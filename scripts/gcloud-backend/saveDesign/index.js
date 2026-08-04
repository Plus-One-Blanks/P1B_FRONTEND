const {createHttpFunction, parseJsonBody} = require('../utils/http');
const {uploadBuffer, saveDesignDoc, getDesignDoc} = require('../services/storage');

/**
 * POST {
 *   designId?,                  // when set: update color + mockups on existing design
 *   productHandle, productId, colorCode, colorName?,
 *   printStyle?,
 *   transform: { x, y, scale, rotation },
 *   logoBase64,                 // primary artwork (required unless designId)
 *   previewBase64?,             // mockup composite (preferred for cart/order)
 *   viewMockups?: [{ view, imageBase64 }],
 *   locations?: [{
 *     id, label?, transform?,
 *     logoBase64?               // per-location art (production files)
 *   }]
 * }
 * → { design }
 *
 * Stores logos + optional composite preview in GCS and a full packet in Firestore.
 * Shopify cart/order line attributes reference design.id + design.previewUrl.
 *
 * Passing designId lets the storefront re-bake mockups when the customer switches
 * blank color without creating a new design ID / re-uploading artwork.
 */
module.exports = createHttpFunction({
  methods: ['POST'],
  auth: 'none',
  handler: async (req, res) => {
    const body = await parseJsonBody(req);
    const existingId = body.designId ? String(body.designId) : null;

    if (existingId) {
      const existing = await getDesignDoc(existingId);
      if (!existing) {
        res.status(404).json({error: 'Design not found'});
        return;
      }

      const stamp = Date.now();
      let previewUrl = existing.previewUrl || null;
      let previewPath = existing.previewPath || null;

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
      }

      /** @type {Array<{ view: string; url: string; path: string }>} */
      let viewMockupRecords = Array.isArray(existing.viewMockups)
        ? existing.viewMockups
        : [];
      const viewMockupsIn = Array.isArray(body.viewMockups)
        ? body.viewMockups
        : [];
      if (viewMockupsIn.length) {
        viewMockupRecords = [];
        for (let i = 0; i < viewMockupsIn.length; i++) {
          const vm = viewMockupsIn[i] || {};
          if (!vm.imageBase64) continue;
          const view = String(vm.view || `view-${i + 1}`);
          const raw = String(vm.imageBase64).replace(/^data:[^;]+;base64,/, '');
          const up = await uploadBuffer(Buffer.from(raw, 'base64'), {
            contentType: 'image/png',
            folder: 'designs/previews',
            fileName: `mockup-${stamp}-${view}.png`,
          });
          viewMockupRecords.push({view, url: up.url, path: up.path});
        }
        if (!body.previewBase64 && viewMockupRecords[0]) {
          previewUrl = viewMockupRecords[0].url;
          previewPath = viewMockupRecords[0].path;
        }
      }

      const design = await saveDesignDoc({
        ...existing,
        id: existingId,
        colorCode:
          body.colorCode != null ? body.colorCode : existing.colorCode,
        colorName:
          body.colorName != null ? body.colorName : existing.colorName,
        previewUrl,
        previewPath,
        viewMockups: viewMockupRecords,
      });

      res.json({design});
      return;
    }

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

    /** @type {Array<{ view: string; url: string; path: string }>} */
    const viewMockupRecords = [];
    const viewMockupsIn = Array.isArray(body.viewMockups) ? body.viewMockups : [];
    for (let i = 0; i < viewMockupsIn.length; i++) {
      const vm = viewMockupsIn[i] || {};
      if (!vm.imageBase64) continue;
      const view = String(vm.view || `view-${i + 1}`);
      const raw = String(vm.imageBase64).replace(/^data:[^;]+;base64,/, '');
      const up = await uploadBuffer(Buffer.from(raw, 'base64'), {
        contentType: 'image/png',
        folder: 'designs/previews',
        fileName: `mockup-${stamp}-${view}.png`,
      });
      viewMockupRecords.push({view, url: up.url, path: up.path});
    }

    if (!previewUrl && viewMockupRecords[0]) {
      previewUrl = viewMockupRecords[0].url;
      previewPath = viewMockupRecords[0].path;
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
      viewMockups: viewMockupRecords,
      locations: locationRecords,
      status: 'saved',
      source: 'design-studio',
    });

    res.json({design});
  },
});
