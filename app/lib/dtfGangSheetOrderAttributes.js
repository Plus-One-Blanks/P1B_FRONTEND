/**
 * Cart / order line attributes for DTF gang sheets & transfers.
 */

export const GANG_SHEET_ATTR = {
  id: '_gangSheetId',
  idLabel: 'Gang sheet ID',
  preview: '_gangSheetPreview',
  packet: 'Gang sheet files',
  sheetSize: 'Sheet size',
  designCount: 'Design count',
  designName: 'Design name',
  productHandle: '_gangSheetProductHandle',
};

export const DTF_TRANSFER_ATTR = {
  designLabel: 'Design name',
  transferSize: 'Transfer size',
  notes: 'Artwork notes',
};

/**
 * @param {import('~/lib/dtfGangSheetApi').SavedGangSheet | null | undefined} sheet
 * @param {{ packetBaseUrl?: string | null; designName?: string | null }} [opts]
 * @returns {Array<{ key: string; value: string }>}
 */
export function buildGangSheetLineAttributes(sheet, opts = {}) {
  if (!sheet?.remoteId) return [];

  const id = String(sheet.remoteId);
  const packetBase = String(opts.packetBaseUrl || '').replace(/\/$/, '');
  const packetUrl = packetBase
    ? `${packetBase}/admin/gangSheet?id=${encodeURIComponent(id)}`
    : '';
  const designName =
    opts.designName != null
      ? String(opts.designName).trim()
      : sheet.designName
        ? String(sheet.designName).trim()
        : '';

  /** @type {Array<{ key: string; value: string }>} */
  const attrs = [
    {key: GANG_SHEET_ATTR.id, value: truncateAttr(id)},
    {key: GANG_SHEET_ATTR.idLabel, value: truncateAttr(id)},
    {
      key: GANG_SHEET_ATTR.sheetSize,
      value: truncateAttr(String(sheet.sheetSize || '')),
    },
    {
      key: GANG_SHEET_ATTR.designCount,
      value: truncateAttr(String(sheet.items?.length || 0)),
    },
  ];

  if (designName) {
    attrs.push({
      key: GANG_SHEET_ATTR.designName,
      value: truncateAttr(designName),
    });
  }
  if (sheet.previewUrl && !String(sheet.previewUrl).startsWith('data:')) {
    attrs.push({
      key: GANG_SHEET_ATTR.preview,
      value: truncateAttr(sheet.previewUrl),
    });
  }
  if (sheet.productHandle) {
    attrs.push({
      key: GANG_SHEET_ATTR.productHandle,
      value: truncateAttr(String(sheet.productHandle)),
    });
  }
  if (packetUrl) {
    attrs.push({key: GANG_SHEET_ATTR.packet, value: truncateAttr(packetUrl)});
  }

  return attrs;
}

/**
 * @param {Array<{ key?: string; value?: string }> | null | undefined} attributes
 */
export function readGangSheetFromLineAttributes(attributes) {
  if (!attributes?.length) return null;
  const map = Object.fromEntries(
    attributes.filter((a) => a?.key).map((a) => [a.key, a.value]),
  );
  const id = map[GANG_SHEET_ATTR.id] || map[GANG_SHEET_ATTR.idLabel];
  if (!id) return null;
  return {
    id: String(id),
    previewUrl: map[GANG_SHEET_ATTR.preview] || null,
    packetUrl: map[GANG_SHEET_ATTR.packet] || null,
    sheetSize: map[GANG_SHEET_ATTR.sheetSize] || null,
    designCount: map[GANG_SHEET_ATTR.designCount] || null,
    designName: map[GANG_SHEET_ATTR.designName] || null,
  };
}

/**
 * Studio URL to reopen a cart gang sheet for editing.
 * @param {{
 *   gangSheetId: string;
 *   cartLineId?: string | null;
 *   sheetSize?: string | null;
 *   designName?: string | null;
 * }} opts
 */
export function gangSheetStudioEditUrl(opts) {
  const sp = new URLSearchParams();
  sp.set('gangSheetId', String(opts.gangSheetId));
  if (opts.cartLineId) sp.set('cartLine', String(opts.cartLineId));
  if (opts.sheetSize) sp.set('size', String(opts.sheetSize));
  if (opts.designName) sp.set('name', String(opts.designName));
  return `/dtf-sheets/studio?${sp.toString()}`;
}

/**
 * Human-readable sheet dimensions for cart / confirm UI.
 * @param {string | null | undefined} sheetSizeId
 * @param {{ widthIn?: number; heightIn?: number; feetLabel?: string } | null} [sheet]
 */
export function formatGangSheetSizeLabel(sheetSizeId, sheet = null) {
  const width = sheet?.widthIn || 22;
  if (sheet?.feetLabel) {
    return `${width}" × ${sheet.feetLabel}`;
  }
  const id = String(sheetSizeId || '');
  const feetMatch = id.match(/^(\d+)ft$/i);
  if (feetMatch) {
    const n = Number(feetMatch[1]);
    return `${width}" × ${n} ${n === 1 ? 'Foot' : 'Feet'}`;
  }
  return id || `${width}" sheet`;
}

/**
 * @param {string} s
 */
function truncateAttr(s) {
  const str = String(s || '');
  return str.length > 250 ? `${str.slice(0, 247)}...` : str;
}
