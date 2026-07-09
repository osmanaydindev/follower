export type User = {
  pk: string;
  username: string;
  fullName: string;
  isPrivate: boolean;
  isVerified: boolean;
  profilePicUrl: string;
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
