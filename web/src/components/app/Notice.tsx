import { Icon, type IconName } from '../ui/Icon';
import styles from './Notice.module.css';

export type NoticeTone = 'info' | 'success' | 'warning' | 'danger';

const icons: Record<NoticeTone, IconName> = {
  info: 'info',
  success: 'check',
  warning: 'warning',
  danger: 'warning',
};

/**
 * Status is colour + icon + words, never colour alone — about 1 in 12 men cannot
 * separate the red one from the green one.
 */
export function Notice({
  tone = 'info',
  title,
  children,
  role,
}: {
  tone?: NoticeTone;
  title?: string;
  children?: React.ReactNode;
  role?: 'status' | 'alert';
}) {
  return (
    <div className={`${styles.notice} ${styles[tone]}`} role={role}>
      <span className={styles.icon}>
        <Icon name={icons[tone]} size={18} strokeWidth={1.9} />
      </span>
      <div className={styles.text}>
        {title ? <p className={styles.title}>{title}</p> : null}
        {children ? <div className={styles.body}>{children}</div> : null}
      </div>
    </div>
  );
}
