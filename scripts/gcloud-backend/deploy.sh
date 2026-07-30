#!/usr/bin/env bash
# Deploy Plus One Design Studio Cloud Functions to a fixed GCP project
# (does NOT change your active gcloud config — always passes --project).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# Fixed project from your GCP account (plus-one-blanks-d09a5)
PROJECT_ID="${GCP_PROJECT_ID:-plus-one-blanks-d09a5}"
REGION="${GCP_REGION:-us-central1}"
FUNCTION_NAME="${GCP_FUNCTION_NAME:-p1-design-api}"
GCS_BUCKET="${GCS_BUCKET:-${PROJECT_ID}-designs}"
# Commas break --set-env-vars; we write an env vars YAML file instead.
CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:3030,http://127.0.0.1:3030,http://localhost:3000,http://127.0.0.1:3000,*}"
RUNTIME="${GCP_RUNTIME:-nodejs20}"
MEMORY="${GCP_MEMORY:-2Gi}"
TIMEOUT="${GCP_TIMEOUT:-300s}"
MIN_INSTANCES="${GCP_MIN_INSTANCES:-0}"
MAX_INSTANCES="${GCP_MAX_INSTANCES:-10}"
ENV_FILE="${ROOT}/.deploy-env.yaml"

echo "==> Project:  ${PROJECT_ID}"
echo "==> Region:   ${REGION}"
echo "==> Function: ${FUNCTION_NAME}"
echo "==> Bucket:   ${GCS_BUCKET}"

# Ensure deps are installed for the upload source
if [[ ! -d node_modules ]]; then
  echo "==> npm install"
  npm install
fi

echo "==> Enabling required APIs (project-scoped)"
gcloud services enable \
  cloudfunctions.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  storage.googleapis.com \
  firestore.googleapis.com \
  --project="${PROJECT_ID}"

echo "==> Ensuring Cloud Storage bucket exists"
if ! gcloud storage buckets describe "gs://${GCS_BUCKET}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://${GCS_BUCKET}" \
    --project="${PROJECT_ID}" \
    --location="${REGION}" \
    --uniform-bucket-level-access
  echo "    Created gs://${GCS_BUCKET}"
else
  echo "    Bucket already exists"
fi

echo "==> Ensuring bucket is publicly readable (stable art/mockup URLs for cart + orders)"
# Uniform bucket-level access: grant objectViewer to allUsers instead of per-object ACLs.
# Object names are unguessable (timestamp + uuid). Avoids iam.serviceAccounts.signBlob.
gcloud storage buckets add-iam-policy-binding "gs://${GCS_BUCKET}" \
  --project="${PROJECT_ID}" \
  --member=allUsers \
  --role=roles/storage.objectViewer \
  >/dev/null
echo "    allUsers → roles/storage.objectViewer"

# Firestore must exist in the project (Native mode). Create if missing.
echo "==> Checking Firestore"
if ! gcloud firestore databases describe --database='(default)' --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "    Creating Firestore (default) in ${REGION}…"
  gcloud firestore databases create \
    --project="${PROJECT_ID}" \
    --location="${REGION}" \
    --type=firestore-native || true
else
  echo "    Firestore already configured"
fi

# Quote CORS list so commas are preserved
cat > "${ENV_FILE}" <<EOF
GCS_BUCKET: "${GCS_BUCKET}"
CORS_ORIGINS: "${CORS_ORIGINS}"
EOF

cleanup() { rm -f "${ENV_FILE}"; }
trap cleanup EXIT

echo "==> Deploying Gen2 HTTP function: ${FUNCTION_NAME}"
gcloud functions deploy "${FUNCTION_NAME}" \
  --gen2 \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --runtime="${RUNTIME}" \
  --source="${ROOT}" \
  --entry-point=api \
  --trigger-http \
  --allow-unauthenticated \
  --memory="${MEMORY}" \
  --timeout="${TIMEOUT}" \
  --min-instances="${MIN_INSTANCES}" \
  --max-instances="${MAX_INSTANCES}" \
  --env-vars-file="${ENV_FILE}"

URI="$(gcloud functions describe "${FUNCTION_NAME}" \
  --gen2 \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --format='value(serviceConfig.uri)')"

echo ""
echo "==> Deployed successfully"
echo "    URL: ${URI}"
echo ""
echo "Add this to the Hydrogen root .env:"
echo "PUBLIC_DESIGN_API_URL=${URI}"
echo ""
echo "Routes:"
echo "  POST ${URI}/removeBackground"
echo "  POST ${URI}/saveDesign"
echo "  GET  ${URI}/getDesign?id=..."
echo "  GET  ${URI}/admin/design?id=...   (production design packet page)"
