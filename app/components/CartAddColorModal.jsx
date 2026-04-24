import {ChevronLeft, ChevronRight} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {createPortal} from 'react-dom';
import {useFetcher, useLocation, useRevalidator} from 'react-router';
import {ColorDropdown} from '~/components/ColorDropdown';
import {isColorLikeOptionName} from '~/lib/cartEditSizes';
import {useCartModalSubmitFinish} from '~/lib/useCartModalSubmitFinish';
import {CartModalSubmitBusyLayer} from '~/components/CartModalSubmitBusyLayer';

/**
 * “Add a Color” — same data + POST target as {@link CartEditSizesModal}, with `mode=addColor` extras from the loader.
 *
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   productHandle: string;
 *   colorOptionName: string;
 *   lineColorValue: string;
 *   discountPercentage: number;
 *   cart: import('storefrontapi.generated').CartApiQueryFragment | null;
 * }} props
 */
export function CartAddColorModal({
  open,
  onClose,
  productHandle,
  colorOptionName,
  lineColorValue,
  discountPercentage,
  cart,
}) {
  const titleId = useId();
  const colorDropdownTriggerId = useId();
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

  const initialResourcePath = useMemo(
    () =>
      `${localePrefix}/cart-edit-sizes/${encodeURIComponent(productHandle)}`,
    [localePrefix, productHandle],
  );

  const loadUrl = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('mode', 'addColor');
    if (colorOptionName) sp.set('optionName', colorOptionName);
    if (lineColorValue) sp.set('currentColor', lineColorValue);
    return `${initialResourcePath}?${sp.toString()}`;
  }, [initialResourcePath, colorOptionName, lineColorValue]);

  const loadedHandle = String(fetcher.data?.productHandle ?? productHandle);

  const resourcePath = useMemo(
    () =>
      `${localePrefix}/cart-edit-sizes/${encodeURIComponent(loadedHandle)}`,
    [localePrefix, loadedHandle],
  );

  const usesSiblingColors = Boolean(fetcher.data?.addColorUsesSiblings);
  const activeColorValue = String(fetcher.data?.colorValue ?? '').trim();

  const variantToLineId = useMemo(() => {
    /** @type {Record<string, string>} */
    const map = {};
    const nodes = cart?.lines?.nodes ?? [];
    for (const line of nodes) {
      const m = line.merchandise;
      if (!m || !('product' in m) || !m.product?.handle) continue;
      if (m.product.handle !== loadedHandle) continue;
      if (usesSiblingColors) {
        map[m.id] = line.id;
        continue;
      }
      const opts = m.selectedOptions ?? [];
      if (activeColorValue) {
        if (colorOptionName) {
          const o = opts.find(
            (x) =>
              x.name.toLowerCase().trim() ===
              colorOptionName.toLowerCase().trim(),
          );
          if (
            !o ||
            String(o.value).toLowerCase().trim() !==
              activeColorValue.toLowerCase().trim()
          ) {
            continue;
          }
        } else {
          const colorOpt = opts.find((o) => isColorLikeOptionName(o.name));
          if (
            !colorOpt ||
            String(colorOpt.value).toLowerCase().trim() !==
              activeColorValue.toLowerCase().trim()
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
    loadedHandle,
    usesSiblingColors,
    activeColorValue,
    colorOptionName,
  ]);

  useEffect(() => {
    if (!open) return;
    void fetcher.load(loadUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loadUrl]);

  useEffect(() => {
    if (open) return;
    fetcher.unstable_reset?.();
    submitFetcher.unstable_reset?.();
  }, [open, fetcher, submitFetcher]);

  const selectColor = useCallback(
    (value) => {
      const sp = new URLSearchParams();
      sp.set('mode', 'addColor');
      sp.set('color', value);
      if (colorOptionName) sp.set('optionName', colorOptionName);
      void fetcher.load(`${initialResourcePath}?${sp.toString()}`);
    },
    [fetcher, initialResourcePath, colorOptionName],
  );

  const selectProductByHandle = useCallback(
    (h) => {
      const sp = new URLSearchParams();
      sp.set('mode', 'addColor');
      void fetcher.load(
        `${localePrefix}/cart-edit-sizes/${encodeURIComponent(h)}?${sp.toString()}`,
      );
    },
    [fetcher, localePrefix],
  );

  const dropdownColors = useMemo(() => {
    const usesSib = Boolean(fetcher.data?.addColorUsesSiblings);
    const sc = fetcher.data?.siblingColors;
    const pal = fetcher.data?.palette;
    if (usesSib && Array.isArray(sc) && sc.length) {
      return sc.map((c) => ({
        code: c.code,
        name: c.name,
        formattedCode: c.formattedCode,
        product: {handle: c.productHandle},
        image: c.imageUrl
          ? {url: c.imageUrl, altText: c.imageAlt ?? c.name}
          : null,
        imageUrl: c.imageUrl ?? null,
      }));
    }
    if (Array.isArray(pal) && pal.length) {
      return pal.map((p) => ({
        code: p.value,
        name: p.value,
        formattedCode: null,
        product: {handle: loadedHandle},
        image: p.imageUrl
          ? {url: p.imageUrl, altText: p.imageAlt ?? p.value}
          : null,
        imageUrl: p.imageUrl ?? null,
      }));
    }
    return [];
  }, [
    fetcher.data?.addColorUsesSiblings,
    fetcher.data?.siblingColors,
    fetcher.data?.palette,
    loadedHandle,
  ]);

  const dropdownSelectedColor = useMemo(() => {
    if (!fetcher.data) return null;
    if (fetcher.data.addColorUsesSiblings) {
      const c = fetcher.data.selectedColorCode;
      return c ? String(c) : null;
    }
    const v = String(fetcher.data.colorValue ?? '').trim();
    return v || null;
  }, [
    fetcher.data?.addColorUsesSiblings,
    fetcher.data?.selectedColorCode,
    fetcher.data?.colorValue,
    fetcher.data,
  ]);

  const handleDropdownColor = useCallback(
    (code, product) => {
      if (
        usesSiblingColors &&
        product &&
        typeof product === 'object' &&
        'handle' in product &&
        product.handle
      ) {
        selectProductByHandle(String(product.handle));
        return;
      }
      selectColor(String(code));
    },
    [usesSiblingColors, selectProductByHandle, selectColor],
  );

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

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
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
  const palette = Array.isArray(fetcher.data?.palette)
    ? fetcher.data.palette
    : [];
  const siblingColors = Array.isArray(fetcher.data?.siblingColors)
    ? fetcher.data.siblingColors
    : [];
  const colorCount =
    typeof fetcher.data?.colorCount === 'number'
      ? fetcher.data.colorCount
      : usesSiblingColors
        ? siblingColors.length
        : palette.length;
  const heroImage = fetcher.data?.heroImage;

  const root = (
    <div
      className="cart-edit-sizes-modal-root"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !overlayActive) onClose();
      }}
    >
      <div
        className="cart-edit-sizes-modal cart-add-color-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="cart-edit-sizes-modal-header">
          <h2 id={titleId} className="cart-edit-sizes-modal-title">
            Add a Color
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

        <div className="cart-edit-sizes-modal-body cart-add-color-modal-body">
          {loading ? (
            <p className="cart-edit-sizes-modal-status">Loading…</p>
          ) : err ? (
            <p className="cart-edit-sizes-modal-status">{err}</p>
          ) : (
            <>
              <div className="cart-add-color-modal-hero">
                {heroImage?.url ? (
                  <img
                    className="cart-add-color-modal-hero-img"
                    src={heroImage.url}
                    alt={heroImage.alt || 'Product'}
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="cart-add-color-modal-hero-placeholder"
                    aria-hidden
                  />
                )}
              </div>

              <hr className="cart-edit-sizes-modal-rule cart-add-color-modal-rule--tight" />

              <div className="cart-add-color-modal-color-toolbar">
                <div className="product-color-selector cart-add-color-modal-product-color-selector">
                  <div className="color-selector-label cart-add-color-modal-color-heading">
                    <label htmlFor={colorDropdownTriggerId}>Selected Color</label>
                    {colorCount > 0 ? (
                      <span className="cart-add-color-modal-count-badge">
                        {colorCount} colors
                      </span>
                    ) : null}
                  </div>
                  {dropdownColors.length > 0 ? (
                    <ColorDropdown
                      colors={dropdownColors}
                      selectedColor={dropdownSelectedColor}
                      onColorSelect={handleDropdownColor}
                      triggerId={colorDropdownTriggerId}
                    />
                  ) : null}
                </div>
              </div>

              {usesSiblingColors && siblingColors.length ? (
                <CartAddColorSwatchStrip
                  stripKey={`s-${siblingColors.length}-${loadedHandle}`}
                >
                  {siblingColors.map((c) => {
                    const active = c.productHandle === loadedHandle;
                    return (
                      <button
                        key={c.productHandle}
                        type="button"
                        role="listitem"
                        className={
                          'cart-add-color-modal-swatch-btn' +
                          (active
                            ? ' cart-add-color-modal-swatch-btn--selected'
                            : '')
                        }
                        aria-label={c.name}
                        title={c.name}
                        aria-pressed={active}
                        onClick={() => selectProductByHandle(c.productHandle)}
                      >
                        <div className="cart-add-color-modal-swatch-face-wrap">
                          <span
                            className="cart-add-color-modal-swatch-face"
                            style={{
                              backgroundColor:
                                c.formattedCode || `#${c.code}`,
                            }}
                            aria-hidden
                          />
                          {active ? (
                            <svg
                              className="cart-add-color-modal-swatch-check"
                              width="11"
                              height="11"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden
                            >
                              <path d="M13 3L6 10l-3-3" />
                            </svg>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </CartAddColorSwatchStrip>
              ) : palette.length ? (
                <CartAddColorSwatchStrip
                  stripKey={`p-${palette.length}-${activeColorValue}`}
                >
                  {palette.map((p) => {
                    const active =
                      p.value.toLowerCase().trim() ===
                      activeColorValue.toLowerCase().trim();
                    return (
                      <button
                        key={p.value}
                        type="button"
                        role="listitem"
                        className={
                          'cart-add-color-modal-swatch-btn' +
                          (active
                            ? ' cart-add-color-modal-swatch-btn--selected'
                            : '')
                        }
                        title={p.value}
                        aria-label={`Color ${p.value}`}
                        aria-pressed={active}
                        onClick={() => selectColor(p.value)}
                      >
                        <div className="cart-add-color-modal-swatch-face-wrap">
                          <span
                            className={
                              'cart-add-color-modal-swatch-face cart-add-color-modal-swatch-face--thumb' +
                              (p.imageUrl ? '' : ' cart-add-color-modal-swatch-face--empty')
                            }
                            style={
                              p.imageUrl
                                ? {
                                    backgroundImage: `url(${p.imageUrl})`,
                                  }
                                : undefined
                            }
                            aria-hidden
                          />
                          {active ? (
                            <svg
                              className="cart-add-color-modal-swatch-check"
                              width="11"
                              height="11"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden
                            >
                              <path d="M13 3L6 10l-3-3" />
                            </svg>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </CartAddColorSwatchStrip>
              ) : null}

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
                          htmlFor={`ac-${v.id}`}
                        >
                          {v.sizeLabel}
                        </label>
                        <input
                          id={`ac-${v.id}`}
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
            className="cart-edit-sizes-btn cart-edit-sizes-btn--primary cart-add-color-modal-primary"
            disabled={
              loading ||
              !!err ||
              overlayActive ||
              !Array.isArray(variants)
            }
            onClick={handleSubmit}
          >
            Add to Cart
          </button>
        </footer>

        <CartModalSubmitBusyLayer
          active={overlayActive}
          successPhase={postSubmitHold}
          submittingLabel="Adding to cart…"
          successLabel="Added to cart"
        />
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(root, document.body)
    : null;
}

/**
 * Horizontal swatches with floating scroll arrows (right when overflow; left after scroll).
 * @param {{ stripKey: string; children: React.ReactNode; listLabel?: string }} props
 */
function CartAddColorSwatchStrip({stripKey, children, listLabel = 'Colors'}) {
  const scrollRef = useRef(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setShowLeft(false);
      setShowRight(false);
      return;
    }
    const {scrollLeft, scrollWidth, clientWidth} = el;
    if (scrollWidth <= clientWidth + 1) {
      setShowLeft(false);
      setShowRight(false);
      return;
    }
    setShowLeft(scrollLeft > 4);
    setShowRight(scrollLeft < scrollWidth - clientWidth - 4);
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, stripKey]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, {passive: true});
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      ro.disconnect();
    };
  }, [measure, stripKey]);

  const scrollStep = useCallback(
    (dir) => {
      scrollRef.current?.scrollBy({left: dir * 120, behavior: 'smooth'});
    },
    [],
  );

  return (
    <div className="cart-add-color-modal-swatch-strip">
      {showLeft ? (
        <button
          type="button"
          className="cart-add-color-modal-swatch-scroll-fab cart-add-color-modal-swatch-scroll-fab--left"
          aria-label="Scroll colors left"
          onClick={() => scrollStep(-1)}
        >
          <ChevronLeft size={18} strokeWidth={2} aria-hidden />
        </button>
      ) : null}
      <div
        ref={scrollRef}
        className="cart-add-color-modal-swatch-scroller"
        style={{
          paddingLeft: showLeft ? '2.35rem' : 0,
          paddingRight: showRight ? '2.35rem' : 0,
        }}
      >
        <div className="cart-add-color-modal-swatch-scroller-inner">
          <div
            className="cart-add-color-modal-swatch-row"
            role="list"
            aria-label={listLabel}
          >
            {children}
          </div>
        </div>
      </div>
      {showRight ? (
        <button
          type="button"
          className="cart-add-color-modal-swatch-scroll-fab cart-add-color-modal-swatch-scroll-fab--right"
          aria-label="Scroll colors right"
          onClick={() => scrollStep(1)}
        >
          <ChevronRight size={18} strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
