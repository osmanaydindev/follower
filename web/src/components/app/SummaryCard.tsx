import { Icon, type IconName } from '../ui/Icon';
import { fmtNumber } from '@/lib/format';
import type { Locale } from '@/lib/i18n';
import styles from './SummaryCard.module.css';

export type CardTone = 'success' | 'danger' | 'info' | 'accent';

/**
 * State is never carried by colour alone: every card pairs its tone with an icon
 * and a written label.
 */
export function SummaryCard({
  count,
  title,
  hint,
  tone,
  icon,
  locale,
  onClick,
  selected,
}: {
  count: number;
  title: string;
  hint: string;
  tone: CardTone;
  icon: IconName;
  locale: Locale;
  onClick?: () => void;
  selected?: boolean;
}) {
  const body = (
    <>
      <span className={`${styles.badge} nums`}>
        <Icon name={icon} size={18} strokeWidth={1.9} />
        <span className={styles.count}>{fmtNumber(count, locale)}</span>
      </span>
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        <span className={styles.hint}>{hint}</span>
      </span>
      {onClick ? <Icon name="arrowRight" size={18} className={styles.chevron} /> : null}
    </>
  );

  const cls = [styles.card, styles[tone], selected ? styles.selected : undefined]
    .filter(Boolean)
    .join(' ');

  if (!onClick) return <div className={cls}>{body}</div>;
  return (
    <button type="button" className={cls} onClick={onClick} aria-pressed={selected}>
      {body}
    </button>
  );
}
