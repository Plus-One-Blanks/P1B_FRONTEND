import {useCallback, useEffect, useId, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useFetcher, useLocation, useRevalidator} from 'react-router';
import {
  isColorLikeOptionName,
  sameNonSizeSelection,
} from '~/lib/cartEditSizes';
import {isLightSwatchHex} from '~/lib/featuredProductCard';
import {useCartModalSubmitFinish} from '~/lib/useCartModalSubmitFinish';
import {CartModalSubmitBusyLayer} from '~/components/CartModalSubmitBusyLayer';

/**
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   productHandle: string;
 *   colorOptionName: string;
 *   colorValue: string;
 *   discountPercentage: number;
 *   cart: import('storefrontapi.generated').CartApiQueryFragment | null;
 *   anchorVariantId?: string;
 *   lineSelectedOptions?: Array<{ name: string; value: string }>;
 * }} props
 */
export function CartEditSizesModal({
  open,
  onClose,
  productHandle,
  colorOptionName,
  colorValue,
  discountPercentage,
  cart,
  anchorVariantId,
  lineSelectedOptions = [],
}) {
  const titleId = useId();
  const location = useLocation();
  const fetcher = useFetcher();
  const submitFetcher = useFetcher();
  const revalidator = useRevalidator();
  const closeBtnRef = useRef(null);

  const [qtyByVariantId, setQtyByVariantId] = useState(() => ({}));

  const localePrefix = useMemo(() => {
    const m = location.pathname.match(/^(\/[a-z]{2}-[a-z]{2})\//i);
    return m?.[1] ?? '';
  }, [location.pathname]);

  const resourcePath = useMemo(
    () =>
      `${localePrefix}/cart-edit-sizes/${encodeURIComponent(productHandle)}`,
    [localePrefix, productHandle],
  );

  const loadUrl = useMemo(() => {
    const sp = new URLSearchParams();
    if (anchorVariantId) {
      sp.set('anchorVariant', anchorVariantId);
    } else {
      if (colorValue) sp.set('color', colorValue);
      if (colorOptionName) sp.set('optionName', colorOptionName);
    }
    const q = sp.toString();
    return q ? `${resourcePath}?${q}` : resourcePath;
  }, [resourcePath, colorValue, colorOptionName, anchorVariantId]);

  const variantToLineId = useMemo(() => {
    /** @type {Record<string, string>} */
    const map = {};
    const nodes = cart?.lines?.nodes ?? [];
    for (const line of nodes) {
      const m = line.merchandise;
      if (!m || !('product' in m) || !m.product?.handle) continue;
      if (m.product.handle !== productHandle) continue;
      const opts = m.selectedOptions ?? [];
      if (anchorVariantId) {
        if (
          lineSelectedOptions.length &&
          !sameNonSizeSelection(lineSelectedOptions, opts)
        ) {
          continue;
        }
      } else if (colorValue) {
        if (colorOptionName) {
          const o = opts.find(
            (x) =>
              x.name.toLowerCase().trim() ===
              colorOptionName.toLowerCase().trim(),
          );
          if (
            !o ||
            String(o.value).toLowerCase().trim() !==
              String(colorValue).toLowerCase().trim()
          ) {
            continue;
          }
        } else {
          const colorOpt = opts.find((o) => isColorLikeOptionName(o.name));
          if (
            colorOpt &&
            String(colorOpt.value).toLowerCase().trim() !==
              String(colorValue).toLowerCase().trim()
          ) {
            continue;
          }
        }
      }
      map[m.id] = line.id;
    }
    return map;
  }, [
    cart,
    productHandle,
    colorValue,
    colorOptionName,
    anchorVariantId,
    lineSelectedOptions,
  ]);

  useEffect(() => {
    if (!open) return;
    void fetcher.load(loadUrl);
    // fetcher identity changes every render; only reload when dialog opens or URL changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loadUrl]);

  /** Drop in-flight fetcher work when the dialog closes (avoids Mini-Oxygen / worker “hanging Promise” noise). */
  useEffect(() => {
    if (open) return;
    fetcher.unstable_reset?.();
    submitFetcher.unstable_reset?.();
  }, [open, fetcher, submitFetcher]);

  useEffect(() => {
    if (!open) return;
    const nodes = fetcher.data?.variants;
    if (!Array.isArray(nodes)) return;

    /** @type {Record<string, string>} */
    const next = {};
    for (const v of nodes) {
      const lineId = variantToLineId[v.id];
      const line = cart?.lines?.nodes?.find((l) => l.id === lineId);
      const q = Math.max(0, line?.quantity ?? 0);
      next[v.id] = q > 0 ? String(q) : '';
    }
    setQtyByVariantId(next);
  }, [open, fetcher.data, variantToLineId, cart]);

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus?.();
  }, [open]);

  const {overlayActive, postSubmitHold} = useCartModalSubmitFinish({
    open,
    submitFetcher,
    onClose,
    revalidator,
  });

  const submitEscapeBlockRef = useRef(false);
  submitEscapeBlockRef.current = overlayActive;

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape' && !submitEscapeBlockRef.current) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const displayUnit = useCallback(
    (priceAmount, compareAtAmount) => {
      const base = parseFloat(String(priceAmount || '0'));
      const compare = compareAtAmount
        ? parseFloat(String(compareAtAmount))
        : null;
      const strikeVal =
        compare != null && compare > base ? compare : null;
      const pct = discountPercentage > 0 ? discountPercentage / 100 : 0;
      const sale =
        pct > 0 && base > 0 ? Math.round(base * (1 - pct) * 100) / 100 : base;
      const showStrike = strikeVal != null || pct > 0;
      const strikeDisplay =
        strikeVal != null ? strikeVal : pct > 0 ? base : null;
      return {strikeVal: strikeDisplay, sale, showStrike};
    },
    [discountPercentage],
  );

  const handleSubmit = useCallback(() => {
    const variants = fetcher.data?.variants;
    if (!Array.isArray(variants)) return;

    const changes = variants.map((v) => {
      const raw = qtyByVariantId[v.id];
      const quantity = Math.max(
        0,
        Math.floor(Number.parseInt(String(raw ?? ''), 10) || 0),
      );
      const lineId = variantToLineId[v.id] ?? null;
      return {variantId: v.id, quantity, lineId};
    });

    const fd = new FormData();
    fd.set('payload', JSON.stringify({changes}));

    void submitFetcher.submit(fd, {
      method: 'POST',
      action: resourcePath,
    });
  }, [
    fetcher.data,
    qtyByVariantId,
    variantToLineId,
    submitFetcher,
    resourcePath,
  ]);

  if (!open) return null;

  const variants = fetcher.data?.variants;
  const loading = fetcher.state === 'loading' && !fetcher.data;
  const err = fetcher.data?.error;
  const colorHexFromTags =
    typeof fetcher.data?.colorHex === 'string' ? fetcher.data.colorHex : null;
  const swatchIsLight =
    Boolean(colorHexFromTags) && isLightSwatchHex(colorHexFromTags);

  const root = (
    <div
      className="cart-edit-sizes-modal-root"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !overlayActive) onClose();
      }}
    >
      <div
        className="cart-edit-sizes-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="cart-edit-sizes-modal-header">
          <h2 id={titleId} className="cart-edit-sizes-modal-title">
            Add/Edit Size(s)
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="cart-edit-sizes-modal-close"
            aria-label="Close"
            disabled={overlayActive}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="cart-edit-sizes-modal-body">
          {loading ? (
            <p className="cart-edit-sizes-modal-status">Loading sizes…</p>
          ) : err ? (
            <p className="cart-edit-sizes-modal-status">{err}</p>
          ) : (
            <>
              <div className="cart-edit-sizes-modal-color">
                <span className="cart-edit-sizes-modal-label">
                  {colorOptionName}:
                </span>
                <span
                  className={
                    'cart-edit-sizes-modal-swatch' +
                    (swatchIsLight ? ' cart-edit-sizes-modal-swatch--light' : '')
                  }
                  style={
                    colorHexFromTags
                      ? {backgroundColor: colorHexFromTags}
                      : undefined
                  }
                  title={
                    colorHexFromTags
                      ? `${colorValue || '—'} (${colorHexFromTags})`
                      : colorValue || '—'
                  }
                  aria-hidden
                />
                <span className="cart-edit-sizes-modal-color-name">
                  {colorValue || '—'}
                </span>
              </div>

              <hr className="cart-edit-sizes-modal-rule" />

              <p className="cart-edit-sizes-modal-section-title">Choose Size(s)</p>

              <div className="cart-edit-sizes-grid">
                {Array.isArray(variants) &&
                  variants.map((v) => {
                    const rawQty = qtyByVariantId[v.id] ?? '';
                    const q =
                      rawQty === ''
                        ? 0
                        : Math.max(0, Number.parseInt(rawQty, 10) || 0);
                    const inCart = q > 0;
                    const {strikeVal, sale, showStrike} = displayUnit(
                      v.price,
                      v.compareAtPrice,
                    );
                    return (
                      <div key={v.id} className="cart-edit-sizes-cell">
                        <label
                          className="cart-edit-sizes-size-label"
                          htmlFor={`sz-${v.id}`}
                        >
                          {v.sizeLabel}
                        </label>
                        <input
                          id={`sz-${v.id}`}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className={
                            'cart-edit-sizes-qty-input' +
                            (inCart ? ' cart-edit-sizes-qty-input--active' : '')
                          }
                          value={qtyByVariantId[v.id] ?? ''}
                          placeholder="-"
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '');
                            if (digits === '') {
                              setQtyByVariantId((prev) => ({
                                ...prev,
                                [v.id]: '',
                              }));
                              return;
                            }
                            const n = Number.parseInt(digits, 10);
                            if (Number.isNaN(n) || n === 0) {
                              setQtyByVariantId((prev) => ({
                                ...prev,
                                [v.id]: '',
                              }));
                              return;
                            }
                            setQtyByVariantId((prev) => ({
                              ...prev,
                              [v.id]: String(n),
                            }));
                          }}
                          onFocus={(e) => {
                            if (e.target.value.length > 0) e.target.select();
                          }}
                          disabled={!v.availableForSale}
                          aria-label={`Quantity for size ${v.sizeLabel}`}
                        />
                        <div className="cart-edit-sizes-prices">
                          {showStrike && strikeVal != null ? (
                            <span className="cart-edit-sizes-strike">
                              ${Number(strikeVal).toFixed(2)}
                            </span>
                          ) : null}
                          <span className="cart-edit-sizes-sale">
                            ${sale.toFixed(2)}
                          </span>
                        </div>
                        {inCart ? (
                          <span className="cart-edit-sizes-in-cart">In cart</span>
                        ) : (
                          <span className="cart-edit-sizes-in-cart-spacer" />
                        )}
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </div>

        <footer className="cart-edit-sizes-modal-footer">
          <button
            type="button"
            className="cart-edit-sizes-btn cart-edit-sizes-btn--secondary"
            disabled={overlayActive}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="cart-edit-sizes-btn cart-edit-sizes-btn--primary"
            disabled={
              loading ||
              !!err ||
              overlayActive ||
              !Array.isArray(variants)
            }
            onClick={handleSubmit}
          >
            Update
          </button>
        </footer>

        <CartModalSubmitBusyLayer
          active={overlayActive}
          successPhase={postSubmitHold}
          submittingLabel="Updating your cart…"
          successLabel="Cart updated"
        />
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(root, document.body)
    : null;
}
