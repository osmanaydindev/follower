import type { User } from './types';

// The script that runs INSIDE the logged-in Instagram WebView and paginates the
// follower/following lists with the page's own session.
//
// Why this exists at all: Instagram binds a session to the browser that created
// it. Handing the cookie jar to another client — our Python sidecar, however
// faithfully it copies the User-Agent — leaves a mismatch somewhere (TLS
// fingerprint, header order, exit IP), and Instagram answers those with "please
// wait a few minutes". A fetch issued by the page itself has no mismatch left to
// find: same cookies, same TLS, same IP, same everything. Verified live — the
// browser's own list endpoint paginated happily while the sidecar was getting
// 429 on the very same account.
//
// What this does NOT do is bypass rate limits. They are server-side and keyed to
// the account. The pacing below is the same discipline the sidecar applies, just
// moved to where the requests now originate.

// Desktop web client id. Must match the UA the WebView logs in with — a desktop
// UA claiming the mobile app id is exactly the kind of inconsistency we are
// trying to stop producing.
const WEB_APP_ID = '936619743392459';

// The single definition of who our browser claims to be. The login WebView, the
// collector WebView and the sidecar's WEB_UA all have to agree; keeping one
// exported constant is how they stay that way instead of drifting apart in three
// files. Desktop Chrome on purpose — it pairs with WEB_APP_ID above.
export const IG_WEB_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Pacing, mirrored from the sidecar (IG_PAGES_PER_REST and friends). Continuous
// pagination is the least human-looking thing this app does, so every page costs
// a pause and every fifth page costs a long one.
const PAGE_SIZE = 50;
const PAGE_DELAY_MS: [number, number] = [2500, 5000];
const PAGES_PER_REST = 5;
const REST_MS: [number, number] = [20000, 40000];
// Between the two lists: a human does not open their following list the
// millisecond their follower list finishes loading.
const BETWEEN_LISTS_MS: [number, number] = [4000, 8000];

// Reads the signed-in account's own summary from inside the WebView, so logging
// in costs the backend zero Instagram requests.
//
// This is here because the sidecar's version of this one call was what kept the
// user locked out: the browser was scrolling its feed while our replay of its
// session got 429 for the same account in the same minute. The request that
// proves a session works should be made by the session.
// Only the username is required — it is what the backend keys the snapshot on.
// The counts are a bonus for the dashboard; the analysis produces the real ones
// anyway. So this tries the cheapest sources first and never depends on a call
// that might be refused.
//
// Order matters, and it is the whole lesson of this feature: start with what the
// page ALREADY has (zero requests), then fall back only to endpoints the web app
// itself calls. An invented endpoint — /users/<pk>/info/ was the first attempt
// here — gets refused precisely because the browser never asks for it.
export const PROFILE_JS = `
(function () {
  function send(m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); }

  function fromDom() {
    // The nav avatar is a link to href="/<username>/" wrapping an <img>. Present
    // on every signed-in page and free to read.
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || '';
      var m = href.match(/^\\/([A-Za-z0-9._]{1,30})\\/$/);
      if (m && links[i].querySelector('img')) return m[1];
    }
    return '';
  }

  async function viewer() {
    try {
      var v = window._sharedData && window._sharedData.config && window._sharedData.config.viewer;
      if (v && v.username) return v;
    } catch (e) {}
    try {
      // The bootstrap endpoint the web app loads for itself.
      var r = await fetch('/data/shared_data/', { credentials: 'include' });
      if (r.ok) {
        var d = await r.json();
        var v2 = d && d.config && d.config.viewer;
        if (v2 && v2.username) return v2;
      }
    } catch (e) {}
    var name = fromDom();
    return name ? { username: name } : null;
  }

  (async function () {
    try {
      var v = await viewer();
      if (!v || !v.username) { send({ type: 'profile', profile: null }); return; }

      var p = {
        username: v.username,
        fullName: v.full_name || '',
        profilePicUrl: v.profile_pic_url_hd || v.profile_pic_url || '',
        followersCount: 0,
        followingCount: 0,
        mediaCount: 0,
        isPrivate: !!v.is_private,
        isVerified: false
      };

      // Counts, from the endpoint the web app really does call when you open a
      // profile page. Optional: a refusal here must not block signing in.
      try {
        var r2 = await fetch('/api/v1/users/web_profile_info/?username=' + encodeURIComponent(v.username), {
          credentials: 'include',
          headers: { 'x-ig-app-id': '${WEB_APP_ID}' }
        });
        if (r2.ok) {
          var d2 = await r2.json();
          var u = d2 && d2.data && d2.data.user;
          if (u) {
            p.fullName = u.full_name || p.fullName;
            p.profilePicUrl = u.profile_pic_url_hd || u.profile_pic_url || p.profilePicUrl;
            p.followersCount = (u.edge_followed_by && u.edge_followed_by.count) || 0;
            p.followingCount = (u.edge_follow && u.edge_follow.count) || 0;
            p.mediaCount = (u.edge_owner_to_timeline_media && u.edge_owner_to_timeline_media.count) || 0;
            p.isPrivate = !!u.is_private;
            p.isVerified = !!u.is_verified;
          }
        }
      } catch (e) {}

      send({ type: 'profile', profile: p });
    } catch (e) {
      send({ type: 'profile', profile: null });
    }
  })();
})();
true;
`;

export type CollectPhase = 'followers' | 'following';

// What the injected script reports back over postMessage.
export type CollectorMessage =
  | { type: 'page'; phase: CollectPhase; users: User[] }
  | { type: 'progress'; phase: CollectPhase; count: number }
  | { type: 'done' }
  // Instagram said slow down. Stop asking — this is the status the whole app
  // treats as first-class rather than as a failure to retry.
  | { type: 'throttled'; message: string }
  // No usable Instagram session in the WebView. Not an error on its own: it is
  // also what mock mode looks like, so the caller falls back to the server.
  | { type: 'auth' }
  | { type: 'error'; message: string };

export function parseCollectorMessage(raw: string): CollectorMessage | null {
  try {
    const m = JSON.parse(raw);
    return m && typeof m.type === 'string' ? (m as CollectorMessage) : null;
  } catch {
    return null;
  }
}

// Built as a string because it executes in the WebView, not here. It guards
// against double-injection: injectedJavaScript fires on every page load, and
// Instagram is a SPA that loads more than once.
export const COLLECTOR_JS = `
(function () {
  if (window.__followerCollecting) return;
  window.__followerCollecting = true;

  var APP_ID = '${WEB_APP_ID}';
  var PAGE_SIZE = ${PAGE_SIZE};
  var PAGES_PER_REST = ${PAGES_PER_REST};

  function send(m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function jitter(a, b) { return a + Math.random() * (b - a); }

  function cookie(name) {
    var m = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[2]) : '';
  }

  // Instagram's shape → ours. Keep the field names identical to the Go User
  // struct so the backend decodes the list without a translation layer.
  function mapUser(u) {
    return {
      pk: String(u.pk || u.id || ''),
      username: u.username || '',
      fullName: u.full_name || '',
      isPrivate: !!u.is_private,
      isVerified: !!u.is_verified,
      profilePicUrl: u.profile_pic_url || ''
    };
  }

  async function fetchList(uid, kind) {
    var out = [];
    var next = null;
    var pages = 0;

    while (true) {
      var url = '/api/v1/friendships/' + uid + '/' + kind + '/?count=' + PAGE_SIZE +
        (next ? '&max_id=' + encodeURIComponent(next) : '');

      var res = await fetch(url, {
        credentials: 'include',
        headers: { 'x-ig-app-id': APP_ID, 'x-requested-with': 'XMLHttpRequest' }
      });

      // A refusal ends the whole collection. Retrying through a rate limit is
      // what makes it last longer, and it is how this account got flagged before.
      if (res.status === 429) { send({ type: 'throttled', message: 'Instagram istekleri sinirladi (429).' }); return null; }
      if (res.status === 401 || res.status === 403) { send({ type: 'auth' }); return null; }
      if (!res.ok) { send({ type: 'error', message: kind + ' icin HTTP ' + res.status }); return null; }

      var data = await res.json();
      var users = (data.users || []).map(mapUser);
      out = out.concat(users);

      // Stream each page out instead of holding the whole list in the page and
      // sending one huge string at the end.
      send({ type: 'page', phase: kind, users: users });
      send({ type: 'progress', phase: kind, count: out.length });

      next = data.next_max_id || null;
      if (!next || users.length === 0) break;

      pages++;
      await sleep(pages % PAGES_PER_REST === 0
        ? jitter(${REST_MS[0]}, ${REST_MS[1]})
        : jitter(${PAGE_DELAY_MS[0]}, ${PAGE_DELAY_MS[1]}));
    }
    return out;
  }

  (async function () {
    try {
      // ds_user_id is the signed-in account. Absent → this browser is not logged
      // in, which the app handles by falling back to the server-side path.
      var uid = cookie('ds_user_id');
      if (!uid) { send({ type: 'auth' }); return; }

      // SEQUENTIAL, same reason /api/analysis is: one account paginating two
      // lists at once is traffic no human produces.
      if (await fetchList(uid, 'followers') === null) return;
      await sleep(jitter(${BETWEEN_LISTS_MS[0]}, ${BETWEEN_LISTS_MS[1]}));
      if (await fetchList(uid, 'following') === null) return;

      send({ type: 'done' });
    } catch (e) {
      send({ type: 'error', message: String((e && e.message) || e) });
    }
  })();
})();
true;
`;
