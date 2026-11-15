import { Icon } from './Icon';
import styles from './Disclosure.module.css';

/**
 * Built on <details>, so it opens without JavaScript, is findable by the
 * browser's in-page search, and needs no keyboard handling of our own.
 */
export function Disclosure({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className={styles.item}>
      <summary className={styles.summary}>
        <span>{summary}</span>
        <Icon name="chevronDown" size={18} className={styles.chevron} />
      </summary>
      <div className={styles.body}>{children}</div>
    </details>
  );
}
