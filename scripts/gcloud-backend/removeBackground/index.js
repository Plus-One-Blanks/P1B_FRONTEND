const {createHttpFunction, parseJsonBody} = require('../utils/http');
const {removeBackground} = require('@imgly/background-removal-node');

/**
 * POST { imageBase64: string, mimeType?: string }
 * → { imageBase64: string, mimeType: 'image/png' }
 *
 * Clean logo cutout for the design studio.
 */
module.exports = createHttpFunction({
  methods: ['POST'],
  auth: 'none',
  handler: async (req, res) => {
    const body = await parseJsonBody(req);
    const imageBase64 = body.imageBase64;
    const mimeType = body.mimeType || 'image/png';

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      res.status(400).json({error: 'imageBase64 is required'});
      return;
    }

    const raw = imageBase64.replace(/^data:[^;]+;base64,/, '');
    const inputBuffer = Buffer.from(raw, 'base64');
    const blob = new Blob([inputBuffer], {type: mimeType});

    const resultBlob = await removeBackground(blob, {
      output: {format: 'image/png', quality: 0.95},
    });

    const arrayBuffer = await resultBlob.arrayBuffer();
    const out = Buffer.from(arrayBuffer);

    res.json({
      mimeType: 'image/png',
      imageBase64: `data:image/png;base64,${out.toString('base64')}`,
    });
  },
});
