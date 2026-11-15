import { ProgressBar } from './ProgressBar';
import { Spinner } from '../ui/Spinner';
import { phasePercent, type AnalyzeProgress as Progress } from '@/lib/analyze';
import { fmtNumber } from '@/lib/format';
import { fill, type Dict, type Locale } from '@/lib/i18n';
import styles from './AnalyzeProgress.module.css';

export function AnalyzeProgress({
  progress,
  locale,
  t,
}: {
  progress: Progress;
  locale: Locale;
  t: Dict;
}) {
  const pct = phasePercent(progress);
  const phaseLabel =
    progress.phase === 'saving'
      ? t.panel.phaseSaving
      : fill(t.panel.phaseFetching, {
          phase: progress.phase === 'followers' ? t.panel.phaseFollowers : t.panel.phaseFollowing,
        });

  const done = progress.phase === 'followers' ? progress.followers : progress.following;
  const target =
    progress.phase === 'followers' ? progress.expectedFollowers : progress.expectedFollowing;

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <Spinner size={16} />
        <p className={styles.phase}>{phaseLabel}</p>
        {progress.phase !== 'saving' && target ? (
          <p className={`${styles.count} nums`}>
            {fmtNumber(done, locale)} / {fmtNumber(target, locale)}
          </p>
        ) : null}
      </div>
      <ProgressBar pct={pct} label={phaseLabel} />
      <p className={styles.hint}>{t.panel.progressPatience}</p>
    </div>
  );
}
