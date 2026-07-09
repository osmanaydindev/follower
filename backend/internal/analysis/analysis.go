// Package analysis contains pure follower-diff logic (no I/O), so it stays
// trivially unit-testable and reusable by any transport.
package analysis

import "follower/backend/internal/instagram"

// Result is the computed relationship analysis between a user's followers and
// the accounts they follow.
type Result struct {
	FollowersCount int `json:"followersCount"`
	FollowingCount int `json:"followingCount"`
	MutualsCount   int `json:"mutualsCount"`

	// Full lists, included so the client fetches everything in ONE request and
	// every list view is instant (no re-fetch per screen).
	Followers []instagram.User `json:"followers"`
	Following []instagram.User `json:"following"`

	// Mutuals: accounts we follow each other (intersection).
	Mutuals []instagram.User `json:"mutuals"`

	// NotFollowingBack: accounts I follow that do NOT follow me back
	// (following − followers). This is the headline feature.
	NotFollowingBack []instagram.User `json:"notFollowingBack"`

	// Fans: accounts that follow me that I do NOT follow back
	// (followers − following).
	Fans []instagram.User `json:"fans"`

	// Snapshot comparison (populated by the handler from the stored snapshot):
	// who was following me last time but isn't now, and who's new since then.
	// HasHistory is false on the very first analysis (nothing to compare against).
	HasHistory   bool             `json:"hasHistory"`
	Unfollowed   []instagram.User `json:"unfollowed"`
	NewFollowers []instagram.User `json:"newFollowers"`
}

// Compute derives the relationship analysis from raw follower/following lists.
func Compute(followers, following []instagram.User) Result {
	followerSet := make(map[string]struct{}, len(followers))
	for _, u := range followers {
		followerSet[u.PK] = struct{}{}
	}
	followingSet := make(map[string]struct{}, len(following))
	for _, u := range following {
		followingSet[u.PK] = struct{}{}
	}

	if followers == nil {
		followers = []instagram.User{}
	}
	if following == nil {
		following = []instagram.User{}
	}
	res := Result{
		FollowersCount:   len(followers),
		FollowingCount:   len(following),
		Followers:        followers,
		Following:        following,
		Mutuals:          []instagram.User{},
		NotFollowingBack: []instagram.User{},
		Fans:             []instagram.User{},
		Unfollowed:       []instagram.User{},
		NewFollowers:     []instagram.User{},
	}

	for _, u := range following {
		if _, ok := followerSet[u.PK]; ok {
			res.MutualsCount++
			res.Mutuals = append(res.Mutuals, u)
		} else {
			res.NotFollowingBack = append(res.NotFollowingBack, u)
		}
	}
	for _, u := range followers {
		if _, ok := followingSet[u.PK]; !ok {
			res.Fans = append(res.Fans, u)
		}
	}
	return res
}

// Missing returns the users present in `a` but not in `b` (matched by PK). Used
// for snapshot diffs: unfollowed = Missing(prevFollowers, currentFollowers),
// newFollowers = Missing(currentFollowers, prevFollowers).
func Missing(a, b []instagram.User) []instagram.User {
	bset := make(map[string]struct{}, len(b))
	for _, u := range b {
		bset[u.PK] = struct{}{}
	}
	out := []instagram.User{}
	for _, u := range a {
		if _, ok := bset[u.PK]; !ok {
			out = append(out, u)
		}
	}
	return out
}
