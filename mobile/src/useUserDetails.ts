import { useCallback, useEffect, useRef, useState } from 'react';
import { api, isThrottled, THROTTLE_COOLDOWN_MS } from './api';
import { igCall, igReady, igWhenReady, IgError } from './igBridge';
import type { User, UserDetail } from './types';

// Each detail is a separate private-API request, so we never fetch a whole list:
// the list screen asks only for the rows currently on screen, and this queue
// drains them slowly. That keeps the user's own account out of Instagram's rate
// limiter (the same reason pagination is throttled server-side).
const MAX_CONCURRENT = 2;
const GAP_MS = 350; // minimum spacing between two request starts

export function useUserDetails(sessionId: string, enabled: boolean) {
  const [details, setDetails] = useState<Record<string, UserDetail>>({});
  // Rows whose detail request came back empty-handed. Without this a failure is
  // indistinguishable from a pending request and the row says "yükleniyor…"
  // forever — which is exactly how a broken bridge hid itself.
  const [failed, setFailed] = useState<Record<string, true>>({});
  const queued = useRef<Set<string>>(new Set()); // every pk ever enqueued (no re-asks)
  // The username travels with the pk: the browser path looks accounts up by
  // username (that is the request the web app itself makes).
  const pending = useRef<Array<{ pk: string; username: string }>>([]);
  const active = useRef(0);
  const lastStart = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  // Set when Instagram throttles us (429). Until it passes, the queue stays
  // parked: one more request per scrolled row is exactly what keeps a rate limit
  // from expiring.
  const cooldownUntil = useRef(0);
  // The queue does not start until we know which transport to use. The list
  // screen mounts the bridge and FlatList reports its visible rows in the same
  // tick, so without this gate the first screenful always lost the race, took
  // the server path, and one 429 from it parked the queue for 15 minutes — the
  // reason the "unfollowed" list never showed a single picture.
  const gateOpen = useRef(false);

  useEffect(() => {
    alive.current = true;
    // Open the gate as soon as the bridge settles — signed in (use the page) or
    // not (use the server, which is what mock mode needs). Either answer is
    // fine; what we must not do is start before there is one.
    if (enabled) {
      igWhenReady().then(() => {
        if (!alive.current) return;
        gateOpen.current = true;
        pump();
      });
    }
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const pump = useCallback(() => {
    if (!alive.current) return;
    if (!gateOpen.current) return;
    if (Date.now() < cooldownUntil.current) return;
    if (active.current >= MAX_CONCURRENT || pending.current.length === 0) return;

    // Respect the spacing between starts; re-check once the gap has passed.
    const wait = GAP_MS - (Date.now() - lastStart.current);
    if (wait > 0) {
      if (timer.current == null) {
        timer.current = setTimeout(() => {
          timer.current = null;
          pump();
        }, wait);
      }
      return;
    }

    const next = pending.current.shift();
    if (!next) return;
    const { pk, username } = next;
    lastStart.current = Date.now();
    active.current += 1;
    // Prefer the page's own request. The server-side route stays as the fallback
    // — it is what mock mode uses, and what runs if the bridge is not up yet.
    const fetchDetail = igReady()
      ? igCall<UserDetail>('userDetail', { pk, username })
      : api.userDetail(sessionId, pk);
    fetchDetail
      .then((d) => {
        if (alive.current) setDetails((m) => ({ ...m, [pk]: d }));
      })
      // A failed row just keeps the data we already had — never a visible error.
      // A throttle is different: park the whole queue instead of letting every
      // remaining row fire one more doomed request.
      .catch((e) => {
        console.log('[details]', username, e instanceof Error ? e.message : String(e));
        if (alive.current) setFailed((f) => ({ ...f, [pk]: true }));
        // 429 from either path means the same thing: stop asking.
        const throttled = isThrottled(e) || (e instanceof IgError && e.status === 429);
        if (throttled) {
          cooldownUntil.current = Date.now() + THROTTLE_COOLDOWN_MS;
          // Forget the dropped rows as well as this one, so they can be asked for
          // again once the cooldown passes ("queued" means "already handled").
          pending.current.forEach((p) => queued.current.delete(p.pk));
          queued.current.delete(pk);
          pending.current = [];
          console.log('[details] Instagram throttled us, kuyruk 15 dk duraklatildi');
        }
      })
      .finally(() => {
        active.current -= 1;
        pump();
      });
    pump(); // fill the second slot (deferred by the gap above)
  }, [sessionId]);

  // Enqueue the pks of the rows that just became visible, newest first so
  // scrolling always prioritises what the user is looking at right now.
  const request = useCallback(
    (rows: User[]) => {
      if (!enabled) return;
      const fresh = rows
        .filter((u) => u.pk && !queued.current.has(u.pk))
        .map((u) => ({ pk: u.pk, username: u.username }));
      if (fresh.length === 0) return;
      fresh.forEach((r) => queued.current.add(r.pk));
      pending.current.unshift(...fresh);
      pump();
    },
    [enabled, pump],
  );

  return { details, failed, request };
}
