import type { CollectPhase } from './collector';

// The state of a running collection, owned by App and read by two screens: the
// dedicated progress screen and the dashboard's banner. It lives here rather
// than in either screen because the collection outlives both.

export type CollectionState = {
  phase: CollectPhase;
  followers: number;
  following: number;
  // Rough targets from the cached profile, so progress reads "412 / 922"
  // instead of a number climbing towards nothing.
  expectedFollowers?: number;
  expectedFollowing?: number;
  // Lists are in; the backend is diffing them.
  saving: boolean;
};

// A failed collection ends it: App clears this state and shows the message on
// the dashboard, next to the retry button. There is no "running but broken".

export const PHASE_LABEL: Record<CollectPhase, string> = {
  followers: 'Takipçiler',
  following: 'Takip edilenler',
};

export function newCollection(
  expectedFollowers?: number,
  expectedFollowing?: number,
): CollectionState {
  return {
    phase: 'followers',
    followers: 0,
    following: 0,
    expectedFollowers,
    expectedFollowing,
    saving: false,
  };
}

// Progress for the phase currently running. The two lists are fetched
// sequentially, so showing one bar at a time is honest; `pct` is null when we
// have no target to measure against.
export function collectionProgress(s: CollectionState): {
  done: number;
  target?: number;
  pct: number | null;
} {
  const followersPhase = s.phase === 'followers';
  const done = followersPhase ? s.followers : s.following;
  const target = followersPhase ? s.expectedFollowers : s.expectedFollowing;
  if (s.saving) return { done, target, pct: 100 };
  return {
    done,
    target,
    pct: target && target > 0 ? Math.min(100, Math.round((done / target) * 100)) : null,
  };
}
