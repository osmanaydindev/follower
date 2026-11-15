import { Icon } from '../ui/Icon';
import type { Dict } from '@/lib/i18n';
import styles from './InstallStepArt.module.css';

export type InstallOS = 'ios' | 'android';

const HOST = 'follower.app';

/**
 * The illustration inside the install-guide phone: a believable Safari or
 * Chrome, drawn entirely in markup.
 *
 * Screenshots were the obvious alternative and the wrong one — they would be
 * stuck in one theme and one language, go stale the next time either browser
 * repaints its chrome, and need a retina asset per variant. This follows the
 * page's own tokens instead.
 *
 * All four states are present at once and `data-step` decides which is forward,
 * so the movement is pure CSS and the global reduced-motion rule switches it
 * off without this component knowing.
 */
export function InstallStepArt({ os, step, t }: { os: InstallOS; step: number; t: Dict }) {
  const addLabel = os === 'ios' ? t.install.iosSteps[2]?.caption : t.install.androidSteps[2]?.caption;

  return (
    <div className={styles.stage} data-os={os} data-step={step} aria-hidden="true">
      <div className={styles.status}>
        <span className={styles.clock}>9:41</span>
        <span className={styles.statusIcons}>
          <span className={styles.signal}>
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className={styles.battery} />
        </span>
      </div>

      {/* Chrome keeps its bar at the top, with the overflow menu in the corner. */}
      <div className={styles.topChrome}>
        <span className={styles.omnibox}>
          <Icon name="lock" size={11} strokeWidth={2.2} />
          <span className={styles.host}>{HOST}</span>
        </span>
        <span className={`${styles.chromeBtn} ${styles.menuTarget}`}>
          <Icon name="dots" size={15} />
        </span>
      </div>

      {/* A small, honest version of the page the visitor is already looking at. */}
      <div className={styles.page}>
        <span className={styles.pageBrand}>{t.nav.brand}</span>
        <span className={styles.pageTitle}>{t.hero.titleLead}</span>
        <span className={styles.pageRule} />
        <div className={styles.pageCards}>
          <span className={`${styles.pageCard} ${styles.success}`}>
            <i />
            <b />
          </span>
          <span className={`${styles.pageCard} ${styles.danger}`}>
            <i />
            <b />
          </span>
          <span className={`${styles.pageCard} ${styles.info}`}>
            <i />
            <b />
          </span>
        </div>

        {/* A second block, so the screen behind the sheet looks like a page
            rather than a half-empty placeholder. */}
        <div className={styles.pageList}>
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>

      {/* Safari keeps its toolbar at the bottom; Share is the control to find. */}
      <div className={styles.bottomChrome}>
        <span className={styles.safariNav}>
          <Icon name="arrowLeft" size={16} strokeWidth={2.2} />
        </span>
        <span className={`${styles.safariNav} ${styles.dim}`}>
          <Icon name="arrowRight" size={16} strokeWidth={2.2} />
        </span>
        <span className={`${styles.shareBtn} ${styles.target}`}>
          <Icon name="share" size={17} strokeWidth={2} />
        </span>
        <span className={styles.safariNav}>
          <Icon name="bookmark" size={16} strokeWidth={2} />
        </span>
        <span className={styles.safariNav}>
          <Icon name="tabs" size={16} strokeWidth={2} />
        </span>
      </div>

      <div className={styles.scrim} />

      {/* ---- iOS share sheet ---- */}
      <div className={styles.sheet}>
        <span className={styles.grabber} />

        <div className={styles.sheetHead}>
          <span className={styles.sheetFavicon}>F</span>
          <span className={styles.sheetMeta}>
            <b>{t.nav.brand}</b>
            <i>{HOST}</i>
          </span>
          <span className={styles.sheetClose}>
            <Icon name="close" size={12} strokeWidth={2.6} />
          </span>
        </div>

        <div className={styles.sheetTargets}>
          <span />
          <span />
          <span />
          <span />
        </div>

        <div className={styles.sheetRows}>
          <div className={styles.sheetRow}>
            <span className={styles.sheetLabel}>Kopyala</span>
            <Icon name="copy" size={15} strokeWidth={1.9} />
          </div>
          <div className={`${styles.sheetRow} ${styles.addRow}`}>
            <span className={styles.sheetLabel}>{addLabel}</span>
            <Icon name="plusSquare" size={15} strokeWidth={1.9} />
          </div>
          <div className={styles.sheetRow}>
            <span className={styles.sheetLabel}>İşaretle</span>
            <Icon name="bookmark" size={15} strokeWidth={1.9} />
          </div>
        </div>
      </div>

      {/* ---- Android overflow menu ---- */}
      <div className={styles.menu}>
        <span className={styles.menuRow}>
          <Icon name="arrowRight" size={14} strokeWidth={1.9} />
          <span>İleri</span>
        </span>
        <span className={styles.menuRow}>
          <Icon name="refresh" size={14} strokeWidth={1.9} />
          <span>Yenile</span>
        </span>
        <span className={`${styles.menuRow} ${styles.addRow}`}>
          <Icon name="download" size={14} strokeWidth={1.9} />
          <span>{addLabel}</span>
        </span>
        <span className={styles.menuRow}>
          <Icon name="share" size={14} strokeWidth={1.9} />
          <span>Paylaş</span>
        </span>
      </div>

      {/* ---- home screen ---- */}
      <div className={styles.home}>
        <div className={styles.homeGrid}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <span key={i} className={styles.homeApp}>
              <span className={styles.homeIcon} />
              <span className={styles.homeLabel} />
            </span>
          ))}
          <span className={`${styles.homeApp} ${styles.homeOurs}`}>
            <span className={styles.homeIcon}>
              <span className={styles.homeGlyph}>F</span>
            </span>
            <span className={styles.homeName}>{t.nav.brand}</span>
          </span>
        </div>
        <span className={styles.homeDock}>
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>
    </div>
  );
}
