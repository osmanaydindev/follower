// Package api wires the HTTP transport: routing, CORS, and request/response
// shapes on top of the instagram provider, session store, and analysis logic.
package api

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"strings"
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
	snapDir := os.Getenv("SNAPSHOT_DIR")
	if snapDir == "" {
		snapDir = "snapshots"
	}
	// Sessions persist across restarts so development rebuilds don't force a new
	// Instagram login every time (repeated logins are what get accounts throttled).
	sessDir := os.Getenv("SESSION_DIR")
	if sessDir == "" {
		sessDir = "sessions"
	}
	return &Server{
		ig:       ig,
		sessions: session.NewStore(sessDir),
		snaps:    snapshot.NewStore(snapDir),
	}
}

// Handler returns the fully-routed http.Handler (with CORS applied).
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.health)
	mux.HandleFunc("POST /api/login", s.login)
	mux.HandleFunc("POST /api/login_sessionid", s.loginSessionID)
	mux.HandleFunc("POST /api/challenge", s.challenge)
	mux.HandleFunc("POST /api/logout", s.logout)
	mux.HandleFunc("GET /api/profile", s.profile)
	mux.HandleFunc("GET /api/analysis", s.analysis)
	mux.HandleFunc("GET /api/last-analysis", s.lastAnalysis)
	mux.HandleFunc("POST /api/collect-session", s.collectSession)
	mux.HandleFunc("POST /api/ingest", s.ingest)
	mux.HandleFunc("GET /api/followers", s.followers)
	mux.HandleFunc("GET /api/following", s.following)
	mux.HandleFunc("GET /api/user-detail", s.userDetail)
	mux.HandleFunc("POST /api/unfollow", s.unfollow)
	mux.HandleFunc("POST /api/remove-follower", s.removeFollower)
	mux.HandleFunc("POST /api/snapshot-forget", s.snapshotForget)
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
		writeErr(w, instagram.StatusFor(err, http.StatusUnauthorized), err.Error())
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
	SessionID string            `json:"sessionid"`
	Cookies   map[string]string `json:"cookies"`
	UserAgent string            `json:"userAgent"`
	// Optional: the profile the app read inside the WebView, which lets the
	// provider skip its own Instagram call entirely.
	Profile *instagram.Profile `json:"profile"`
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

	res, err := s.ig.LoginBySessionID(ctx, instagram.WebLogin{
		SessionID: req.SessionID,
		Cookies:   req.Cookies,
		UserAgent: req.UserAgent,
		Profile:   req.Profile,
	})
	if err != nil {
		writeErr(w, instagram.StatusFor(err, http.StatusUnauthorized), err.Error())
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
		writeErr(w, instagram.StatusFor(err, http.StatusBadGateway), err.Error())
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
		writeErr(w, instagram.StatusFor(err, http.StatusUnauthorized), err.Error())
		return
	}
	s.sessions.Update(req.SessionID, &session.Entry{Session: res.Session, Pending: false})
	writeJSON(w, http.StatusOK, map[string]any{
		"sessionId": req.SessionID,
		"username":  res.Session.Username,
	})
}

// logout forgets the session server-side. Sessions now outlive restarts, so
// signing out has to actually delete one rather than wait for a process exit.
func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SessionID string `json:"sessionId"`
	}
	if !decode(w, r, &req) {
		return
	}
	s.sessions.Delete(req.SessionID)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) analysis(w http.ResponseWriter, r *http.Request) {
	entry, ok := s.authed(w, r)
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Minute)
	defer cancel()

	// SEQUENTIAL on purpose. These two used to run in parallel to halve the wait,
	// but that means one account paginating two lists at the same time — traffic no
	// human produces, and a reliable way to get flagged. The second fetch also gets
	// to stop early if the first one comes back throttled.
	followers, err := s.ig.Followers(ctx, entry.Session)
	if err != nil {
		writeErr(w, instagram.StatusFor(err, http.StatusBadGateway), err.Error())
		return
	}
	following, err := s.ig.Following(ctx, entry.Session)
	if err != nil {
		writeErr(w, instagram.StatusFor(err, http.StatusBadGateway), err.Error())
		return
	}

	writeJSON(w, http.StatusOK, s.diffAndStore(entry.Session.Username, followers, following))
}

// diffAndStore runs the pure analysis, layers the snapshot comparison on top
// (who unfollowed, who is new), and stores the fresh follower list.
//
// Shared by the two ways the lists can arrive: fetched server-side through the
// provider (/api/analysis) or collected by the app's own Instagram browser and
// handed to us (/api/ingest). Everything downstream of the fetch is identical,
// so it must not be duplicated per transport.
func (s *Server) diffAndStore(username string, followers, following []instagram.User) analysis.Result {
	res := analysis.Compute(followers, following)
	if prev, ok := s.snaps.Load(username); ok {
		res.HasHistory = true
		res.Unfollowed = analysis.Missing(prev.Followers, followers)
		res.NewFollowers = analysis.Missing(followers, prev.Followers)
	}
	s.snaps.Save(username, followers)
	// Keep the result itself too: relaunching the app must not cost another
	// collection just to see the numbers that were on screen a minute ago.
	s.snaps.SaveResult(username, res)
	return res
}

// lastAnalysis replays the stored result of the previous analysis. It makes no
// Instagram request at all — it exists so an app restart is free.
func (s *Server) lastAnalysis(w http.ResponseWriter, r *http.Request) {
	entry, ok := s.entryFor(w, r.URL.Query().Get("sessionId"))
	if !ok {
		return
	}
	last, ok := s.snaps.LoadResult(entry.Session.Username)
	if !ok {
		writeErr(w, http.StatusNotFound, "kayıtlı analiz yok")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"analysis":  last.Result,
		"updatedAt": last.Timestamp,
	})
}

type ingestReq struct {
	SessionID string           `json:"sessionId"`
	Followers []instagram.User `json:"followers"`
	Following []instagram.User `json:"following"`
}

// ingest accepts follower/following lists the app collected itself, inside the
// WebView that is already logged into Instagram, and returns the same analysis
// /api/analysis would have.
//
// Why this exists: Instagram binds a session to the browser that created it, and
// every mismatch — User-Agent, TLS fingerprint, exit IP — reads as a stolen
// cookie and earns "please wait a few minutes". A fetch issued by the page
// itself has no mismatch to find. The server never sees Instagram here; it only
// diffs and stores.
// snapshotForget drops pk from the stored follower snapshot after the app
// removed that follower itself, in its own browser. /api/remove-follower does
// this as part of the call it makes to Instagram; when the app does the removing
// there is no such call, but the snapshot still has to be corrected — otherwise
// the next analysis reports them under "unfollowed you", and the user is the one
// who ended it.
func (s *Server) snapshotForget(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SessionID string `json:"sessionId"`
		PK        string `json:"pk"`
	}
	if !decode(w, r, &req) {
		return
	}
	entry, ok := s.entryFor(w, req.SessionID)
	if !ok {
		return
	}
	if req.PK == "" {
		writeErr(w, http.StatusBadRequest, "pk is required")
		return
	}
	s.snaps.Forget(entry.Session.Username, req.PK)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

type collectSessionReq struct {
	Username string `json:"username"`
}

// collectSession opens a session that holds no Instagram credentials.
//
// It exists for the browser-collector path: the lists are paginated by the
// user's own signed-in browser and arrive through /api/ingest, so the server
// never needs to authenticate against Instagram at all. All a session has to
// carry here is the account name, which is the key the follower snapshot is
// stored under.
//
// Session.Auth stays empty on purpose. Every endpoint that would actually call
// Instagram goes through the provider with that blob and will fail — which is
// correct: on this path those endpoints have no business working.
func (s *Server) collectSession(w http.ResponseWriter, r *http.Request) {
	var req collectSessionReq
	if !decode(w, r, &req) {
		return
	}
	username := strings.TrimSpace(req.Username)
	if username == "" {
		writeErr(w, http.StatusBadRequest, "username is required")
		return
	}
	id := s.sessions.Put(&session.Entry{Session: &instagram.Session{Username: username}})
	writeJSON(w, http.StatusOK, map[string]any{"sessionId": id, "username": username})
}

func (s *Server) ingest(w http.ResponseWriter, r *http.Request) {
	var req ingestReq
	if !decode(w, r, &req) {
		return
	}
	entry, ok := s.entryFor(w, req.SessionID)
	if !ok {
		return
	}
	// A collection that returned nothing is a failed collection, not an account
	// with no followers — storing it would wipe the snapshot and report everyone
	// as having unfollowed on the next run.
	if len(req.Followers) == 0 && len(req.Following) == 0 {
		writeErr(w, http.StatusBadRequest, "bos liste kaydedilmez")
		return
	}
	writeJSON(w, http.StatusOK, s.diffAndStore(entry.Session.Username, req.Followers, req.Following))
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
		writeErr(w, instagram.StatusFor(err, http.StatusBadGateway), err.Error())
		return
	}
	if users == nil {
		users = []instagram.User{}
	}
	writeJSON(w, http.StatusOK, users)
}

// userDetail returns one other account's counts and a freshly-signed picture URL.
// The client asks for this per visible row (never for a whole list at once) —
// each call is a private-API request and we protect the user's account.
func (s *Server) userDetail(w http.ResponseWriter, r *http.Request) {
	entry, ok := s.authed(w, r)
	if !ok {
		return
	}
	pk := r.URL.Query().Get("pk")
	if pk == "" {
		writeErr(w, http.StatusBadRequest, "pk is required")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	d, err := s.ig.UserDetail(ctx, entry.Session, pk)
	if err != nil {
		writeErr(w, instagram.StatusFor(err, http.StatusBadGateway), err.Error())
		return
	}
	writeJSON(w, http.StatusOK, d)
}

type actionReq struct {
	SessionID string `json:"sessionId"`
	PK        string `json:"pk"`
}

// unfollow stops the session user from following pk.
func (s *Server) unfollow(w http.ResponseWriter, r *http.Request) {
	s.act(w, r, func(ctx context.Context, e *session.Entry, pk string) error {
		return s.ig.Unfollow(ctx, e.Session, pk)
	})
}

// removeFollower removes pk from the session user's followers.
func (s *Server) removeFollower(w http.ResponseWriter, r *http.Request) {
	s.act(w, r, func(ctx context.Context, e *session.Entry, pk string) error {
		if err := s.ig.RemoveFollower(ctx, e.Session, pk); err != nil {
			return err
		}
		// The user ended this themselves, so keep the next analysis from listing
		// them as someone who unfollowed.
		s.snaps.Forget(e.Session.Username, pk)
		return nil
	})
}

// act runs a {sessionId, pk} relationship action, taking the session from the
// BODY (these are POSTs, unlike the read endpoints which use a query param).
func (s *Server) act(w http.ResponseWriter, r *http.Request,
	fn func(context.Context, *session.Entry, string) error) {
	var req actionReq
	if !decode(w, r, &req) {
		return
	}
	if req.PK == "" {
		writeErr(w, http.StatusBadRequest, "pk is required")
		return
	}
	entry, ok := s.sessions.Get(req.SessionID)
	if !ok {
		writeErr(w, http.StatusUnauthorized, "unknown or expired session")
		return
	}
	if entry.Pending {
		writeErr(w, http.StatusForbidden, "session needs challenge verification")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	if err := fn(ctx, entry, req.PK); err != nil {
		writeErr(w, instagram.StatusFor(err, http.StatusBadGateway), err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
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
	return s.entryFor(w, r.URL.Query().Get("sessionId"))
}

// entryFor resolves a session id to its entry. Split out of authed because the
// POST endpoints carry the id in the JSON body, not the query string.
func (s *Server) entryFor(w http.ResponseWriter, id string) (*session.Entry, bool) {
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
