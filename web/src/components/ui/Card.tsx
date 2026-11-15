import styles from './Card.module.css';

type Props = React.HTMLAttributes<HTMLDivElement> & {
  as?: 'div' | 'section' | 'article';
  tone?: 'raised' | 'flat' | 'sunken';
  padding?: 'normal' | 'tight' | 'none';
};

export function Card({
  as: Tag = 'div',
  tone = 'raised',
  padding = 'normal',
  className,
  ...rest
}: Props) {
  const cls = [
    styles.card,
    tone === 'flat' ? styles.flat : undefined,
    tone === 'sunken' ? styles.sunken : undefined,
    padding === 'tight' ? styles.tight : undefined,
    padding === 'none' ? styles.plain : undefined,
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <Tag className={cls} {...rest} />;
}
