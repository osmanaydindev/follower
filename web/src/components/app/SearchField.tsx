'use client';

import { Icon } from '../ui/Icon';
import styles from './SearchField.module.css';

/** Filters the list that is already in memory — never a network request. */
export function SearchField({
  value,
  onChange,
  placeholder,
  clearLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  clearLabel: string;
}) {
  return (
    <div className={styles.wrap}>
      <Icon name="search" size={18} className={styles.icon} />
      <input
        className={styles.input}
        type="search"
        inputMode="search"
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {value ? (
        <button type="button" className={styles.clear} onClick={() => onChange('')} aria-label={clearLabel}>
          <Icon name="close" size={16} strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}
