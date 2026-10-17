export type User = {
  pk: string;
  username: string;
  fullName: string;
  isPrivate: boolean;
  isVerified: boolean;
  profilePicUrl: string;
};

// UserDetail is the expanded view of another account, fetched one row at a time
// (each one is a private-API call). It also carries a freshly-signed picture URL:
// Instagram's CDN links expire, so pictures kept in an old snapshot — the
// "unfollowed" list — only render once refreshed through this.
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

// Everything the embedded browser login produced. Instagram binds a session to
// the browser that created it, so the cookie jar and the User-Agent travel
// together — the backend replays both on every request.
export type WebSession = {
  sessionid: string;
  cookies: Record<string, string>;
  userAgent: string;
  // Read inside the WebView before the hand-off, so the backend never has to
  // ask Instagram "who is this?" — the request that proves the session works is
  // made by the session itself. Null when the in-page read failed; the backend
  // then falls back to fetching it.
  profile?: Profile | null;
};

export type LoginResponse = {
  sessionId: string;
  challenge: boolean;
  username: string;
  profile: Profile | null;
};
