import { useCallback, useEffect, useRef, useState } from 'react';
import { api, isThrottled, THROTTLE_COOLDOWN_MS } from './api';
import type { UserDetail } from './types';

// Each detail is a separate private-API request, so we never fetch a whole list:
// the list screen asks only for the rows currently on screen, and this queue
// drains them slowly. That keeps the user's own account out of Instagram's rate
// limiter (the same reason pagination is throttled server-side).
const MAX_CONCURRENT = 2;
const GAP_MS = 350; // minimum spacing between two request starts

export function useUserDetails(sessionId: string, enabled: boolean) {
  const [details, setDetails] = useState<Record<string, UserDetail>>({});
  const queued = useRef<Set<string>>(new Set()); // every pk ever enqueued (no re-asks)
  const pending = useRef<string[]>([]);
  const active = useRef(0);
  const lastStart = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  // Set when Instagram throttles us (429). Until it passes, the queue stays
  // parked: one more request per scrolled row is exactly what keeps a rate limit
  // from expiring.
  const cooldownUntil = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const pump = useCallback(() => {
    if (!alive.current) return;
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

    const pk = pending.current.shift();
    if (!pk) return;
    lastStart.current = Date.now();
    active.current += 1;
    api
      .userDetail(sessionId, pk)
      .then((d) => {
        if (alive.current) setDetails((m) => ({ ...m, [pk]: d }));
      })
      // A failed row just keeps the data we already had — never a visible error.
      // A throttle is different: park the whole queue instead of letting every
      // remaining row fire one more doomed request.
      .catch((e) => {
        if (isThrottled(e)) {
          cooldownUntil.current = Date.now() + THROTTLE_COOLDOWN_MS;
          // Forget the dropped rows as well as this one, so they can be asked for
          // again once the cooldown passes ("queued" means "already handled").
          pending.current.forEach((p) => queued.current.delete(p));
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
    (pks: string[]) => {
      if (!enabled) return;
      const fresh = pks.filter((pk) => pk && !queued.current.has(pk));
      if (fresh.length === 0) return;
      fresh.forEach((pk) => queued.current.add(pk));
      pending.current.unshift(...fresh);
      pump();
    },
    [enabled, pump],
  );

  return { details, request };
}
