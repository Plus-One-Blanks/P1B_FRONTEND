# DTF sheets & gang sheet builder

Separate from Design Studio (garment decoration). Customers order **transfers** — individual designs by finished size, or a **gang sheet** (product page → studio).

Inspired by [DTFSheet gang sheet builder](https://dtfsheet.com/products/dtfsheet%E2%84%A2-custom-gang-sheet-order-builder).

## Customer flow

```
/dtf-sheets  (hub: by-size vs gang sheet)
    │
    ├─ /dtf-sheets/by-size          individual transfers
    │
    └─ /dtf-sheets/builder          product page (size + qty)
            │
            ├─ Create Design  →  /dtf-sheets/studio?size=5ft&qty=1
            └─ Upload Now     →  /dtf-sheets/studio?mode=upload&size=5ft
```

Studio is full-viewport (header/footer hidden). Save → GCloud packet → Add to cart with line attributes.

## Shopify products

Handles in `app/lib/dtfSheetConstants.js`.

### Create via Admin API

```bash
SHOPIFY_ADMIN_API_TOKEN=shpat_xxx \
SHOPIFY_STORE=yf5c1z-bs.myshopify.com \
node scripts/create-dtf-products.js
```

Needs a Custom App with `write_products` / `read_products`. After create, **publish both products to the Hydrogen / Headless sales channel**.

### 1. Gang sheet — `dtf-gang-sheet`

Variants (option **Size**):

| Variant | Dimensions | Default price |
|---------|------------|---------------|
| 2 Feet | 22″ × 24″ | $19.99 |
| 5 Feet | 22″ × 60″ | $44.99 |
| 7 Feet | 22″ × 84″ | $59.99 |
| 10 Feet | 22″ × 120″ | $74.99 |
| 15 Feet | 22″ × 180″ | $99.99 |
| 20 Feet | 22″ × 240″ | $119.99 |

### 2. Transfers by size — `dtf-transfer-by-size`

Variants: `2x2` … `12x12` (see constants).

## GCloud (same project as Design Studio)

`PUBLIC_DESIGN_API_URL` → same Cloud Run service:

| Route | Role |
|-------|------|
| `POST /saveGangSheet` | Art + preview → Firestore `gangSheets` |
| `GET /getGangSheet?id=` | JSON packet |
| `GET /admin/gangSheet?id=` | Ops HTML packet |

## Cart attributes (gang sheet)

| Key | Value |
|-----|--------|
| `_gangSheetId` / `Gang sheet ID` | Packet UUID |
| `Sheet size` | e.g. `5ft` |
| `Design count` | Number of arts |
| `_gangSheetPreview` | Hosted preview URL |
| `Gang sheet files` | `{API}/admin/gangSheet?id=…` |

## Files

| Area | Path |
|------|------|
| Constants / SKUs | `app/lib/dtfSheetConstants.js` |
| Product landing UI | `app/components/DtfGangSheet/DtfGangSheetProductPage.jsx` |
| Studio UI | `app/components/DtfGangSheet/DtfGangSheetBuilder.jsx` |
| Client API | `app/lib/dtfGangSheetApi.js` |
| Cart attributes | `app/lib/dtfGangSheetOrderAttributes.js` |
| Create products script | `scripts/create-dtf-products.js` |
| Cloud handlers | `scripts/gcloud-backend/saveGangSheet`, `getGangSheet`, `adminGangSheet` |
