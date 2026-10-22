# Design Studio — logic & process

Portable overview of how decorated-apparel design works in this storefront. Use this to reimplement or wire the same flow in another project.

## Purpose

Customers pick a blank color, choose print locations, place artwork, pick a print style, then save. The saved design:

1. Shows as a mockup on the product page
2. Travels with the line item into cart / checkout / order (via line attributes + a remote design ID)
3. Can be restored on refresh or reordered later from account (`?design=<id>`)

## Wizard steps

```
Color → Locations → Artwork → Print style → Save
```

| Step | What happens |
|------|----------------|
| **Color** | Confirm garment color (swatches + searchable dropdown). Updates blank preview. |
| **Locations** | Multi-select print spots (front center, left chest, back, sleeves, hat panels, etc.). Catalog depends on garment kind (tee / hoodie / hat). |
| **Artwork** | Per location, two sub-steps: (1) **Clean up** — art opens large for bg/color remove; (2) **Place** — size / rotate / drag on the garment. |
| **Print** | Choose simple vs full-color print style + rights checkbox. |
| **Save** | Bake view mockups → POST to design API → return `SavedProductDesign` to the PDP. |

Gating: sizes / add-to-cart on decorated PDPs require a saved design with a `remoteId` (and preferably hosted mockups).

## Core data shape

```ts
SavedProductDesign {
  remoteId: string | null          // server design UUID
  productHandle, productId
  colorCode, colorName
  printStyle: 'simple' | 'full'
  logoDataUrl                      // primary art (first location)
  transform: { x, y, scale, rotation }  // primary
  locations: [{
    id, label,
    logoDataUrl,                   // or hosted logoUrl after save
    transform: { x, y, scale, rotation }
  }]
  previewUrl                       // hosted composite (cart thumb)
  viewMockups: [{ view: 'front'|'back'|'side', url?, dataUrl? }]
}
```

**Transforms** are normalized percentages of the **garment photo’s object-fit box** (not the letterboxed stage):

- `x`, `y` — center of the logo (0–1)
- `scale` — logo width as a fraction of garment-box width
- `rotation` — degrees

CSS placement (studio + PDP overlay):

```
left: x * 100%
top: y * 100%
width: scale * 100%
transform: translate(-50%, -50%) rotate(rotation)
```

## Coordinate system (important)

1. Stage is a **square**.
2. Garment image uses `object-fit: contain` → letterboxing on portrait photos.
3. A **fit-layer** is sized to the real drawn garment rect; guides + logos live inside it.
4. When baking mockups (`composeStageExactPreview`), place logos in that same fit-box (`ox/oy/dw/dh`), **not** on the full canvas. Otherwise art looks shifted/scaled wrong after save.

Location presets (left chest, front center, …) are default `transform` values in a location catalog, keyed by garment kind from the product title.

## Save pipeline

```
1. Collect artByLocation + transforms + printStyle + color
2. Group locations by garment view (front / back / side)
3. For each view with art:
     composeStageExactPreview(garmentUrl, logos[]) → PNG data URL
4. POST saveDesign {
     productHandle, productId, colorCode, colorName, printStyle,
     locations: [{ id, label, transform, logoBase64 }],
     logoBase64, previewBase64,
     viewMockups: [{ view, imageBase64 }]
   }
5. API uploads to storage, writes Firestore packet, returns:
     { id, previewUrl, logoUrl, locations[].logoUrl, viewMockups[].url }
6. PDP stores SavedProductDesign; gallery prefers baked viewMockups
7. SessionStorage keeps a slim packet (remoteId + urls + transforms;
   strip huge data URLs)
```

Env: `PUBLIC_DESIGN_API_URL` → Cloud Function base (`/saveDesign`, `/getDesign`, `/removeBackground`, …).

DTF gang sheets reuse the **same** API URL (`/saveGangSheet`, `/getGangSheet`) — see `docs/dtf-gang-sheet.md`.

## Restore / refresh

| Source | Behavior |
|--------|----------|
| Session (`p1-design:<handle>`) | Load slim packet. If `remoteId` but no mockups/logos → `getDesign` rehydrate. |
| URL `?design=<uuid>` | Account reorder: fetch remote packet, apply color, show mockups. |
| Clear design | Null state + clear session + strip `?design=`. |

Do **not** persist `null` on first paint before restore runs (wipes session).

## Cart / order attachment

Build line item attributes from the saved design, e.g.:

| Key | Role |
|-----|------|
| `_designId` / `Design ID` | Machine + admin-visible ID |
| `_designPreview` | Hosted mockup URL for cart UI |
| `Design files` | Admin packet link |
| `Print style`, `Locations`, `Garment color` | Human-readable |

Only attach when `remoteId` exists. Production pulls art from the design API / storage by ID.

## PDP integration sketch

```
Decorated PDP
  ├─ Design Studio CTA (start / edit / clear)
  ├─ ProductImage gallery
  │    └─ baked viewMockups if color matches
  │    └─ else live logo overlays from transforms
  ├─ Color siblings (same ProductID tag, decorated)
  ├─ Size qty + ATC (gated on designReady)
  └─ DesignStudioModal
       onConfirmColor → switch blank sibling
       onSave → setSavedDesign + scroll to mockup
```

After save (especially mobile): scroll back to the product image so the customer sees the mockup.

## Files in this repo (reference)

| Area | Path |
|------|------|
| Modal / wizard UI | `app/components/DesignStudio/DesignStudioModal.jsx` |
| Location catalog | `app/components/DesignStudio/designStudioLocations.js` |
| Compose, save, get, bg-remove | `app/lib/designStudioApi.js` |
| Cart attributes + session | `app/lib/designOrderAttributes.js` |
| Decorated PDP wiring | `app/routes/($locale).decorated-products.$handle.jsx` |
| Cloud save handler | `scripts/gcloud-backend/saveDesign/index.js` |

## Checklist for another project

- [ ] Wizard: color → locations → artwork → print → save  
- [ ] Transforms in garment fit-box space; bake with the same math  
- [ ] Persist designs remotely; cart only stores ID + preview URL  
- [ ] Slim session restore + API rehydrate on refresh  
- [ ] ATC gated until design is saved  
- [ ] Clear / edit design without losing the rest of the PDP flow  
