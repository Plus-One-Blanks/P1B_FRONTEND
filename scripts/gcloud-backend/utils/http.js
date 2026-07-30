/**
 * Small HTTP helper matching the style of `scripts/addProofSlide`.
 * Wraps Cloud Function handlers with CORS, method checks, and JSON errors.
 */

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * @param {{
 *   methods?: string[];
 *   auth?: 'none' | 'staff';
 *   handler: (req: import('http').IncomingMessage & { body?: any; files?: any }, res: any) => Promise<void>;
 * }} options
 */
function createHttpFunction(options) {
  const methods = (options.methods || ['GET', 'POST']).map((m) =>
    m.toUpperCase(),
  );
  const auth = options.auth || 'none';

  return async (req, res) => {
    applyCors(req, res);

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (!methods.includes(String(req.method || '').toUpperCase())) {
      res.status(405).json({error: 'Method not allowed'});
      return;
    }

    try {
      if (auth === 'staff') {
        const key = req.headers['x-api-key'] || req.headers['x-staff-key'];
        const expected = process.env.STAFF_API_KEY;
        if (expected && key !== expected) {
          res.status(401).json({error: 'Unauthorized'});
          return;
        }
      }

      await options.handler(req, res);
    } catch (err) {
      console.error('[gcloud-backend]', err);
      const message =
        err instanceof Error ? err.message : 'Unexpected server error';
      if (!res.headersSent) {
        res.status(500).json({error: message});
      }
    }
  };
}

function applyCors(req, res) {
  const origin = req.headers.origin || '*';
  const allow =
    ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)
      ? ALLOWED_ORIGINS.includes('*')
        ? origin === '*'
          ? '*'
          : origin
        : origin
      : ALLOWED_ORIGINS[0] || '*';

  res.set('Access-Control-Allow-Origin', allow);
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Api-Key, X-Staff-Key',
  );
  res.set('Access-Control-Max-Age', '3600');
}

/**
 * Read raw body as Buffer (for multipart / binary uploads).
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<Buffer>}
 */
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Parse JSON body when Content-Type is application/json.
 * @param {import('http').IncomingMessage & { body?: any }} req
 */
async function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const raw = await readRawBody(req);
  if (!raw.length) return {};
  return JSON.parse(raw.toString('utf8'));
}

module.exports = {
  createHttpFunction,
  readRawBody,
  parseJsonBody,
};
