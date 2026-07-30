# Design Studio — Google Cloud backend

Clean Node.js Cloud Functions for the Plus One **design studio**:

| Function | Method | Purpose |
|----------|--------|---------|
| `removeBackground` | POST | Clean logo cutout (`@imgly/background-removal-node`) |
| `saveDesign` | POST | Store logo + preview in **Cloud Storage**, metadata in **Firestore** |
| `getDesign` | GET | Load a saved design by id |

## Fixed GCP project

Deploy always targets **`plus-one-blanks-d09a5`** (via `--project=`), so your active `gcloud config` for other apps is left alone.

```bash
cd scripts/gcloud-backend
chmod +x deploy.sh
./deploy.sh
```

Optional overrides:

```bash
GCP_REGION=us-central1 GCS_BUCKET=plus-one-blanks-d09a5-designs ./deploy.sh
```

## After deploy

Copy the printed URL into the Hydrogen root `.env`:

```
PUBLIC_DESIGN_API_URL=https://....a.run.app
```

Then restart `npm run dev`.

## Local

```bash
cd scripts/gcloud-backend
npm install
npx @google-cloud/functions-framework --target=api --port=8080
```
