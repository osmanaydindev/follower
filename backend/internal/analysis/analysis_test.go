package analysis

import "testing"

import "follower/backend/internal/instagram"

func u(pk string) instagram.User { return instagram.User{PK: pk, Username: "u" + pk} }

func TestCompute(t *testing.T) {
	// I follow: 1,2,3,4 ; My followers: 3,4,5,6
	// mutuals = 3,4 ; notFollowingBack = 1,2 ; fans = 5,6
	following := []instagram.User{u("1"), u("2"), u("3"), u("4")}
	followers := []instagram.User{u("3"), u("4"), u("5"), u("6")}

	res := Compute(followers, following)

	if res.FollowersCount != 4 || res.FollowingCount != 4 {
		t.Fatalf("counts wrong: %+v", res)
	}
	if res.MutualsCount != 2 {
		t.Errorf("mutuals = %d, want 2", res.MutualsCount)
	}
	if got := pks(res.NotFollowingBack); !equal(got, []string{"1", "2"}) {
		t.Errorf("notFollowingBack = %v, want [1 2]", got)
	}
	if got := pks(res.Fans); !equal(got, []string{"5", "6"}) {
		t.Errorf("fans = %v, want [5 6]", got)
	}
}

func TestComputeEmpty(t *testing.T) {
	res := Compute(nil, nil)
	if res.NotFollowingBack == nil || res.Fans == nil {
		t.Fatal("slices must be non-nil so JSON encodes [] not null")
	}
	if len(res.NotFollowingBack) != 0 || len(res.Fans) != 0 {
		t.Fatalf("expected empty results, got %+v", res)
	}
}

func pks(us []instagram.User) []string {
	out := make([]string, len(us))
	for i, x := range us {
		out[i] = x.PK
	}
	return out
}

func equal(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	seen := map[string]int{}
	for _, x := range a {
		seen[x]++
	}
	for _, x := range b {
		seen[x]--
	}
	for _, v := range seen {
		if v != 0 {
			return false
		}
	}
	return true
}
