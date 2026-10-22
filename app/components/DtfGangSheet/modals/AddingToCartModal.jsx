import {createPortal} from 'react-dom';
import {Check, Loader2, X} from 'lucide-react';

const STEPS = [
  {id: 'design', label: 'Preparing design...'},
  {id: 'artwork', label: 'Preparing artwork...'},
  {id: 'cart', label: 'Added to cart'},
];

/**
 * Progress UI while gang sheet is saved to GCloud and added/updated in cart.
 * At 100% switches to a success panel, then parent redirects to cart.
 *
 * @param {{
 *   open: boolean;
 *   completedSteps: number;
 *   percent: number;
 *   designName?: string;
 *   sheetSizeLabel?: string;
 *   mode?: 'add' | 'update';
 *   error?: string | null;
 *   onClose: () => void;
 * }} props
 */
export function AddingToCartModal({
  open,
  completedSteps,
  percent,
  designName = '',
  sheetSizeLabel = '',
  mode = 'add',
  error = null,
  onClose,
}) {
  if (!open || typeof document === 'undefined') return null;

  const isUpdate = mode === 'update';
  const steps = isUpdate
    ? [
        {id: 'design', label: 'Preparing design...'},
        {id: 'artwork', label: 'Saving artwork...'},
        {id: 'cart', label: 'Cart updated'},
      ]
    : STEPS;

  const done = completedSteps >= steps.length && !error;
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const name = designName.trim() || 'Your gang sheet';
  const sizeBit = sheetSizeLabel ? `${sheetSizeLabel} ` : '';

  return createPortal(
    <div
      className="dtf-modal-root dtf-modal-root--elevated"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dtf-adding-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && error) onClose();
      }}
    >
      <div
        className={`dtf-modal dtf-modal--adding${done ? ' is-success' : ''}`}
      >
        {done ? (
          <>
            <header className="dtf-modal-header dtf-adding-success-header">
              <div className="dtf-modal-header-lead">
                <span className="dtf-adding-success-icon" aria-hidden>
                  <Check size={18} strokeWidth={2.75} />
                </span>
                <div>
                  <h2 id="dtf-adding-title" className="dtf-adding-success-title">
                    {isUpdate ? 'Sheet Updated!' : 'Added to Cart!'}
                  </h2>
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

            <div className="dtf-modal-body dtf-adding-success-body">
              <p className="dtf-adding-success-copy">
                {isUpdate
                  ? `Your ${sizeBit}DTF gang sheet has been updated in your cart.`
                  : `Your ${sizeBit}DTF gang sheet has been added to your cart.`}
              </p>
              <div className="dtf-adding-success-card">
                <Check size={28} strokeWidth={2.75} aria-hidden />
                <strong>{name} is ready for checkout</strong>
              </div>
              <div className="dtf-adding-redirect">
                <Loader2
                  size={14}
                  className="dtf-modal-spin"
                  strokeWidth={2.5}
                  aria-hidden
                />
                <span>Redirecting to cart...</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <header className="dtf-modal-header">
              <div className="dtf-modal-header-lead">
                <div>
                  <h2 id="dtf-adding-title">
                    {error
                      ? isUpdate
                        ? 'Couldn’t update sheet'
                        : 'Couldn’t add to cart'
                      : isUpdate
                        ? 'Updating Sheet'
                        : 'Adding to Cart'}
                  </h2>
                  <p className="dtf-modal-sub">
                    {error ||
                      (isUpdate
                        ? 'Saving changes to your gang sheet.'
                        : 'Processing gang sheet.')}
                  </p>
                </div>
              </div>
              {error ? (
                <button
                  type="button"
                  className="dtf-modal-close"
                  aria-label="Close"
                  onClick={onClose}
                >
                  <X size={18} strokeWidth={2.25} />
                </button>
              ) : null}
            </header>

            <div className="dtf-modal-body dtf-adding-body">
              <ul className="dtf-adding-steps">
                {steps.map((step, i) => {
                  const complete = completedSteps > i;
                  const active = !error && completedSteps === i;
                  return (
                    <li
                      key={step.id}
                      className={`dtf-adding-step${complete ? ' is-complete' : ''}${active ? ' is-active' : ''}`}
                    >
                      <span className="dtf-adding-step-icon" aria-hidden>
                        {complete ? (
                          <Check size={14} strokeWidth={2.75} />
                        ) : active ? (
                          <Loader2
                            size={14}
                            className="dtf-modal-spin"
                            strokeWidth={2.5}
                          />
                        ) : (
                          <span className="dtf-adding-step-dot" />
                        )}
                      </span>
                      <span>{step.label}</span>
                    </li>
                  );
                })}
              </ul>

              <div className="dtf-adding-progress">
                <div
                  className="dtf-adding-bar"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{width: `${pct}%`}} />
                </div>
                <em>{pct}%</em>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
