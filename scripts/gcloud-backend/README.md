# Design Studio + DTF gang sheets — Google Cloud backend

Single Cloud Functions / Cloud Run service for Plus One **Design Studio** and **DTF gang sheets** (same GCP project `plus-one-blanks-d09a5`).

| Route | Method | Purpose |
|-------|--------|---------|
| `/removeBackground` | POST | Clean logo cutout (`@imgly/background-removal-node`) |
| `/saveDesign` | POST | Store logo + preview in **Cloud Storage**, metadata in **Firestore** |
| `/getDesign` | GET | Load a saved design by id |
| `/admin/design` | GET | Ops packet for a design |
| `/saveGangSheet` | POST | Store gang sheet art + preview (`gangSheets` collection) |
| `/getGangSheet` | GET | Load a gang sheet by id |
| `/admin/gangSheet` | GET | Ops HTML/JSON packet for print fulfillment |

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
