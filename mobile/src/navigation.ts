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

export type Route =
  | { name: 'login' }
  | { name: 'webviewLogin' }
  | { name: 'challenge'; sessionId: string; username: string }
  | { name: 'home'; sessionId: string; username: string }
  | { name: 'list'; sessionId: string; kind: ListKind }
  | { name: 'profileViewers' };
