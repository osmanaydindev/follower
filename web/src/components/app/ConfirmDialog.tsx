'use client';

import { useEffect, useRef } from 'react';
import { Button } from '../ui/Button';
import styles from './ConfirmDialog.module.css';

/**
 * Built on the native <dialog>, which hands us the focus trap, the Esc key and
 * the inert background for free. Every row action goes through here — unfollowing
 * someone is not undoable from this app.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === ref.current) onCancel();
      }}
    >
      <div className={styles.inner}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.body}>{body}</p>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm} autoFocus>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
