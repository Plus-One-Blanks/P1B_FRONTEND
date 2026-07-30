const {createHttpFunction, parseJsonBody} = require('../utils/http');
const {uploadBuffer, saveDesignDoc} = require('../services/storage');

/**
 * POST {
 *   productHandle, productId, colorCode, colorName?,
 *   printStyle?,
 *   transform: { x, y, scale, rotation },
 *   logoBase64,                 // primary artwork
 *   previewBase64?,             // mockup composite (preferred for cart/order)
 *   locations?: [{
 *     id, label?, transform?,
 *     logoBase64?               // per-location art (production files)
 *   }]
 * }
 * → { design }
 *
 * Stores logos + optional composite preview in GCS and a full packet in Firestore.
 * Shopify cart/order line attributes reference design.id + design.previewUrl.
 */
module.exports = createHttpFunction({
  methods: ['POST'],
  auth: 'none',
  handler: async (req, res) => {
    const body = await parseJsonBody(req);

    if (!body.logoBase64 && !body.locations?.length) {
      res.status(400).json({
        error: 'logoBase64 or locations[].logoBase64 is required',
      });
      return;
    }

    const stamp = Date.now();
    const primaryRawSource =
      body.logoBase64 ||
      body.locations?.find((l) => l?.logoBase64)?.logoBase64;

    if (!primaryRawSource) {
      res.status(400).json({error: 'No artwork payload found'});
      return;
    }

    const logoRaw = String(primaryRawSource).replace(
      /^data:[^;]+;base64,/,
      '',
    );
    const logoUpload = await uploadBuffer(Buffer.from(logoRaw, 'base64'), {
      contentType: 'image/png',
      folder: 'designs/logos',
      fileName: `logo-${stamp}.png`,
    });

    /** @type {Array<Record<string, unknown>>} */
    const locationRecords = [];
    const locationsIn = Array.isArray(body.locations) ? body.locations : [];

    for (let i = 0; i < locationsIn.length; i++) {
      const loc = locationsIn[i] || {};
      const id = String(loc.id || `location-${i + 1}`);
      let logoUrl = null;
      let logoPath = null;

      if (loc.logoBase64) {
        const raw = String(loc.logoBase64).replace(/^data:[^;]+;base64,/, '');
        const up = await uploadBuffer(Buffer.from(raw, 'base64'), {
          contentType: 'image/png',
          folder: 'designs/logos',
          fileName: `logo-${stamp}-${id}.png`,
        });
        logoUrl = up.url;
        logoPath = up.path;
      } else if (i === 0) {
        // Fall back to primary upload for first location when only logoBase64 sent
        logoUrl = logoUpload.url;
        logoPath = logoUpload.path;
      }

      locationRecords.push({
        id,
        label: loc.label || id,
        transform: loc.transform || null,
        logoUrl,
        logoPath,
      });
    }

    // If no locations array was sent, still record the primary logo as one location
    if (!locationRecords.length) {
      locationRecords.push({
        id: 'primary',
        label: 'Primary',
        transform: body.transform || null,
        logoUrl: logoUpload.url,
        logoPath: logoUpload.path,
      });
    }

    let previewUrl = null;
    let previewPath = null;
    if (body.previewBase64) {
      const previewRaw = String(body.previewBase64).replace(
        /^data:[^;]+;base64,/,
        '',
      );
      const previewUpload = await uploadBuffer(
        Buffer.from(previewRaw, 'base64'),
        {
          contentType: 'image/png',
          folder: 'designs/previews',
          fileName: `preview-${stamp}.png`,
        },
      );
      previewUrl = previewUpload.url;
      previewPath = previewUpload.path;
    } else {
      previewUrl = logoUpload.url;
      previewPath = logoUpload.path;
    }

    const design = await saveDesignDoc({
      productHandle: body.productHandle || null,
      productId: body.productId || null,
      colorCode: body.colorCode || null,
      colorName: body.colorName || null,
      printStyle: body.printStyle || null,
      transform: body.transform || {x: 0.5, y: 0.38, scale: 0.35, rotation: 0},
      logoUrl: logoUpload.url,
      logoPath: logoUpload.path,
      previewUrl,
      previewPath,
      locations: locationRecords,
      status: 'saved',
      source: 'design-studio',
    });

    res.json({design});
  },
});
