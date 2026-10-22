import {useEffect, useId, useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown, ShoppingCart, X} from 'lucide-react';

/**
 * @typedef {{
 *   id: string;
 *   label: string;
 *   imageDataUrl?: string | null;
 *   widthIn: number;
 *   heightIn: number;
 *   qty: number;
 * }} ConfirmOrderImage
 */

/**
 * Confirm gang sheet order before save + add to cart.
 *
 * @param {{
 *   open: boolean;
 *   designName: string;
 *   sheetSizeLabel: string;
 *   imageCount: number;
 *   images?: ConfirmOrderImage[];
 *   priceLabel: string;
 *   previewUrl?: string | null;
 *   busy?: boolean;
 *   onDesignNameChange: (value: string) => void;
 *   onClose: () => void;
 *   onConfirm: () => void;
 * }} props
 */
export function ConfirmOrderModal({
  open,
  designName,
  sheetSizeLabel,
  imageCount,
  images = [],
  priceLabel,
  previewUrl = null,
  busy = false,
  onDesignNameChange,
  onClose,
  onConfirm,
}) {
  const titleId = useId();
  const nameId = useId();
  const rightsId = useId();
  const [rightsOk, setRightsOk] = useState(false);
  const [imagesOpen, setImagesOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setRightsOk(false);
      setImagesOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    /**
     * @param {KeyboardEvent} e
     */
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const nameTrimmed = designName.trim();
  const canSubmit = Boolean(nameTrimmed) && rightsOk && !busy;

  return createPortal(
    <div
      className="dtf-modal-root dtf-modal-root--elevated"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="dtf-modal dtf-modal--confirm">
        <header className="dtf-modal-header dtf-confirm-header">
          <div className="dtf-modal-header-lead">
            <span className="dtf-confirm-icon" aria-hidden>
              <ShoppingCart size={18} strokeWidth={2.25} />
            </span>
            <div>
              <h2 id={titleId}>Confirm Your Order</h2>
              <p className="dtf-modal-sub">
                Review your gang sheet and add it to cart.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="dtf-modal-close"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
          >
            <X size={18} strokeWidth={2.25} />
          </button>
        </header>

        <div className="dtf-modal-body dtf-confirm-body">
          <label className="dtf-confirm-field" htmlFor={nameId}>
            <span>Design Name</span>
            <input
              id={nameId}
              type="text"
              value={designName}
              maxLength={80}
              placeholder="My Amazing Design"
              autoFocus
              disabled={busy}
              onChange={(e) => onDesignNameChange(e.target.value)}
            />
            <em>This name will appear on your order</em>
          </label>

          <div className="dtf-confirm-summary">
            <div className="dtf-confirm-summary-main">
              <div className="dtf-confirm-summary-rows">
                <div className="dtf-confirm-row">
                  <span>Gang Sheet Size</span>
                  <strong>{sheetSizeLabel}</strong>
                </div>
                <div className="dtf-confirm-row">
                  <span>Transfer Type</span>
                  <strong>DTF</strong>
                </div>
                <div className="dtf-confirm-images-block">
                  <div className="dtf-confirm-row dtf-confirm-row--images">
                    <button
                      type="button"
                      className={`dtf-confirm-images-toggle${imagesOpen ? ' is-open' : ''}`}
                      onClick={() => setImagesOpen((v) => !v)}
                      aria-expanded={imagesOpen}
                    >
                      <ChevronDown size={14} strokeWidth={2.5} aria-hidden />
                      Images
                    </button>
                    <strong>{imageCount}</strong>
                  </div>
                  {imagesOpen && images.length ? (
                    <ul className="dtf-confirm-image-list">
                      {images.map((img) => (
                        <li key={img.id} className="dtf-confirm-image-card">
                          <div className="dtf-confirm-image-thumb">
                            {img.imageDataUrl ? (
                              <img src={img.imageDataUrl} alt="" />
                            ) : (
                              <span />
                            )}
                          </div>
                          <div className="dtf-confirm-image-meta">
                            <strong title={img.label}>
                              {img.label || 'Art'}
                            </strong>
                            <small>
                              {img.widthIn.toFixed(1)}″ × {img.heightIn.toFixed(1)}″
                            </small>
                          </div>
                          <em className="dtf-confirm-image-qty">×{img.qty}</em>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
              <div className="dtf-confirm-preview">
                {previewUrl ? (
                  <img src={previewUrl} alt="" />
                ) : (
                  <span className="dtf-confirm-preview-empty" />
                )}
              </div>
            </div>
            <div className="dtf-confirm-price">
              <span>Price</span>
              <strong>{priceLabel}</strong>
            </div>
          </div>

          <label className="dtf-confirm-rights" htmlFor={rightsId}>
            <input
              id={rightsId}
              type="checkbox"
              checked={rightsOk}
              disabled={busy}
              onChange={(e) => setRightsOk(e.target.checked)}
            />
            <span>
              I confirm I have the rights to print the artwork on this gang sheet
            </span>
          </label>
        </div>

        <footer className="dtf-modal-footer">
          <button
            type="button"
            className="dtf-modal-secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="dtf-modal-primary dtf-confirm-atc"
            disabled={!canSubmit}
            onClick={onConfirm}
          >
            <ShoppingCart size={16} strokeWidth={2.25} aria-hidden />
            Add to Cart
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
