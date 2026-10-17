package instagram

import (
	"context"
	"fmt"
	"hash/fnv"
	"math/rand"
	"strconv"
	"sync"
)

// Mock is a deterministic fake provider. Given a username it always returns the
// same generated followers/following lists, with a realistic overlap so the diff
// features (not-following-back / fans) have meaningful data. It never touches the
// network, so the whole app can be built and tested against it.
//
// Unfollow/RemoveFollower are remembered in memory (per username) and filtered
// out of subsequent Following/Followers calls, so a re-analysis after an action
// reflects it — the mock stays a faithful stand-in for the real provider.
type Mock struct {
	mu       sync.Mutex
	dropped  map[string]map[string]struct{} // username → unfollowed pks
	detached map[string]map[string]struct{} // username → removed follower pks
}

func NewMock() *Mock {
	return &Mock{
		dropped:  map[string]map[string]struct{}{},
		detached: map[string]map[string]struct{}{},
	}
}

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

func (m *Mock) LoginBySessionID(_ context.Context, w WebLogin) (*LoginResult, error) {
	if w.SessionID == "" {
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
	return m.without(m.slice(s.Username, 0, 80, 60), m.detached, s.Username), nil
}

func (m *Mock) Following(_ context.Context, s *Session) ([]User, error) {
	// Following: 50 accounts drawn from id range [40, 120). Overlap with the
	// follower range [40,80) creates mutuals; the rest are non-followers/fans.
	return m.without(m.slice(s.Username, 40, 120, 50), m.dropped, s.Username), nil
}

// UserDetail fabricates stable counts from the pk so the list rows have
// plausible, non-repeating numbers.
func (m *Mock) UserDetail(_ context.Context, _ *Session, pk string) (*UserDetail, error) {
	id, err := strconv.Atoi(pk)
	if err != nil {
		return nil, fmt.Errorf("invalid pk %q", pk)
	}
	u := mockUser(id - 100000)
	r := rand.New(rand.NewSource(int64(id)))
	return &UserDetail{
		PK:             u.PK,
		Username:       u.Username,
		FullName:       u.FullName,
		ProfilePicURL:  u.ProfilePicURL,
		FollowersCount: 50 + r.Intn(9500),
		FollowingCount: 40 + r.Intn(2200),
		MediaCount:     r.Intn(420),
		IsPrivate:      u.IsPrivate,
		IsVerified:     u.IsVerified,
	}, nil
}

func (m *Mock) Unfollow(_ context.Context, s *Session, pk string) error {
	m.remember(m.dropped, s.Username, pk)
	return nil
}

func (m *Mock) RemoveFollower(_ context.Context, s *Session, pk string) error {
	m.remember(m.detached, s.Username, pk)
	return nil
}

func (m *Mock) remember(set map[string]map[string]struct{}, username, pk string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if set[username] == nil {
		set[username] = map[string]struct{}{}
	}
	set[username][pk] = struct{}{}
}

func (m *Mock) without(users []User, set map[string]map[string]struct{}, username string) []User {
	m.mu.Lock()
	defer m.mu.Unlock()
	gone := set[username]
	if len(gone) == 0 {
		return users
	}
	out := make([]User, 0, len(users))
	for _, u := range users {
		if _, ok := gone[u.PK]; !ok {
			out = append(out, u)
		}
	}
	return out
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
