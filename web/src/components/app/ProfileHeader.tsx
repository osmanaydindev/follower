import { Avatar } from './Avatar';
import { Icon } from '../ui/Icon';
import { fmtNumber } from '@/lib/format';
import type { Dict, Locale } from '@/lib/i18n';
import type { Profile } from '@/lib/types';
import styles from './ProfileHeader.module.css';

export type StatTarget = 'followers' | 'following';

export function ProfileHeader({
  profile,
  locale,
  t,
  onStat,
  compact = false,
}: {
  profile: Profile;
  locale: Locale;
  t: Dict;
  onStat?: (target: StatTarget) => void;
  /** The phone mockup uses the tighter variant. */
  compact?: boolean;
}) {
  const stats: { key: 'posts' | StatTarget; label: string; value: number }[] = [
    { key: 'posts', label: t.panel.posts, value: profile.mediaCount },
    { key: 'followers', label: t.panel.followers, value: profile.followersCount },
    { key: 'following', label: t.panel.following, value: profile.followingCount },
  ];

  return (
    <div className={compact ? `${styles.wrap} ${styles.compact}` : styles.wrap}>
      <Avatar
        src={profile.profilePicUrl}
        username={profile.username}
        fullName={profile.fullName}
        size={compact ? 56 : 76}
        priority
      />
      <p className={styles.name}>
        {profile.fullName || profile.username}
        {profile.isVerified ? (
          <span className={styles.verified} title={t.panel.verifiedAccount}>
            <Icon name="verified" size={16} strokeWidth={1.8} />
            <span className="srOnly">{t.panel.verifiedAccount}</span>
          </span>
        ) : null}
      </p>
      <p className={styles.handle}>@{profile.username}</p>

      <div className={styles.stats}>
        {stats.map((stat, i) => {
          const clickable = onStat && stat.key !== 'posts';
          const content = (
            <>
              <span className={`${styles.statValue} nums`}>{fmtNumber(stat.value, locale)}</span>
              <span className={styles.statLabel}>{stat.label}</span>
            </>
          );
          return (
            <div className={styles.statCell} key={stat.key}>
              {i > 0 ? <span className={styles.divider} aria-hidden="true" /> : null}
              {clickable ? (
                <button
                  type="button"
                  className={styles.stat}
                  onClick={() => onStat?.(stat.key as StatTarget)}
                >
                  {content}
                </button>
              ) : (
                <span className={styles.stat}>{content}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
