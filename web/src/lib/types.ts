// Mirror of the Go backend's JSON shapes (`backend/internal/instagram/client.go`,
// `backend/internal/analysis/analysis.go`). Kept field-for-field identical to
// `mobile/src/types.ts` so the two clients cannot drift apart.

export type User = {
  pk: string;
  username: string;
  fullName: string;
  isPrivate: boolean;
  isVerified: boolean;
  profilePicUrl: string;
};

// The expanded view of another account, fetched one row at a time (each one is a
// private-API call). It also carries a freshly signed picture URL: Instagram's
// CDN links expire, so pictures kept in an old snapshot — the "unfollowed" list
// — only render once refreshed through this.
export type UserDetail = {
  pk: string;
  username: string;
  fullName: string;
  profilePicUrl: string;
  followersCount: number;
  followingCount: number;
  mediaCount: number;
  isPrivate: boolean;
  isVerified: boolean;
};

export type Analysis = {
  followersCount: number;
  followingCount: number;
  mutualsCount: number;
  followers: User[];
  following: User[];
  mutuals: User[];
  notFollowingBack: User[];
  fans: User[];
  hasHistory: boolean;
  unfollowed: User[];
  newFollowers: User[];
};

export type Profile = {
  username: string;
  fullName: string;
  profilePicUrl: string;
  followersCount: number;
  followingCount: number;
  mediaCount: number;
  isPrivate: boolean;
  isVerified: boolean;
};

export type LoginResponse = {
  sessionId: string;
  challenge: boolean;
  username: string;
  profile: Profile | null;
};

/** What the web login route hands back; the session id stays server-side. */
export type WebLoginResult = {
  challenge: boolean;
  username: string;
  profile: Profile | null;
};

export type ListKind =
  | 'mutuals'
  | 'notFollowingBack'
  | 'fans'
  | 'followers'
  | 'following'
  | 'unfollowed'
  | 'newFollowers';

export type RowAction = 'unfollow' | 'removeFollower';

export type ListConfig = {
  /** Which row action this list offers, if any. */
  action: RowAction;
  /** Per-account counts under the username — one extra request per visible row. */
  stats: boolean;
  /** Snapshot-derived lists carry expired picture URLs and need a fresh one. */
  refreshAvatar: boolean;
  /** "Unfollowed" rows may already not be followed; gate the button on the real list. */
  actionNeedsFollowing?: boolean;
};

// Same table as mobile/src/navigation.ts — only `notFollowingBack` is worth the
// per-row stat calls, and only `unfollowed` needs its avatars re-signed.
export const listConfig: Record<ListKind, ListConfig> = {
  following: { action: 'unfollow', stats: false, refreshAvatar: false },
  notFollowingBack: { action: 'unfollow', stats: true, refreshAvatar: false },
  mutuals: { action: 'unfollow', stats: false, refreshAvatar: false },
  followers: { action: 'removeFollower', stats: false, refreshAvatar: false },
  fans: { action: 'removeFollower', stats: false, refreshAvatar: false },
  newFollowers: { action: 'removeFollower', stats: false, refreshAvatar: false },
  unfollowed: { action: 'unfollow', stats: false, refreshAvatar: true, actionNeedsFollowing: true },
};

/** Tab order on the panel. History lists only appear once there is history. */
export const BASE_TABS: ListKind[] = [
  'mutuals',
  'notFollowingBack',
  'fans',
  'followers',
  'following',
];
export const HISTORY_TABS: ListKind[] = ['unfollowed', 'newFollowers'];

export function usersFor(analysis: Analysis, kind: ListKind): User[] {
  return analysis[kind];
}
