// Package session holds authenticated Instagram sessions server-side, keyed by an
// opaque session id handed to the client.
//
// The store is backed by a file so a server restart does not sign everybody out —
// otherwise every `go run` during development forces a fresh Instagram login,
// which is exactly the repeated-login pattern that gets an account throttled.
// Swap for Redis/DB later without changing callers.
package session

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"

	"follower/backend/internal/instagram"
)

// Sessions older than this are dropped on load. Instagram's own sessions outlive
// this comfortably; it just keeps the file from growing forever.
const ttl = 60 * 24 * time.Hour

// Entry is a stored session. Pending marks a login that still needs a challenge
// code before it can be used for data fetches.
type Entry struct {
	Session *instagram.Session
	Pending bool
}

// record is the on-disk shape. Pending entries are never written: they are
// mid-challenge and only meaningful to the process that started them. The
// password on instagram.Session is json:"-", so it cannot reach the file either.
type record struct {
	Username  string `json:"username"`
	Auth      string `json:"auth"`
	CreatedAt int64  `json:"createdAt"`
}

type Store struct {
	mu      sync.RWMutex
	items   map[string]*Entry
	created map[string]int64
	path    string // empty → memory only
}

// NewStore loads any previously persisted sessions from dir. An empty dir (or an
// unwritable one) degrades to an in-memory store rather than failing to start.
func NewStore(dir string) *Store {
	s := &Store{items: map[string]*Entry{}, created: map[string]int64{}}
	if dir == "" {
		return s
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return s
	}
	s.path = filepath.Join(dir, "sessions.json")
	s.load()
	return s
}

// Put stores an entry and returns its new session id.
func (s *Store) Put(e *Entry) string {
	id := newID()
	s.mu.Lock()
	defer s.mu.Unlock()
	// One live session per account: a fresh login replaces the previous handle
	// instead of piling up.
	if e.Session != nil && e.Session.Username != "" {
		for old, prev := range s.items {
			if prev.Session != nil && prev.Session.Username == e.Session.Username {
				delete(s.items, old)
				delete(s.created, old)
			}
		}
	}
	s.items[id] = e
	s.created[id] = time.Now().Unix()
	s.save()
	return id
}

// Update replaces the entry for an existing id (e.g. after a challenge succeeds).
func (s *Store) Update(id string, e *Entry) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.items[id] = e
	if _, ok := s.created[id]; !ok {
		s.created[id] = time.Now().Unix()
	}
	s.save()
}

// Get returns the entry for id, or (nil, false) if unknown.
func (s *Store) Get(id string) (*Entry, bool) {
	s.mu.RLock()
	e, ok := s.items[id]
	s.mu.RUnlock()
	return e, ok
}

// Delete removes a session (used on logout).
func (s *Store) Delete(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.items, id)
	delete(s.created, id)
	s.save()
}

// load reads the persisted sessions, skipping expired ones. Called once at
// construction, before the store is shared.
func (s *Store) load() {
	data, err := os.ReadFile(s.path)
	if err != nil {
		return
	}
	var recs map[string]record
	if json.Unmarshal(data, &recs) != nil {
		return
	}
	cutoff := time.Now().Add(-ttl).Unix()
	for id, r := range recs {
		if r.CreatedAt < cutoff {
			continue
		}
		s.items[id] = &Entry{Session: &instagram.Session{Username: r.Username, Auth: r.Auth}}
		s.created[id] = r.CreatedAt
	}
}

// save writes the usable sessions to disk. Callers hold the write lock.
func (s *Store) save() {
	if s.path == "" {
		return
	}
	recs := make(map[string]record, len(s.items))
	for id, e := range s.items {
		if e.Pending || e.Session == nil {
			continue
		}
		recs[id] = record{
			Username:  e.Session.Username,
			Auth:      e.Session.Auth,
			CreatedAt: s.created[id],
		}
	}
	data, err := json.Marshal(recs)
	if err != nil {
		return
	}
	// 0600: the auth blob is an Instagram credential.
	_ = os.WriteFile(s.path, data, 0o600)
}

func newID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
