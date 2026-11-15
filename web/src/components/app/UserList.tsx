'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState } from './EmptyState';
import { Notice } from './Notice';
import { SearchField } from './SearchField';
import { UserRow, type RowState } from './UserRow';
import { Button } from '../ui/Button';
import { isThrottled } from '@/lib/api';
import { fmtNumber } from '@/lib/format';
import { fill, type Dict, type Locale } from '@/lib/i18n';
import { listConfig, type ListKind, type RowAction, type User } from '@/lib/types';
import { useRowVisibility } from '@/lib/useRowVisibility';
import { useUserDetails } from '@/lib/useUserDetails';
import styles from './UserList.module.css';

const PAGE = 50;

export function UserList({
  kind,
  users,
  locale,
  t,
  followingPks,
  blocked,
  onAction,
  onThrottled,
  detailsEnabled = true,
}: {
  kind: ListKind;
  users: User[];
  locale: Locale;
  t: Dict;
  /** Real "following" set, so an "unfollowed" row cannot offer an impossible action. */
  followingPks: Set<string>;
  blocked: boolean;
  onAction: (user: User, action: RowAction) => Promise<void>;
  onThrottled: () => void;
  detailsEnabled?: boolean;
}) {
  const config = listConfig[kind];

  // Frozen for the visit: a row whose action just succeeded must not vanish from
  // under the finger — it turns into "done" instead. Switching tabs remounts the
  // list and picks up the updated analysis.
  const [rows] = useState(users);

  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [busyPk, setBusyPk] = useState<string | null>(null);
  const [donePks, setDonePks] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<User | null>(null);

  const wantsDetails = detailsEnabled && (config.stats || config.refreshAvatar);
  const { details, request } = useUserDetails(wantsDetails);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(locale === 'tr' ? 'tr-TR' : 'en-GB');
    if (!q) return rows;
    return rows.filter(
      (u) =>
        u.username.toLocaleLowerCase('en-GB').includes(q) ||
        u.fullName.toLocaleLowerCase(locale === 'tr' ? 'tr-TR' : 'en-GB').includes(q),
    );
  }, [rows, query, locale]);

  const visible = filtered.slice(0, shown);

  // Reset the window when the filter changes, so searching does not start the
  // user 400 rows down an unrelated list.
  useEffect(() => {
    setShown(PAGE);
  }, [query]);

  const byPk = useMemo(() => new Map(visible.map((u) => [u.pk, u])), [visible]);
  const onVisible = useCallback(
    (pks: string[]) => {
      if (!wantsDetails) return;
      const found = pks.map((pk) => byPk.get(pk)).filter((u): u is User => Boolean(u));
      if (found.length > 0) request(found);
    },
    [byPk, request, wantsDetails],
  );
  const register = useRowVisibility(onVisible);

  // Infinite append: one sentinel at the end of the window, no virtualisation
  // library. Rows are cheap; a thousand of them are not.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown((s) => (s >= filtered.length ? s : s + PAGE));
        }
      },
      { rootMargin: '400px 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [filtered.length]);

  async function runAction(user: User) {
    setConfirming(null);
    setError(null);
    setBusyPk(user.pk);
    try {
      await onAction(user, config.action);
      setDonePks((prev) => new Set(prev).add(user.pk));
    } catch (e) {
      if (isThrottled(e)) {
        onThrottled();
      } else {
        setError(e instanceof Error ? e.message : t.panel.errorGeneric);
      }
    } finally {
      setBusyPk(null);
    }
  }

  const actionLabel =
    config.action === 'unfollow' ? t.panel.actionUnfollow : t.panel.actionRemove;
  const actionDoneLabel =
    config.action === 'unfollow' ? t.panel.actionUnfollowDone : t.panel.actionRemoveDone;

  function noteFor(user: User): string | undefined {
    if (donePks.has(user.pk)) return undefined;
    if (blocked) return t.panel.noteBlocked;
    if (config.actionNeedsFollowing && !followingPks.has(user.pk)) return t.panel.noteNotFollowing;
    return undefined;
  }

  function stateFor(user: User): RowState {
    if (donePks.has(user.pk)) return 'done';
    if (busyPk === user.pk) return 'busy';
    return 'idle';
  }

  return (
    <div className={styles.wrap}>
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder={fill(t.panel.search, { n: fmtNumber(rows.length, locale) })}
        clearLabel={t.common.close}
      />

      {error ? (
        <Notice tone="danger" title={t.common.errorTitle} role="alert">
          {error}
        </Notice>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState title={query ? t.panel.emptyFiltered : t.panel.empty} />
      ) : (
        <>
          <ul className={styles.list}>
            {visible.map((user) => (
              <UserRow
                key={user.pk}
                user={user}
                detail={details[user.pk]}
                showStats={config.stats}
                actionLabel={actionLabel}
                actionDoneLabel={actionDoneLabel}
                state={stateFor(user)}
                note={noteFor(user)}
                onAction={() => setConfirming(user)}
                locale={locale}
                t={t}
                rowRef={wantsDetails ? register(user.pk) : undefined}
              />
            ))}
          </ul>

          <div ref={sentinel} className={styles.sentinel} aria-hidden="true" />

          {shown < filtered.length ? (
            <div className={styles.more}>
              <p className={`${styles.moreText} nums`}>
                {fill(t.panel.showing, {
                  shown: fmtNumber(visible.length, locale),
                  total: fmtNumber(filtered.length, locale),
                })}
              </p>
              <Button variant="secondary" size="sm" onClick={() => setShown((s) => s + PAGE)}>
                {t.panel.loadMore}
              </Button>
            </div>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={confirming !== null}
        title={
          config.action === 'unfollow' ? t.panel.confirmUnfollowTitle : t.panel.confirmRemoveTitle
        }
        body={fill(
          config.action === 'unfollow' ? t.panel.confirmUnfollowBody : t.panel.confirmRemoveBody,
          { username: confirming?.username ?? '' },
        )}
        confirmLabel={actionLabel}
        cancelLabel={t.common.cancel}
        onConfirm={() => {
          if (confirming) void runAction(confirming);
        }}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}
