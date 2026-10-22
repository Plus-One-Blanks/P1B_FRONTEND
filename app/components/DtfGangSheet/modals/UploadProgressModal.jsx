import {createPortal} from 'react-dom';
import {Loader2, X} from 'lucide-react';

/**
 * @param {{
 *   open: boolean;
 *   elevated?: boolean;
 *   files: Array<{
 *     id: string;
 *     name: string;
 *     previewUrl?: string | null;
 *     progress: number;
 *     status: string;
 *   }>;
 *   onClose: () => void;
 * }} props
 */
export function UploadProgressModal({open, elevated = false, files, onClose}) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`dtf-modal-root${elevated ? ' dtf-modal-root--elevated' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dtf-upload-progress-title"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="dtf-modal dtf-modal--progress">
        <header className="dtf-modal-header">
          <div className="dtf-modal-header-lead">
            <Loader2
              className="dtf-modal-spin"
              size={18}
              strokeWidth={2.25}
              aria-hidden
            />
            <div>
              <h2 id="dtf-upload-progress-title">Uploading Files</h2>
              <p className="dtf-modal-sub">Upload in progress</p>
            </div>
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

        <div className="dtf-modal-body">
          <ul className="dtf-upload-list">
            {files.map((f) => (
              <li key={f.id} className="dtf-upload-row">
                <div className="dtf-upload-thumb-wrap">
                  {f.previewUrl ? (
                    <img src={f.previewUrl} alt="" className="dtf-upload-thumb" />
                  ) : (
                    <span className="dtf-upload-thumb is-empty" />
                  )}
                  <Loader2
                    className="dtf-upload-thumb-spin dtf-modal-spin"
                    size={14}
                    aria-hidden
                  />
                </div>
                <div className="dtf-upload-meta">
                  <div className="dtf-upload-meta-top">
                    <span className="dtf-upload-name" title={f.name}>
                      {f.name}
                    </span>
                    <span className="dtf-upload-status">{f.status}</span>
                  </div>
                  <div className="dtf-upload-bar-row">
                    <div
                      className="dtf-upload-bar"
                      role="progressbar"
                      aria-valuenow={Math.round(f.progress)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <span style={{width: `${Math.min(100, f.progress)}%`}} />
                    </div>
                    <em>{Math.round(f.progress)}%</em>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
}
