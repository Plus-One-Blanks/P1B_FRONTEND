import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';

const PREVIEW_BGS = [
  {id: 'check', label: 'Transparent', value: 'check'},
  {id: 'white', label: 'White', value: '#ffffff'},
  {id: 'light', label: 'Light gray', value: '#e5e7eb'},
  {id: 'gray', label: 'Gray', value: '#9ca3af'},
  {id: 'dark', label: 'Dark', value: '#1f2937'},
  {id: 'black', label: 'Black', value: '#0a0a0a'},
  {id: 'red', label: 'Red', value: '#dc2626'},
  {id: 'navy', label: 'Navy', value: '#1e3a5f'},
];

/**
 * Before/after compare for background removal.
 * @param {{
 *   open: boolean;
 *   elevated?: boolean;
 *   fileName: string;
 *   originalUrl: string;
 *   cleanedUrl: string;
 *   busy?: boolean;
 *   onCancel: () => void;
 *   onApply: () => void;
 * }} props
 */
export function RemoveBgCompareModal({
  open,
  elevated = false,
  fileName,
  originalUrl,
  cleanedUrl,
  busy = false,
  onCancel,
  onApply,
}) {
  const [pos, setPos] = useState(50);
  const [previewBg, setPreviewBg] = useState('check');
  const [stageW, setStageW] = useState(0);
  const dragging = useRef(false);
  const trackRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  useEffect(() => {
    if (open) setPos(50);
  }, [open, cleanedUrl]);

  useEffect(() => {
    if (!open) return;
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStageW(el.clientWidth));
    setStageW(el.clientWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    /** @param {PointerEvent} e */
    function onMove(e) {
      if (!dragging.current || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const next = ((e.clientX - rect.left) / rect.width) * 100;
      setPos(Math.min(98, Math.max(2, next)));
    }
    function onUp() {
      dragging.current = false;
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const bgStyle =
    previewBg === 'check'
      ? undefined
      : {background: previewBg};

  return createPortal(
    <div
      className={`dtf-modal-root${elevated ? ' dtf-modal-root--elevated' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dtf-bg-compare-title"
      onClick={onCancel}
    >
      <div
        className="dtf-modal dtf-modal--compare"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dtf-modal-header">
          <div>
            <h2 id="dtf-bg-compare-title">Remove Background</h2>
            <p className="dtf-modal-sub">
              Compare before and after, then apply the result.
            </p>
          </div>
          <button
            type="button"
            className="dtf-modal-close"
            aria-label="Close"
            onClick={onCancel}
          >
            <X size={18} strokeWidth={2.25} />
          </button>
        </header>

        <div className="dtf-modal-body">
          <div
            ref={trackRef}
            className={`dtf-compare-stage${previewBg === 'check' ? ' is-check' : ''}`}
            style={bgStyle}
          >
            <img
              src={cleanedUrl || originalUrl}
              alt=""
              className="dtf-compare-img dtf-compare-img--after"
              draggable={false}
            />
            <div
              className="dtf-compare-before-clip"
              style={{width: `${pos}%`}}
            >
              <img
                src={originalUrl}
                alt=""
                className="dtf-compare-img dtf-compare-img--before"
                draggable={false}
                style={stageW ? {width: stageW} : undefined}
              />
            </div>
            <span className="dtf-compare-tag dtf-compare-tag--left">
              Original
            </span>
            <span className="dtf-compare-tag dtf-compare-tag--right">
              Background Removed
            </span>
            <button
              type="button"
              className="dtf-compare-handle"
              style={{left: `${pos}%`}}
              aria-label="Drag to compare"
              onPointerDown={(e) => {
                e.preventDefault();
                dragging.current = true;
              }}
            >
              <span />
            </button>
          </div>

          <p className="dtf-detect-filename" title={fileName}>
            {fileName}
          </p>

          <div className="dtf-compare-bgs">
            <p className="dtf-compare-bgs-label">Preview Background</p>
            <div className="dtf-compare-bg-swatches" role="group">
              {PREVIEW_BGS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  title={b.label}
                  aria-label={b.label}
                  className={`dtf-compare-bg-swatch${previewBg === b.value ? ' is-selected' : ''}${b.value === 'check' ? ' is-check' : ''}`}
                  style={
                    b.value === 'check' ? undefined : {background: b.value}
                  }
                  onClick={() => setPreviewBg(b.value)}
                />
              ))}
            </div>
          </div>
        </div>

        <footer className="dtf-modal-footer">
          <button
            type="button"
            className="dtf-modal-secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="dtf-modal-primary"
            onClick={onApply}
            disabled={busy || !cleanedUrl}
          >
            {busy ? 'Working…' : 'Apply'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
