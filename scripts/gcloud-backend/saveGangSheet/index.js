const {createHttpFunction, parseJsonBody} = require('../utils/http');
const {
  uploadBuffer,
  saveGangSheetDoc,
  getGangSheetDoc,
} = require('../services/storage');

/**
 * POST {
 *   gangSheetId?,              // update existing packet (items + preview)
 *   sheetSize,                 // e.g. '2ft'
 *   sheetWidthIn, sheetHeightIn,
 *   productHandle?, productId?,
 *   designName?,               // customer-facing label on the order
 *   previewBase64?,            // full sheet PNG for cart/order
 *   items: [{
 *     id, designId?, label?,
 *     transform: { x, y, scale, rotation },
 *     imageBase64,
 *     widthIn?, heightIn?,
 *   }],
 *   customerEmail?, customerId?,
 * }
 * → { gangSheet }
 *
 * Uploads art + sheet preview to GCS; stores packet in Firestore `gangSheets`.
 * Same Cloud Function service / GCP project as Design Studio (`saveDesign`).
 */
module.exports = createHttpFunction({
  methods: ['POST'],
  auth: 'none',
  handler: async (req, res) => {
    const body = await parseJsonBody(req);
    const existingId = body.gangSheetId ? String(body.gangSheetId) : null;
    const itemsIn = Array.isArray(body.items) ? body.items : [];

    /**
     * @param {Array<Record<string, unknown>>} source
     * @param {number} stamp
     */
    async function uploadItems(source, stamp) {
      /** @type {Array<Record<string, unknown>>} */
      const items = [];
      for (let i = 0; i < source.length; i++) {
        const item = source[i] || {};
        if (!item.imageBase64) {
          throw new Error(`items[${i}].imageBase64 is required`);
        }
        const raw = String(item.imageBase64).replace(/^data:[^;]+;base64,/, '');
        const up = await uploadBuffer(Buffer.from(raw, 'base64'), {
          contentType: 'image/png',
          folder: 'gang-sheets/art',
          fileName: `art-${stamp}-${i + 1}.png`,
        });
        items.push({
          id: String(item.id || `item-${i + 1}`),
          designId: item.designId != null ? String(item.designId) : null,
          label: item.label != null ? String(item.label) : `Design ${i + 1}`,
          transform: item.transform || {x: 0.5, y: 0.5, scale: 0.2, rotation: 0},
          widthIn: item.widthIn != null ? Number(item.widthIn) : null,
          heightIn: item.heightIn != null ? Number(item.heightIn) : null,
          imageUrl: up.url,
          imagePath: up.path,
        });
      }
      return items;
    }

    /**
     * @param {string | null | undefined} previewBase64
     * @param {number} stamp
     */
    async function uploadPreview(previewBase64, stamp) {
      if (!previewBase64) return {previewUrl: null, previewPath: null};
      const raw = String(previewBase64).replace(/^data:[^;]+;base64,/, '');
      const up = await uploadBuffer(Buffer.from(raw, 'base64'), {
        contentType: 'image/png',
        folder: 'gang-sheets/previews',
        fileName: `preview-${stamp}.png`,
      });
      return {previewUrl: up.url, previewPath: up.path};
    }

    if (existingId) {
      const existing = await getGangSheetDoc(existingId);
      if (!existing) {
        res.status(404).json({error: 'Gang sheet not found'});
        return;
      }

      const stamp = Date.now();
      let items = existing.items || [];
      let itemCount = existing.itemCount || items.length;

      if (itemsIn.length) {
        try {
          items = await uploadItems(itemsIn, stamp);
          itemCount = items.length;
        } catch (e) {
          res.status(400).json({
            error: e instanceof Error ? e.message : 'Invalid items',
          });
          return;
        }
      }

      let previewUrl = existing.previewUrl || null;
      let previewPath = existing.previewPath || null;
      if (body.previewBase64) {
        const up = await uploadPreview(body.previewBase64, stamp);
        previewUrl = up.previewUrl;
        previewPath = up.previewPath;
      }

      const gangSheet = await saveGangSheetDoc({
        ...existing,
        id: existingId,
        sheetSize: body.sheetSize != null ? body.sheetSize : existing.sheetSize,
        sheetWidthIn:
          body.sheetWidthIn != null
            ? Number(body.sheetWidthIn)
            : existing.sheetWidthIn,
        sheetHeightIn:
          body.sheetHeightIn != null
            ? Number(body.sheetHeightIn)
            : existing.sheetHeightIn,
        designName:
          body.designName != null
            ? String(body.designName).trim() || null
            : existing.designName || null,
        productHandle:
          body.productHandle != null
            ? body.productHandle
            : existing.productHandle,
        productId:
          body.productId != null ? body.productId : existing.productId,
        items,
        itemCount,
        previewUrl,
        previewPath,
        status: 'saved',
      });
      res.json({gangSheet});
      return;
    }

    if (!itemsIn.length) {
      res.status(400).json({error: 'items[] with artwork is required'});
      return;
    }

    const stamp = Date.now();
    let items;
    try {
      items = await uploadItems(itemsIn, stamp);
    } catch (e) {
      res.status(400).json({
        error: e instanceof Error ? e.message : 'Invalid items',
      });
      return;
    }

    const {previewUrl, previewPath} = await uploadPreview(
      body.previewBase64,
      stamp,
    );

    const gangSheet = await saveGangSheetDoc({
      sheetSize: body.sheetSize ? String(body.sheetSize) : '22x24',
      sheetWidthIn:
        body.sheetWidthIn != null ? Number(body.sheetWidthIn) : null,
      sheetHeightIn:
        body.sheetHeightIn != null ? Number(body.sheetHeightIn) : null,
      productHandle: body.productHandle || null,
      productId: body.productId || null,
      designName: body.designName
        ? String(body.designName).trim() || null
        : null,
      items,
      previewUrl,
      previewPath,
      itemCount: items.length,
      status: 'saved',
      source: 'dtf-gang-sheet-builder',
      customerEmail: body.customerEmail || null,
      customerId: body.customerId || null,
    });

    res.json({gangSheet});
  },
});
