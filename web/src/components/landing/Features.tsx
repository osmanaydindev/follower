import { Icon, type IconName } from '../ui/Icon';
import type { Dict } from '@/lib/i18n';
import styles from './Features.module.css';

const icons: Record<string, IconName | undefined> = {
  notBack: 'userMinus',
  fans: 'heart',
  mutuals: 'handshake',
  history: 'trend',
};

// CSS-module lookups are `string | undefined` under noUncheckedIndexedAccess.
const tones: Record<string, string | undefined> = {
  notBack: styles.danger,
  fans: styles.info,
  mutuals: styles.success,
  history: styles.accent,
};

export function Features({ t }: { t: Dict }) {
  return (
    <section className={`page ${styles.section}`} id="what">
      <header className={styles.head}>
        <span className="eyebrow">{t.features.eyebrow}</span>
        <h2>{t.features.title}</h2>
        <p className={styles.subtitle}>{t.features.subtitle}</p>
      </header>

      <ol className={styles.grid}>
        {t.features.items.map((item, index) => (
          <li key={item.key} className={`${styles.card} ${tones[item.key] ?? styles.accent}`}>
            <span className={styles.number} aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className={styles.icon}>
              <Icon name={icons[item.key] ?? 'users'} size={19} strokeWidth={1.9} />
            </span>
            <h3 className={styles.title}>{item.title}</h3>
            <p className={styles.body}>{item.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
