import styles from './PhoneFrame.module.css';

/**
 * A phone drawn in CSS rather than a screenshot: it stays sharp at any density,
 * follows the dark/light theme, and never goes out of date when the app changes.
 *
 * The screen is a fixed 360x720 design surface scaled by `--ps`, because the
 * panel components inside it are sized in rem. Scaling the whole surface is the
 * only way to keep *real* components at a believable phone size without giving
 * them a second, mockup-only type scale.
 */
export function PhoneFrame({
  children,
  label,
  className,
  /** `short` is for the install guide, where a full-height phone cannot stay sticky. */
  variant = 'tall',
}: {
  children: React.ReactNode;
  label: string;
  className?: string;
  variant?: 'tall' | 'short';
}) {
  const cls = [styles.frame, variant === 'short' ? styles.short : undefined, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} role="img" aria-label={label}>
      <div className={styles.bezel}>
        <div className={styles.island} aria-hidden="true" />
        <div className={styles.viewport}>
          <div className={styles.surface}>{children}</div>
        </div>
      </div>
    </div>
  );
}
