const {createHttpFunction} = require('../utils/http');
const {getDesignDoc} = require('../services/storage');

/**
 * GET ?id=...
 * → { design }
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

    res.json({design});
  },
});
