import type { Profile, User } from './types';

/**
 * Sample data for the phone mockup on the landing page.
 *
 * The mockup renders the *real* panel components, so the marketing shot cannot
 * drift away from the product — but it must never touch the network, so there
 * are no picture URLs here: every avatar falls back to its tinted initial.
 */

const names: [string, string][] = [
  ['ayse.kaya', 'Ayşe Kaya'],
  ['mert_demir', 'Mert Demir'],
  ['zeynepyildiz', 'Zeynep Yıldız'],
  ['can.ozturk', 'Can Öztürk'],
  ['elifsahin', 'Elif Şahin'],
  ['burakarslan', 'Burak Arslan'],
  ['selin.aydin', 'Selin Aydın'],
  ['emre_kilic', 'Emre Kılıç'],
  ['defne.korkmaz', 'Defne Korkmaz'],
  ['kaan.yilmaz', 'Kaan Yılmaz'],
  ['irem_dogan', 'İrem Doğan'],
  ['tolga.ates', 'Tolga Ateş'],
  ['nehir.celik', 'Nehir Çelik'],
  ['ozan_tekin', 'Ozan Tekin'],
  ['melis.bulut', 'Melis Bulut'],
];

function user(index: number, opts: { verified?: boolean; priv?: boolean } = {}): User {
  const entry = names[index % names.length]!;
  return {
    pk: String(900_000 + index),
    username: entry[0],
    fullName: entry[1],
    isPrivate: opts.priv ?? index % 7 === 3,
    isVerified: opts.verified ?? index % 11 === 2,
    profilePicUrl: '',
  };
}

export const demoProfile: Profile = {
  username: 'denizyilmaz',
  fullName: 'Deniz Yılmaz',
  profilePicUrl: '',
  followersCount: 1842,
  followingCount: 913,
  mediaCount: 128,
  isPrivate: false,
  isVerified: true,
};

export const demoLists = {
  mutuals: [0, 2, 4, 6, 9, 11, 13].map((i) => user(i)),
  notFollowingBack: [1, 3, 5, 7, 10, 12, 14].map((i) => user(i)),
  fans: [8, 2, 13, 5, 0, 7, 11].map((i) => user(i + 1)),
};

export type DemoTab = keyof typeof demoLists;
export const demoTabs: DemoTab[] = ['mutuals', 'notFollowingBack', 'fans'];

export const demoCounts: Record<DemoTab, number> = {
  mutuals: 724,
  notFollowingBack: 189,
  fans: 1118,
};
