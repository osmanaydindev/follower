// Package instagram defines the provider abstraction for reading a user's own
// Instagram social graph. All Instagram access in the app goes through Client so
// the fragile/risky real implementation stays swappable with a mock.
package instagram

import "context"

// User is a single Instagram account as it appears in a follower/following list.
type User struct {
	PK            string `json:"pk"`       // stable numeric id (as string)
	Username      string `json:"username"`
	FullName      string `json:"fullName"`
	IsPrivate     bool   `json:"isPrivate"`
	IsVerified    bool   `json:"isVerified"`
	ProfilePicURL string `json:"profilePicUrl"`
}

// Session is an authenticated handle for a single user. Auth holds an opaque,
// provider-serialized credential blob (never a plaintext password). It is what
// we persist so we can fetch data later without re-login.
type Session struct {
	Username string `json:"username"`
	Auth     string `json:"auth"` // opaque provider state (e.g. serialized IG session)

	// Password is held transiently in server memory ONLY between Login and
	// SubmitChallenge (2FA needs it to complete). json:"-" so it is never
	// serialized to the client or persisted. Cleared once challenge succeeds.
	Password string `json:"-"`
}

// Profile is the cheap, no-pagination summary of the logged-in account (picture
// and follower/following counts), shown on the home screen before any analysis.
type Profile struct {
	Username       string `json:"username"`
	FullName       string `json:"fullName"`
	ProfilePicURL  string `json:"profilePicUrl"`
	FollowersCount int    `json:"followersCount"`
	FollowingCount int    `json:"followingCount"`
	MediaCount     int    `json:"mediaCount"`
	IsPrivate      bool   `json:"isPrivate"`
	IsVerified     bool   `json:"isVerified"`
}

// LoginResult is the outcome of a login attempt. When NeedsChallenge is true the
// caller must collect a verification code from the user and call SubmitChallenge.
// Profile is populated for sessionid logins (cheap, in the same call).
type LoginResult struct {
	Session        *Session
	NeedsChallenge bool
	Profile        *Profile
}

// Client is implemented by each provider (mock, real).
type Client interface {
	// Login authenticates with a username/password. The password must be used
	// transiently and never stored.
	Login(ctx context.Context, username, password string) (*LoginResult, error)

	// LoginBySessionID authenticates with a sessionid cookie captured from a real
	// browser login (the robust path — Instagram does not block it).
	LoginBySessionID(ctx context.Context, sessionID string) (*LoginResult, error)

	// Profile returns the cheap account summary (counts + picture) for a session.
	Profile(ctx context.Context, s *Session) (*Profile, error)

	// SubmitChallenge completes a checkpoint/2FA flow started by Login.
	SubmitChallenge(ctx context.Context, s *Session, code string) (*LoginResult, error)

	// Followers returns accounts that follow the session user.
	Followers(ctx context.Context, s *Session) ([]User, error)

	// Following returns accounts the session user follows.
	Following(ctx context.Context, s *Session) ([]User, error)
}
