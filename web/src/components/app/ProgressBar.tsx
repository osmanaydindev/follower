import styles from './ProgressBar.module.css';

/**
 * `pct === null` means the target is unknown. The track then shows a slow
 * indeterminate sweep instead of a made-up number — the one thing it must not do
 * is imply progress it cannot measure.
 */
export function ProgressBar({ pct, label }: { pct: number | null; label?: string }) {
  return (
    <div
      className={styles.track}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      {...(pct === null ? {} : { 'aria-valuenow': pct })}
    >
      {pct === null ? (
        <div className={styles.indeterminate} />
      ) : (
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      )}
    </div>
  );
}
