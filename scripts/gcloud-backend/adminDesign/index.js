const {createHttpFunction} = require('../utils/http');
const {getDesignDoc} = require('../services/storage');

/**
 * Staff-facing design packet page.
 * GET /admin/design?id=...
 *
 * UUID-gated (unguessable id). Open from Shopify order line attribute "Design files".
 * Returns HTML for browsers, JSON when Accept: application/json.
 */
module.exports = createHttpFunction({
  methods: ['GET'],
  auth: 'none',
  handler: async (req, res) => {
    const id = req.query?.id || req.query?.designId;
    if (!id) {
      res.status(400).json({error: 'id is required'});
      return;
    }

    const design = await getDesignDoc(String(id));
    if (!design) {
      res.status(404).json({error: 'Design not found'});
      return;
    }

    const wantsJson =
      String(req.headers.accept || '').includes('application/json') ||
      req.query?.format === 'json';

    if (wantsJson) {
      res.json({design});
      return;
    }

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(renderDesignPacketHtml(design));
  },
});

/**
 * @param {Record<string, any>} design
 */
function renderDesignPacketHtml(design) {
  const esc = (v) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const locations = Array.isArray(design.locations) ? design.locations : [];
  const locationCards = locations
    .map((loc) => {
      const img = loc.logoUrl
        ? `<a href="${esc(loc.logoUrl)}" target="_blank" rel="noopener"><img src="${esc(loc.logoUrl)}" alt="${esc(loc.label || loc.id)}" /></a>`
        : '<p class="muted">No file</p>';
      return `<article class="card">
        <h3>${esc(loc.label || loc.id)}</h3>
        <p class="muted">${esc(loc.id)}</p>
        <div class="art">${img}</div>
        <p><a href="${esc(loc.logoUrl || '#')}" target="_blank" rel="noopener">Download artwork</a></p>
      </article>`;
    })
    .join('\n');

  const preview = design.previewUrl
    ? `<a href="${esc(design.previewUrl)}" target="_blank" rel="noopener"><img class="preview" src="${esc(design.previewUrl)}" alt="Mockup preview" /></a>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Design packet · ${esc(design.id)}</title>
  <style>
    :root {
      --ink: #1a1a1a;
      --muted: #5c5c5c;
      --line: #e6e6e6;
      --bg: #f7f5f2;
      --card: #fff;
      --accent: #0b6e4f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, sans-serif;
      color: var(--ink);
      background: linear-gradient(180deg, #efeae3 0%, var(--bg) 40%, #f3f3f3 100%);
      min-height: 100vh;
    }
    main { max-width: 960px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
    header { margin-bottom: 1.75rem; }
    .kicker { text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.75rem; color: var(--muted); }
    h1 { font-size: 1.75rem; margin: 0.35rem 0 0.5rem; }
    .meta { display: grid; gap: 0.35rem; color: var(--muted); font-size: 0.95rem; }
    .meta strong { color: var(--ink); font-weight: 600; }
    .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-top: 1.25rem; }
    .card, .hero {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 1rem;
    }
    .hero { margin-top: 1rem; }
    .preview, .art img {
      width: 100%;
      max-height: 420px;
      object-fit: contain;
      background: #fafafa;
      border-radius: 8px;
    }
    .art img { max-height: 220px; }
    h2, h3 { margin: 0 0 0.5rem; font-size: 1.05rem; }
    a { color: var(--accent); }
    .muted { color: var(--muted); font-size: 0.85rem; }
    .pill {
      display: inline-block;
      margin-top: 0.75rem;
      padding: 0.35rem 0.65rem;
      border-radius: 999px;
      background: #e7f4ef;
      color: var(--accent);
      font-size: 0.8rem;
      font-weight: 600;
    }
    code { font-size: 0.85rem; word-break: break-all; }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="kicker">Plus One · Production design packet</div>
      <h1>${esc(design.productHandle || 'Decorated product')}</h1>
      <div class="meta">
        <div><strong>Design ID:</strong> <code>${esc(design.id)}</code></div>
        <div><strong>Color:</strong> ${esc(design.colorName || design.colorCode || '—')}</div>
        <div><strong>Print style:</strong> ${esc(design.printStyle || '—')}</div>
        <div><strong>Saved:</strong> ${esc(design.createdAt || '—')}</div>
        <div><strong>Status:</strong> ${esc(design.status || 'saved')}</div>
      </div>
      <span class="pill">Open this link from the Shopify order line attributes</span>
    </header>

    <section class="hero">
      <h2>Mockup preview</h2>
      ${preview || '<p class="muted">No preview on file — use location artwork below.</p>'}
      ${
        design.previewUrl
          ? `<p><a href="${esc(design.previewUrl)}" target="_blank" rel="noopener">Download mockup</a></p>`
          : ''
      }
    </section>

    <h2 style="margin-top:1.75rem">Artwork by location</h2>
    <div class="grid">
      ${locationCards || '<p class="muted">No location files stored.</p>'}
    </div>

    <section class="hero" style="margin-top:1.5rem">
      <h2>Primary logo</h2>
      ${
        design.logoUrl
          ? `<div class="art"><a href="${esc(design.logoUrl)}" target="_blank" rel="noopener"><img src="${esc(design.logoUrl)}" alt="Primary logo" /></a></div>
             <p><a href="${esc(design.logoUrl)}" target="_blank" rel="noopener">Download primary logo</a></p>`
          : '<p class="muted">Missing</p>'
      }
    </section>
  </main>
</body>
</html>`;
}
