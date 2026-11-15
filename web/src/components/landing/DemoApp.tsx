'use client';

import { useEffect, useState } from 'react';
import { ProfileHeader } from '../app/ProfileHeader';
import { Tabs } from '../app/Tabs';
import { UserRow } from '../app/UserRow';
import { demoCounts, demoLists, demoProfile, demoTabs, type DemoTab } from '@/lib/demoData';
import { useInView, useReducedMotion } from '@/lib/useInView';
import type { Dict, Locale } from '@/lib/i18n';
import styles from './DemoApp.module.css';

const LABELS: Record<DemoTab, keyof Dict['demo']> = {
  mutuals: 'tabMutual',
  notFollowingBack: 'tabNotBack',
  fans: 'tabFans',
};

/**
 * The phone's content. It is built from the same components the real panel uses
 * (`ProfileHeader`, `Tabs`, `UserRow`) with sample data, so what the landing page
 * promises and what the product looks like cannot diverge.
 *
 * It takes one slow tour of the tabs while it is on screen, stops the moment the
 * visitor touches a tab themselves, and does not move at all under
 * `prefers-reduced-motion`.
 */
export function DemoApp({ locale, t }: { locale: Locale; t: Dict }) {
  const [tab, setTab] = useState<DemoTab>('notFollowingBack');
  const [auto, setAuto] = useState(true);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.4 });
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!auto || !inView || reduced) return;
    const id = setInterval(() => {
      setTab((current) => {
        const next = demoTabs[(demoTabs.indexOf(current) + 1) % demoTabs.length];
        return next ?? current;
      });
    }, 3200);
    return () => clearInterval(id);
  }, [auto, inView, reduced]);

  const rows = demoLists[tab];
  const actionLabel = tab === 'fans' ? t.panel.actionRemove : t.panel.actionUnfollow;
  const actionDoneLabel = tab === 'fans' ? t.panel.actionRemoveDone : t.panel.actionUnfollowDone;

  return (
    <div className={styles.app} ref={ref}>
      <div className={styles.topbar}>
        <span className={styles.brand}>{t.nav.brand}</span>
        <span className={styles.hint}>{t.demo.hint}</span>
      </div>

      <div className={styles.scroll}>
        <div className={styles.card}>
          <ProfileHeader profile={demoProfile} locale={locale} t={t} compact />
        </div>

        <div className={styles.tabs}>
          <Tabs
            items={demoTabs.map((value) => ({
              value,
              label: t.demo[LABELS[value]],
              count: demoCounts[value],
            }))}
            value={tab}
            onChange={(next) => {
              setAuto(false);
              setTab(next);
            }}
            label={t.panel.tabsLabel}
            locale={locale}
          />
        </div>

        <ul className={styles.list}>
          {rows.map((user) => (
            <UserRow
              key={`${tab}-${user.pk}`}
              user={user}
              actionLabel={actionLabel}
              actionDoneLabel={actionDoneLabel}
              state={done.has(`${tab}-${user.pk}`) ? 'done' : 'idle'}
              onAction={() => {
                setAuto(false);
                setDone((prev) => new Set(prev).add(`${tab}-${user.pk}`));
              }}
              locale={locale}
              t={t}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
