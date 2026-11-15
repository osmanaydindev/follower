'use client';

import { useEffect, useState } from 'react';
import styles from './Avatar.module.css';

/** Stable hue per account, so the same person always gets the same colour. */
function hueFor(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

function initial(username: string, fullName: string): string {
  const source = fullName.trim() || username.trim();
  return (source[0] ?? '?').toLocaleUpperCase('tr-TR');
}

/**
 * Instagram's CDN URLs are signed and expire, so a picture that rendered an hour
 * ago can 403 now. When that happens the fallback is a letter on a tinted
 * circle, never an empty hole: on a white card a white placeholder reads as a
 * broken row.
 *
 * `referrerPolicy="no-referrer"` matters — the CDN refuses requests that carry
 * a foreign referrer.
 */
export function Avatar({
  src,
  username,
  fullName = '',
  size = 44,
  priority = false,
}: {
  src?: string;
  username: string;
  fullName?: string;
  size?: number;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  // A new URL (a refreshed, re-signed one) deserves another attempt.
  useEffect(() => {
    setFailed(false);
  }, [src]);

  const style = { width: size, height: size, '--av-h': hueFor(username) } as React.CSSProperties;

  if (!src || failed) {
    return (
      <span className={`${styles.avatar} ${styles.fallback}`} style={style} aria-hidden="true">
        <span style={{ fontSize: Math.round(size * 0.4) }}>{initial(username, fullName)}</span>
      </span>
    );
  }

  return (
    <img
      className={styles.avatar}
      style={style}
      src={src}
      alt=""
      width={size}
      height={size}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
