import {useMemo, useState} from 'react';
import {
  ArrowUpFromLine,
  FileText,
  Filter,
  Palette,
  Search,
  Sparkles,
  Star,
  Trash2,
  Type,
} from 'lucide-react';
import {DTF_TRANSFER_QTY_TIERS, DTF_TRANSFER_SIZES} from '~/lib/dtfSheetConstants';
import teeTemplate from '~/assets/dtf-size-guide/tee.png';
import hatTemplate from '~/assets/dtf-size-guide/hat.png';
import poloTemplate from '~/assets/dtf-size-guide/polo.png';
import toteTemplate from '~/assets/dtf-size-guide/tote.png';
import youthTemplate from '~/assets/dtf-size-guide/youth.png';
import apronTemplate from '~/assets/dtf-size-guide/apron.png';

/** @type {Array<{
 *   id: string;
 *   label: string;
 *   widthIn: number;
 *   heightIn: number;
 *   kind: string;
 *   template: string;
 *   zone: { w: number; h: number; cx: number; cy: number };
 * }>} */
const SIZE_GUIDE_ITEMS = [
  {
    id: 'tee',
    label: 'T-shirt',
    widthIn: 11,
    heightIn: 14.83,
    kind: 'tee',
    template: teeTemplate,
    zone: {w: 0.55, h: 0.46, cx: 0.5, cy: 0.49},
  },
  {
    id: 'hat',
    label: 'Hat',
    widthIn: 1.85,
    heightIn: 2.5,
    kind: 'hat',
    template: hatTemplate,
    zone: {w: 0.2, h: 0.18, cx: 0.5, cy: 0.405},
  },
  {
    id: 'polo',
    label: 'Polo',
    widthIn: 3.5,
    heightIn: 4.72,
    kind: 'polo',
    template: poloTemplate,
    // Left chest from viewer, below collar / inset from shoulder
    zone: {w: 0.22, h: 0.2, cx: 0.38, cy: 0.45},
  },
  {
    id: 'tote',
    label: 'Tote',
    widthIn: 6.68,
    heightIn: 9,
    kind: 'tote',
    template: toteTemplate,
    zone: {w: 0.4, h: 0.38, cx: 0.5, cy: 0.55},
  },
  {
    id: 'youth',
    label: 'Youth',
    widthIn: 10,
    heightIn: 12,
    kind: 'youth',
    template: youthTemplate,
    zone: {w: 0.52, h: 0.44, cx: 0.5, cy: 0.49},
  },
  {
    id: 'apron',
    label: 'Apron',
    widthIn: 5,
    heightIn: 6.74,
    kind: 'apron',
    template: apronTemplate,
    // Lower on the bib, above the pocket line
    zone: {w: 0.3, h: 0.28, cx: 0.5, cy: 0.52},
  },
];

const GARMENT_COLORS = [
  '#ffffff',
  '#0a0a0a',
  '#94a3b8',
  '#dc2626',
  '#ea580c',
  '#eab308',
  '#16a34a',
  '#0ea5e9',
  '#1d4ed8',
  'rainbow',
];

const PREVIEW_BGS = [
  {id: 'check', label: 'Transparent'},
  {id: '#ffffff', label: 'White'},
  {id: '#0a0a0a', label: 'Black'},
  {id: '#a4d8ff', label: 'Sky'},
];

/**
 * Step 1 — customize uploaded artwork (same-page studio).
 *
 * @param {{
 *   designs: Array<any>;
 *   active: any;
 *   variants: Array<any>;
 *   previewBg: string;
 *   setPreviewBg: (v: string) => void;
 *   bgBusy: boolean;
 *   onSelect: (id: string) => void;
 *   onRemove: (id: string) => void;
 *   onPatch: (id: string, patch: object) => void;
 *   onToggleBg: () => void;
 *   onPopular: (sizeId: string) => void;
 *   onAddMore: () => void;
 * }} props
 */
export function DtfTransferCustomizeStep({
  designs,
  active,
  variants,
  previewBg,
  setPreviewBg,
  bgBusy,
  onSelect,
  onPatch,
  onRemove,
  onToggleBg,
  onPopular,
  onAddMore,
}) {
  const [garmentColor, setGarmentColor] = useState('#ffffff');
  const [zoom, setZoom] = useState(1);
  const [hoveredGuideId, setHoveredGuideId] = useState(/** @type {string | null} */ (null));

  const tier = useMemo(() => {
    const qty = active?.qty || 1;
    return (
      DTF_TRANSFER_QTY_TIERS.find((t) => qty >= t.min && qty <= t.max) ||
      DTF_TRANSFER_QTY_TIERS[0]
    );
  }, [active?.qty]);

  const nextTier = useMemo(() => {
    if (!tier) return null;
    const idx = DTF_TRANSFER_QTY_TIERS.findIndex((t) => t.label === tier.label);
    return DTF_TRANSFER_QTY_TIERS[idx + 1] || null;
  }, [tier]);

  if (!active) return null;

  const unit = unitPrice(variants, active, true);
  const each = unit * (1 - (tier?.discount || 0));
  const needForNext = nextTier ? Math.max(0, nextTier.min - active.qty) : 0;
  const isRainbow = garmentColor === 'rainbow';
  const hoveredGuide =
    SIZE_GUIDE_ITEMS.find((item) => item.id === hoveredGuideId) || null;

  /**
   * @param {typeof SIZE_GUIDE_ITEMS[number]} item
   * @param {'tile' | 'enlarge'} [mode]
   */
  function renderGarment(item, mode = 'tile') {
    const {zone} = item;
    // Mock the labeled placement size on this garment (art fills the print zone,
    // preserving the uploaded artwork's aspect ratio via object-fit: contain).
    const left = zone.cx - zone.w / 2;
    const top = zone.cy - zone.h / 2;

    return (
      <span
        className={`ns-studio-garment${isRainbow ? ' is-rainbow' : ''}${
          mode === 'enlarge' ? ' is-enlarge' : ''
        }`}
        style={
          isRainbow ? undefined : {['--ns-garment-fill']: garmentColor}
        }
      >
        <img
          className="ns-studio-garment-template"
          src={item.template}
          alt=""
          draggable={false}
        />
        <span
          className={`ns-studio-garment-art ns-studio-garment-art--${item.kind}`}
          style={{
            left: `${left * 100}%`,
            top: `${top * 100}%`,
            width: `${zone.w * 100}%`,
            height: `${zone.h * 100}%`,
          }}
        >
          <img src={active.dataUrl} alt="" />
        </span>
      </span>
    );
  }

  return (
    <div className="ns-studio">
      <div className="ns-studio-grid">
        {/* ── Size guide ───────────────────────────────────────── */}
        <section className="ns-studio-card ns-studio-guide">
          <header className="ns-studio-card-head">
            <h2>Plus 1 size guide</h2>
            <p>Hover over any image to enlarge</p>
          </header>

          <div
            className="ns-studio-guide-panel"
            onMouseLeave={() => setHoveredGuideId(null)}
          >
            <div className="ns-studio-guide-grid">
              {SIZE_GUIDE_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`ns-studio-guide-item${
                    hoveredGuideId === item.id ? ' is-hovered' : ''
                  }`}
                  onMouseEnter={() => setHoveredGuideId(item.id)}
                  onFocus={() => setHoveredGuideId(item.id)}
                  onBlur={() => setHoveredGuideId(null)}
                  onClick={() => {
                    const match = nearestGuideSize(item.widthIn, item.heightIn);
                    if (match) onPopular(match.id);
                  }}
                  title={`${item.label} · Apply ~${item.widthIn}″ × ${item.heightIn}″`}
                  aria-label={`${item.label}, ${formatIn(item.widthIn)} by ${formatIn(item.heightIn)} inches`}
                >
                  <span className="ns-studio-guide-dims">
                    {formatIn(item.widthIn)}″ × {formatIn(item.heightIn)}″
                  </span>
                  {renderGarment(item, 'tile')}
                </button>
              ))}
            </div>

            {hoveredGuide ? (
              <div className="ns-studio-guide-enlarge" aria-hidden>
                <span className="ns-studio-guide-enlarge-dims">
                  {formatIn(hoveredGuide.widthIn)}″ ×{' '}
                  {formatIn(hoveredGuide.heightIn)}″
                </span>
                {renderGarment(hoveredGuide, 'enlarge')}
              </div>
            ) : null}
          </div>

          <div className="ns-studio-guide-colors">
            <p>Change your preview items to any color below:</p>
            <div className="ns-studio-swatches">
              {GARMENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`ns-studio-swatch${
                    garmentColor === c ? ' is-active' : ''
                  }${c === 'rainbow' ? ' is-rainbow' : ''}`}
                  style={c === 'rainbow' ? undefined : {background: c}}
                  aria-label={c === 'rainbow' ? 'Multi' : c}
                  onClick={() => setGarmentColor(c)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ── Customize canvas ─────────────────────────────────── */}
        <section className="ns-studio-card ns-studio-canvas-wrap">
          <header className="ns-studio-card-head ns-studio-card-head--row">
            <h2>
              <span>Step 1</span> Customize your image
            </h2>
            <button
              type="button"
              className="ns-studio-add-more"
              onClick={onAddMore}
            >
              + Add files
            </button>
          </header>

          <div className="ns-studio-canvas-layout">
            <div className="ns-studio-rail">
              <div className="ns-studio-toggle">
                <span className="ns-studio-toggle-copy">
                  <strong>Remove background</strong>
                  <small>{bgBusy ? 'Working…' : active.bgRemoved ? 'On' : 'Off'}</small>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={active.bgRemoved}
                  aria-label="Remove background"
                  disabled={bgBusy}
                  className={`ns-studio-switch${active.bgRemoved ? ' is-on' : ''}`}
                  onClick={() => void onToggleBg()}
                >
                  <span className="ns-studio-switch-knob" />
                </button>
              </div>

              <div className="ns-studio-options">
                <p>Designs</p>
                {designs.map((d, i) => (
                  <button
                    key={d.id}
                    type="button"
                    className={`ns-studio-option${
                      d.id === active.id ? ' is-active' : ''
                    }`}
                    onClick={() => onSelect(d.id)}
                  >
                    <img src={d.dataUrl} alt="" />
                    <span>Option {i + 1}</span>
                  </button>
                ))}
              </div>

              <button type="button" className="ns-studio-notes" disabled title="Coming soon">
                <FileText size={15} strokeWidth={2.25} aria-hidden />
                Design notes
              </button>
            </div>

            <div className="ns-studio-stage">
              <div className="ns-studio-bg-bar" role="group" aria-label="Preview background">
                <span>Preview background</span>
                {PREVIEW_BGS.map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    className={`ns-studio-bg-swatch${
                      previewBg === bg.id ? ' is-active' : ''
                    }${bg.id === 'check' ? ' is-check' : ''}`}
                    style={bg.id === 'check' ? undefined : {background: bg.id}}
                    aria-label={bg.label}
                    onClick={() => setPreviewBg(bg.id)}
                  />
                ))}
              </div>

              <div
                className={`ns-studio-stage-frame${
                  previewBg === 'check' ? ' is-check' : ''
                }`}
                style={
                  previewBg === 'check' ? undefined : {background: previewBg}
                }
              >
                <button
                  type="button"
                  className="ns-studio-stage-action ns-studio-stage-action--trash"
                  aria-label="Remove design"
                  onClick={() => onRemove(active.id)}
                >
                  <Trash2 size={16} strokeWidth={2.25} />
                </button>
                <button
                  type="button"
                  className="ns-studio-stage-action ns-studio-stage-action--zoom"
                  aria-label={zoom > 1 ? 'Reset zoom' : 'Zoom in'}
                  onClick={() => setZoom((z) => (z > 1 ? 1 : 1.35))}
                >
                  <Search size={16} strokeWidth={2.25} />
                </button>

                <div
                  className="ns-studio-art"
                  style={{transform: `scale(${zoom})`}}
                >
                  <img src={active.dataUrl} alt={active.name} />
                </div>

                <span className="ns-studio-dim ns-studio-dim--w">
                  {formatIn(active.widthIn)}″
                </span>
                <span className="ns-studio-dim ns-studio-dim--h">
                  {formatIn(active.heightIn)}″
                </span>
              </div>

              <div className="ns-studio-toolbar">
                <button type="button" className="ns-studio-tool ns-studio-tool--ai" disabled title="Coming soon">
                  <Sparkles size={15} strokeWidth={2.25} aria-hidden />
                  Edit with AI
                </button>
                <button type="button" className="ns-studio-tool" disabled title="Coming soon">
                  <Type size={15} strokeWidth={2.25} aria-hidden />
                  Add text
                </button>
                <button type="button" className="ns-studio-tool" disabled title="Coming soon">
                  <Palette size={15} strokeWidth={2.25} aria-hidden />
                  Recolor
                </button>
                <button type="button" className="ns-studio-tool" disabled title="Coming soon">
                  <Filter size={15} strokeWidth={2.25} aria-hidden />
                  Filters
                </button>
                <button type="button" className="ns-studio-tool" disabled title="Coming soon">
                  <ArrowUpFromLine size={15} strokeWidth={2.25} aria-hidden />
                  Upscale
                </button>
              </div>

              <div className="ns-studio-size-row">
                <label>
                  <span>Width</span>
                  <input
                    type="number"
                    min={0.5}
                    max={22}
                    step={0.01}
                    value={active.widthIn}
                    onChange={(e) =>
                      onPatch(active.id, {
                        widthIn: Math.max(0.5, Number(e.target.value) || 0.5),
                        sizeMode: 'custom',
                      })
                    }
                  />
                </label>
                <label>
                  <span>Height</span>
                  <input
                    type="number"
                    min={0.5}
                    max={22}
                    step={0.01}
                    value={active.heightIn}
                    onChange={(e) =>
                      onPatch(active.id, {
                        heightIn: Math.max(0.5, Number(e.target.value) || 0.5),
                        sizeMode: 'custom',
                      })
                    }
                  />
                </label>
                <label>
                  <span>Qty</span>
                  <input
                    type="number"
                    min={1}
                    value={active.qty}
                    onChange={(e) =>
                      onPatch(active.id, {
                        qty: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                  />
                </label>
                <div className="ns-studio-popular-chips">
                  {DTF_TRANSFER_SIZES.slice(0, 6).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={active.sizeId === s.id ? 'is-active' : undefined}
                      onClick={() => onPopular(s.id)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Pricing ──────────────────────────────────────────── */}
        <section className="ns-studio-card ns-studio-pricing">
          <header className="ns-studio-card-head">
            <h2>
              Buy more &amp; save
              <em> with volume discounts</em>
            </h2>
            <p>
              Discounts apply to the quantity of this design. Add more pieces to
              unlock the next tier.
            </p>
          </header>

          <ul className="ns-studio-tiers">
            {DTF_TRANSFER_QTY_TIERS.map((t) => {
              const price = unit * (1 - t.discount);
              const selected = active.qty >= t.min && active.qty <= t.max;
              return (
                <li
                  key={t.label}
                  className={selected ? 'is-selected' : undefined}
                >
                  <button
                    type="button"
                    onClick={() => onPatch(active.id, {qty: t.min})}
                  >
                    <span className="ns-studio-tier-qty">{t.label}</span>
                    <span className="ns-studio-tier-price">
                      ${price.toFixed(2)} ea
                    </span>
                    <span className="ns-studio-tier-off">
                      {t.discount
                        ? `${Math.round(t.discount * 100)}% off`
                        : 'Base'}
                    </span>
                  </button>
                  {selected && nextTier && needForNext > 0 ? (
                    <p className="ns-studio-tier-nudge">
                      Add {needForNext} more to unlock{' '}
                      {Math.round(nextTier.discount * 100)}% off
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <div className="ns-studio-price-summary">
            <div>
              <span>Your price</span>
              <strong>${each.toFixed(2)} ea</strong>
            </div>
            <div>
              <span>Line total</span>
              <strong>${(each * active.qty).toFixed(2)}</strong>
            </div>
          </div>

          <p className="ns-studio-guarantee">
            <Star size={14} fill="currentColor" strokeWidth={0} aria-hidden />
            Plus 1 guarantee · Perfect prints · No extra fees
          </p>
        </section>
      </div>
    </div>
  );
}

/**
 * @param {number} n
 */
function formatIn(n) {
  const x = Math.round(Number(n) * 100) / 100;
  return Number.isInteger(x) ? String(x) : String(x);
}

/**
 * @param {number} w
 * @param {number} h
 */
function nearestGuideSize(w, h) {
  const target = Math.max(w, h);
  let best = DTF_TRANSFER_SIZES[0];
  let bestDiff = Math.abs(best.maxIn - target);
  for (const s of DTF_TRANSFER_SIZES) {
    const d = Math.abs(s.maxIn - target);
    if (d < bestDiff) {
      best = s;
      bestDiff = d;
    }
  }
  return best;
}

/**
 * @param {Array<{ id: string; title: string; price?: { amount: string } }>} variants
 * @param {{ sizeId?: string; widthIn?: number; heightIn?: number; qty?: number }} design
 * @param {boolean} [ignoreQtyDiscount]
 */
function unitPrice(variants, design, ignoreQtyDiscount = false) {
  const sizeId =
    design.sizeId ||
    nearestGuideSize(design.widthIn || 4, design.heightIn || 4).id;
  const size = DTF_TRANSFER_SIZES.find((s) => s.id === sizeId);
  const v = variants.find(
    (x) =>
      String(x.title).toLowerCase() === String(size?.variantTitle || '').toLowerCase() ||
      String(x.title).toLowerCase().includes(sizeId),
  );
  const base = Number(v?.price?.amount || size?.defaultPrice || 1.49);
  if (ignoreQtyDiscount) return base;
  const qty = Math.max(1, design.qty || 1);
  const t =
    DTF_TRANSFER_QTY_TIERS.find((tier) => qty >= tier.min && qty <= tier.max) ||
    DTF_TRANSFER_QTY_TIERS[0];
  return base * (1 - (t?.discount || 0));
}
