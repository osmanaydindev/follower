'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, isThrottled, THROTTLE_COOLDOWN_MS } from './api';
import type { User, UserDetail } from './types';

// Each detail is a private-API request on the user's own account, so the queue is
// paced: at most two in flight and at least 350ms between two starts. Same
// numbers as the mobile client — they were tuned against a live account.
const MAX_CONCURRENT = 2;
const GAP_MS = 350;

/**
 * Fills in per-account counts and fresh profile-picture URLs for the rows that
 * are actually on screen. Never for a whole list: that would be one Instagram
 * request per row of a thousand-row list.
 *
 * Failures are silent by design — a row keeps whatever it already had. The one
 * exception is a 429: that parks the queue for 15 minutes and flushes it, so the
 * rows can be asked again later instead of being permanently marked as asked.
 */
export function useUserDetails(enabled: boolean) {
  const [details, setDetails] = useState<Record<string, UserDetail>>({});

  const queued = useRef(new Set<string>());
  const pending = useRef<{ pk: string }[]>([]);
  const active = useRef(0);
  const lastStart = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const cooldownUntil = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current != null) clearTimeout(timer.current);
    };
  }, []);

  const pump = useCallback(() => {
    if (!alive.current || !enabled) return;
    if (Date.now() < cooldownUntil.current) return;
    if (active.current >= MAX_CONCURRENT) return;
    const next = pending.current.shift();
    if (!next) return;

    const wait = GAP_MS - (Date.now() - lastStart.current);
    if (wait > 0) {
      pending.current.unshift(next);
      if (timer.current == null) {
        timer.current = setTimeout(() => {
          timer.current = null;
          pump();
        }, wait);
      }
      return;
    }

    lastStart.current = Date.now();
    active.current += 1;

    api
      .userDetail(next.pk)
      .then((detail) => {
        if (!alive.current) return;
        setDetails((prev) => ({ ...prev, [next.pk]: detail }));
      })
      .catch((e: unknown) => {
        if (!alive.current) return;
        if (isThrottled(e)) {
          cooldownUntil.current = Date.now() + THROTTLE_COOLDOWN_MS;
          // Forget everything still queued, including this row, so the same rows
          // can be re-requested once the cooldown is over.
          for (const p of pending.current) queued.current.delete(p.pk);
          queued.current.delete(next.pk);
          pending.current = [];
          return;
        }
        // Anything else (private account, expired media, a 502) stays invisible:
        // the row simply shows what it already knew.
        if (!(e instanceof ApiError)) return;
      })
      .finally(() => {
        active.current -= 1;
        pump();
      });

    // Fill the second slot in the same tick.
    pump();
  }, [enabled]);

  const request = useCallback(
    (rows: User[]) => {
      if (!enabled) return;
      const fresh = rows.filter((u) => u.pk && !queued.current.has(u.pk)).map((u) => ({ pk: u.pk }));
      if (fresh.length === 0) return;
      for (const r of fresh) queued.current.add(r.pk);
      // Newest first: what just scrolled into view matters more than what was
      // queued two screens ago.
      pending.current.unshift(...fresh);
      pump();
    },
    [enabled, pump],
  );

  return { details, request };
}
