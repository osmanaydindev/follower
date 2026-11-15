/**
 * The collector that runs inside instagram.com.
 *
 * Why it exists at all: a password login from our server is refused by
 * Instagram's CAA flow, and copying a session to the server leaves a mismatch
 * (exit IP, TLS fingerprint, header order) that reads as a stolen cookie. The
 * one client Instagram already trusts is the user's own logged-in browser, so
 * that is where the pagination happens. The server never contacts Instagram on
 * this path.
 *
 * How the data gets out: it cannot be fetched to us directly. Instagram sends
 *
 *   connect-src *.instagram.com ... facebook.com ... 'self'
 *
 * and our origin is not on that list, so `fetch('https://takipanaliz.com/...')`
 * from the page is blocked — measured, not assumed. `postMessage` is not
 * governed by connect-src, so the collector opens our page in a second window
 * and posts the lists to it; that window is our origin and submits them with an
 * ordinary same-origin request.
 *
 * The script is inlined into the bookmarklet rather than loaded from us,
 * because `script-src` excludes our origin too.
 *
 * The pacing is the mobile app's, unchanged, and it is not decoration: page
 * size, the jittered gap between pages, a long rest every few pages, the two
 * lists strictly sequential, and a refusal ending the run instead of being
 * retried. Those numbers were tuned against a live account that got flagged
 * when they were not respected.
 */

const WEB_APP_ID = '936619743392459';
const PAGE_SIZE = 50;
const PAGE_DELAY_MS: [number, number] = [2500, 5000];
const PAGES_PER_REST = 5;
const REST_MS: [number, number] = [20000, 40000];
const BETWEEN_LISTS_MS: [number, number] = [4000, 8000];

export type CollectPhase = 'followers' | 'following';

/** What the page posts to our window. Mirrors the mobile message protocol. */
export type CollectorMessage =
  | { kind: 'follower-collect'; type: 'hello'; username: string }
  | { kind: 'follower-collect'; type: 'progress'; phase: CollectPhase; count: number }
  | {
      kind: 'follower-collect';
      type: 'done';
      username: string;
      followers: unknown[];
      following: unknown[];
    }
  | { kind: 'follower-collect'; type: 'throttled'; message: string }
  | { kind: 'follower-collect'; type: 'auth' }
  | { kind: 'follower-collect'; type: 'error'; message: string };

/** The script body, as it runs on instagram.com. */
export function collectorSource(targetOrigin: string, collectPath: string): string {
  return `(function(){
if (window.__followerCollecting) { alert('Toplama zaten calisiyor.'); return; }

function cookie(n){var m=document.cookie.match(new RegExp('(^|; )'+n+'=([^;]*)'));return m?decodeURIComponent(m[2]):'';}
var uid = cookie('ds_user_id');
if (!uid) { alert('Once instagram.com uzerinde giris yapmalisin.'); return; }

// Opened on the click, before any await, or the popup blocker eats it.
var win = window.open(${JSON.stringify(targetOrigin + collectPath)}, 'followerCollect');
if (!win) { alert('Acilir pencere engellendi. Bu site icin izin verip tekrar dene.'); return; }

window.__followerCollecting = true;
var ORIGIN = ${JSON.stringify(targetOrigin)};
var APP_ID = ${JSON.stringify(WEB_APP_ID)};
var PAGE_SIZE = ${PAGE_SIZE};
var PAGES_PER_REST = ${PAGES_PER_REST};

function send(m){ m.kind='follower-collect'; try{ win.postMessage(m, ORIGIN); }catch(e){} }
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function jitter(a,b){ return a + Math.random()*(b-a); }

// Field names match the Go User struct so the backend needs no translation.
function mapUser(u){
  return {
    pk: String(u.pk || u.id || ''),
    username: u.username || '',
    fullName: u.full_name || '',
    isPrivate: !!u.is_private,
    isVerified: !!u.is_verified,
    profilePicUrl: u.profile_pic_url || ''
  };
}

async function whoami(){
  // When the bookmark runs on the user's own profile, the pathname is the
  // username and costs no request at all. Prefer that over Instagram's
  // increasingly unreliable /users/{id}/info/ endpoint.
  var part = location.pathname.replace(/^\\/+|\\/+$/g, '').split('/')[0] || '';
  var reserved = ['accounts','direct','explore','p','reel','reels','stories'];
  if (/^[a-zA-Z0-9._]{1,30}$/.test(part) && reserved.indexOf(part.toLowerCase()) === -1) {
    return part;
  }
  try {
    var r = await fetch('/api/v1/users/' + uid + '/info/', {
      credentials:'include', headers:{'x-ig-app-id': APP_ID}
    });
    if (r.ok) { var j = await r.json(); return (j.user && j.user.username) || ''; }
  } catch(e){}
  return '';
}

async function fetchList(kind){
  var out = [], next = null, pages = 0;
  while (true) {
    var url = '/api/v1/friendships/' + uid + '/' + kind + '/?count=' + PAGE_SIZE +
      (next ? '&max_id=' + encodeURIComponent(next) : '');
    var res = await fetch(url, {
      credentials:'include',
      headers:{'x-ig-app-id': APP_ID, 'x-requested-with':'XMLHttpRequest'}
    });
    // A refusal ends the run. Retrying through a rate limit is what makes it
    // last longer, and it is how an account got flagged here before.
    if (res.status === 429) { send({type:'throttled', message:'Instagram istekleri sinirladi (429).'}); return null; }
    if (res.status === 401 || res.status === 403) { send({type:'auth'}); return null; }
    if (!res.ok) { send({type:'error', message: kind + ' icin HTTP ' + res.status}); return null; }

    var data = await res.json();
    var users = (data.users || []).map(mapUser);
    out = out.concat(users);
    send({type:'progress', phase:kind, count: out.length});

    next = data.next_max_id || null;
    if (!next || users.length === 0) break;
    pages++;
    await sleep(pages % PAGES_PER_REST === 0
      ? jitter(${REST_MS[0]}, ${REST_MS[1]})
      : jitter(${PAGE_DELAY_MS[0]}, ${PAGE_DELAY_MS[1]}));
  }
  return out;
}

(async function(){
  try {
    var username = await whoami();
    if (!username) {
      send({type:'error', message:'Instagram kullanici adi okunamadi. Kendi profil sayfanizi acip yer imine tekrar tiklayin.'});
      return;
    }
    send({type:'hello', username: username});
    var followers = await fetchList('followers');
    if (followers === null) return;
    // Sequential, same reason the server path is: one account paginating two
    // lists at once is traffic no human produces.
    await sleep(jitter(${BETWEEN_LISTS_MS[0]}, ${BETWEEN_LISTS_MS[1]}));
    var following = await fetchList('following');
    if (following === null) return;
    send({type:'done', username: username, followers: followers, following: following});
  } catch (e) {
    send({type:'error', message: String((e && e.message) || e)});
  } finally {
    window.__followerCollecting = false;
  }
})();
})();`;
}

/** The `javascript:` URL the user drags to their bookmarks bar. */
export function bookmarkletHref(targetOrigin: string, collectPath: string): string {
  return 'javascript:' + encodeURIComponent(collectorSource(targetOrigin, collectPath));
}
