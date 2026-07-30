const {Storage} = require('@google-cloud/storage');
const {Firestore} = require('@google-cloud/firestore');
const {v4: uuidv4} = require('uuid');

const bucketName = process.env.GCS_BUCKET || '';
const storage = bucketName ? new Storage() : null;
const db = new Firestore();

/**
 * Upload a buffer to Cloud Storage and return a durable public URL.
 *
 * Buckets are created with uniform bucket-level access, so per-object
 * `makePublic()` always fails. We rely on bucket IAM (`allUsers` objectViewer)
 * set in deploy.sh, and return stable https URLs (important: order line
 * attributes must not use short-lived signed URLs).
 *
 * @param {Buffer} buffer
 * @param {{ contentType: string; folder?: string; fileName?: string }} opts
 */
async function uploadBuffer(buffer, opts) {
  if (!storage || !bucketName) {
    throw new Error('GCS_BUCKET is not configured');
  }

  const folder = opts.folder || 'designs';
  const fileName = opts.fileName || `${uuidv4()}.png`;
  const objectPath = `${folder}/${fileName}`;
  const file = storage.bucket(bucketName).file(objectPath);

  await file.save(buffer, {
    contentType: opts.contentType || 'image/png',
    resumable: false,
    metadata: {
      cacheControl: 'public, max-age=31536000',
    },
  });

  return {
    path: objectPath,
    url: `https://storage.googleapis.com/${bucketName}/${objectPath}`,
  };
}

/**
 * Persist design metadata in Firestore.
 * @param {Record<string, unknown>} data
 */
async function saveDesignDoc(data) {
  const id = data.id || uuidv4();
  const ref = db.collection('designs').doc(String(id));
  const payload = {
    ...data,
    id,
    updatedAt: new Date().toISOString(),
    createdAt: data.createdAt || new Date().toISOString(),
  };
  await ref.set(payload, {merge: true});
  return payload;
}

/**
 * @param {string} id
 */
async function getDesignDoc(id) {
  const snap = await db.collection('designs').doc(String(id)).get();
  if (!snap.exists) return null;
  return snap.data();
}

module.exports = {
  uploadBuffer,
  saveDesignDoc,
  getDesignDoc,
};
