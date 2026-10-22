const {createHttpFunction} = require('../utils/http');
const {getGangSheetDoc} = require('../services/storage');

/**
 * GET ?id=... — production packet for ops (HTML by default, JSON if Accept/format).
 */
module.exports = createHttpFunction({
  methods: ['GET'],
  auth: 'none',
  handler: async (req, res) => {
    const id = req.query?.id || req.query?.gangSheetId;
    if (!id) {
      res.status(400).json({error: 'id is required'});
      return;
    }

    const gangSheet = await getGangSheetDoc(String(id));
    if (!gangSheet) {
      res.status(404).json({error: 'Gang sheet not found'});
      return;
    }

    const wantJson =
      String(req.query?.format || '').toLowerCase() === 'json' ||
      String(req.headers?.accept || '').includes('application/json');

    if (wantJson) {
      res.json({gangSheet});
      return;
    }

    const items = Array.isArray(gangSheet.items) ? gangSheet.items : [];
    const itemRows = items
      .map(
        (it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(it.label || it.id || '')}</td>
        <td>${it.widthIn || '—'} × ${it.heightIn || '—'} in</td>
        <td><a href="${escapeHtml(it.imageUrl || '')}" target="_blank" rel="noopener">Art file</a></td>
      </tr>`,
      )
      .join('');

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html>
<html><head><meta charset="utf-8"/><title>Gang sheet ${escapeHtml(String(id))}</title>
<style>
  body{font-family:system-ui,sans-serif;margin:2rem;color:#111}
  table{border-collapse:collapse;width:100%;margin-top:1rem}
  th,td{border:1px solid #ddd;padding:0.5rem;text-align:left}
  img.preview{max-width:480px;border:1px solid #eee}
</style></head><body>
  <h1>Gang sheet packet</h1>
  <p><strong>ID:</strong> ${escapeHtml(String(gangSheet.id))}</p>
  <p><strong>Size:</strong> ${escapeHtml(String(gangSheet.sheetSize || ''))}
     (${gangSheet.sheetWidthIn || '?'}×${gangSheet.sheetHeightIn || '?'} in)</p>
  <p><strong>Designs:</strong> ${items.length}</p>
  ${
    gangSheet.previewUrl
      ? `<p><img class="preview" src="${escapeHtml(gangSheet.previewUrl)}" alt="Sheet preview"/></p>
         <p><a href="${escapeHtml(gangSheet.previewUrl)}" target="_blank" rel="noopener">Open preview</a></p>`
      : '<p>No preview uploaded.</p>'
  }
  <table>
    <thead><tr><th>#</th><th>Label</th><th>Size</th><th>File</th></tr></thead>
    <tbody>${itemRows || '<tr><td colspan="4">No items</td></tr>'}</tbody>
  </table>
</body></html>`);
  },
});

/**
 * @param {string} s
 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
