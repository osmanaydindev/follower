import { api } from './api';
import type { Analysis, Profile } from './types';

export type AnalyzePhase = 'followers' | 'following' | 'saving';

export type AnalyzeProgress = {
  phase: AnalyzePhase;
  /** Counts that have actually arrived. */
  followers: number;
  following: number;
  /** Targets from the cached profile, so the bar can show "412 / 922". */
  expectedFollowers?: number;
  expectedFollowing?: number;
};

export function newProgress(profile?: Profile | null): AnalyzeProgress {
  return {
    phase: 'followers',
    followers: 0,
    following: 0,
    expectedFollowers: profile?.followersCount,
    expectedFollowing: profile?.followingCount,
  };
}

export function phasePercent(p: AnalyzeProgress): number | null {
  if (p.phase === 'saving') return 100;
  const done = p.phase === 'followers' ? p.followers : p.following;
  const target = p.phase === 'followers' ? p.expectedFollowers : p.expectedFollowing;
  // No target means no honest percentage: the bar stays an empty track rather
  // than animating a number we made up.
  if (!target || target <= 0) return null;
  return Math.min(100, Math.round((done / target) * 100));
}

/**
 * Fetches the two lists and has the backend diff them.
 *
 * The lists are fetched **sequentially and never in parallel**, for the same
 * reason the Go handler does it that way: two concurrent paginating fetches on
 * one account is exactly what earns a rate limit. The browser cannot paginate
 * Instagram itself (same-origin policy), so the pacing lives in the sidecar —
 * which is also why a single call can take minutes.
 *
 * Splitting it into two calls instead of one `/api/analysis` buys real
 * two-phase progress at no extra cost in Instagram requests, and the diff still
 * runs in the one place it has always run (`diffAndStore`).
 */
export async function runAnalysis({
  profile,
  onProgress,
  signal,
}: {
  profile?: Profile | null;
  onProgress: (p: AnalyzeProgress) => void;
  signal?: AbortSignal;
}): Promise<Analysis> {
  const progress = newProgress(profile);
  onProgress({ ...progress });

  const followers = await api.followers(signal);
  progress.followers = followers.length;
  progress.phase = 'following';
  onProgress({ ...progress });

  const following = await api.following(signal);
  progress.following = following.length;
  progress.phase = 'saving';
  onProgress({ ...progress });

  // An empty collection is a failed fetch, not an account with no followers.
  // The backend rejects it too (400 "bos liste kaydedilmez"); failing here keeps
  // the user's snapshot intact and the message specific.
  if (followers.length === 0 && following.length === 0) {
    throw new EmptyCollectionError();
  }

  return api.ingest(followers, following, signal);
}

export class EmptyCollectionError extends Error {
  constructor() {
    super('empty collection');
    this.name = 'EmptyCollectionError';
  }
}
