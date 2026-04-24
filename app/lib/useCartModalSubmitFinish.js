import {useEffect, useRef, useState} from 'react';

const DEFAULT_HOLD_MS = 700;

/**
 * Keeps a cart modal visible with {@link overlayActive} while a fetcher POST runs,
 * then briefly after `data.ok` before calling `onClose` + `revalidator.revalidate()`.
 * Reduces nested-request races in Workers and reads clearer than closing instantly.
 *
 * @param {{
 *   open: boolean;
 *   submitFetcher: {state: string; data?: unknown};
 *   onClose: () => void;
 *   revalidator: {revalidate: () => void};
 *   holdMs?: number;
 * }}
 */
export function useCartModalSubmitFinish({
  open,
  submitFetcher,
  onClose,
  revalidator,
  holdMs = DEFAULT_HOLD_MS,
}) {
  const [postSubmitHold, setPostSubmitHold] = useState(false);
  const successCloseStarted = useRef(false);
  const prevOpenRef = useRef(false);

  /** Clear stale POST results whenever the dialog opens (avoids re-running the success path). */
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      submitFetcher.unstable_reset?.();
    }
    prevOpenRef.current = open;
  }, [open, submitFetcher]);

  useEffect(() => {
    if (!open) {
      successCloseStarted.current = false;
      setPostSubmitHold(false);
      return;
    }

    if (submitFetcher.state !== 'idle' || !submitFetcher.data) return;

    const data = submitFetcher.data;
    if (
      typeof data !== 'object' ||
      data === null ||
      !('ok' in data) ||
      /** @type {{ ok?: boolean }} */ (data).ok !== true
    ) {
      return;
    }

    if (successCloseStarted.current) return;
    successCloseStarted.current = true;
    setPostSubmitHold(true);

    const t = window.setTimeout(() => {
      setPostSubmitHold(false);
      successCloseStarted.current = false;
      onClose();
      queueMicrotask(() => revalidator.revalidate());
    }, holdMs);

    return () => {
      window.clearTimeout(t);
      successCloseStarted.current = false;
      setPostSubmitHold(false);
    };
  }, [open, submitFetcher.state, submitFetcher.data, onClose, revalidator, holdMs]);

  const overlayActive =
    submitFetcher.state !== 'idle' || postSubmitHold;

  return {overlayActive, postSubmitHold};
}
