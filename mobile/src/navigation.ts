// Lightweight navigation model. We use a plain state machine in App.tsx instead
// of a navigation library so there are no native dependencies to keep in sync
// with Expo Go — the screen set is small and this stays bulletproof.

export type ListKind =
  | 'notFollowingBack'
  | 'fans'
  | 'followers'
  | 'following'
  | 'mutuals'
  | 'unfollowed'
  | 'newFollowers';

export const listTitles: Record<ListKind, string> = {
  notFollowingBack: 'Geri takip etmeyenler',
  fans: 'Hayranların',
  followers: 'Takipçiler',
  following: 'Takip edilenler',
  mutuals: 'Karşılıklı takipleşme',
  unfollowed: 'Takipten çıkanlar',
  newFollowers: 'Yeni takipçiler',
};

// What a row's action button does in each list:
//   unfollow       — I follow them; stop following.
//   removeFollower — they follow me; remove them from my followers.
export type RowAction = 'unfollow' | 'removeFollower';

export const actionLabels: Record<RowAction, string> = {
  unfollow: 'Takipten çık',
  removeFollower: 'Takipten çıkar',
};

export const actionDoneLabels: Record<RowAction, string> = {
  unfollow: 'Çıkıldı',
  removeFollower: 'Çıkarıldı',
};

type ListConfig = {
  // The action that makes sense for this list's relationship direction.
  action: RowAction;
  // Show the account's post/follower/following counts on the row.
  stats: boolean;
  // Only for lists built from an old snapshot: re-fetch the picture URL, because
  // the stored one has expired and would render as a blank letter avatar.
  refreshAvatar: boolean;
  // The action only applies to rows I actually follow (the "unfollowed" list is a
  // snapshot diff — some of those accounts I never followed).
  actionNeedsFollowing?: boolean;
};

export const listConfig: Record<ListKind, ListConfig> = {
  // I follow them → unfollow.
  following: { action: 'unfollow', stats: false, refreshAvatar: false },
  notFollowingBack: { action: 'unfollow', stats: true, refreshAvatar: false },
  mutuals: { action: 'unfollow', stats: false, refreshAvatar: false },
  // They follow me → remove them as a follower.
  followers: { action: 'removeFollower', stats: false, refreshAvatar: false },
  fans: { action: 'removeFollower', stats: false, refreshAvatar: false },
  newFollowers: { action: 'removeFollower', stats: false, refreshAvatar: false },
  // They already stopped following me; the open question is whether I still
  // follow them. Pictures come from the previous snapshot, so they need a refresh.
  unfollowed: {
    action: 'unfollow',
    stats: false,
    refreshAvatar: true,
    actionNeedsFollowing: true,
  },
};

export type Route =
  | { name: 'login' }
  | { name: 'webviewLogin' }
  | { name: 'challenge'; sessionId: string; username: string }
  | { name: 'home'; sessionId: string; username: string }
  | { name: 'collect'; sessionId: string; username: string }
  | { name: 'list'; sessionId: string; kind: ListKind }
  | { name: 'profileViewers' };
