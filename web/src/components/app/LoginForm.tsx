'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Notice } from './Notice';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { Spinner } from '../ui/Spinner';
import { api, ApiError, isOffline, isThrottled } from '@/lib/api';
import { href, type Dict, type Locale } from '@/lib/i18n';
import styles from './LoginForm.module.css';

type Step = 'credentials' | 'challenge';

export function LoginForm({
  locale,
  t,
  initialStep,
  expired,
}: {
  locale: Locale;
  t: Dict;
  /** A reload mid-challenge must land back on the code step. */
  initialStep: Step;
  expired: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialStep);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function describe(e: unknown): string {
    if (isThrottled(e)) return t.panel.errorThrottled;
    if (isOffline(e)) return t.panel.errorNetwork;
    // Everything else is Instagram's own wording, forwarded by the sidecar —
    // more useful than anything we could invent ("wrong password" vs. "we are
    // being throttled" look identical from here otherwise).
    if (e instanceof ApiError && e.message) return e.message;
    return t.panel.errorGeneric;
  }

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!username.trim() || !password) {
      setError(t.login.missing);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await api.login(username.trim(), password);
      // The password is dropped the moment it is no longer needed; the backend
      // keeps it in memory only while a challenge is pending.
      setPassword('');
      if (result.challenge) {
        setStep('challenge');
      } else {
        router.replace(href(locale, 'panel'));
      }
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!code.trim()) {
      setError(t.login.codeMissing);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api.challenge(code.trim());
      router.replace(href(locale, 'panel'));
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }

  if (step === 'challenge') {
    return (
      <Card className={styles.card}>
        <h1 className={styles.title}>{t.login.challengeTitle}</h1>
        <p className={styles.subtitle}>{t.login.challengeSubtitle}</p>

        {error ? (
          <Notice tone="danger" title={t.common.errorTitle} role="alert">
            {error}
          </Notice>
        ) : null}

        <form className={styles.form} onSubmit={submitCode}>
          <label className={styles.field}>
            <span className={styles.label}>{t.login.code}</span>
            <input
              className={`${styles.input} ${styles.code} nums`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={12}
              required
            />
          </label>
          <Button type="submit" size="lg" block disabled={busy}>
            {busy ? <Spinner size={16} /> : null}
            <span>{busy ? t.login.verifying : t.login.verify}</span>
          </Button>
        </form>

        <button
          type="button"
          className={styles.textButton}
          onClick={() => {
            // Abandoning the code step has to drop the pending session too,
            // otherwise a reload lands straight back here with a cookie that
            // can no longer be verified.
            void api.logout().catch(() => {});
            setStep('credentials');
            setCode('');
            setError(null);
          }}
        >
          {t.login.startOver}
        </button>
      </Card>
    );
  }

  return (
    <Card className={styles.card}>
      <h1 className={styles.title}>{t.login.title}</h1>
      <p className={styles.subtitle}>{t.login.subtitle}</p>

      {expired ? (
        <Notice tone="warning" role="status">
          {t.panel.sessionExpired}
        </Notice>
      ) : null}

      {error ? (
        <Notice tone="danger" title={t.common.errorTitle} role="alert">
          {error}
        </Notice>
      ) : null}

      <form className={styles.form} onSubmit={submitCredentials}>
        <label className={styles.field}>
          <span className={styles.label}>{t.login.username}</span>
          <input
            className={styles.input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t.login.usernamePlaceholder}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="username"
            name="username"
            required
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{t.login.password}</span>
          <span className={styles.passwordWrap}>
            <input
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={reveal ? 'text' : 'password'}
              autoComplete="current-password"
              name="password"
              required
            />
            <button
              type="button"
              className={styles.reveal}
              onClick={() => setReveal((r) => !r)}
              aria-label={reveal ? t.login.hidePassword : t.login.showPassword}
              title={reveal ? t.login.hidePassword : t.login.showPassword}
            >
              <Icon name={reveal ? 'eyeOff' : 'eye'} size={18} />
            </button>
          </span>
        </label>

        <Button type="submit" size="lg" block disabled={busy}>
          {busy ? <Spinner size={16} /> : null}
          <span>{busy ? t.login.submitting : t.login.submit}</span>
        </Button>
      </form>

      {/* Guidance, not a hazard warning — the tone matters as much as the
          wording. The specifics stay, they are things people should know. */}
      <Notice tone="info" title={t.login.riskTitle}>
        <ul className={styles.riskList}>
          {t.login.riskItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Notice>
    </Card>
  );
}
