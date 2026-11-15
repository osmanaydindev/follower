'use client';

import { useRef } from 'react';
import { fmtNumber } from '@/lib/format';
import type { Locale } from '@/lib/i18n';
import styles from './Tabs.module.css';

export type TabItem<T extends string> = { value: T; label: string; count: number };

/**
 * The strip scrolls inside its own overflow container — seven Turkish labels do
 * not fit on a 360px screen, and the page body must never scroll sideways.
 * Arrow keys move between tabs, which is what `role="tablist"` promises.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  locale,
  controls,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  locale: Locale;
  /** id of the element holding the selected list. */
  controls?: string;
}) {
  const strip = useRef<HTMLDivElement>(null);

  function onKeyDown(e: React.KeyboardEvent) {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (delta === 0) return;
    e.preventDefault();
    const index = items.findIndex((i) => i.value === value);
    const next = items[(index + delta + items.length) % items.length];
    if (!next) return;
    onChange(next.value);
    strip.current?.querySelector<HTMLElement>(`[data-value="${next.value}"]`)?.focus();
  }

  return (
    <div className={styles.scroller}>
      <div className={styles.strip} role="tablist" aria-label={label} ref={strip} onKeyDown={onKeyDown}>
        {items.map((item) => {
          const selected = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              data-value={item.value}
              aria-selected={selected}
              aria-controls={controls}
              tabIndex={selected ? 0 : -1}
              className={selected ? `${styles.tab} ${styles.selected}` : styles.tab}
              onClick={() => onChange(item.value)}
            >
              <span>{item.label}</span>
              <span className={`${styles.count} nums`}>{fmtNumber(item.count, locale)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
