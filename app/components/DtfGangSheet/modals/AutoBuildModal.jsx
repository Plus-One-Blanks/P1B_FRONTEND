import {useEffect, useMemo, useState} from 'react';
import {createPortal} from 'react-dom';
import {
  Copy,
  Info,
  Link2,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
  Unlink2,
  Wand2,
  X,
} from 'lucide-react';
import {
  computePrintSize,
  estimateDpi,
  getActiveSize,
  packGangSheetItems,
} from '~/lib/dtfGangSheetHelpers';

/**
 * @typedef {{
 *   id: string;
 *   label: string;
 *   imageDataUrl: string;
 *   naturalWidth: number;
 *   naturalHeight: number;
 *   sizes?: Array<{ id: string; longerSideIn: number; qty: number }>;
 *   activeSizeId?: string;
 * }} AutoBuildDesign
 */

/**
 * @typedef {{
 *   id: string;
 *   designId: string;
 *   widthIn: number;
 *   heightIn: number;
 *   qty: number;
 *   aspectLocked: boolean;
 * }} AutoBuildRow
 */

/**
 * @typedef {{
 *   designId: string;
 *   widthIn: number;
 *   heightIn: number;
 * }} AutoBuildPlaced
 */

/**
 * Count placed copies and average size per design.
 * @param {AutoBuildPlaced[]} placed
 */
function sheetStatsByDesign(placed) {
  /** @type {Map<string, { qty: number; widthIn: number; heightIn: number }>} */
  const map = new Map();
  for (const p of placed) {
    const cur = map.get(p.designId);
    if (!cur) {
      map.set(p.designId, {
        qty: 1,
        widthIn: p.widthIn,
        heightIn: p.heightIn,
      });
    } else {
      cur.qty += 1;
      // Keep first size so reopening matches what they already applied.
    }
  }
  return map;
}

/**
 * @param {AutoBuildDesign} design
 * @param {Map<string, { qty: number; widthIn: number; heightIn: number }> | null} [sheetStats]
 * @returns {AutoBuildRow}
 */
function rowFromDesign(design, sheetStats = null) {
  const onSheet = sheetStats?.get(design.id);
  const size = computePrintSize(design, getActiveSize(design));
  return {
    id: `ab-${design.id}-${Math.random().toString(36).slice(2, 7)}`,
    designId: design.id,
    widthIn: Number((onSheet?.widthIn ?? size.widthIn).toFixed(2)),
    heightIn: Number((onSheet?.heightIn ?? size.heightIn).toFixed(2)),
    // Prefer what's already on the sheet so reopening Auto Build doesn't
    // look like a fresh qty=1 and risk stacking more copies on Apply.
    qty: onSheet ? onSheet.qty : Math.max(1, getActiveSize(design).qty || 1),
    aspectLocked: true,
  };
}

/**
 * Auto Build — set quantities, preview pack, apply optimized gang sheet layout.
 * @param {{
 *   open: boolean;
 *   designs: AutoBuildDesign[];
 *   placed?: AutoBuildPlaced[];
 *   sheet: { widthIn: number; heightIn: number; feetLabel: string };
 *   onClose: () => void;
 *   onAddImages: () => void;
 *   onApply: (payload: {
 *     items: Array<{
 *       designId: string;
 *       label: string;
 *       imageDataUrl: string;
 *       widthIn: number;
 *       heightIn: number;
 *       x: number;
 *       y: number;
 *     }>;
 *   }) => void;
 * }} props
 */
export function AutoBuildModal({
  open,
  designs,
  placed = [],
  sheet,
  onClose,
  onAddImages,
  onApply,
}) {
  const [rows, setRows] = useState(/** @type {AutoBuildRow[]} */ ([]));
  const [tidy, setTidy] = useState(true);
  const [canvasMargin, setCanvasMargin] = useState(0);
  const [imageMargin, setImageMargin] = useState(0.25);

  const sheetStats = useMemo(() => sheetStatsByDesign(placed), [placed]);

  useEffect(() => {
    if (!open) return;
    setRows(designs.map((d) => rowFromDesign(d, sheetStats)));
    setTidy(true);
    setCanvasMargin(0);
    setImageMargin(0.25);
    // Seed from current sheet when opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setRows((prev) => {
      const designIds = new Set(designs.map((d) => d.id));
      const kept = prev.filter((r) => designIds.has(r.designId));
      const have = new Set(kept.map((r) => r.designId));
      const additions = designs
        .filter((d) => !have.has(d.id))
        .map((d) => rowFromDesign(d, sheetStats));
      if (!additions.length && kept.length === prev.length) return prev;
      return [...kept, ...additions];
    });
  }, [open, designs, sheetStats]);

  const designMap = useMemo(() => {
    /** @type {Map<string, AutoBuildDesign>} */
    const m = new Map();
    for (const d of designs) m.set(d.id, d);
    return m;
  }, [designs]);

  const packPreview = useMemo(() => {
    /** @type {Array<{ id: string; designId: string; widthIn: number; heightIn: number; imageDataUrl: string; label: string }>} */
    const flat = [];
    rows.forEach((row) => {
      const d = designMap.get(row.designId);
      if (!d) return;
      const qty = Math.max(1, row.qty || 1);
      for (let i = 0; i < qty; i++) {
        flat.push({
          id: `${row.id}-${i}`,
          designId: row.designId,
          widthIn: row.widthIn,
          heightIn: row.heightIn,
          imageDataUrl: d.imageDataUrl,
          label: d.label,
        });
      }
    });
    const placements = packGangSheetItems({
      sheetWidthIn: sheet.widthIn,
      sheetHeightIn: sheet.heightIn,
      items: flat,
      canvasMarginIn: canvasMargin,
      imageMarginIn: imageMargin,
      tidy,
    });
    return flat.map((item) => ({
      ...item,
      x: placements.get(item.id)?.x ?? 0.5,
      y: placements.get(item.id)?.y ?? 0.5,
    }));
  }, [rows, designMap, sheet.widthIn, sheet.heightIn, canvasMargin, imageMargin, tidy]);

  const totalImages = packPreview.length;

  if (!open || typeof document === 'undefined') return null;

  /**
   * @param {string} id
   * @param {Partial<AutoBuildRow>} partial
   */
  function updateRow(id, partial) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next = {...r, ...partial};
        if (r.aspectLocked && (partial.widthIn != null || partial.heightIn != null)) {
          const aspect = r.widthIn / Math.max(r.heightIn, 0.01);
          if (partial.widthIn != null && partial.heightIn == null) {
            next.heightIn = Number((partial.widthIn / aspect).toFixed(2));
          } else if (partial.heightIn != null && partial.widthIn == null) {
            next.widthIn = Number((partial.heightIn * aspect).toFixed(2));
          }
        }
        return next;
      }),
    );
  }

  function resetChanges() {
    setRows(designs.map((d) => rowFromDesign(d, sheetStats)));
    setTidy(true);
    setCanvasMargin(0);
    setImageMargin(0.25);
  }

  function handleApply() {
    if (!packPreview.length) return;
    onApply({
      items: packPreview.map((p) => ({
        designId: p.designId,
        label: p.label,
        imageDataUrl: p.imageDataUrl,
        widthIn: p.widthIn,
        heightIn: p.heightIn,
        x: p.x,
        y: p.y,
      })),
    });
    onClose();
  }

  return createPortal(
    <div
      className="dtf-modal-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dtf-ab-title"
      onClick={onClose}
    >
      <div
        className="dtf-modal dtf-modal--ab"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dtf-modal-header dtf-ab-header">
          <div className="dtf-modal-header-lead">
            <h2 id="dtf-ab-title">
              <Wand2 size={18} strokeWidth={2.25} aria-hidden />
              Auto Build
            </h2>
            <p className="dtf-modal-sub">
              Set quantities for each image and let the layout optimize placement.
            </p>
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

        <div className="dtf-ab-body">
          <div className="dtf-ab-grid">
            {rows.map((row) => {
              const d = designMap.get(row.designId);
              if (!d) return null;
              const dpi = estimateDpi(d, {
                widthIn: row.widthIn,
                heightIn: row.heightIn,
              });
              return (
                <article key={row.id} className="dtf-ab-card">
                  <div className="dtf-ab-card-tools">
                    <button
                      type="button"
                      title="Duplicate"
                      aria-label="Duplicate"
                      onClick={() =>
                        setRows((prev) => [
                          ...prev,
                          {
                            ...row,
                            id: `ab-${Date.now()}-${Math.random()
                              .toString(36)
                              .slice(2, 7)}`,
                            qty: 1,
                          },
                        ])
                      }
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type="button"
                      className="is-danger"
                      title="Remove"
                      aria-label="Remove"
                      onClick={() =>
                        setRows((prev) => prev.filter((r) => r.id !== row.id))
                      }
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div className="dtf-ab-card-thumb">
                    <img src={d.imageDataUrl} alt="" />
                  </div>

                  <p className="dtf-ab-card-name">{d.label}</p>

                  <div className="dtf-ab-dims">
                    <label>
                      <span>w</span>
                      <input
                        type="number"
                        min={0.25}
                        step={0.05}
                        value={row.widthIn}
                        onChange={(e) =>
                          updateRow(row.id, {
                            widthIn: Math.max(0.25, Number(e.target.value) || 0.25),
                          })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className={`dtf-ab-aspect${row.aspectLocked ? ' is-locked' : ''}`}
                      title={
                        row.aspectLocked
                          ? 'Unlock aspect ratio'
                          : 'Lock aspect ratio'
                      }
                      aria-label={
                        row.aspectLocked
                          ? 'Unlock aspect ratio'
                          : 'Lock aspect ratio'
                      }
                      onClick={() =>
                        updateRow(row.id, {aspectLocked: !row.aspectLocked})
                      }
                    >
                      {row.aspectLocked ? (
                        <Link2 size={13} />
                      ) : (
                        <Unlink2 size={13} />
                      )}
                    </button>
                    <label>
                      <span>h</span>
                      <input
                        type="number"
                        min={0.25}
                        step={0.05}
                        value={row.heightIn}
                        onChange={(e) =>
                          updateRow(row.id, {
                            heightIn: Math.max(
                              0.25,
                              Number(e.target.value) || 0.25,
                            ),
                          })
                        }
                      />
                    </label>
                  </div>

                  <div className="dtf-ab-card-meta">
                    <span className={dpi >= 300 ? 'is-good' : 'is-warn'}>
                      {dpi >= 300 ? '300+ DPI' : `${dpi} DPI`}
                    </span>
                  </div>

                  <div className="dtf-ab-qty">
                    <span>Qty</span>
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() =>
                        updateRow(row.id, {qty: Math.max(1, row.qty - 1)})
                      }
                    >
                      <Minus size={12} />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={row.qty}
                      onChange={(e) =>
                        updateRow(row.id, {
                          qty: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => updateRow(row.id, {qty: row.qty + 1})}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </article>
              );
            })}

            <button
              type="button"
              className="dtf-ab-add"
              onClick={onAddImages}
            >
              <Plus size={22} strokeWidth={2} />
              Add More Images
            </button>
          </div>

          <aside className="dtf-ab-side">
            <div className="dtf-ab-preview-head">
              <h3>Gang sheet preview</h3>
              <span>{sheet.feetLabel}</span>
            </div>
            <div className="dtf-ab-preview">
              {packPreview.length ? (
                packPreview.map((p) => (
                  <img
                    key={p.id}
                    src={p.imageDataUrl}
                    alt=""
                    style={{
                      left: `${p.x * 100}%`,
                      top: `${p.y * 100}%`,
                      width: `${(p.widthIn / sheet.widthIn) * 100}%`,
                      height: `${(p.heightIn / sheet.heightIn) * 100}%`,
                    }}
                  />
                ))
              ) : (
                <p>Add images to preview the pack.</p>
              )}
            </div>

            <label className="dtf-ab-tidy">
              <input
                type="checkbox"
                checked={tidy}
                onChange={(e) => setTidy(e.target.checked)}
              />
              <span>Tidy my layout for more room</span>
              <em
                title="Sorts taller art first so rows pack denser and leave less wasted space."
              >
                <Info size={13} strokeWidth={2.25} />
              </em>
            </label>

            <div className="dtf-ab-margins">
              <label>
                <span>Canvas Margin</span>
                <input
                  type="number"
                  min={0}
                  step={0.05}
                  value={canvasMargin}
                  onChange={(e) =>
                    setCanvasMargin(Math.max(0, Number(e.target.value) || 0))
                  }
                />
                <small>in</small>
              </label>
              <label>
                <span>Image Margin</span>
                <input
                  type="number"
                  min={0}
                  step={0.05}
                  value={imageMargin}
                  onChange={(e) =>
                    setImageMargin(Math.max(0, Number(e.target.value) || 0))
                  }
                />
                <small>in</small>
              </label>
            </div>

            <div className="dtf-ab-stats">
              <div>
                <span>Images to Place</span>
                <strong>{totalImages}</strong>
              </div>
              <div>
                <span>Canvas Size</span>
                <strong>{sheet.feetLabel}</strong>
              </div>
            </div>
          </aside>
        </div>

        <footer className="dtf-modal-footer dtf-ab-footer">
          <button
            type="button"
            className="dtf-ab-reset"
            onClick={resetChanges}
          >
            <RotateCcw size={14} />
            Reset changes
          </button>
          <div className="dtf-ab-footer-actions">
            <button
              type="button"
              className="dtf-modal-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="dtf-modal-primary"
              disabled={!totalImages}
              onClick={handleApply}
            >
              Apply Layout
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
