import {useEffect, useId, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Link} from 'react-router';
import {CartForm, Money} from '@shopify/hydrogen';
import {
  Calculator,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  CircleHelp,
  Droplets,
  FolderOpen,
  Package,
  Plus,
  ShieldCheck,
  Shirt,
  Sparkles,
  Star,
  Tag,
  X,
} from 'lucide-react';
import {removeEdgeBackground} from '~/lib/designStudioApi';
import {
  detectSolidBackground,
  loadImageDims,
  readFileAsDataUrl,
} from '~/lib/dtfGangSheetHelpers';
import {
  DTF_TRANSFER_BY_SIZE_PRODUCT_HANDLE,
  DTF_TRANSFER_QTY_TIERS,
  DTF_TRANSFER_SIZES,
  nearestTransferSizeId,
  transferQtyTier,
} from '~/lib/dtfSheetConstants';
import {DTF_TRANSFER_ATTR} from '~/lib/dtfGangSheetOrderAttributes';
import {DtfTransferCustomizeStep} from '~/components/DtfGangSheet/DtfTransferCustomizeStep';

/**
 * @typedef {{
 *   id: string;
 *   name: string;
 *   fileName: string;
 *   originalDataUrl: string;
 *   dataUrl: string;
 *   bgRemoved: boolean;
 *   naturalWidth: number;
 *   naturalHeight: number;
 *   widthIn: number;
 *   heightIn: number;
 *   sizeMode: 'custom' | 'popular';
 *   sizeId: string;
 *   qty: number;
 * }} TransferDesign
 */

/**
 * Ninja-inspired DTF Transfers by Size page — Plus 1 branded.
 *
 * @param {{
 *   product: {
 *     id?: string;
 *     handle?: string;
 *     title?: string;
 *     description?: string;
 *     featuredImage?: { url?: string; altText?: string } | null;
 *     images?: { nodes?: Array<{ url: string; altText?: string }> };
 *     variants?: { nodes?: Array<{
 *       id: string;
 *       title: string;
 *       availableForSale?: boolean;
 *       price?: { amount: string; currencyCode: string };
 *     }> };
 *   } | null;
 * }} props
 */
export function DtfTransferBySizePage({product}) {
  const fileRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const inputId = useId();

  const [designs, setDesigns] = useState(/** @type {TransferDesign[]} */ ([]));
  const [activeId, setActiveId] = useState(/** @type {string | null} */ (null));
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [bgBusy, setBgBusy] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [calcOpen, setCalcOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(
    /** @type {string | null} */ (null),
  );
  const [previewBg, setPreviewBg] = useState('check');
  /** @type {'pdp' | 'loading' | 'studio'} */
  const [view, setView] = useState('pdp');
  const [loadStep, setLoadStep] = useState(0);
  const [studioEnter, setStudioEnter] = useState(false);

  const variants = product?.variants?.nodes || [];
  const active = designs.find((d) => d.id === activeId) || designs[0] || null;

  const gallery = useMemo(() => {
    if (product?.images?.nodes?.length) return product.images.nodes;
    if (product?.featuredImage?.url) return [product.featuredImage];
    return [];
  }, [product]);

  const fromPrice = useMemo(() => {
    const min = DTF_TRANSFER_SIZES.reduce((m, s) => {
      const v = findVariant(variants, s.id);
      const amount = Number(v?.price?.amount || s.defaultPrice);
      return Number.isFinite(amount) ? Math.min(m, amount) : m;
    }, Number.POSITIVE_INFINITY);
    return Number.isFinite(min) ? min : 1.49;
  }, [variants]);

  const cartLines = useMemo(() => {
    return designs
      .map((d) => {
        const sizeId = nearestTransferSizeId(
          Math.max(d.widthIn, d.heightIn),
        );
        const v = findVariant(variants, sizeId);
        if (!v?.id) return null;
        const size = DTF_TRANSFER_SIZES.find((s) => s.id === sizeId);
        return {
          merchandiseId: v.id,
          quantity: Math.max(1, d.qty),
          attributes: [
            {key: DTF_TRANSFER_ATTR.designLabel, value: truncate(d.name)},
            {
              key: DTF_TRANSFER_ATTR.transferSize,
              value: truncate(
                `${roundIn(d.widthIn)}" × ${roundIn(d.heightIn)}"`,
              ),
            },
            {
              key: DTF_TRANSFER_ATTR.notes,
              value: truncate(
                [
                  size?.label ? `Bucket ${size.label}` : '',
                  d.bgRemoved ? 'BG removed' : '',
                  d.fileName,
                ]
                  .filter(Boolean)
                  .join(' · '),
              ),
            },
          ],
        };
      })
      .filter(Boolean);
  }, [designs, variants]);

  const orderTotal = useMemo(
    () =>
      designs.reduce((sum, d) => {
        const unit = unitPrice(variants, d);
        return sum + unit * Math.max(1, d.qty);
      }, 0),
    [designs, variants],
  );

  const totalQty = designs.reduce((n, d) => n + Math.max(1, d.qty), 0);

  useEffect(() => {
    if (!activeId && designs[0]) setActiveId(designs[0].id);
  }, [designs, activeId]);

  useEffect(() => {
    if (view !== 'loading') {
      setLoadStep(0);
      return undefined;
    }
    setLoadStep(0);
    const timers = [
      window.setTimeout(() => setLoadStep(1), 450),
      window.setTimeout(() => setLoadStep(2), 950),
      window.setTimeout(() => setLoadStep(3), 1400),
    ];
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [view]);

  useEffect(() => {
    if (view !== 'studio') {
      setStudioEnter(false);
      return undefined;
    }
    const id = window.requestAnimationFrame(() => setStudioEnter(true));
    return () => window.cancelAnimationFrame(id);
  }, [view]);

  /**
   * @param {FileList | File[] | null} fileList
   */
  async function onUpload(fileList) {
    const files = Array.from(fileList || []).filter((f) =>
      String(f.type || '').startsWith('image/'),
    );
    if (!files.length) return;
    const enteringFromPdp = view === 'pdp' || !designs.length;
    if (enteringFromPdp) setView('loading');
    setUploadBusy(true);
    setError(null);
    try {
      /** @type {TransferDesign[]} */
      const next = [];
      for (const file of files.slice(0, 25)) {
        if (file.size > 25 * 1024 * 1024) {
          setError(`${file.name} is over 25 MB.`);
          continue;
        }
        const dataUrl = await readFileAsDataUrl(file);
        const dims = await loadImageDims(dataUrl);
        const aspect = dims.w / Math.max(1, dims.h);
        // Default popular left-chest size, preserve aspect
        const base = DTF_TRANSFER_SIZES.find((s) => s.id === '4x4') || DTF_TRANSFER_SIZES[2];
        let widthIn = base.widthIn;
        let heightIn = base.heightIn;
        if (aspect >= 1) {
          heightIn = roundIn(widthIn / aspect);
        } else {
          widthIn = roundIn(heightIn * aspect);
        }
        const design = {
          id: `des-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name.replace(/\.[^.]+$/, '') || 'Design',
          fileName: file.name,
          originalDataUrl: dataUrl,
          dataUrl,
          bgRemoved: false,
          naturalWidth: dims.w,
          naturalHeight: dims.h,
          widthIn,
          heightIn,
          sizeMode: /** @type {'popular'} */ ('popular'),
          sizeId: base.id,
          qty: 1,
        };
        // Auto-clean solid backgrounds like gang sheet studio
        const detect = await detectSolidBackground(dataUrl);
        if (detect.detected) {
          try {
            const cleaned = await removeEdgeBackground(dataUrl, {tolerance: 42});
            design.dataUrl = cleaned;
            design.bgRemoved = true;
          } catch {
            /* keep original */
          }
        }
        next.push(design);
      }
      if (next.length) {
        setDesigns((prev) => [...prev, ...next]);
        setActiveId(next[0].id);
        if (enteringFromPdp) {
          await new Promise((r) => setTimeout(r, 1600));
        }
        setView('studio');
      } else if (enteringFromPdp) {
        setView('pdp');
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Upload failed');
      if (enteringFromPdp && !designs.length) setView('pdp');
    } finally {
      setUploadBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  /**
   * @param {string} id
   * @param {Partial<TransferDesign>} patch
   */
  function patchDesign(id, patch) {
    setDesigns((prev) =>
      prev.map((d) => (d.id === id ? {...d, ...patch} : d)),
    );
  }

  async function toggleBgRemove() {
    if (!active) return;
    if (active.bgRemoved) {
      patchDesign(active.id, {
        dataUrl: active.originalDataUrl,
        bgRemoved: false,
      });
      return;
    }
    setBgBusy(true);
    try {
      const cleaned = await removeEdgeBackground(active.originalDataUrl, {
        tolerance: 42,
      });
      patchDesign(active.id, {dataUrl: cleaned, bgRemoved: true});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Background removal failed');
    } finally {
      setBgBusy(false);
    }
  }

  /**
   * @param {string} sizeId
   */
  function applyPopularSize(sizeId) {
    if (!active) return;
    const size = DTF_TRANSFER_SIZES.find((s) => s.id === sizeId);
    if (!size) return;
    const aspect =
      active.naturalWidth / Math.max(1, active.naturalHeight);
    let widthIn = size.widthIn;
    let heightIn = size.heightIn;
    // Fit inside square without stretching
    if (aspect >= 1) {
      heightIn = roundIn(Math.min(size.heightIn, size.widthIn / aspect));
      widthIn = roundIn(heightIn * aspect);
      if (widthIn > size.widthIn) {
        widthIn = size.widthIn;
        heightIn = roundIn(widthIn / aspect);
      }
    } else {
      widthIn = roundIn(Math.min(size.widthIn, size.heightIn * aspect));
      heightIn = roundIn(widthIn / aspect);
      if (heightIn > size.heightIn) {
        heightIn = size.heightIn;
        widthIn = roundIn(heightIn * aspect);
      }
    }
    patchDesign(active.id, {
      sizeId,
      sizeMode: 'popular',
      widthIn,
      heightIn,
    });
  }

  const inStudio = view === 'studio' && designs.length > 0;
  const showLoading = view === 'loading';
  const showPdp = view === 'pdp' || view === 'loading';
  const loadSteps = [
    'Reading your artwork',
    'Cleaning the background',
    'Building size previews',
    'Opening your studio',
  ];

  return (
    <div
      className={`ninja-size${inStudio ? ' ninja-size--studio' : ''}${
        showLoading ? ' is-transitioning' : ''
      }`}
    >
      {showLoading ? (
        <div className="ns-studio-transition" role="status" aria-live="polite">
          <div className="ns-studio-transition-glow" aria-hidden />
          <div className="ns-studio-transition-panel">
            <span className="ns-studio-transition-mark" aria-hidden>
              +1
            </span>
            <p className="ns-studio-transition-kicker">Plus 1 DTF</p>
            <h2 className="ns-studio-transition-title">
              Preparing your transfer
            </h2>
            <p
              key={loadSteps[loadStep] || loadSteps[0]}
              className="ns-studio-transition-status"
            >
              {loadSteps[loadStep] || loadSteps[0]}
            </p>

            <div className="ns-studio-transition-progress" aria-hidden>
              <span
                className="ns-studio-transition-progress-fill"
                style={{
                  width: `${((loadStep + 1) / loadSteps.length) * 100}%`,
                }}
              />
            </div>

            <ol className="ns-studio-transition-pips" aria-hidden>
              {loadSteps.map((label, i) => (
                <li
                  key={label}
                  className={
                    i < loadStep
                      ? 'is-done'
                      : i === loadStep
                        ? 'is-active'
                        : undefined
                  }
                />
              ))}
            </ol>
          </div>
        </div>
      ) : null}

      {inStudio ? (
        <div
          className={`ns-studio-shell${studioEnter ? ' is-enter' : ''}`}
        >
          <div className="ns-studio-topbar">
            <button
              type="button"
              className="ninja-size-back"
              onClick={() => {
                setDesigns([]);
                setActiveId(null);
                setView('pdp');
              }}
            >
              ← Back to product
            </button>
            <div className="ns-studio-topbar-copy">
              <p className="ns-studio-kicker">Plus 1 DTF</p>
              <h1>Customize your transfer</h1>
            </div>
            <button
              type="button"
              className="ns-studio-topbar-upload"
              onClick={() => fileRef.current?.click()}
              disabled={uploadBusy}
            >
              <CloudUpload size={16} strokeWidth={2.25} aria-hidden />
              Upload more
            </button>
          </div>

          <DtfTransferCustomizeStep
            designs={designs}
            active={active}
            variants={variants}
            previewBg={previewBg}
            setPreviewBg={setPreviewBg}
            bgBusy={bgBusy}
            onSelect={setActiveId}
            onRemove={(id) => {
              setDesigns((prev) => {
                const next = prev.filter((d) => d.id !== id);
                if (activeId === id) setActiveId(next[0]?.id || null);
                if (!next.length) setView('pdp');
                return next;
              });
            }}
            onPatch={patchDesign}
            onToggleBg={toggleBgRemove}
            onPopular={applyPopularSize}
            onAddMore={() => fileRef.current?.click()}
          />

          <section className="ninja-size-checkout ns-studio-checkout">
            <div className="ninja-size-checkout-summary">
              <div>
                <span>
                  {designs.length} design{designs.length === 1 ? '' : 's'} ·{' '}
                  {totalQty} transfer{totalQty === 1 ? '' : 's'}
                </span>
                <strong>${orderTotal.toFixed(2)}</strong>
              </div>
              {cartLines.length ? (
                <CartForm
                  route="/cart"
                  action={CartForm.ACTIONS.LinesAdd}
                  inputs={{lines: cartLines}}
                >
                  {(fetcher) => (
                    <button
                      type="submit"
                      className="ninja-size-cta"
                      disabled={fetcher.state !== 'idle'}
                    >
                      {fetcher.state !== 'idle' ? 'Adding…' : 'Proceed to cart'}
                    </button>
                  )}
                </CartForm>
              ) : (
                <p className="ninja-size-warn">
                  Matching Shopify variants not found for selected sizes.
                </p>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {showPdp ? (
        <div
          className={`ninja-size-pdp${showLoading ? ' is-dimmed' : ''}`}
          aria-hidden={showLoading || undefined}
        >
      <div className="ninja-size-grid">
        {/* ── Left: product gallery (div — global `aside` is cart drawer) ── */}
        <div className="ninja-size-gallery">
          <div className="ninja-size-hero">
            {gallery[galleryIndex]?.url ? (
              <img
                src={gallery[galleryIndex].url}
                alt={
                  gallery[galleryIndex].altText ||
                  product?.title ||
                  'DTF transfers'
                }
              />
            ) : (
              <div className="ninja-size-hero-fallback" aria-hidden>
                <span className="ninja-size-hero-pill">Plus 1 DTF</span>
                <div className="ninja-size-hero-card">
                  <span>+1</span>
                  <small>Transfer preview</small>
                </div>
              </div>
            )}
            {gallery.length > 1 ? (
              <>
                <button
                  type="button"
                  className="ninja-size-hero-nav ninja-size-hero-nav--prev"
                  aria-label="Previous image"
                  onClick={() =>
                    setGalleryIndex(
                      (i) => (i - 1 + gallery.length) % gallery.length,
                    )
                  }
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  className="ninja-size-hero-nav ninja-size-hero-nav--next"
                  aria-label="Next image"
                  onClick={() =>
                    setGalleryIndex((i) => (i + 1) % gallery.length)
                  }
                >
                  <ChevronRight size={18} />
                </button>
              </>
            ) : null}
          </div>
          {gallery.length > 1 ? (
            <div className="ninja-size-thumbs">
              {gallery.map((img, i) => (
                <button
                  key={img.url || i}
                  type="button"
                  className={`ninja-size-thumb${
                    i === galleryIndex ? ' is-active' : ''
                  }`}
                  onClick={() => setGalleryIndex(i)}
                >
                  <img src={img.url} alt="" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* ── Right: buy column (Ninja-style content) ─────────── */}
        <div className="ninja-size-buy">
          <Link to="/dtf-sheets" className="ninja-size-back">
            ← DTF sheets
          </Link>

          <div className="ninja-size-title-row">
            <h1>{product?.title || 'DTF Transfers by Size'}</h1>
            <span className="ninja-size-badge">No setup fees</span>
          </div>

          <p className="ninja-size-meta">
            <button
              type="button"
              className="ninja-size-meta-price"
              onClick={() => setCalcOpen(true)}
            >
              <span>As low as</span>
              <strong>
                <Money
                  data={{
                    amount: String(fromPrice.toFixed(2)),
                    currencyCode: 'USD',
                  }}
                />
              </strong>
            </button>
            <span className="ninja-size-meta-sep" aria-hidden>
              |
            </span>
            <span>Printed in-house · Ships from USA</span>
            <span className="ninja-size-meta-sep" aria-hidden>
              |
            </span>
            <span className="ninja-size-stars">
              {Array.from({length: 5}).map((_, i) => (
                <Star key={i} size={12} fill="currentColor" strokeWidth={0} />
              ))}
              <span>4.8 average</span>
            </span>
          </p>

          <ul className="ninja-size-features">
            <li>
              <Shirt size={18} strokeWidth={1.75} aria-hidden />
              Works on any fabric or color
            </li>
            <li>
              <Droplets size={18} strokeWidth={1.75} aria-hidden />
              Certified for 100+ washes
              <CircleHelp
                size={13}
                strokeWidth={2}
                className="ninja-size-info"
                aria-hidden
              />
            </li>
            <li>
              <Sparkles size={18} strokeWidth={1.75} aria-hidden />
              Vibrant color &amp; ultra-fine detail
            </li>
            <li>
              <ShieldCheck size={18} strokeWidth={1.75} aria-hidden />
              100% satisfaction guaranteed
            </li>
          </ul>

          {!product ? (
            <p className="ninja-size-warn">
              Create Shopify product{' '}
              <code>{DTF_TRANSFER_BY_SIZE_PRODUCT_HANDLE}</code> with size
              variants to enable checkout.
            </p>
          ) : null}

          <UploadCard
            inputId={inputId}
            fileRef={fileRef}
            dragOver={dragOver}
            uploadBusy={uploadBusy}
            setDragOver={setDragOver}
            onUpload={onUpload}
            onCalc={() => setCalcOpen(true)}
          />

          <ul className="ninja-size-trustbar">
            <li>
              <span className="ninja-size-trust-icon" aria-hidden>
                <Tag size={16} strokeWidth={2.25} />
              </span>
              <div>
                <strong>Buy more &amp; save</strong>
                <span>Volume discounts up to 50% off</span>
              </div>
            </li>
            <li>
              <span className="ninja-size-trust-icon" aria-hidden>
                <Package size={16} strokeWidth={2.25} />
              </span>
              <div>
                <strong>Printed in-house</strong>
                <span>USA production · hot peel</span>
              </div>
            </li>
            <li>
              <span className="ninja-size-trust-icon" aria-hidden>
                <ShieldCheck size={16} strokeWidth={2.25} />
              </span>
              <div>
                <strong>No setup fees</strong>
                <span>The Plus 1 guarantee</span>
              </div>
            </li>
          </ul>
        </div>
      </div>
        </div>
      ) : null}

      {!inStudio && !showLoading ? (
        <>
      {/* ── Blanks cross-sell ──────────────────────────────────── */}
      <section className="ninja-size-blanks">
        <div className="ninja-size-blanks-head">
          <h2>Complete your order with blanks</h2>
          <p>
            <Check size={14} strokeWidth={2.5} aria-hidden /> No minimums
            <span aria-hidden>·</span>
            <Check size={14} strokeWidth={2.5} aria-hidden /> Pair with your
            transfers
          </p>
        </div>
        <div className="ninja-size-blank-links">
          <Link to="/collections/t-shirts">Tees</Link>
          <Link to="/collections/sweatshirts">Sweatshirts</Link>
          <Link to="/collections/hats">Hats</Link>
          <Link to="/collections/all-products">Shop all blanks</Link>
        </div>
      </section>

      {/* ── Product details ────────────────────────────────────── */}
      <section className="ninja-size-details">
        <div className="ninja-size-details-copy">
          <h2>Product details</h2>
          <p>
            Plus 1 DTF transfers are printed in-house with vibrant color, a soft
            hand feel, and reliable durability for apparel businesses. Upload
            your artwork, choose a size, and we handle the rest.
          </p>
          <p className="ninja-size-details-strong">
            Hot peel · Soft finish · No upcharge for quality.
          </p>
          <p>
            Prefer packing many designs on one sheet?{' '}
            <Link to="/dtf-sheets/builder">Build a gang sheet</Link>.
          </p>
        </div>
        <div className="ninja-size-accordion">
          {[
            {
              id: 'features',
              label: 'Features',
              body: 'Works on cotton, blends, and dark or light garments. Soft hand feel with sharp detail for logos, photos, and full-color artwork.',
            },
            {
              id: 'guarantee',
              label: 'Satisfaction guarantee',
              body: 'If something is wrong with your print, contact us and we will make it right with a reprint or refund per our policy.',
            },
            {
              id: 'press',
              label: 'Pressing instructions',
              body: 'Preheat garment, press around 300–320°F with firm pressure for 10–15 seconds, hot peel, then finish press 5 seconds. Always test your press.',
            },
            {
              id: 'shipping',
              label: 'Shipping & returns',
              body: 'Printed in the USA. Custom transfers ship after production. See our shipping and refund policies for full details.',
            },
            {
              id: 'upload',
              label: 'Art upload recommendations',
              body: 'PNG with transparent background preferred. 300 DPI at final size. JPG and WEBP also accepted up to 25 MB.',
            },
          ].map((row) => {
            const open = detailsOpen === row.id;
            return (
              <div key={row.id} className="ninja-size-acc-item">
                <button
                  type="button"
                  className="ninja-size-acc-trigger"
                  aria-expanded={open}
                  onClick={() =>
                    setDetailsOpen(open ? null : row.id)
                  }
                >
                  <span>{row.label}</span>
                  <Plus
                    size={16}
                    strokeWidth={2.25}
                    className={open ? 'is-open' : undefined}
                  />
                </button>
                {open ? <p className="ninja-size-acc-body">{row.body}</p> : null}
              </div>
            );
          })}
        </div>
      </section>
        </>
      ) : null}

      {error ? (
        <p className="ninja-size-error" role="alert">
          {error}
          <button type="button" onClick={() => setError(null)}>
            Dismiss
          </button>
        </p>
      ) : null}

      <input
        ref={fileRef}
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        multiple
        className="ninja-size-file"
        onChange={(e) => {
          void onUpload(e.target.files);
          e.target.value = '';
        }}
      />

      <PriceCalculatorModal
        open={calcOpen}
        onClose={() => setCalcOpen(false)}
        variants={variants}
        fromPrice={fromPrice}
        onUpload={() => {
          setCalcOpen(false);
          fileRef.current?.click();
        }}
      />
    </div>
  );
}

/* ─── Subcomponents ──────────────────────────────────────────────────────── */

/**
 * @param {{
 *   inputId: string;
 *   fileRef: React.MutableRefObject<HTMLInputElement | null>;
 *   dragOver: boolean;
 *   uploadBusy: boolean;
 *   setDragOver: (v: boolean) => void;
 *   onUpload: (files: FileList | null) => void;
 *   onCalc: () => void;
 * }} props
 */
function UploadCard({
  inputId,
  fileRef,
  dragOver,
  uploadBusy,
  setDragOver,
  onUpload,
  onCalc,
}) {
  return (
    <section className="ninja-size-upload-card">
      <div className="ninja-size-upload-head">
        <h2>Upload artwork</h2>
        <div className="ninja-size-tabs" role="tablist" aria-label="Artwork source">
          <span className="ninja-size-tab is-active" role="tab" aria-selected="true">
            <CloudUpload size={14} strokeWidth={2.25} aria-hidden />
            Upload
          </span>
          <span
            className="ninja-size-tab is-muted"
            role="tab"
            aria-selected="false"
            title="Coming soon"
          >
            <FolderOpen size={14} strokeWidth={2.25} aria-hidden />
            Previous designs
          </span>
        </div>
      </div>
      <div
        className={`ninja-size-drop${dragOver ? ' is-dragover' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void onUpload(e.dataTransfer.files);
        }}
        onClick={() => {
          if (!uploadBusy) fileRef.current?.click();
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!uploadBusy) fileRef.current?.click();
          }
        }}
      >
        <span className="ninja-size-drop-icon" aria-hidden>
          <CloudUpload size={22} strokeWidth={2.25} />
        </span>
        <div className="ninja-size-drop-copy">
          <strong>
            {uploadBusy ? 'Uploading…' : 'Upload your files (up to 25)'}
          </strong>
          <span>Drag and drop files here or click to browse</span>
        </div>
        <button
          type="button"
          className="ninja-size-browse"
          disabled={uploadBusy}
          onClick={(e) => {
            e.stopPropagation();
            fileRef.current?.click();
          }}
        >
          Browse
        </button>
      </div>
      <p className="ninja-size-filetypes-label">
        Accepting common file types
        <span className="ninja-size-filetypes">
          <span>PNG</span>
          <span>JPG</span>
          <span>JPEG</span>
          <span>WEBP</span>
        </span>
      </p>
      <div className="ninja-size-upload-foot">
        <p className="ninja-size-upload-hint">
          Transparent PNGs give the cleanest press. We can auto-clean solid
          backgrounds after upload.
        </p>
        <button type="button" className="ninja-size-calc-link" onClick={onCalc}>
          <Calculator size={14} strokeWidth={2.25} aria-hidden />
          Price calculator
        </button>
      </div>
    </section>
  );
}

/**
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   variants: Array<{ id: string; title: string; price?: { amount: string } }>;
 *   fromPrice: number;
 *   onUpload: () => void;
 * }} props
 */
function PriceCalculatorModal({open, onClose, variants, fromPrice, onUpload}) {
  const [widthIn, setWidthIn] = useState(4);
  const [heightIn, setHeightIn] = useState(4);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const sizeId = nearestTransferSizeId(Math.max(widthIn, heightIn));
  const dummy = {
    widthIn,
    heightIn,
    sizeId,
    qty,
  };
  const base = unitPrice(variants, dummy, true) || fromPrice;
  const tier = transferQtyTier(qty);
  const each = base * (1 - tier.discount);
  const sizeLabel =
    DTF_TRANSFER_SIZES.find((s) => s.id === sizeId)?.label || sizeId;

  return createPortal(
    <div className="ninja-size-modal-root" role="dialog" aria-modal="true">
      <button
        type="button"
        className="ninja-size-modal-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="ninja-size-modal">
        <header className="ninja-size-modal-header">
          <div>
            <p className="ninja-size-modal-kicker">Plus 1 DTF</p>
            <h2>Price calculator</h2>
          </div>
          <button
            type="button"
            className="ninja-size-modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={18} strokeWidth={2.25} />
          </button>
        </header>

        <div className="ninja-size-modal-inputs">
          <div className="ninja-size-modal-field">
            <span className="ninja-size-modal-field-label" id="ns-calc-width-label">
              Width (in)
            </span>
            <div className="ninja-size-stepper" role="group" aria-labelledby="ns-calc-width-label">
              <button
                type="button"
                className="ninja-size-stepper-btn"
                aria-label="Decrease width"
                onClick={() => setWidthIn((w) => Math.max(0.5, roundIn(w - 0.25)))}
              >
                −
              </button>
              <input
                type="number"
                className="ninja-size-stepper-input"
                value={widthIn}
                min={0.5}
                max={22}
                step={0.25}
                aria-labelledby="ns-calc-width-label"
                onChange={(e) =>
                  setWidthIn(Math.max(0.5, Number(e.target.value) || 0.5))
                }
              />
              <button
                type="button"
                className="ninja-size-stepper-btn"
                aria-label="Increase width"
                onClick={() => setWidthIn((w) => Math.min(22, roundIn(w + 0.25)))}
              >
                +
              </button>
            </div>
          </div>
          <div className="ninja-size-modal-field">
            <span className="ninja-size-modal-field-label" id="ns-calc-height-label">
              Height (in)
            </span>
            <div className="ninja-size-stepper" role="group" aria-labelledby="ns-calc-height-label">
              <button
                type="button"
                className="ninja-size-stepper-btn"
                aria-label="Decrease height"
                onClick={() =>
                  setHeightIn((h) => Math.max(0.5, roundIn(h - 0.25)))
                }
              >
                −
              </button>
              <input
                type="number"
                className="ninja-size-stepper-input"
                value={heightIn}
                min={0.5}
                max={22}
                step={0.25}
                aria-labelledby="ns-calc-height-label"
                onChange={(e) =>
                  setHeightIn(Math.max(0.5, Number(e.target.value) || 0.5))
                }
              />
              <button
                type="button"
                className="ninja-size-stepper-btn"
                aria-label="Increase height"
                onClick={() =>
                  setHeightIn((h) => Math.min(22, roundIn(h + 0.25)))
                }
              >
                +
              </button>
            </div>
          </div>
          <div className="ninja-size-modal-field">
            <span className="ninja-size-modal-field-label" id="ns-calc-qty-label">
              Quantity
            </span>
            <div className="ninja-size-stepper" role="group" aria-labelledby="ns-calc-qty-label">
              <button
                type="button"
                className="ninja-size-stepper-btn"
                aria-label="Decrease quantity"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                −
              </button>
              <input
                type="number"
                className="ninja-size-stepper-input"
                value={qty}
                min={1}
                aria-labelledby="ns-calc-qty-label"
                onChange={(e) =>
                  setQty(Math.max(1, Number(e.target.value) || 1))
                }
              />
              <button
                type="button"
                className="ninja-size-stepper-btn"
                aria-label="Increase quantity"
                onClick={() => setQty((q) => q + 1)}
              >
                +
              </button>
            </div>
          </div>
        </div>

        <p className="ninja-size-modal-size-hint">
          Matched size band: <strong>{sizeLabel}</strong>
          {tier.discount
            ? ` · ${Math.round(tier.discount * 100)}% volume discount`
            : null}
        </p>

        <table className="ninja-size-tier-table">
          <thead>
            <tr>
              <th>Qty</th>
              <th>Discount</th>
              <th>Per piece</th>
            </tr>
          </thead>
          <tbody>
            {DTF_TRANSFER_QTY_TIERS.map((t) => {
              const selected = qty >= t.min && qty <= t.max;
              return (
                <tr key={t.label} className={selected ? 'is-selected' : undefined}>
                  <td>{t.label}</td>
                  <td>
                    {t.discount ? `${Math.round(t.discount * 100)}% off` : '—'}
                  </td>
                  <td>${(base * (1 - t.discount)).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="ninja-size-modal-price">
          <div>
            <span className="ninja-size-modal-price-label">Your price</span>
            <div className="ninja-size-modal-price-row">
              <strong>${each.toFixed(2)}</strong>
              <span>per piece</span>
            </div>
          </div>
          <span className="ninja-size-modal-price-total">
            ${(each * qty).toFixed(2)} total
          </span>
        </div>

        <button type="button" className="ninja-size-cta" onClick={onUpload}>
          Upload your design
        </button>
        <p className="ninja-size-modal-foot">
          No setup fees · Printed in-house in the USA
        </p>
      </div>
    </div>,
    document.body,
  );
}

/* ─── helpers ────────────────────────────────────────────────────────────── */

/**
 * @param {Array<{ id: string; title: string; price?: { amount: string } }>} variants
 * @param {string} sizeId
 */
function findVariant(variants, sizeId) {
  const size = DTF_TRANSFER_SIZES.find((s) => s.id === sizeId);
  if (!size) return null;
  return (
    variants.find(
      (v) =>
        String(v.title).toLowerCase() === size.variantTitle.toLowerCase() ||
        String(v.title).toLowerCase().includes(size.id),
    ) || null
  );
}

/**
 * @param {Array<{ id: string; title: string; price?: { amount: string } }>} variants
 * @param {{ widthIn?: number; heightIn?: number; sizeId?: string; qty?: number }} design
 * @param {boolean} [ignoreQtyDiscount]
 */
function unitPrice(variants, design, ignoreQtyDiscount = false) {
  const sizeId =
    design.sizeId ||
    nearestTransferSizeId(
      Math.max(Number(design.widthIn) || 4, Number(design.heightIn) || 4),
    );
  const size = DTF_TRANSFER_SIZES.find((s) => s.id === sizeId);
  const v = findVariant(variants, sizeId);
  const base = Number(v?.price?.amount || size?.defaultPrice || 0);
  if (ignoreQtyDiscount) return base;
  const tier = transferQtyTier(design.qty || 1);
  return base * (1 - (tier?.discount || 0));
}

/**
 * @param {number} n
 */
function roundIn(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * @param {string} s
 */
function truncate(s) {
  const str = String(s || '');
  return str.length > 250 ? `${str.slice(0, 247)}...` : str;
}
