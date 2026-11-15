import { Disclosure } from '../ui/Disclosure';
import type { Dict } from '@/lib/i18n';
import styles from './Faq.module.css';

export function Faq({ t }: { t: Dict }) {
  return (
    <section className={`page ${styles.section}`} id="faq">
      <header className={styles.head}>
        <span className="eyebrow">{t.faq.eyebrow}</span>
        <h2>{t.faq.title}</h2>
      </header>
      <div className={styles.list}>
        {t.faq.items.map((item) => (
          <Disclosure key={item.q} summary={item.q}>
            {item.a}
          </Disclosure>
        ))}
      </div>
    </section>
  );
}
