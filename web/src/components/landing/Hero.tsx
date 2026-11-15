import { DemoApp } from './DemoApp';
import { PhoneFrame } from './PhoneFrame';
import { LinkButton } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { href, type Dict, type Locale } from '@/lib/i18n';
import styles from './Hero.module.css';

export function Hero({ locale, t, signedIn }: { locale: Locale; t: Dict; signedIn: boolean }) {
  return (
    <section className={styles.hero}>
      <div className={`page ${styles.inner}`}>
        <div className={styles.copy}>
          <p className={styles.badge}>
            <span>{t.hero.badge}</span>
          </p>
          <h1 className={styles.title}>
            {t.hero.titleLead}
            <span className={styles.accent}>{t.hero.titleAccent}</span>
          </h1>
          <p className={styles.subtitle}>{t.hero.subtitle}</p>
          <div className={styles.ctas}>
            <LinkButton href={href(locale, signedIn ? 'panel' : 'login')} size="lg">
              <span>{signedIn ? t.nav.panel : t.hero.cta}</span>
              <Icon name="arrowRight" size={18} strokeWidth={2} />
            </LinkButton>
            <LinkButton href="#what" variant="secondary" size="lg">
              {t.hero.ctaSecondary}
            </LinkButton>
          </div>
          <p className={styles.note}>{t.hero.note}</p>
        </div>

        <div className={styles.phoneWrap}>
          <PhoneFrame label={t.hero.mockupLabel}>
            <DemoApp locale={locale} t={t} />
          </PhoneFrame>
        </div>
      </div>
    </section>
  );
}
