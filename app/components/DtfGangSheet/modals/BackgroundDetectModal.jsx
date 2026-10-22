import {createPortal} from 'react-dom';
import {Sparkles, X} from 'lucide-react';

/**
 * @param {{
 *   open: boolean;
 *   elevated?: boolean;
 *   fileName: string;
 *   previewUrl: string;
 *   bgHex: string;
 *   onKeep: () => void;
 *   onRemove: () => void;
 *   onClose: () => void;
 * }} props
 */
export function BackgroundDetectModal({
  open,
  elevated = false,
  fileName,
  previewUrl,
  bgHex,
  onKeep,
  onRemove,
  onClose,
}) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`dtf-modal-root${elevated ? ' dtf-modal-root--elevated' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dtf-bg-detect-title"
      onClick={onClose}
    >
      <div
        className="dtf-modal dtf-modal--detect"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dtf-modal-header">
          <div>
            <h2 id="dtf-bg-detect-title">Background Detected</h2>
            <p className="dtf-modal-sub">
              We detected that this image may have a solid background.
            </p>
          </div>
          <button
            type="button"
            className="dtf-modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={18} strokeWidth={2.25} />
          </button>
        </header>

        <div className="dtf-modal-body dtf-detect-body">
          <div className="dtf-detect-preview">
            <img src={previewUrl} alt="" />
          </div>
          <p className="dtf-detect-filename" title={fileName}>
            {fileName}
          </p>
          <p className="dtf-detect-swatch-row">
            Detected background:
            <span
              className="dtf-detect-swatch"
              style={{background: bgHex}}
              title={bgHex}
            />
            <code>{bgHex}</code>
          </p>
        </div>

        <footer className="dtf-modal-footer">
          <button type="button" className="dtf-modal-secondary" onClick={onKeep}>
            Keep As Is
          </button>
          <button type="button" className="dtf-modal-primary" onClick={onRemove}>
            <Sparkles size={15} strokeWidth={2.25} />
            Remove Background
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
