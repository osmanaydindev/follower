'use client';

import { useCallback, useEffect, useState } from 'react';
import { InstallStepArt, type InstallOS } from './InstallStepArt';
import { PhoneFrame } from './PhoneFrame';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Segmented } from '../ui/Segmented';
import { fill, type Dict } from '@/lib/i18n';
import { useInView, useReducedMotion } from '@/lib/useInView';
import styles from './InstallGuide.module.css';

const OS_KEY = 'follower.install.os';

function detectOS(): InstallOS {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, so the touch-point count is the tell.
  const iOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return iOS ? 'ios' : 'android';
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const AUTOPLAY_MS = 3400;

/**
 * "Add to home screen", taught rather than asserted: a phone that stays in view
 * while the four steps play through it.
 *
 * It walks itself while the section is on screen and stops for good the moment
 * someone takes over — a step, the pager, either one. Scroll position
 * deliberately does *not* drive it: on a desktop all four steps sit on screen at
 * once, so any scroll-linked rule either never advances or jumps erratically.
 * A steady cadence you can interrupt is both calmer and predictable at every
 * width. Under `prefers-reduced-motion` it does not move on its own at all.
 *
 * When Chrome offers a real install prompt we surface it instead of asking
 * anyone to follow instructions they do not need.
 */
export function InstallGuide({ t }: { t: Dict }) {
  const [os, setOS] = useState<InstallOS>('ios');
  const [detected, setDetected] = useState(false);
  const [step, setStep] = useState(0);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [auto, setAuto] = useState(true);
  const [sectionRef, inView] = useInView<HTMLElement>({ threshold: 0.3 });
  const reduced = useReducedMotion();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(OS_KEY);
      if (stored === 'ios' || stored === 'android') {
        setOS(stored);
        return;
      }
    } catch {
      /* private mode */
    }
    setOS(detectOS());
    setDetected(true);
  }, []);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const steps = os === 'ios' ? t.install.iosSteps : t.install.androidSteps;
  const total = steps.length;

  useEffect(() => {
    if (!auto || !inView || reduced) return;
    const id = setInterval(() => setStep((s) => (s + 1) % total), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [auto, inView, reduced, total]);

  /** Any manual move stops the walkthrough for the rest of the visit. */
  const goTo = useCallback(
    (index: number) => {
      setAuto(false);
      // Wraps, so the pager never dead-ends at either edge.
      setStep(((index % total) + total) % total);
    },
    [total],
  );

  const chooseOS = useCallback((next: InstallOS) => {
    setOS(next);
    setDetected(false);
    setStep(0);
    // Switching platform is a request to see that walkthrough, so it restarts.
    setAuto(true);
    try {
      localStorage.setItem(OS_KEY, next);
    } catch {
      /* private mode: the choice simply does not persist */
    }
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    setPrompt(null);
  }

  return (
    <section className={styles.outer} id="install" ref={sectionRef}>
      <div className={`page ${styles.section}`}>
        <header className={styles.head}>
          <div className={styles.headText}>
            <span className="eyebrow">{t.install.eyebrow}</span>
            <h2>{t.install.title}</h2>
            <p className={styles.subtitle}>{t.install.subtitle}</p>
          </div>

          <div className={styles.controls}>
            <Segmented
              name="install-os"
              label={t.install.osLabel}
              value={os}
              options={[
                { value: 'ios', label: t.install.ios },
                { value: 'android', label: t.install.android },
              ]}
              onChange={chooseOS}
            />
            {detected ? <p className={styles.hint}>{t.install.detected}</p> : null}
            {prompt ? (
              <div className={styles.installNow}>
                <Button onClick={() => void install()}>
                  <Icon name="download" size={18} strokeWidth={2} />
                  <span>{t.install.installNow}</span>
                </Button>
                <p className={styles.hint}>{t.install.installNowHint}</p>
              </div>
            ) : null}
          </div>
        </header>

        <div className={styles.layout}>
          <div className={styles.phoneCol}>
            <div className={styles.phoneInner}>
              <PhoneFrame label={t.install.phoneAlt} variant="short" className={styles.phone}>
                <InstallStepArt os={os} step={step} t={t} />
              </PhoneFrame>

              <div className={styles.pager}>
                <button
                  type="button"
                  className={styles.pagerBtn}
                  onClick={() => goTo(step - 1)}
                  aria-label={t.install.prev}
                >
                  <Icon name="arrowLeft" size={17} strokeWidth={2.2} />
                </button>

                <span className={`${styles.pagerCount} nums`} aria-live="polite">
                  {fill(t.install.stepOf, { n: step + 1, total })}
                </span>

                <button
                  type="button"
                  className={styles.pagerBtn}
                  onClick={() => goTo(step + 1)}
                  aria-label={t.install.next}
                >
                  <Icon name="arrowRight" size={17} strokeWidth={2.2} />
                </button>
              </div>
            </div>
          </div>

          <ol className={styles.steps}>
            {steps.map((item, index) => (
              <li
                key={`${os}-${item.title}`}
                className={index === step ? `${styles.step} ${styles.active}` : styles.step}
              >
                <button
                  type="button"
                  className={styles.stepButton}
                  onClick={() => goTo(index)}
                  aria-current={index === step ? 'step' : undefined}
                >
                  <span className={`${styles.stepNo} nums`} aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className={styles.stepText}>
                    <span className="srOnly">{`${t.install.stepLabel} ${index + 1}: `}</span>
                    <span className={styles.stepTitle}>{item.title}</span>
                    <span className={styles.stepBody}>{item.body}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <p className={styles.note}>{t.install.httpsNote}</p>
      </div>
    </section>
  );
}
