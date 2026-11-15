'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * One IntersectionObserver for a whole list, instead of one per row. A list can
 * hold a thousand rows; a thousand observers is a thousand bits of bookkeeping
 * for the same answer.
 *
 * This is the web stand-in for the mobile list's `onViewableItemsChanged`: it
 * reports which rows are actually on screen, so per-row detail requests are only
 * made for what the user is looking at.
 */
export function useRowVisibility(onVisible: (keys: string[]) => void) {
  const cb = useRef(onVisible);
  cb.current = onVisible;

  const observer = useRef<IntersectionObserver | null>(null);
  const keys = useRef(new WeakMap<Element, string>());
  const refs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const pending = useRef<Set<string>>(new Set());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    flushTimer.current = null;
    if (pending.current.size === 0) return;
    const batch = [...pending.current];
    pending.current.clear();
    cb.current(batch);
  }, []);

  const ensureObserver = useCallback(() => {
    if (observer.current || typeof IntersectionObserver === 'undefined') return observer.current;
    observer.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const key = keys.current.get(entry.target);
          if (key) pending.current.add(key);
        }
        // Scrolling fires a burst of entries; collapse them into one request so
        // the detail queue is handed a whole screenful at once.
        if (pending.current.size > 0 && flushTimer.current == null) {
          flushTimer.current = setTimeout(flush, 80);
        }
      },
      // 10% of a row is enough to count as visible, matching the mobile list's
      // itemVisiblePercentThreshold.
      { threshold: 0.1, rootMargin: '120px 0px' },
    );
    return observer.current;
  }, [flush]);

  /** Stable per-key ref callback, so re-renders do not re-observe every row. */
  const register = useCallback(
    (key: string) => {
      const existing = refs.current.get(key);
      if (existing) return existing;
      const fn = (el: HTMLElement | null) => {
        const obs = ensureObserver();
        if (!obs) return;
        if (el) {
          keys.current.set(el, key);
          obs.observe(el);
        }
      };
      refs.current.set(key, fn);
      return fn;
    },
    [ensureObserver],
  );

  useEffect(() => {
    // Captured here so the cleanup touches the same Maps this mount created,
    // not whatever the refs hold by the time it runs.
    const observerRef = observer;
    const refsMap = refs.current;
    const timerRef = flushTimer;
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      refsMap.clear();
      if (timerRef.current != null) clearTimeout(timerRef.current);
    };
  }, []);

  return register;
}
