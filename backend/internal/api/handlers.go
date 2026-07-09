// Package api wires the HTTP transport: routing, CORS, and request/response
// shapes on top of the instagram provider, session store, and analysis logic.
package api

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"sync"
	"time"

	"follower/backend/internal/analysis"
	"follower/backend/internal/instagram"
	"follower/backend/internal/session"
	"follower/backend/internal/snapshot"
)

type Server struct {
	ig       instagram.Client
	sessions *session.Store
	snaps    *snapshot.Store
}

func NewServer(ig instagram.Client) *Server {
	dir := os.Getenv("SNAPSHOT_DIR")
	if dir == "" {
		dir = "snapshots"
	}
	return &Server{ig: ig, sessions: session.NewStore(), snaps: snapshot.NewStore(dir)}
}

// Handler returns the fully-routed http.Handler (with CORS applied).
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.health)
	mux.HandleFunc("POST /api/login", s.login)
	mux.HandleFunc("POST /api/login_sessionid", s.loginSessionID)
	mux.HandleFunc("POST /api/challenge", s.challenge)
	mux.HandleFunc("GET /api/profile", s.profile)
	mux.HandleFunc("GET /api/analysis", s.analysis)
	mux.HandleFunc("GET /api/followers", s.followers)
	mux.HandleFunc("GET /api/following", s.following)
	mux.HandleFunc("GET /api/profile-viewers", s.profileViewers)
	return withCORS(mux)
}

// ---- handlers ----

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type loginReq struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if !decode(w, r, &req) {
		return
	}
	if req.Username == "" || req.Password == "" {
		writeErr(w, http.StatusBadRequest, "username and password are required")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	res, err := s.ig.Login(ctx, req.Username, req.Password)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, err.Error())
		return
	}
	// A challenge (2FA) needs the password again to complete. Keep it in the
	// in-memory session only until the challenge succeeds; it is never serialized.
	if res.NeedsChallenge {
		res.Session.Password = req.Password
	}
	id := s.sessions.Put(&session.Entry{Session: res.Session, Pending: res.NeedsChallenge})
	writeJSON(w, http.StatusOK, map[string]any{
		"sessionId": id,
		"challenge": res.NeedsChallenge,
		"username":  res.Session.Username,
	})
}

type sessionIDReq struct {
	SessionID string `json:"sessionid"`
}

// loginSessionID authenticates with a sessionid cookie captured from the in-app
// browser login (the robust path that Instagram does not block).
func (s *Server) loginSessionID(w http.ResponseWriter, r *http.Request) {
	var req sessionIDReq
	if !decode(w, r, &req) {
		return
	}
	if req.SessionID == "" {
		writeErr(w, http.StatusBadRequest, "sessionid is required")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	res, err := s.ig.LoginBySessionID(ctx, req.SessionID)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, err.Error())
		return
	}
	id := s.sessions.Put(&session.Entry{Session: res.Session, Pending: false})
	writeJSON(w, http.StatusOK, map[string]any{
		"sessionId": id,
		"username":  res.Session.Username,
		"profile":   res.Profile,
	})
}

// profile returns the cheap account summary (counts + picture) for a session.
func (s *Server) profile(w http.ResponseWriter, r *http.Request) {
	entry, ok := s.authed(w, r)
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	p, err := s.ig.Profile(ctx, entry.Session)
	if err != nil {
		writeErr(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, p)
}

type challengeReq struct {
	SessionID string `json:"sessionId"`
	Code      string `json:"code"`
}

func (s *Server) challenge(w http.ResponseWriter, r *http.Request) {
	var req challengeReq
	if !decode(w, r, &req) {
		return
	}
	entry, ok := s.sessions.Get(req.SessionID)
	if !ok {
		writeErr(w, http.StatusNotFound, "unknown session")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	res, err := s.ig.SubmitChallenge(ctx, entry.Session, req.Code)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, err.Error())
		return
	}
	s.sessions.Update(req.SessionID, &session.Entry{Session: res.Session, Pending: false})
	writeJSON(w, http.StatusOK, map[string]any{
		"sessionId": req.SessionID,
		"username":  res.Session.Username,
	})
}

func (s *Server) analysis(w http.ResponseWriter, r *http.Request) {
	entry, ok := s.authed(w, r)
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Minute)
	defer cancel()

	// Fetch followers and following in PARALLEL (the sidecar uses an independent
	// client per request), roughly halving the wait for large accounts.
	var followers, following []instagram.User
	var fErr, gErr error
	var wg sync.WaitGroup
	wg.Add(2)
	go func() { defer wg.Done(); followers, fErr = s.ig.Followers(ctx, entry.Session) }()
	go func() { defer wg.Done(); following, gErr = s.ig.Following(ctx, entry.Session) }()
	wg.Wait()
	if fErr != nil {
		writeErr(w, http.StatusBadGateway, fErr.Error())
		return
	}
	if gErr != nil {
		writeErr(w, http.StatusBadGateway, gErr.Error())
		return
	}

	res := analysis.Compute(followers, following)

	// Compare against the previous follower snapshot: who unfollowed and who's new.
	username := entry.Session.Username
	if prev, ok := s.snaps.Load(username); ok {
		res.HasHistory = true
		res.Unfollowed = analysis.Missing(prev.Followers, followers)
		res.NewFollowers = analysis.Missing(followers, prev.Followers)
	}
	s.snaps.Save(username, followers)

	writeJSON(w, http.StatusOK, res)
}

func (s *Server) followers(w http.ResponseWriter, r *http.Request) {
	s.list(w, r, s.ig.Followers)
}

func (s *Server) following(w http.ResponseWriter, r *http.Request) {
	s.list(w, r, s.ig.Following)
}

func (s *Server) list(w http.ResponseWriter, r *http.Request,
	fn func(context.Context, *instagram.Session) ([]instagram.User, error)) {
	entry, ok := s.authed(w, r)
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Minute)
	defer cancel()

	users, err := fn(ctx, entry.Session)
	if err != nil {
		writeErr(w, http.StatusBadGateway, err.Error())
		return
	}
	if users == nil {
		users = []instagram.User{}
	}
	writeJSON(w, http.StatusOK, users)
}

// profileViewers is an intentionally honest endpoint: this data does not exist.
func (s *Server) profileViewers(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"available": false,
		"reason": "Instagram, profilinize kimin baktığını hiçbir yerde paylaşmaz — " +
			"ne resmi API'de, ne veri indirmede, ne de gizli API'de. Bunu " +
			"yapabildiğini iddia eden uygulamalar doğru söylemiyor.",
	})
}

// ---- helpers ----

// authed resolves the sessionId query param to a usable (non-pending) session.
func (s *Server) authed(w http.ResponseWriter, r *http.Request) (*session.Entry, bool) {
	id := r.URL.Query().Get("sessionId")
	if id == "" {
		writeErr(w, http.StatusBadRequest, "sessionId is required")
		return nil, false
	}
	entry, ok := s.sessions.Get(id)
	if !ok {
		writeErr(w, http.StatusUnauthorized, "unknown or expired session")
		return nil, false
	}
	if entry.Pending {
		writeErr(w, http.StatusForbidden, "session needs challenge verification")
		return nil, false
	}
	return entry, true
}

func decode(w http.ResponseWriter, r *http.Request, dst any) bool {
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
