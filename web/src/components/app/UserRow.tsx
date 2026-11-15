import { Avatar } from './Avatar';
import { Icon } from '../ui/Icon';
import { Spinner } from '../ui/Spinner';
import { fmtCompact } from '@/lib/format';
import { fill, type Dict, type Locale } from '@/lib/i18n';
import { platform } from '@/lib/platforms';
import type { User, UserDetail } from '@/lib/types';
import styles from './UserRow.module.css';

export type RowState = 'idle' | 'busy' | 'done';

export function UserRow({
  user,
  detail,
  showStats,
  actionLabel,
  actionDoneLabel,
  state = 'idle',
  note,
  onAction,
  locale,
  t,
  rowRef,
}: {
  user: User;
  detail?: UserDetail;
  showStats?: boolean;
  actionLabel?: string;
  actionDoneLabel?: string;
  state?: RowState;
  /** Shown instead of the button when there is nothing actionable. */
  note?: string;
  onAction?: () => void;
  locale: Locale;
  t: Dict;
  rowRef?: (el: HTMLLIElement | null) => void;
}) {
  // A refreshed detail carries a freshly signed picture URL; prefer it.
  const picture = detail?.profilePicUrl || user.profilePicUrl;
  const stats = showStats
    ? detail
      ? fill(t.panel.rowStats, {
          posts: fmtCompact(detail.mediaCount, locale),
          followers: fmtCompact(detail.followersCount, locale),
          following: fmtCompact(detail.followingCount, locale),
        })
      : t.panel.rowStatsLoading
    : null;

  return (
    <li className={styles.row} ref={rowRef}>
      <Avatar src={picture} username={user.username} fullName={user.fullName} />

      <div className={styles.info}>
        <p className={styles.handle}>
          <a
            href={platform().profileUrl(user.username)}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={styles.link}
          >
            @{user.username}
          </a>
          {user.isVerified ? (
            <span className={styles.badge} title={t.panel.verifiedAccount}>
              <Icon name="verified" size={14} strokeWidth={1.8} />
              <span className="srOnly">{t.panel.verifiedAccount}</span>
            </span>
          ) : null}
          {user.isPrivate ? (
            <span className={styles.badgeMuted} title={t.panel.privateAccount}>
              <Icon name="lock" size={13} strokeWidth={1.8} />
              <span className="srOnly">{t.panel.privateAccount}</span>
            </span>
          ) : null}
        </p>
        {user.fullName ? <p className={styles.name}>{user.fullName}</p> : null}
        {stats ? <p className={`${styles.stats} nums`}>{stats}</p> : null}
      </div>

      {note ? (
        <span className={styles.note}>{note}</span>
      ) : actionLabel && onAction ? (
        <button
          type="button"
          className={state === 'done' ? `${styles.action} ${styles.actionDone}` : styles.action}
          onClick={onAction}
          disabled={state !== 'idle'}
          aria-label={`${actionLabel} @${user.username}`}
        >
          {state === 'busy' ? (
            <Spinner size={14} />
          ) : state === 'done' ? (
            <>
              <Icon name="check" size={14} strokeWidth={2.2} />
              <span>{actionDoneLabel}</span>
            </>
          ) : (
            <span>{actionLabel}</span>
          )}
        </button>
      ) : null}
    </li>
  );
}
