import { CartForm, Image } from '@shopify/hydrogen';
import { createPortal } from 'react-dom';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getVariantUrl, useVariantUrl } from '~/lib/variants';
import {
  findColorInLineAttributes,
  findColorSelectedOption,
  inferColorFromProductTitle,
  inferColorFromVariantTitle,
  isColorLikeOptionName,
  nonSizeSelectedOptions,
} from '~/lib/cartEditSizes';
import { ArrowRight, GripVertical } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';
import { CartAddColorModal } from '~/components/CartAddColorModal';
import { CartEditSizesModal } from '~/components/CartEditSizesModal';
import { groupKeyForLineGroup } from '~/lib/cartPageGroupOrder';
import { retailLineTotalForLine } from '~/lib/cartRetailPricing';
import { useAside } from './Aside';

/** Trailing icon for cart line footer text actions (bounce on hover — see `app.css`). */
function CartLinePageFooterActionIcon() {
  return (
    <span className="cart-line-page-footer-text-btn__icon" aria-hidden>
      <ArrowRight size={15} strokeWidth={2.25} />
    </span>
  );
}

/**
 * @param {CartLine} line
 * @param {CartApiQueryFragment | null | undefined} cart
 */
function computeCartLineDisplayPricing(line, cart) {
  const { merchandise, quantity, cost } = line;
  const totalAmount = parseFloat(cost?.totalAmount?.amount || 0);
  const unitPrice = parseFloat(cost?.amountPerQuantity?.amount || 0);
  const originalUnitPrice = parseFloat(merchandise?.price?.amount || 0);
  const retailLineTotal = retailLineTotalForLine(line);

  const cartSubtotal = parseFloat(cart?.cost?.subtotalAmount?.amount || 0);
  const cartTotal = parseFloat(cart?.cost?.totalAmount?.amount || 0);
  const cartSavings = cartSubtotal - cartTotal;
  const discountPercentage =
    cartSubtotal > 0 ? (cartSavings / cartSubtotal) * 100 : 0;
  const computedDiscountedUnit =
    discountPercentage > 0 && originalUnitPrice > 0
      ? originalUnitPrice * (1 - discountPercentage / 100)
      : unitPrice;
  const displayUnitPrice =
    discountPercentage > 0 && originalUnitPrice > 0
      ? Math.round(computedDiscountedUnit * 100) / 100
      : unitPrice > 0
        ? unitPrice
        : computedDiscountedUnit;

  const displayLineTotal =
    discountPercentage > 0 && originalUnitPrice > 0
      ? Math.round(displayUnitPrice * quantity * 100) / 100
      : totalAmount;
  const hasDiscount =
    retailLineTotal > displayLineTotal + 0.005 && displayLineTotal >= 0;

  return {
    displayUnitPrice,
    displayLineTotal,
    hasDiscount,
    originalUnitPrice,
    retailLineTotal,
  };
}

/**
 * A single line item in the cart. It displays the product image, title, price.
 * It also provides controls to update the quantity or remove the line item.
 * @param {{
 *   layout: CartLayout;
 *   line?: CartLine;
 *   lines?: CartLine[];
 *   cart?: CartApiQueryFragment | null;
 *   pageGroupIndex?: number;
 *   pageSortableGrip?: {
 *     listeners: Record<string, unknown>;
 *     attributes: Record<string, unknown>;
 *     isDragging: boolean;
 *   };
 * }}
 */
export function CartLineItem({
  layout,
  line,
  lines: linesProp,
  cart,
  pageGroupIndex,
  pageSortableGrip,
}) {
  const lines = linesProp ?? (line ? [line] : []);
  const primaryLine = lines[0];
  if (!primaryLine) return null;

  const { id, merchandise } = primaryLine;
  const { product, title, image, selectedOptions } = merchandise;
  const lineItemUrl = useVariantUrl(product.handle, selectedOptions);
  const { pathname } = useLocation();
  const { close } = useAside();
  const navigate = useNavigate();

  const productPageUrl = useMemo(
    () =>
      getVariantUrl({
        handle: product.handle,
        pathname,
        searchParams: new URLSearchParams(),
      }),
    [pathname, product.handle],
  );

  const handleLineItemClick = () => {
    if (layout === 'aside') {
      close();
    }
    navigate(lineItemUrl);
  };

  const cartSubtotal = parseFloat(cart?.cost?.subtotalAmount?.amount || 0);
  const cartTotal = parseFloat(cart?.cost?.totalAmount?.amount || 0);
  const cartSavings = cartSubtotal - cartTotal;
  const discountPercentage =
    cartSubtotal > 0 ? (cartSavings / cartSubtotal) * 100 : 0;

  const asidePricing =
    layout !== 'page'
      ? computeCartLineDisplayPricing(primaryLine, cart)
      : null;
  const displayLineTotal = asidePricing?.displayLineTotal ?? 0;
  const hasDiscount = asidePricing?.hasDiscount ?? false;
  const retailLineTotal = asidePricing?.retailLineTotal ?? 0;

  // Get product title and remove everything after the last "-"
  const fullTitle = product.title;
  const displayTitle = fullTitle?.includes('-')
    ? fullTitle.substring(0, fullTitle.lastIndexOf('-')).trim()
    : fullTitle;

  const sizeOption = selectedOptions.find(
    (opt) => opt.name.toLowerCase().trim() === 'size',
  );

  const colorFromOptions = findColorSelectedOption(selectedOptions);
  const colorFromTitle =
    !colorFromOptions && sizeOption
      ? inferColorFromVariantTitle(title, sizeOption)
      : null;
  const colorFromAttributes = findColorInLineAttributes(
    primaryLine.attributes ?? [],
  );
  const colorFromProduct =
    !colorFromOptions
      ? inferColorFromProductTitle(fullTitle)
      : null;
  /** Shown on the cart row: variant options, line props, variant title, or product title tail. */
  const colorRow =
    colorFromOptions ||
    colorFromTitle ||
    colorFromAttributes ||
    colorFromProduct;

  const useAnchorForLoader = Boolean(sizeOption) && !colorFromOptions;
  const nonSize = nonSizeSelectedOptions(selectedOptions);
  const modalColorLabel =
    colorFromOptions?.name ||
    colorFromTitle?.name ||
    colorFromAttributes?.name ||
    colorFromProduct?.name ||
    findColorSelectedOption(selectedOptions)?.name ||
    (nonSize[0]?.name ?? 'Color');
  const modalColorValue = String(
    colorFromOptions?.value ??
    colorFromTitle?.value ??
    colorFromAttributes?.value ??
    colorFromProduct?.value ??
    findColorSelectedOption(selectedOptions)?.value ??
    nonSize[0]?.value ??
    '',
  );

  const canBulkEditSizes = Boolean(sizeOption);

  const otherOptions = selectedOptions.filter((opt) => {
    const name = opt.name.toLowerCase().trim();
    const matchesColorRow =
      colorRow &&
      opt.name === colorRow.name &&
      opt.value === colorRow.value;
    return (
      !matchesColorRow &&
      !isColorLikeOptionName(opt.name) &&
      name !== 'size'
    );
  });

  const lineClass =
    layout === 'page' ? 'cart-line cart-line--page' : 'cart-line';

  const [sizesModalOpen, setSizesModalOpen] = useState(false);
  const [addColorModalOpen, setAddColorModalOpen] = useState(false);
  const [removeGroupModalOpen, setRemoveGroupModalOpen] = useState(false);

  const pageLineIdsKey = lines.map((l) => l.id).join('::');
  const pageGroupKey = useMemo(
    () => groupKeyForLineGroup(lines),
    [pageLineIdsKey, lines],
  );
  const pageReorderEnabled = Boolean(pageSortableGrip);
  const anyLineOptimistic = lines.some((l) => l.isOptimistic);
  const removeAllLineIds = lines.map((l) => l.id);

  const pageInner = (
    <>
        <div
          className={
            'cart-line-page-card' +
            (pageReorderEnabled ? ' cart-line-page-card--reorder' : '') +
            (pageSortableGrip?.isDragging ? ' cart-line-page-card--sortable-dragging' : '')
          }
        >
          {pageReorderEnabled && pageSortableGrip ? (
            <div className="cart-line-page-toolbar">
              <span
                className="cart-line-page-drag-grip cart-line-page-drag-grip--sortable"
                aria-label="Drag to reorder cart row"
                {...pageSortableGrip.listeners}
                {...pageSortableGrip.attributes}
              >
                <GripVertical size={18} strokeWidth={2} aria-hidden />
              </span>
            </div>
          ) : null}
          <div className="cart-line-page-toolbar-remove">
            <span className="cart-line-page-remove-all-wrap">
              <button
                type="button"
                className="cart-line-remove-btn cart-line-remove-btn--close cart-line-remove-btn--remove-all"
                disabled={anyLineOptimistic}
                aria-label="Remove this product from cart"
                title="Remove from cart"
                onClick={(e) => {
                  e.stopPropagation();
                  setRemoveGroupModalOpen(true);
                }}
              >
                <svg
                  className="cart-line-remove-icon-close"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  aria-hidden
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </span>
          </div>
          <div className="cart-line-page-header">
            {image ? (
              <Link
                draggable={pageSortableGrip ? false : undefined}
                className="cart-line-page-media cart-line-page-media--header-thumb"
                to={lineItemUrl}
                onClick={() => close()}
              >
                {/* Match HomeFeaturedProductCard: no aspectRatio on Image (avoids CDN square-crop); square is CSS-only */}
                <div className="cart-line-page-header-image">
                  <Image
                    alt={title}
                    data={image}
                    sizes="100px"
                    width={280}
                  />
                </div>
              </Link>
            ) : (
              <span className="cart-line-page-media cart-line-page-media--empty cart-line-page-media--header-thumb">
                <span
                  className="cart-line-page-header-image cart-line-page-header-image--empty"
                  aria-hidden
                />
              </span>
            )}

            <div className="cart-line-page-info">
              <Link
                draggable={pageSortableGrip ? false : undefined}
                className="cart-line-page-title-link"
                to={lineItemUrl}
                onClick={() => close()}
              >
                <span className="cart-line-page-title-link__inner">
                  <p className="cart-line-product-name">{displayTitle}</p>
                  <span className="cart-line-page-title-link__arrow" aria-hidden>
                    <ArrowRight
                      size={16}
                      strokeWidth={2.25}
                      className="cart-line-page-title-link__arrow-icon"
                    />
                  </span>
                </span>
              </Link>
              <div className="cart-line-attributes cart-line-attributes--page">
                {colorRow && (
                  <span key={colorRow.name} className="cart-line-attribute">
                    {colorRow.name}: {colorRow.value}
                  </span>
                )}
                {otherOptions.map((option) => (
                  <span key={option.name} className="cart-line-attribute">
                    {option.name}: {option.value}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {lines.map((rowLine) => (
            <CartPageLineSizeRow key={rowLine.id} line={rowLine} cart={cart} />
          ))}

          <div className="cart-line-page-footer">
            {canBulkEditSizes ? (
              <button
                type="button"
                className="cart-line-page-footer-text-btn"
                onClick={() => setSizesModalOpen(true)}
              >
                <span className="cart-line-page-footer-text-btn__label">
                  Add/Edit Size(s)
                </span>
                <CartLinePageFooterActionIcon />
              </button>
            ) : (
              <Link
                className="cart-line-page-footer-text-btn"
                to={lineItemUrl}
                onClick={() => close()}
              >
                <span className="cart-line-page-footer-text-btn__label">
                  Add/Edit Size(s)
                </span>
                <CartLinePageFooterActionIcon />
              </Link>
            )}
            {canBulkEditSizes ? (
              <button
                type="button"
                className="cart-line-page-footer-text-btn"
                onClick={() => setAddColorModalOpen(true)}
              >
                <span className="cart-line-page-footer-text-btn__label">Add a Color</span>
                <CartLinePageFooterActionIcon />
              </button>
            ) : (
              <Link
                className="cart-line-page-footer-text-btn"
                to={productPageUrl}
                onClick={() => close()}
              >
                <span className="cart-line-page-footer-text-btn__label">Add a Color</span>
                <CartLinePageFooterActionIcon />
              </Link>
            )}
          </div>
        </div>

        {canBulkEditSizes ? (
          <CartEditSizesModal
            open={sizesModalOpen}
            onClose={() => setSizesModalOpen(false)}
            productHandle={product.handle}
            colorOptionName={
              useAnchorForLoader
                ? modalColorLabel
                : String(colorFromOptions?.name ?? 'Color')
            }
            colorValue={
              useAnchorForLoader
                ? modalColorValue
                : String(colorFromOptions?.value ?? '')
            }
            discountPercentage={discountPercentage}
            cart={cart ?? null}
            anchorVariantId={useAnchorForLoader ? merchandise.id : undefined}
            lineSelectedOptions={merchandise.selectedOptions ?? []}
          />
        ) : null}

        {canBulkEditSizes ? (
          <CartAddColorModal
            open={addColorModalOpen}
            onClose={() => setAddColorModalOpen(false)}
            productHandle={product.handle}
            colorOptionName={modalColorLabel}
            lineColorValue={modalColorValue}
            discountPercentage={discountPercentage}
            cart={cart ?? null}
          />
        ) : null}

        <CartRemoveGroupConfirmModal
          open={removeGroupModalOpen}
          onClose={() => setRemoveGroupModalOpen(false)}
          productTitle={displayTitle ?? ''}
          lineIds={removeAllLineIds}
          disabled={anyLineOptimistic}
        />
    </>
  );

  if (layout === 'page') {
    if (pageSortableGrip) {
      return pageInner;
    }
    return (
      <li key={lines.map((l) => l.id).join('::')} className={lineClass}>
        {pageInner}
      </li>
    );
  }

  return (
    <li key={id} className={lineClass} onClick={handleLineItemClick}>
      {image && (
        <div className="cart-line-image">
          <Image
            alt={title}
            data={image}
            aspectRatio="3/4" // typical apparel ratio
            width={80}
          />
        </div>
      )}

      <div className="cart-line-content">
        <p className="cart-line-product-name">{displayTitle}</p>
        <div className="cart-line-attributes">
          {sizeOption && (
            <span key={sizeOption.name} className="cart-line-attribute">
              {sizeOption.name}: {sizeOption.value}
            </span>
          )}
          {colorRow && (
            <span key={colorRow.name} className="cart-line-attribute">
              {colorRow.name}: {colorRow.value}
            </span>
          )}
          {otherOptions.map((option) => (
            <span key={option.name} className="cart-line-attribute">
              {option.name}: {option.value}
            </span>
          ))}
        </div>
        <div className="cart-line-controls" onClick={(e) => e.stopPropagation()}>
          <CartLineQuantity line={primaryLine} />
          <div className="cart-line-pricing">
            {hasDiscount ? (
              <span className="cart-line-price-original">
                ${retailLineTotal.toFixed(2)}
              </span>
            ) : null}
            <span className="cart-line-price-total">
              ${displayLineTotal.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}

/**
 * Quantity stepper (and optional remove for aside). `variant="page"` matches full cart row layout.
 * @param {{ line: CartLine; variant?: 'default' | 'page' }}
 */
function CartLineQuantity({ line, variant = 'default' }) {
  if (!line || typeof line?.quantity === 'undefined') return null;
  const { id: lineId, quantity, isOptimistic } = line;
  const prevQuantity = Number(Math.max(0, quantity - 1).toFixed(0));
  const nextQuantity = Number((quantity + 1).toFixed(0));

  const wrapClass =
    variant === 'page'
      ? 'cart-line-quantity-controls cart-line-quantity-controls--page'
      : 'cart-line-quantity-controls';

  return (
    <div className={wrapClass}>
      {variant === 'default' ? (
        <CartLineRemoveButton lineIds={[lineId]} disabled={!!isOptimistic} />
      ) : null}
      <div
        className={
          variant === 'page'
            ? 'cart-line-quantity-box cart-line-quantity-box--page'
            : 'cart-line-quantity-box'
        }
      >
        <CartLineUpdateButton lines={[{ id: lineId, quantity: prevQuantity }]}>
          <button
            className="cart-line-quantity-btn"
            aria-label="Decrease quantity"
            disabled={quantity <= 1 || !!isOptimistic}
            name="decrease-quantity"
            value={prevQuantity}
            onClick={(e) => e.stopPropagation()}
          >
            <span>−</span>
          </button>
        </CartLineUpdateButton>
        <span className="cart-line-quantity-value">{quantity}</span>
        <CartLineUpdateButton lines={[{ id: lineId, quantity: nextQuantity }]}>
          <button
            className="cart-line-quantity-btn"
            aria-label="Increase quantity"
            name="increase-quantity"
            value={nextQuantity}
            disabled={!!isOptimistic}
            onClick={(e) => e.stopPropagation()}
          >
            <span>+</span>
          </button>
        </CartLineUpdateButton>
      </div>
    </div>
  );
}

/**
 * Center-screen confirmation before removing every line in a grouped cart card.
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   productTitle: string;
 *   lineIds: string[];
 *   disabled: boolean;
 * }} props
 */
function CartRemoveGroupConfirmModal({
  open,
  onClose,
  productTitle,
  lineIds,
  disabled,
}) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useLayoutEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const root = (
    <div
      className="cart-remove-group-modal-root"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="cart-remove-group-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <header className="cart-remove-group-modal-header">
          <h2 id={titleId} className="cart-remove-group-modal-title">
            Remove from cart?
          </h2>
          <button
            type="button"
            className="cart-remove-group-modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="cart-remove-group-modal-body">
          <p id={descId} className="cart-remove-group-modal-text">
            Are you sure you want to remove{' '}
            <span className="cart-remove-group-modal-product">
              {productTitle || 'this product'}
            </span>{' '}
            and all of its sizes from your cart?
          </p>
        </div>
        <footer className="cart-remove-group-modal-footer">
          <button
            ref={cancelRef}
            type="button"
            className="cart-edit-sizes-btn cart-edit-sizes-btn--secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <CartForm
            fetcherKey={['remove-all', ...lineIds].sort().join('-')}
            route="/cart"
            action={CartForm.ACTIONS.LinesRemove}
            inputs={{ lineIds }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="submit"
              className="cart-edit-sizes-btn cart-edit-sizes-btn--danger"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                queueMicrotask(() => onClose());
              }}
            >
              Remove
            </button>
          </CartForm>
        </footer>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(root, document.body)
    : null;
}

function CartLineRemoveButton({ lineIds, disabled, removeVariant = 'trash' }) {
  const btnClass =
    removeVariant === 'close'
      ? 'cart-line-remove-btn cart-line-remove-btn--close'
      : 'cart-line-remove-btn';

  return (
    <CartForm
      fetcherKey={getUpdateKey(lineIds)}
      route="/cart"
      action={CartForm.ACTIONS.LinesRemove}
      inputs={{ lineIds }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className={btnClass}
        disabled={disabled}
        type="submit"
        aria-label="Remove item"
        onClick={(e) => e.stopPropagation()}
      >
        {removeVariant === 'close' ? (
          <svg
            className="cart-line-remove-icon-close"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            aria-hidden
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        )}
      </button>
    </CartForm>
  );
}

/**
 * @param {{
 *   children: React.ReactNode;
 *   lines: CartLineUpdateInput[];
 * }}
 */
function CartLineUpdateButton({ children, lines }) {
  const lineIds = lines.map((line) => line.id);

  return (
    <CartForm
      fetcherKey={getUpdateKey(lineIds)}
      route="/cart"
      action={CartForm.ACTIONS.LinesUpdate}
      inputs={{ lines }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </CartForm>
  );
}

/**
 * Returns a unique key for the update action. This is used to make sure actions modifying the same line
 * items are not run concurrently, but cancel each other. For example, if the user clicks "Increase quantity"
 * and "Decrease quantity" in rapid succession, the actions will cancel each other and only the last one will run.
 * @returns
 * @param {string[]} lineIds - line ids affected by the update
 */
function getUpdateKey(lineIds) {
  return [CartForm.ACTIONS.LinesUpdate, ...lineIds].join('-');
}

/**
 * One size row inside a grouped full-cart card.
 * @param {{ line: CartLine; cart: CartApiQueryFragment | null | undefined }}
 */
function CartPageLineSizeRow({ line, cart }) {
  const { id, merchandise, isOptimistic } = line;
  const { selectedOptions } = merchandise;
  const sizeOption = selectedOptions.find(
    (opt) => opt.name.toLowerCase().trim() === 'size',
  );
  const { displayLineTotal, hasDiscount, retailLineTotal } =
    computeCartLineDisplayPricing(line, cart);

  return (
    <div className="cart-line-page-size-row">
      <span className="cart-line-page-size-label">{sizeOption?.value ?? '—'}</span>
      <div className="cart-line-page-size-row-rest">
        <div
          className="cart-line-page-size-row-controls"
          onClick={(e) => e.stopPropagation()}
        >
          <CartLineRemoveButton
            lineIds={[id]}
            disabled={!!isOptimistic}
            removeVariant="close"
          />
          <CartLineQuantity line={line} variant="page" />
        </div>
        <div className="cart-line-page-size-row-price">
          {hasDiscount ? (
            <>
              <span className="cart-line-page-strike cart-line-page-strike--size-row">
                ${retailLineTotal.toFixed(2)}
              </span>
              <span className="cart-line-page-line-total cart-line-page-line-total--size-row">
                ${displayLineTotal.toFixed(2)}
              </span>
            </>
          ) : (
            <span className="cart-line-page-line-total cart-line-page-line-total--size-row">
              ${displayLineTotal.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** @typedef {OptimisticCartLine<CartApiQueryFragment>} CartLine */

/** @typedef {import('@shopify/hydrogen/storefront-api-types').CartLineUpdateInput} CartLineUpdateInput */
/** @typedef {import('~/components/CartMain').CartLayout} CartLayout */
/** @typedef {import('@shopify/hydrogen').OptimisticCartLine} OptimisticCartLine */
/** @typedef {import('storefrontapi.generated').CartApiQueryFragment} CartApiQueryFragment */
