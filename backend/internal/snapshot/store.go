// Package snapshot persists a per-account follower snapshot so each analysis can
// compare against the previous one and report who unfollowed / newly followed.
// File-based for now; swap for a DB later without changing callers.
package snapshot

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"follower/backend/internal/instagram"
)

type Snapshot struct {
	Username  string           `json:"username"`
	Timestamp int64            `json:"timestamp"`
	Followers []instagram.User `json:"followers"`
}

type Store struct {
	dir string
	mu  sync.Mutex
}

func NewStore(dir string) *Store {
	_ = os.MkdirAll(dir, 0o755)
	return &Store{dir: dir}
}

// Load returns the previous snapshot for username, or (nil, false) if none.
func (s *Store) Load(username string) (*Snapshot, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.load(username)
}

// Save replaces the snapshot for username with the current followers.
func (s *Store) Save(username string, followers []instagram.User) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.save(username, followers)
}

// Forget drops pk from the stored snapshot. Called when the user removes a
// follower themselves, so the next analysis doesn't report that account under
// "unfollowed you" — the user is the one who ended it.
func (s *Store) Forget(username, pk string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	snap, ok := s.load(username)
	if !ok {
		return
	}
	kept := make([]instagram.User, 0, len(snap.Followers))
	for _, u := range snap.Followers {
		if u.PK != pk {
			kept = append(kept, u)
		}
	}
	if len(kept) != len(snap.Followers) {
		s.save(username, kept)
	}
}

// load/save are the unlocked bodies; callers hold s.mu.
func (s *Store) load(username string) (*Snapshot, bool) {
	data, err := os.ReadFile(s.path(username))
	if err != nil {
		return nil, false
	}
	var snap Snapshot
	if json.Unmarshal(data, &snap) != nil {
		return nil, false
	}
	return &snap, true
}

func (s *Store) save(username string, followers []instagram.User) {
	data, err := json.Marshal(Snapshot{
		Username:  username,
		Timestamp: time.Now().Unix(),
		Followers: followers,
	})
	if err != nil {
		return
	}
	_ = os.WriteFile(s.path(username), data, 0o600)
}

func (s *Store) path(username string) string {
	return filepath.Join(s.dir, sanitize(username)+".json")
}

func sanitize(username string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(username) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '.' || r == '_' || r == '-' {
			b.WriteRune(r)
		}
	}
	if b.Len() == 0 {
		return "unknown"
	}
	return b.String()
}
