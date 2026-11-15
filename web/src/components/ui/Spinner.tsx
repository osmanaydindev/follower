import styles from './Spinner.module.css';

export function Spinner({ size = 18, label }: { size?: number; label?: string }) {
  return (
    <span className={styles.wrap} role={label ? 'status' : undefined}>
      <span
        className={styles.ring}
        style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 9)) }}
        aria-hidden="true"
      />
      {label ? <span className="srOnly">{label}</span> : null}
    </span>
  );
}
