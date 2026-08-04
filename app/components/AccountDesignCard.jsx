import {Link} from 'react-router';
import {Shirt} from 'lucide-react';
import {SolidButton} from '~/components/SolidButton';
import {toBase64} from '~/lib/base64';

/**
 * @param {string} orderId
 * @param {string} previewQuery
 */
function orderPath(orderId, previewQuery) {
  return `/account/orders/${toBase64(orderId)}${previewQuery}`;
}

/**
 * Card for a past Design Studio design recovered from the customer's orders.
 * @param {{
 *   design: import('~/lib/accountDesigns.server').AccountDesignSummary;
 *   previewQuery?: string;
 * }} props
 */
export function AccountDesignCard({design, previewQuery = ''}) {
  const thumb = design.previewUrl || design.lineImageUrl;
  const orderedLabel = design.orderedAt
    ? new Date(design.orderedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;
  const orderHref =
    design.orderId != null
      ? orderPath(String(design.orderId), previewQuery)
      : null;
  const metaBits = [
    design.color,
    design.locations,
    design.orderNumber != null ? `Order #${design.orderNumber}` : null,
  ].filter(Boolean);

  return (
    <article className="account-design-card">
      <div className="account-design-card-media" aria-hidden={!thumb}>
        {thumb ? (
          <img
            className="account-design-card-img"
            src={thumb}
            alt=""
            width={320}
            height={320}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="account-design-card-placeholder">
            <Shirt size={28} strokeWidth={1.5} />
          </div>
        )}
      </div>
      <div className="account-design-card-body">
        <h3 className="account-design-card-title">
          {design.productTitle || 'Decorated design'}
        </h3>
        {metaBits.length ? (
          <p className="account-design-card-meta">{metaBits.join(' · ')}</p>
        ) : null}
        {orderedLabel ? (
          <p className="account-design-card-date">Ordered {orderedLabel}</p>
        ) : null}
        <div className="account-design-card-actions">
          {design.reorderUrl ? (
            <SolidButton
              to={design.reorderUrl}
              compact
              className="account-design-card-cta"
            >
              Reorder
            </SolidButton>
          ) : (
            <SolidButton
              to="/collections/t-shirts-decorated"
              compact
              className="account-design-card-cta"
            >
              Shop decorated
            </SolidButton>
          )}
          {orderHref ? (
            <Link to={orderHref} className="account-design-card-order-link">
              View order
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
