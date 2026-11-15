import Link from 'next/link';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outlineAccent' | 'danger';
type Size = 'sm' | 'md' | 'lg';

function classesFor(variant: Variant, size: Size, block?: boolean, extra?: string) {
  return [
    styles.base,
    styles[variant],
    size === 'md' ? undefined : styles[size],
    block ? styles.block : undefined,
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  block?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return <button type={type} className={classesFor(variant, size, block, className)} {...rest} />;
}

type LinkButtonProps = React.ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
  block?: boolean;
};

export function LinkButton({
  variant = 'primary',
  size = 'md',
  block,
  className,
  ...rest
}: LinkButtonProps) {
  return <Link className={classesFor(variant, size, block, className)} {...rest} />;
}
