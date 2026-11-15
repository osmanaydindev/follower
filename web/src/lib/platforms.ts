import { BASE_TABS, HISTORY_TABS, listConfig, type ListConfig, type ListKind } from './types';

/**
 * Where a second network would plug in.
 *
 * Only Instagram exists today and nothing in the UI hints at more — the point
 * is that the things that would actually differ per platform live in one place
 * instead of being scattered as constants:
 *
 *   - which lists it can produce, and in what order
 *   - which of those only exist once there is history to compare against
 *   - what each list offers per row (unfollow / remove / nothing)
 *   - where the panel's requests go
 *
 * Adding Twitter/X would mean a second entry here, a second set of proxy
 * entries in `app/api/ig/[...path]/route.ts`, and a provider on the Go side.
 * It would not mean touching the panel.
 */
export type PlatformId = 'instagram';

export type Platform = {
  id: PlatformId;
  /** Shown nowhere yet; a second platform is what would make it visible. */
  name: string;
  /** Prefix for this platform's proxy routes. */
  apiPrefix: string;
  /** Profile URL for a username, used by the row links. */
  profileUrl: (username: string) => string;
  /** Tabs always available after an analysis. */
  baseTabs: ListKind[];
  /** Tabs that only appear once a previous snapshot exists. */
  historyTabs: ListKind[];
  /** Per-list row behaviour. */
  lists: Record<ListKind, ListConfig>;
};

export const instagram: Platform = {
  id: 'instagram',
  name: 'Instagram',
  apiPrefix: '/api/ig',
  profileUrl: (username) => `https://www.instagram.com/${encodeURIComponent(username)}/`,
  baseTabs: BASE_TABS,
  historyTabs: HISTORY_TABS,
  lists: listConfig,
};

export const platforms: Record<PlatformId, Platform> = { instagram };

export const DEFAULT_PLATFORM: PlatformId = 'instagram';

export function platform(id: PlatformId = DEFAULT_PLATFORM): Platform {
  return platforms[id];
}
