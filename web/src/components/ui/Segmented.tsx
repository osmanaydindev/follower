'use client';

import styles from './Segmented.module.css';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  icon?: React.ReactNode;
};

/**
 * Two-or-three-way switch rendered as a radio group — not a tablist — because
 * what it changes is content shown elsewhere on the page, and arrow-key radio
 * semantics are what a screen reader user expects from a choice like "iOS or
 * Android".
 */
export function Segmented<T extends string>({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string;
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.wrap} role="radiogroup" aria-label={label}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={selected ? `${styles.item} ${styles.selected}` : styles.item}
            onClick={() => onChange(opt.value)}
            name={name}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
