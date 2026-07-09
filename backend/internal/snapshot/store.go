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

// Save replaces the snapshot for username with the current followers.
func (s *Store) Save(username string, followers []instagram.User) {
	s.mu.Lock()
	defer s.mu.Unlock()
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
