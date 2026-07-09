package instagram

import (
	"context"
	"fmt"
	"hash/fnv"
	"math/rand"
)

// Mock is a deterministic fake provider. Given a username it always returns the
// same generated followers/following lists, with a realistic overlap so the diff
// features (not-following-back / fans) have meaningful data. It never touches the
// network, so the whole app can be built and tested against it.
type Mock struct{}

func NewMock() *Mock { return &Mock{} }

func (m *Mock) Login(_ context.Context, username, password string) (*LoginResult, error) {
	if username == "" || password == "" {
		return nil, fmt.Errorf("username and password required")
	}
	// Username "challenge" simulates a checkpoint so the mobile flow is testable.
	if username == "challenge" {
		return &LoginResult{
			Session:        &Session{Username: username, Auth: "pending-challenge"},
			NeedsChallenge: true,
		}, nil
	}
	return &LoginResult{Session: &Session{Username: username, Auth: "mock:" + username}}, nil
}

func (m *Mock) LoginBySessionID(_ context.Context, sessionID string) (*LoginResult, error) {
	if sessionID == "" {
		return nil, fmt.Errorf("sessionid required")
	}
	// Deterministic mock account so the diff features have data.
	s := &Session{Username: "sessionid_user", Auth: "mock:sessionid_user"}
	return &LoginResult{Session: s, Profile: m.profile(s.Username)}, nil
}

func (m *Mock) Profile(_ context.Context, s *Session) (*Profile, error) {
	return m.profile(s.Username), nil
}

// profile returns a stable mock profile. Counts match the mock follower/following
// slices (60/50) so the UI is internally consistent.
func (m *Mock) profile(username string) *Profile {
	return &Profile{
		Username:       username,
		FullName:       "Test Kullanıcı",
		ProfilePicURL:  "https://i.pravatar.cc/300?img=12",
		FollowersCount: 60,
		FollowingCount: 50,
		MediaCount:     42,
		IsVerified:     true,
	}
}

func (m *Mock) SubmitChallenge(_ context.Context, s *Session, code string) (*LoginResult, error) {
	if code == "" {
		return nil, fmt.Errorf("verification code required")
	}
	return &LoginResult{Session: &Session{Username: s.Username, Auth: "mock:" + s.Username}}, nil
}

func (m *Mock) Followers(_ context.Context, s *Session) ([]User, error) {
	// Followers: 60 accounts drawn from id range [0, 80).
	return m.slice(s.Username, 0, 80, 60), nil
}

func (m *Mock) Following(_ context.Context, s *Session) ([]User, error) {
	// Following: 50 accounts drawn from id range [40, 120). Overlap with the
	// follower range [40,80) creates mutuals; the rest are non-followers/fans.
	return m.slice(s.Username, 40, 120, 50), nil
}

// slice deterministically picks `count` distinct users whose ids fall in
// [lo, hi), seeded by the username so results are stable per account.
func (m *Mock) slice(username string, lo, hi, count int) []User {
	seed := int64(hashString(username))
	r := rand.New(rand.NewSource(seed + int64(lo)))
	ids := make([]int, 0, hi-lo)
	for i := lo; i < hi; i++ {
		ids = append(ids, i)
	}
	r.Shuffle(len(ids), func(i, j int) { ids[i], ids[j] = ids[j], ids[i] })
	if count > len(ids) {
		count = len(ids)
	}
	users := make([]User, 0, count)
	for _, id := range ids[:count] {
		users = append(users, mockUser(id))
	}
	return users
}

func mockUser(id int) User {
	return User{
		PK:            fmt.Sprintf("%d", 100000+id),
		Username:      fmt.Sprintf("user_%03d", id),
		FullName:      fmt.Sprintf("Test User %03d", id),
		IsPrivate:     id%3 == 0,
		IsVerified:    id%17 == 0,
		ProfilePicURL: fmt.Sprintf("https://i.pravatar.cc/150?img=%d", id%70),
	}
}

func hashString(s string) uint32 {
	h := fnv.New32a()
	_, _ = h.Write([]byte(s))
	return h.Sum32()
}
