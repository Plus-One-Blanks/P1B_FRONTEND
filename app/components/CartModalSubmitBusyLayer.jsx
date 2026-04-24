/**
 * Full-dialog overlay with spinner while the cart modal POST runs, then a short success state.
 *
 * @param {{
 *   active: boolean;
 *   successPhase: boolean;
 *   submittingLabel: string;
 *   successLabel: string;
 * }} props
 */
export function CartModalSubmitBusyLayer({
  active,
  successPhase,
  submittingLabel,
  successLabel,
}) {
  if (!active) return null;
  const label = successPhase ? successLabel : submittingLabel;
  return (
    <div
      className="cart-modal-submit-overlay"
      role="status"
      aria-live="polite"
      aria-busy={successPhase ? 'false' : 'true'}
    >
      <div className="cart-modal-submit-spinner" aria-hidden />
      <p className="cart-modal-submit-overlay-text">{label}</p>
    </div>
  );
}
