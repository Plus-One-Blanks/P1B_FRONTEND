import {useEffect, useMemo, useState} from 'react';
import {createPortal} from 'react-dom';
import {
  Check,
  ChevronDown,
  ClipboardPaste,
  Minus,
  Plus,
  Search,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import {
  NN_FILL_PRESETS,
  NN_FONTS,
  NN_OUTLINE_PRESETS,
  NN_SIZE_PRESETS,
  ensureNnFontsLoaded,
  parseNnPasteList,
  renderNnTextGraphic,
  waitForNnFont,
} from '~/lib/dtfNamesNumbers';

/**
 * @typedef {{
 *   id: string;
 *   name: string;
 *   number: string;
 *   qty: number;
 * }} NnRow
 */

/**
 * @typedef {{
 *   label: string;
 *   kind: 'name' | 'number';
 *   dataUrl: string;
 *   naturalWidth: number;
 *   naturalHeight: number;
 *   widthIn: number;
 *   heightIn: number;
 * }} NnGraphic
 */

function newRow() {
  return {
    id: `nn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    number: '',
    qty: 1,
  };
}

/**
 * Names & Numbers builder modal — roster → fonts/colors → add as separate sheet art.
 * @param {{
 *   open: boolean;
 *   sheetFeetLabel: string;
 *   onClose: () => void;
 *   onAddGraphics: (graphics: NnGraphic[]) => void | Promise<void>;
 * }} props
 */
export function NamesNumbersModal({
  open,
  sheetFeetLabel,
  onClose,
  onAddGraphics,
}) {
  const [mode, setMode] = useState(
    /** @type {'name-number' | 'name' | 'number'} */ ('name-number'),
  );
  const [rows, setRows] = useState(/** @type {NnRow[]} */ ([newRow()]));
  const [sizeId, setSizeId] = useState(
    /** @type {'small' | 'medium' | 'large'} */ ('large'),
  );
  const [fontId, setFontId] = useState('oswald');
  const [fontOpen, setFontOpen] = useState(false);
  const [fontQuery, setFontQuery] = useState('');
  const [fillId, setFillId] = useState('black');
  const [outlineId, setOutlineId] = useState('off');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteRaw, setPasteRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [previewUrls, setPreviewUrls] = useState(
    /** @type {Array<{ id: string; label: string; url: string }>} */ ([]),
  );

  const font = NN_FONTS.find((f) => f.id === fontId) || NN_FONTS[0];
  const size = NN_SIZE_PRESETS.find((s) => s.id === sizeId) || NN_SIZE_PRESETS[2];
  const fill = NN_FILL_PRESETS.find((c) => c.id === fillId) || NN_FILL_PRESETS[0];
  const outline =
    NN_OUTLINE_PRESETS.find((c) => c.id === outlineId) || NN_OUTLINE_PRESETS[0];

  const filteredFonts = useMemo(() => {
    const q = fontQuery.trim().toLowerCase();
    if (!q) return NN_FONTS;
    return NN_FONTS.filter((f) => f.label.toLowerCase().includes(q));
  }, [fontQuery]);

  const showName = mode !== 'number';
  const showNumber = mode !== 'name';

  const stats = useMemo(() => {
    let graphics = 0;
    let filled = 0;
    for (const row of rows) {
      const hasName = showName && row.name.trim();
      const hasNum = showNumber && String(row.number).trim();
      if (!hasName && !hasNum) continue;
      filled += 1;
      const qty = Math.max(1, row.qty || 1);
      if (hasName) graphics += qty;
      if (hasNum) graphics += qty;
    }
    return {filled, graphics};
  }, [rows, showName, showNumber]);

  useEffect(() => {
    if (!open) return;
    ensureNnFontsLoaded();
    void waitForNnFont(font.family, 42);
  }, [open, font.family]);

  useEffect(() => {
    if (open) return;
    setFontOpen(false);
    setFontQuery('');
    setPasteOpen(false);
    setError(null);
    setBusy(false);
  }, [open]);

  useEffect(() => {
    if (!fontOpen) return;
    /** @param {KeyboardEvent} e */
    function onKey(e) {
      if (e.key === 'Escape') {
        setFontOpen(false);
        setFontQuery('');
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fontOpen]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function buildPreview() {
      ensureNnFontsLoaded();
      await waitForNnFont(font.family, 64);
      /** @type {Array<{ id: string; label: string; url: string }>} */
      const next = [];
      for (const row of rows) {
        const qty = Math.max(1, row.qty || 1);
        if (showName && row.name.trim()) {
          try {
            const g = await renderNnTextGraphic({
              text: row.name.trim().toUpperCase(),
              fontFamily: font.family,
              heightIn: Math.min(size.nameH, 1.2),
              fill: fill.value,
              outline: outline.value,
            });
            for (let i = 0; i < qty; i++) {
              next.push({
                id: `${row.id}-n-${i}`,
                label: row.name.trim(),
                url: g.dataUrl,
              });
            }
          } catch {
            /* skip */
          }
        }
        if (showNumber && String(row.number).trim()) {
          try {
            const g = await renderNnTextGraphic({
              text: String(row.number).trim(),
              fontFamily: font.family,
              heightIn: Math.min(size.numberH, 2.2),
              fill: fill.value,
              outline: outline.value,
            });
            for (let i = 0; i < qty; i++) {
              next.push({
                id: `${row.id}-num-${i}`,
                label: `#${row.number}`,
                url: g.dataUrl,
              });
            }
          } catch {
            /* skip */
          }
        }
      }
      if (!cancelled) setPreviewUrls(next.slice(0, 12));
    }
    const t = setTimeout(() => void buildPreview(), 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [
    open,
    rows,
    showName,
    showNumber,
    font.family,
    size.nameH,
    size.numberH,
    fill.value,
    outline.value,
  ]);

  if (!open || typeof document === 'undefined') return null;

  /**
   * @param {string} id
   * @param {Partial<NnRow>} partial
   */
  function updateRow(id, partial) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? {...r, ...partial} : r)),
    );
  }

  function applyPaste() {
    const parsed = parseNnPasteList(pasteRaw);
    if (!parsed.length) return;
    setRows(
      parsed.map((p, i) => ({
        id: `nn-paste-${Date.now()}-${i}`,
        name: p.name,
        number: p.number,
        qty: 1,
      })),
    );
    setPasteOpen(false);
    setPasteRaw('');
  }

  async function handleAdd() {
    setBusy(true);
    setError(null);
    try {
      ensureNnFontsLoaded();
      await waitForNnFont(font.family, 120);
      /** @type {NnGraphic[]} */
      const graphics = [];
      for (const row of rows) {
        const qty = Math.max(1, row.qty || 1);
        if (showName && row.name.trim()) {
          const g = await renderNnTextGraphic({
            text: row.name.trim().toUpperCase(),
            fontFamily: font.family,
            heightIn: size.nameH,
            fill: fill.value,
            outline: outline.value,
          });
          for (let i = 0; i < qty; i++) {
            graphics.push({
              label: row.name.trim().toUpperCase(),
              kind: 'name',
              dataUrl: g.dataUrl,
              naturalWidth: g.naturalWidth,
              naturalHeight: g.naturalHeight,
              widthIn: g.widthIn,
              heightIn: g.heightIn,
            });
          }
        }
        if (showNumber && String(row.number).trim()) {
          const g = await renderNnTextGraphic({
            text: String(row.number).trim(),
            fontFamily: font.family,
            heightIn: size.numberH,
            fill: fill.value,
            outline: outline.value,
          });
          for (let i = 0; i < qty; i++) {
            graphics.push({
              label: String(row.number).trim(),
              kind: 'number',
              dataUrl: g.dataUrl,
              naturalWidth: g.naturalWidth,
              naturalHeight: g.naturalHeight,
              widthIn: g.widthIn,
              heightIn: g.heightIn,
            });
          }
        }
      }
      if (!graphics.length) {
        setError('Add at least one name or number.');
        return;
      }
      await onAddGraphics(graphics);
      onClose();
      setRows([newRow()]);
      setPasteOpen(false);
      setFontOpen(false);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Could not create graphics');
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="dtf-modal-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dtf-nn-title"
      onClick={onClose}
    >
      <div
        className="dtf-modal dtf-modal--nn"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dtf-modal-header dtf-nn-header">
          <div className="dtf-modal-header-lead">
            <h2 id="dtf-nn-title">
              <Type size={18} strokeWidth={2.25} aria-hidden />
              Names &amp; Numbers
            </h2>
            <p className="dtf-modal-sub">
              Create text graphics for team names and jersey numbers.
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

        <div className="dtf-nn-modes" role="tablist" aria-label="Graphic type">
          {[
            {id: 'name-number', label: 'Name + Number'},
            {id: 'name', label: 'Name only'},
            {id: 'number', label: 'Number only'},
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              className={mode === m.id ? 'is-active' : ''}
              aria-selected={mode === m.id}
              onClick={() => setMode(/** @type {typeof mode} */ (m.id))}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="dtf-nn-body">
          <div className="dtf-nn-main">
            <section className="dtf-nn-card">
              <div className="dtf-nn-card-head">
                <h3>Roster</h3>
                <button
                  type="button"
                  className="dtf-nn-linkish"
                  onClick={() => setPasteOpen((v) => !v)}
                >
                  <ClipboardPaste size={14} />
                  Paste a list
                </button>
              </div>

              {pasteOpen ? (
                <div className="dtf-nn-paste">
                  <textarea
                    rows={4}
                    placeholder={'One per line — e.g.\nGOOSE 23\nMILLER 7'}
                    value={pasteRaw}
                    onChange={(e) => setPasteRaw(e.target.value)}
                  />
                  <div className="dtf-nn-paste-actions">
                    <button
                      type="button"
                      className="dtf-modal-secondary"
                      onClick={() => {
                        setPasteOpen(false);
                        setPasteRaw('');
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="dtf-modal-primary"
                      onClick={applyPaste}
                    >
                      Apply list
                    </button>
                  </div>
                </div>
              ) : null}

              <div
                className={`dtf-nn-table-head dtf-nn-table-head--${mode}`}
              >
                {showName ? <span>Name</span> : null}
                {showNumber ? <span>Number</span> : null}
                <span>Qty</span>
                <span className="dtf-nn-spacer" />
              </div>

              <ul className={`dtf-nn-rows dtf-nn-rows--${mode}`}>
                {rows.map((row) => (
                  <li key={row.id}>
                    {showName ? (
                      <input
                        type="text"
                        placeholder="NAME"
                        value={row.name}
                        onChange={(e) =>
                          updateRow(row.id, {name: e.target.value})
                        }
                        aria-label="Name"
                      />
                    ) : null}
                    {showNumber ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="#"
                        className="dtf-nn-num"
                        value={row.number}
                        onChange={(e) =>
                          updateRow(row.id, {
                            number: e.target.value.replace(/[^\d]/g, ''),
                          })
                        }
                        aria-label="Number"
                      />
                    ) : null}
                    <div className="dtf-nn-qty">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() =>
                          updateRow(row.id, {
                            qty: Math.max(1, (row.qty || 1) - 1),
                          })
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
                        onClick={() =>
                          updateRow(row.id, {qty: (row.qty || 1) + 1})
                        }
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="dtf-nn-row-del"
                      aria-label="Remove row"
                      disabled={rows.length <= 1}
                      onClick={() =>
                        setRows((prev) =>
                          prev.length <= 1
                            ? prev
                            : prev.filter((r) => r.id !== row.id),
                        )
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className="dtf-nn-add-row"
                onClick={() => setRows((prev) => [...prev, newRow()])}
              >
                <Plus size={14} />
                Add row
              </button>
              <p className="dtf-nn-muted">
                {stats.filled} row{stats.filled === 1 ? '' : 's'} ·{' '}
                {stats.graphics} graphic{stats.graphics === 1 ? '' : 's'}
              </p>
            </section>

            <section className="dtf-nn-card">
              <h3>Size</h3>
              <div className="dtf-nn-sizes">
                {NN_SIZE_PRESETS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={sizeId === s.id ? 'is-active' : ''}
                    onClick={() => setSizeId(s.id)}
                  >
                    <strong>{s.label}</strong>
                    <span>
                      {showName ? `Name ${s.nameH}"h` : null}
                      {showName && showNumber ? ' · ' : null}
                      {showNumber ? `Number ${s.numberH}"h` : null}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <div className="dtf-nn-style-row">
              <section className="dtf-nn-card">
                <h3>Font</h3>
                <button
                  type="button"
                  className="dtf-nn-font-trigger"
                  onClick={() => {
                    setFontQuery('');
                    setFontOpen(true);
                  }}
                  style={{fontFamily: font.family}}
                >
                  <span>{font.label}</span>
                  <ChevronDown size={16} strokeWidth={2.25} aria-hidden />
                </button>
              </section>

              <section className="dtf-nn-card">
                <h3>Color</h3>
                <div className="dtf-nn-colors">
                  <label>
                    <span>Fill</span>
                    <select
                      value={fillId}
                      onChange={(e) => setFillId(e.target.value)}
                    >
                      {NN_FILL_PRESETS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <em style={{background: fill.value}} aria-hidden />
                  </label>
                  <label>
                    <span>Outline</span>
                    <select
                      value={outlineId}
                      onChange={(e) => setOutlineId(e.target.value)}
                    >
                      {NN_OUTLINE_PRESETS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <em
                      className={!outline.value ? 'is-off' : ''}
                      style={{
                        background: outline.value || 'transparent',
                      }}
                      aria-hidden
                    />
                  </label>
                </div>
              </section>
            </div>

            <section className="dtf-nn-card dtf-nn-preview-card">
              <div className="dtf-nn-preview-head">
                <h3>On the sheet</h3>
                <p className="dtf-nn-muted">
                  {sheetFeetLabel} ·{' '}
                  {stats.graphics
                    ? `${stats.graphics} graphic${stats.graphics === 1 ? '' : 's'}`
                    : 'empty'}
                </p>
              </div>
              <div className="dtf-nn-preview-sheet">
                {previewUrls.length ? (
                  <div className="dtf-nn-preview-stack">
                    {previewUrls.map((p) => (
                      <img key={p.id} src={p.url} alt={p.label} />
                    ))}
                  </div>
                ) : (
                  <p>Add names or numbers to preview how they’ll stack.</p>
                )}
              </div>
            </section>
          </div>
        </div>

        {error ? (
          <p className="dtf-nn-error" role="alert">
            {error}
          </p>
        ) : null}

        <footer className="dtf-modal-footer dtf-nn-footer">
          <p className="dtf-nn-muted">
            {sheetFeetLabel} · {stats.graphics} graphic
            {stats.graphics === 1 ? '' : 's'} · 0.25″ between images
          </p>
          <div className="dtf-nn-footer-actions">
            <button
              type="button"
              className="dtf-modal-secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="dtf-modal-primary"
              disabled={busy || stats.graphics < 1}
              onClick={() => void handleAdd()}
            >
              {busy ? 'Adding…' : 'Add to sheet'}
            </button>
          </div>
        </footer>
      </div>

      {fontOpen
        ? createPortal(
            <div
              className="dtf-nn-font-overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby="dtf-nn-font-title"
              onClick={() => {
                setFontOpen(false);
                setFontQuery('');
              }}
            >
              <div
                className="dtf-nn-font-panel"
                onClick={(e) => e.stopPropagation()}
              >
                <header className="dtf-nn-font-panel-head">
                  <div>
                    <h3 id="dtf-nn-font-title">Choose a font</h3>
                    <p>Preview each style, then select one for your roster.</p>
                  </div>
                  <button
                    type="button"
                    className="dtf-modal-close"
                    aria-label="Close font picker"
                    onClick={() => {
                      setFontOpen(false);
                      setFontQuery('');
                    }}
                  >
                    <X size={18} strokeWidth={2.25} />
                  </button>
                </header>

                <div className="dtf-nn-font-search">
                  <Search size={15} strokeWidth={2.25} aria-hidden />
                  <input
                    type="search"
                    placeholder="Search fonts…"
                    value={fontQuery}
                    onChange={(e) => setFontQuery(e.target.value)}
                    autoFocus
                  />
                </div>

                <ul className="dtf-nn-font-list">
                  {filteredFonts.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        className={fontId === f.id ? 'is-active' : ''}
                        style={{fontFamily: f.family}}
                        onClick={() => {
                          setFontId(f.id);
                          setFontOpen(false);
                          setFontQuery('');
                        }}
                      >
                        <span className="dtf-nn-font-sample">{f.label}</span>
                        <span className="dtf-nn-font-meta">
                          {fontId === f.id ? (
                            <Check size={15} strokeWidth={2.5} />
                          ) : null}
                          <em>{f.label}</em>
                        </span>
                      </button>
                    </li>
                  ))}
                  {!filteredFonts.length ? (
                    <li className="dtf-nn-font-empty">No fonts match</li>
                  ) : null}
                </ul>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>,
    document.body,
  );
}
