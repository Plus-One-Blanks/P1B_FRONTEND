const {createHttpFunction} = require('../utils/http');
const {getGangSheetDoc} = require('../services/storage');

/**
 * GET ?id=...
 * → { gangSheet }
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

    res.json({gangSheet});
  },
});
