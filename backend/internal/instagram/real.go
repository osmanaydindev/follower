package instagram

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// NewFromEnv selects the provider based on IG_PROVIDER. Default is the mock
// provider so the app runs end-to-end without touching Instagram. Set
// IG_PROVIDER=real to use the private-API client (which talks to the Python
// instagrapi sidecar; see ig-sidecar/).
func NewFromEnv() Client {
	if os.Getenv("IG_PROVIDER") == "real" {
		return NewReal(os.Getenv("IG_SIDECAR_URL"))
	}
	return NewMock()
}

// Real is the private-API provider. It does not speak Instagram's protocol
// itself; it delegates to the instagrapi sidecar over HTTP (see ig-sidecar/),
// because instagrapi is the most mature client for device identity, challenge/2FA
// and session handling.
//
// Session.Auth carries the sidecar's opaque serialized instagrapi settings, so no
// plaintext password is ever stored and data fetches need only that blob.
//
// NOTE: the sidecar cannot be verified against live Instagram in this
// environment; the flow is implemented but should be tested with a throwaway
// account before relying on it.
type Real struct {
	baseURL string
	http    *http.Client
}

func NewReal(baseURL string) *Real {
	if baseURL == "" {
		baseURL = "http://localhost:8000"
	}
	return &Real{
		baseURL: baseURL,
		// Large accounts paginate for a while in the sidecar; give it room.
		http: &http.Client{Timeout: 12 * time.Minute},
	}
}

func (r *Real) Login(ctx context.Context, username, password string) (*LoginResult, error) {
	var out struct {
		Status string `json:"status"`
		Auth   string `json:"auth"`
	}
	if err := r.call(ctx, "/login", map[string]string{
		"username": username, "password": password,
	}, &out); err != nil {
		return nil, err
	}
	return &LoginResult{
		Session:        &Session{Username: username, Auth: out.Auth},
		NeedsChallenge: out.Status == "challenge",
	}, nil
}

func (r *Real) LoginBySessionID(ctx context.Context, sessionID string) (*LoginResult, error) {
	var out struct {
		Auth     string   `json:"auth"`
		Username string   `json:"username"`
		Profile  *Profile `json:"profile"`
	}
	if err := r.call(ctx, "/login_sessionid", map[string]string{"sessionid": sessionID}, &out); err != nil {
		return nil, err
	}
	return &LoginResult{
		Session: &Session{Username: out.Username, Auth: out.Auth},
		Profile: out.Profile,
	}, nil
}

func (r *Real) Profile(ctx context.Context, s *Session) (*Profile, error) {
	var p Profile
	if err := r.call(ctx, "/profile", map[string]string{"auth": s.Auth}, &p); err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Real) SubmitChallenge(ctx context.Context, s *Session, code string) (*LoginResult, error) {
	var out struct {
		Auth string `json:"auth"`
	}
	// The sidecar's /challenge needs the pending auth blob, the code, and — for
	// 2FA — the password to complete the login. s.Password is the transient
	// in-memory value captured at Login; it is never persisted or serialized.
	if err := r.call(ctx, "/challenge", map[string]string{
		"auth": s.Auth, "username": s.Username, "code": code, "password": s.Password,
	}, &out); err != nil {
		return nil, err
	}
	return &LoginResult{Session: &Session{Username: s.Username, Auth: out.Auth}}, nil
}

func (r *Real) Followers(ctx context.Context, s *Session) ([]User, error) {
	return r.fetch(ctx, "/followers", s)
}

func (r *Real) Following(ctx context.Context, s *Session) ([]User, error) {
	return r.fetch(ctx, "/following", s)
}

func (r *Real) fetch(ctx context.Context, path string, s *Session) ([]User, error) {
	var users []User
	if err := r.call(ctx, path, map[string]string{"auth": s.Auth}, &users); err != nil {
		return nil, err
	}
	return users, nil
}

// call POSTs a JSON body to the sidecar and decodes the JSON response into dst.
// Non-2xx responses are surfaced with the sidecar's error message.
func (r *Real) call(ctx context.Context, path string, body any, dst any) error {
	buf, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, r.baseURL+path, bytes.NewReader(buf))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := r.http.Do(req)
	if err != nil {
		return fmt.Errorf("instagram sidecar unreachable: %w", err)
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var e struct {
			Detail string `json:"detail"`
		}
		if json.Unmarshal(data, &e) == nil && e.Detail != "" {
			return fmt.Errorf("%s", e.Detail)
		}
		return fmt.Errorf("sidecar %s: status %d", path, resp.StatusCode)
	}
	if dst == nil {
		return nil
	}
	return json.Unmarshal(data, dst)
}
