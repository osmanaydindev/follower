'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * True while the element is on screen. Used to start animations only when they
 * can actually be seen — and to stop them when they cannot.
 */
export function useInView<T extends Element>(
  options: IntersectionObserverInit = { threshold: 0.25 },
) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      // No observer (very old browser, SSR snapshot): treat it as visible so
      // nothing stays hidden waiting for an event that will never arrive.
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry) setInView(entry.isIntersecting);
    }, options);
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [ref, inView] as const;
}

/** Respects the OS "reduce motion" setting, and keeps respecting it if it changes. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
