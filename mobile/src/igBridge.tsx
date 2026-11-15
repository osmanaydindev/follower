import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { IG_WEB_UA } from './collector';

// A hidden, signed-in Instagram browser that the app can issue requests through.
//
// Same lesson as the list collector, applied to the rest: a session belongs to
// the browser that created it, and our server-side replay of it keeps getting
// refused — a first-ever unfollow came back 429 on an account that was browsing
// its own feed at that moment. So the write actions and the per-row profile
// refresh run here, as requests the page makes about itself.
//
// Mount <IgBridge /> where it is needed (the list screen); the module-level
// handle below is what screens call. One bridge at a time.

const WEB_APP_ID = '936619743392459';
const IG_URL = 'https://www.instagram.com/';

export class IgError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'IgError';
    this.status = status;
  }
}

type Pending = { resolve: (v: unknown) => void; reject: (e: IgError) => void };

const waiting = new Map<number, Pending>();
let seq = 0;
let inject: ((js: string) => void) | null = null;
let bridgeReady = false;
// The page reports whether it is actually signed in. A bridge sitting on a
// logged-out instagram.com is "loaded" but useless — and that is exactly what
// mock mode looks like, so callers must fall back to the server instead.
let bridgeSignedIn = false;
// Resolved the moment the bridge settles either way, so callers can wait for it
// rather than racing it.
let readyWaiters: Array<(ok: boolean) => void> = [];

function settleReady(ok: boolean) {
  const waiters = readyWaiters;
  readyWaiters = [];
  waiters.forEach((w) => w(ok));
}

export function igReady(): boolean {
  return bridgeReady && bridgeSignedIn && inject != null;
}

// Wait for the bridge to finish loading instead of racing it.
//
// This is the fix for a race that looked like two different bugs: a list screen
// mounts, FlatList reports its visible rows in the same tick, and the bridge's
// WebView has not loaded instagram.com yet. Every one of those first rows took
// the server fallback, collected the sidecar guard's 429, and that single 429
// parked the whole detail queue for 15 minutes — so no picture ever arrived on
// the "unfollowed" list. The row actions lost the same race.
//
// Resolves true when the page is loaded AND signed in, false when it is loaded
// and signed out (mock mode → use the server) or when it never shows up.
export function igWhenReady(timeoutMs = 12000): Promise<boolean> {
  if (igReady()) return Promise.resolve(true);
  if (bridgeReady) return Promise.resolve(false); // loaded, but signed out
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const once = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    const timer = setTimeout(() => once(false), timeoutMs);
    readyWaiters.push((ok) => {
      clearTimeout(timer);
      once(ok);
    });
  });
}

// Run one operation in the page. Rejects with IgError; status carries
// Instagram's HTTP code so 429 stays distinguishable from a plain failure.
export function igCall<T>(op: string, params: Record<string, unknown>, timeoutMs = 20000): Promise<T> {
  if (!igReady()) return Promise.reject(new IgError('Instagram köprüsü hazır değil', 0));
  const id = ++seq;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      waiting.delete(id);
      reject(new IgError('Instagram yanıt vermedi', 0));
    }, timeoutMs);
    waiting.set(id, {
      resolve: (v) => {
        clearTimeout(timer);
        resolve(v as T);
      },
      reject: (e) => {
        clearTimeout(timer);
        reject(e);
      },
    });
    inject?.(`window.__ig && window.__ig.run(${JSON.stringify({ id, op, params })}); true;`);
  });
}

const BRIDGE_JS = `
(function () {
  var APP_ID = '${WEB_APP_ID}';

  function send(m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  // Goes to the Metro console on the native side. A page request that fails
  // inside a hidden WebView is otherwise completely unobservable.
  function log(message) { send({ type: 'log', message: message }); }
  function cookie(name) {
    var m = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[2]) : '';
  }

  // ds_user_id is set for a signed-in session. Without it the page can still
  // load, but every request it makes about an account is a stranger's request —
  // the caller has to use the server path instead.
  function ready() {
    var signedIn = !!cookie('ds_user_id');
    log('köprü hazır — sayfa: ' + location.href + ', ds_user_id: ' + (signedIn ? 'var' : 'YOK') +
      ', csrftoken: ' + (cookie('csrftoken') ? 'var' : 'YOK'));
    send({ type: 'ready', signedIn: signedIn });
  }

  if (window.__ig) { ready(); return; }

  function fail(status, message) { var e = new Error(message); e.status = status; return e; }

  // Whatever Instagram put in the body worth showing a human.
  function reason(b) {
    if (!b) return '';
    if (typeof b.message === 'string' && b.message) return b.message;
    if (typeof b.feedback_message === 'string' && b.feedback_message) return b.feedback_message;
    return '';
  }

  // One request, read once, judged strictly.
  //
  // Every "it said it worked but nothing happened" bug here came from being
  // generous with the response. Two ways Instagram refuses without an error
  // status: HTTP 200 with { status: 'fail', feedback_required: true }, and —
  // when the session is not usable — a redirect to an HTML page, which is also
  // HTTP 200 and simply is not JSON. Anything that is not parseable JSON
  // saying status:'ok' is a failure here.
  async function req(method, path) {
    var init = { method: method, credentials: 'include', headers: { 'x-ig-app-id': APP_ID } };
    if (method === 'POST') {
      // Instagram requires the CSRF token on writes — the same one the page sends.
      init.headers['x-csrftoken'] = cookie('csrftoken');
      init.headers['x-requested-with'] = 'XMLHttpRequest';
      init.headers['content-type'] = 'application/x-www-form-urlencoded';
    }
    var r = await fetch(path, init);

    var raw = '';
    try { raw = await r.text(); } catch (e) { raw = ''; }
    var body = null;
    try { body = JSON.parse(raw); } catch (e) { body = null; }

    // Enough to tell a refusal from a redirect-to-login when something goes
    // wrong in the field; goes to the Metro console, never to the user.
    log(method + ' ' + path + ' → ' + r.status + (r.redirected ? ' (yönlendirildi: ' + r.url + ')' : '') +
      ' ' + (body ? 'json:' + (body.status || '?') : 'json degil: ' + raw.slice(0, 80)));

    if (!r.ok) throw fail(r.status, reason(body) || 'Instagram reddetti (HTTP ' + r.status + ')');

    if (!body) {
      // 200 but not JSON — the request was answered by a page, not the API.
      throw fail(401, 'Instagram yanıt yerine sayfa döndü. Tarayıcı oturumu düşmüş olabilir.');
    }

    if (body.status && body.status !== 'ok') {
      // An action block. Treated as a throttle so the app backs off instead of
      // trying the next row — more attempts are what deepen it.
      if (body.feedback_required || body.spam || reason(body) === 'feedback_required') {
        throw fail(429, 'Instagram bu işlemi geçici olarak engelledi. Bir süre hiç deneme.');
      }
      throw fail(0, reason(body) || 'Instagram işlemi reddetti');
    }
    return body;
  }

  // The response carries the relationship as Instagram now sees it. We claim
  // success only when it says so — an answer that omits the new state is not
  // permission to tell the user it worked.
  function verify(d, field, expected, message) {
    var fs = d && d.friendship_status;
    if (!fs || typeof fs[field] !== 'boolean') {
      throw fail(0, message + ' (yanıt ilişki durumunu bildirmedi)');
    }
    if (fs[field] !== expected) throw fail(0, message);
    return d;
  }

  var ops = {
    unfollow: async function (p) {
      var d = await req('POST', '/api/v1/friendships/destroy/' + p.pk + '/');
      return verify(d, 'following', false, 'Instagram takibi bırakmadı');
    },
    removeFollower: async function (p) {
      var d = await req('POST', '/api/v1/friendships/remove_follower/' + p.pk + '/');
      return verify(d, 'followed_by', false, 'Instagram takipçiyi çıkarmadı');
    },

    // Counts plus a FRESHLY signed picture URL. Instagram's CDN links expire, so
    // a face stored in an old snapshot only renders once refreshed through here.
    userDetail: async function (p) {
      if (!p.username) throw fail(0, 'kullanici adi yok');
      var d = await req('GET', '/api/v1/users/web_profile_info/?username=' + encodeURIComponent(p.username));
      var u = d && d.data && d.data.user;
      if (!u) throw fail(404, 'hesap bulunamadi');
      return {
        pk: String(u.id || p.pk || ''),
        username: u.username || p.username,
        fullName: u.full_name || '',
        profilePicUrl: u.profile_pic_url_hd || u.profile_pic_url || '',
        followersCount: (u.edge_followed_by && u.edge_followed_by.count) || 0,
        followingCount: (u.edge_follow && u.edge_follow.count) || 0,
        mediaCount: (u.edge_owner_to_timeline_media && u.edge_owner_to_timeline_media.count) || 0,
        isPrivate: !!u.is_private,
        isVerified: !!u.is_verified
      };
    }
  };

  window.__ig = {
    run: function (req) {
      var fn = ops[req.op];
      if (!fn) { send({ type: 'rpc', id: req.id, ok: false, error: 'bilinmeyen islem', status: 0 }); return; }
      Promise.resolve()
        .then(function () { return fn(req.params || {}); })
        .then(function (data) { send({ type: 'rpc', id: req.id, ok: true, data: data }); })
        .catch(function (e) {
          send({ type: 'rpc', id: req.id, ok: false, error: (e && e.message) || String(e), status: (e && e.status) || 0 });
        });
    }
  };

  ready();
})();
true;
`;

export function IgBridge({ onReady }: { onReady?: (ok: boolean) => void }) {
  const ref = useRef<WebView | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    return () => {
      // Leaving the screen tears the bridge down; anything still waiting would
      // otherwise hang until its timeout.
      inject = null;
      bridgeReady = false;
      bridgeSignedIn = false;
      settleReady(false);
      waiting.forEach((p) => p.reject(new IgError('Instagram köprüsü kapandı', 0)));
      waiting.clear();
    };
  }, []);

  function handle(raw: string) {
    let msg: {
      type?: string;
      id?: number;
      ok?: boolean;
      data?: unknown;
      error?: string;
      status?: number;
      signedIn?: boolean;
      message?: string;
    };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    // What the page actually got. Without this a request that fails inside a
    // hidden WebView leaves no trace anywhere.
    if (msg.type === 'log') {
      console.log('[igBridge]', msg.message);
      return;
    }
    if (msg.type === 'ready') {
      bridgeReady = true;
      bridgeSignedIn = !!msg.signedIn;
      settleReady(bridgeSignedIn);
      onReady?.(bridgeSignedIn);
      force((n) => n + 1);
      return;
    }
    if (msg.type !== 'rpc' || typeof msg.id !== 'number') return;
    const p = waiting.get(msg.id);
    if (!p) return;
    waiting.delete(msg.id);
    if (msg.ok) p.resolve(msg.data);
    else p.reject(new IgError(msg.error || 'Instagram isteği başarısız', msg.status ?? 0));
  }

  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        ref={ref}
        source={{ uri: IG_URL }}
        userAgent={IG_WEB_UA}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        javaScriptEnabled
        domStorageEnabled
        style={styles.fill}
        onMessage={(e) => handle(e.nativeEvent.data)}
        onLoadEnd={() => {
          // A real page load resets the JS context, so re-inject every time; the
          // script itself is idempotent.
          inject = (js) => ref.current?.injectJavaScript(js);
          ref.current?.injectJavaScript(BRIDGE_JS);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Out of flow on the WRAPPER, not the WebView — react-native-webview keeps
  // `flex: 1` on the container it puts around the view you style, so a
  // "hidden" WebView still claims its share of the column.
  hidden: { position: 'absolute', top: 0, left: 0, width: 1, height: 1, opacity: 0, overflow: 'hidden' },
  fill: { flex: 1 },
});
