'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnalyzeProgress } from './AnalyzeProgress';
import { Notice } from './Notice';
import { Button, LinkButton } from '../ui/Button';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { Spinner } from '../ui/Spinner';
import { bookmarkletHref, type CollectPhase } from '@/lib/collector';
import { href, type Dict, type Locale } from '@/lib/i18n';
import type { Profile } from '@/lib/types';
import styles from './CollectClient.module.css';

const IG_ORIGIN = 'https://www.instagram.com';

function profileFromMessage(value: unknown): Profile | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Record<string, unknown>;
  if (typeof p.username !== 'string' || !p.username) return null;
  return {
    username: p.username.slice(0, 64),
    fullName: typeof p.fullName === 'string' ? p.fullName.slice(0, 128) : '',
    profilePicUrl: typeof p.profilePicUrl === 'string' ? p.profilePicUrl.slice(0, 4096) : '',
    followersCount: typeof p.followersCount === 'number' ? p.followersCount : 0,
    followingCount: typeof p.followingCount === 'number' ? p.followingCount : 0,
    mediaCount: typeof p.mediaCount === 'number' ? p.mediaCount : 0,
    isPrivate: Boolean(p.isPrivate),
    isVerified: Boolean(p.isVerified),
  };
}

type Stage =
  | { name: 'idle' }
  | { name: 'collecting'; phase: CollectPhase; followers: number; following: number }
  | { name: 'saving' }
  | { name: 'done' }
  | { name: 'error'; message: string };

export function CollectClient({
  locale,
  t,
  origin,
}: {
  locale: Locale;
  t: Dict;
  /** Baked server-side: the bookmarklet has to carry an absolute URL. */
  origin: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ name: 'idle' });
  const [bookmarkletHelp, setBookmarkletHelp] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'error'>('idle');
  const submitted = useRef(false);
  const bookmarklet = useRef<HTMLAnchorElement>(null);
  const collectedProfile = useRef<Profile | null>(null);

  const href_ = bookmarkletHref(origin, href(locale, 'collect'));

  // React deliberately replaces javascript: URLs rendered in JSX with a
  // throwing placeholder. This is an intentional, static bookmarklet, so set
  // the attribute after hydration instead. It keeps React's general XSS guard
  // on while allowing the user to drag a real bookmarklet to their browser.
  useEffect(() => {
    bookmarklet.current?.setAttribute('href', href_);
  }, [href_]);

  const copyBookmarklet = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(href_);
      setCopyState('done');
    } catch {
      setCopyState('error');
    }
  }, [href_]);

  const submit = useCallback(
    async (username: string, followers: unknown[], following: unknown[]) => {
      if (submitted.current) return;
      submitted.current = true;
      setStage({ name: 'saving' });
      try {
        const res = await fetch('/api/collect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, followers, following }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? t.panel.errorGeneric);
        // Hand the result straight to the panel. It reads from sessionStorage on
        // mount; without this the user would land on an empty panel offering an
        // analysis the server cannot run on this path.
        try {
          sessionStorage.setItem(
            `follower.analysis.${username}`,
            JSON.stringify({ analysis: data, profile: collectedProfile.current, at: Date.now() }),
          );
        } catch {
          /* private mode: the panel simply starts empty */
        }
        setStage({ name: 'done' });
        router.replace(href(locale, 'panel'));
      } catch (e) {
        submitted.current = false;
        setStage({ name: 'error', message: e instanceof Error ? e.message : t.panel.errorGeneric });
      }
    },
    [locale, router, t],
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // The collector runs on instagram.com and nowhere else. Anything from
      // another origin is not ours, whatever it claims to be.
      if (event.origin !== IG_ORIGIN) return;
      const msg = event.data as Record<string, unknown> | null;
      if (!msg || msg.kind !== 'follower-collect') return;

      switch (msg.type) {
        case 'hello':
          collectedProfile.current = profileFromMessage(msg.profile);
          setStage({ name: 'collecting', phase: 'followers', followers: 0, following: 0 });
          break;
        case 'progress':
          setStage((prev) => {
            const phase = msg.phase === 'following' ? 'following' : 'followers';
            const count = typeof msg.count === 'number' ? msg.count : 0;
            const base =
              prev.name === 'collecting' ? prev : { followers: 0, following: 0 as number };
            return {
              name: 'collecting',
              phase,
              followers: phase === 'followers' ? count : base.followers,
              following: phase === 'following' ? count : base.following,
            };
          });
          break;
        case 'done':
          void submit(
            typeof msg.username === 'string' ? msg.username : '',
            Array.isArray(msg.followers) ? msg.followers : [],
            Array.isArray(msg.following) ? msg.following : [],
          );
          break;
        case 'auth':
          setStage({ name: 'error', message: t.collect.errorAuth });
          break;
        case 'throttled':
          setStage({ name: 'error', message: t.collect.errorThrottled });
          break;
        case 'error':
          setStage({
            name: 'error',
            message: typeof msg.message === 'string' ? msg.message : t.panel.errorGeneric,
          });
          break;
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [submit, t]);

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <h1>{t.collect.title}</h1>
        <p className={styles.lead}>{t.collect.lead}</p>
      </header>

      {stage.name === 'collecting' || stage.name === 'saving' ? (
        <Card>
          <AnalyzeProgress
            progress={{
              phase: stage.name === 'saving' ? 'saving' : stage.phase,
              followers: stage.name === 'collecting' ? stage.followers : 0,
              following: stage.name === 'collecting' ? stage.following : 0,
            }}
            locale={locale}
            t={t}
          />
        </Card>
      ) : null}

      {stage.name === 'done' ? (
        <Card className={styles.done}>
          <Icon name="check" size={26} strokeWidth={2.2} />
          <h2>{t.collect.doneTitle}</h2>
          <LinkButton href={href(locale, 'panel')}>{t.collect.goPanel}</LinkButton>
        </Card>
      ) : null}

      {stage.name === 'error' ? (
        <Notice tone="danger" title={t.common.errorTitle} role="alert">
          {stage.message}
        </Notice>
      ) : null}

      {stage.name === 'idle' ? (
        <>
          <Notice tone="info" title={t.collect.whyTitle}>
            {t.collect.why}
          </Notice>

          <ol className={styles.steps}>
            <li className={styles.step}>
              <span className={styles.no}>1</span>
              <div className={styles.stepBody}>
                <h2 className={styles.stepTitle}>{t.collect.step1Title}</h2>
                <p className={styles.stepText}>{t.collect.step1Body}</p>
                {/* A javascript: URL must run on instagram.com, not here. */}
                <a
                  ref={bookmarklet}
                  className={styles.bookmarklet}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setBookmarkletHelp(true);
                  }}
                  draggable
                >
                  <Icon name="download" size={17} strokeWidth={2} />
                  <span>{t.collect.bookmarkletLabel}</span>
                </a>
                {bookmarkletHelp ? (
                  <Notice tone="info" title={t.collect.bookmarkletClickTitle}>
                    <p>{t.collect.bookmarkletClickBody}</p>
                    <Button variant="secondary" size="sm" onClick={() => void copyBookmarklet()}>
                      {copyState === 'done' ? t.collect.copyDone : t.collect.copyBookmarklet}
                    </Button>
                    {copyState === 'error' ? <p>{t.collect.copyFailed}</p> : null}
                  </Notice>
                ) : null}
              </div>
            </li>

            <li className={styles.step}>
              <span className={styles.no}>2</span>
              <div className={styles.stepBody}>
                <h2 className={styles.stepTitle}>{t.collect.step2Title}</h2>
                <p className={styles.stepText}>{t.collect.step2Body}</p>
                <a
                  className={styles.link}
                  href={IG_ORIGIN}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>{t.collect.openInstagram}</span>
                  <Icon name="arrowRight" size={15} strokeWidth={2} />
                </a>
              </div>
            </li>

            <li className={styles.step}>
              <span className={styles.no}>3</span>
              <div className={styles.stepBody}>
                <h2 className={styles.stepTitle}>{t.collect.step3Title}</h2>
                <p className={styles.stepText}>{t.collect.step3Body}</p>
              </div>
            </li>
          </ol>

          <Card tone="sunken" className={styles.waiting}>
            <Spinner size={16} />
            <div>
              <p className={styles.waitingTitle}>{t.collect.waitingTitle}</p>
              <p className={styles.stepText}>{t.collect.waitingBody}</p>
            </div>
          </Card>

          <Notice tone="warning" title={t.collect.limitsTitle}>
            {t.collect.limitsBody}
          </Notice>
        </>
      ) : null}

      {stage.name === 'error' ? (
        <Button variant="secondary" onClick={() => setStage({ name: 'idle' })}>
          {t.common.retry}
        </Button>
      ) : null}
    </div>
  );
}
