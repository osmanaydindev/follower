import Link from 'next/link';
import { Icon, type IconName } from '../ui/Icon';
import { href, type Dict, type Locale } from '@/lib/i18n';
import styles from './TrustSection.module.css';

const icons: Record<string, IconName | undefined> = {
  password: 'lock',
  protect: 'shield',
  control: 'check',
  data: 'eyeOff',
};

const tones: Record<string, string | undefined> = {
  success: styles.success,
  info: styles.info,
  warning: styles.warning,
};

/**
 * The reassurance section. It is as prominent as the feature grid because the
 * two things someone weighing up an app like this actually wants to know are
 * what happens to their password and what happens to their account.
 *
 * It states the protective measures first and the one honest caveat — that
 * Instagram may ask for a verification code — in the calm place it belongs
 * (the FAQ and the sign-in screen), rather than leading with alarm.
 */
export function TrustSection({ locale, t }: { locale: Locale; t: Dict }) {
  return (
    <section className={styles.outer} id="trust">
      <div className={`page ${styles.section}`}>
        <header className={styles.head}>
          <span className="eyebrow">{t.trust.eyebrow}</span>
          <h2>{t.trust.title}</h2>
          <p className={styles.subtitle}>{t.trust.subtitle}</p>
        </header>

        <ul className={styles.grid}>
          {t.trust.items.map((item) => {
            const linkLabel = 'linkLabel' in item ? item.linkLabel : undefined;
            return (
              <li key={item.key} className={`${styles.card} ${tones[item.tone] ?? styles.success}`}>
                <span className={styles.icon}>
                  <Icon name={icons[item.key] ?? 'shield'} size={19} strokeWidth={1.9} />
                </span>
                <div className={styles.text}>
                  <h3 className={styles.title}>{item.title}</h3>
                  <p className={styles.body}>{item.body}</p>
                  {linkLabel ? (
                    <Link className={styles.link} href={href(locale, 'deletion')}>
                      <span>{linkLabel}</span>
                      <Icon name="arrowRight" size={15} strokeWidth={2} />
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
