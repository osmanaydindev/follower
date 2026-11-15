import styles from './Prose.module.css';

export type Section = { heading: string; body: string[] };

export function ProseDoc({
  title,
  updated,
  lead,
  sections,
  footerNote,
}: {
  title: string;
  updated?: string;
  lead?: string;
  sections: Section[];
  footerNote?: string;
}) {
  return (
    <article className={styles.doc}>
      <header className={styles.head}>
        <h1>{title}</h1>
        {updated ? <p className={styles.updated}>{updated}</p> : null}
        {lead ? <p className={styles.lead}>{lead}</p> : null}
      </header>

      {sections.map((section) => (
        <section key={section.heading} className={styles.section}>
          <h2 className={styles.heading}>{section.heading}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph} className={styles.paragraph}>
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      {footerNote ? <p className={styles.note}>{footerNote}</p> : null}
    </article>
  );
}
