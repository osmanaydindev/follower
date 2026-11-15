import { Icon, type IconName } from '../ui/Icon';
import styles from './EmptyState.module.css';

export function EmptyState({
  icon = 'users',
  title,
  body,
}: {
  icon?: IconName;
  title: string;
  body?: string;
}) {
  return (
    <div className={styles.wrap}>
      <span className={styles.icon}>
        <Icon name={icon} size={26} strokeWidth={1.6} />
      </span>
      <p className={styles.title}>{title}</p>
      {body ? <p className={styles.body}>{body}</p> : null}
    </div>
  );
}
