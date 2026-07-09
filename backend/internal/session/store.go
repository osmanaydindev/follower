// Package session holds authenticated Instagram sessions server-side, keyed by an
// opaque session id handed to the client. In-memory for now; swap for Redis/DB
// later without changing callers.
package session

import (
	"crypto/rand"
	"encoding/hex"
	"sync"

	"follower/backend/internal/instagram"
)

// Entry is a stored session. Pending marks a login that still needs a challenge
// code before it can be used for data fetches.
type Entry struct {
	Session *instagram.Session
	Pending bool
}

type Store struct {
	mu    sync.RWMutex
	items map[string]*Entry
}

func NewStore() *Store {
	return &Store{items: make(map[string]*Entry)}
}

// Put stores an entry and returns its new session id.
func (s *Store) Put(e *Entry) string {
	id := newID()
	s.mu.Lock()
	s.items[id] = e
	s.mu.Unlock()
	return id
}

// Update replaces the entry for an existing id (e.g. after a challenge succeeds).
func (s *Store) Update(id string, e *Entry) {
	s.mu.Lock()
	s.items[id] = e
	s.mu.Unlock()
}

// Get returns the entry for id, or (nil, false) if unknown.
func (s *Store) Get(id string) (*Entry, bool) {
	s.mu.RLock()
	e, ok := s.items[id]
	s.mu.RUnlock()
	return e, ok
}

func newID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
