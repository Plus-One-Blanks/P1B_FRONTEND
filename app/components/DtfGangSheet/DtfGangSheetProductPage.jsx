import {useMemo, useState} from 'react';
import {Link, useNavigate, useSearchParams} from 'react-router';
import {Money} from '@shopify/hydrogen';
import {Lock, Upload} from 'lucide-react';
import {
  DTF_GANG_SHEET_PRODUCT_HANDLE,
  DTF_GANG_SHEET_SIZES,
  findGangSheetVariant,
} from '~/lib/dtfSheetConstants';

/**
 * DTFSheet-style product page: size grid → Create Design / Upload print-ready.
 *
 * @param {{
 *   product: {
 *     id?: string;
 *     handle?: string;
 *     title?: string;
 *     description?: string;
 *     featuredImage?: { url?: string; altText?: string } | null;
 *     images?: { nodes?: Array<{ url: string; altText?: string }> };
 *     variants?: { nodes?: Array<{
 *       id: string;
 *       title: string;
 *       availableForSale?: boolean;
 *       price?: { amount: string; currencyCode: string };
 *     }> };
 *   } | null;
 * }} props
 */
export function DtfGangSheetProductPage({product}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSize =
    searchParams.get('size') ||
    DTF_GANG_SHEET_SIZES.find((s) => s.id === '2ft')?.id ||
    DTF_GANG_SHEET_SIZES[0].id;

  const [sheetId, setSheetId] = useState(initialSize);
  const [qty, setQty] = useState(1);

  const sheet =
    DTF_GANG_SHEET_SIZES.find((s) => s.id === sheetId) || DTF_GANG_SHEET_SIZES[0];

  const variants = product?.variants?.nodes || [];
  const variant = useMemo(
    () => findGangSheetVariant(variants, sheet),
    [variants, sheet],
  );

  const priceAmount = variant?.price?.amount || sheet.defaultPrice;
  const currencyCode = variant?.price?.currencyCode || 'USD';

  const gallery =
    product?.images?.nodes?.length
      ? product.images.nodes
      : product?.featuredImage?.url
        ? [product.featuredImage]
        : [];

  function goStudio() {
    const params = new URLSearchParams({
      size: sheet.id,
      qty: String(Math.max(1, qty)),
    });
    if (variant?.id) params.set('variant', variant.id);
    navigate(`/dtf-sheets/studio?${params.toString()}`);
  }

  function goUpload() {
    const params = new URLSearchParams({
      size: sheet.id,
      qty: String(Math.max(1, qty)),
      mode: 'upload',
    });
    if (variant?.id) params.set('variant', variant.id);
    navigate(`/dtf-sheets/studio?${params.toString()}`);
  }

  return (
    <div className="dtf-pdp">
      <div className="dtf-pdp-grid">
        <div className="dtf-pdp-gallery">
          {gallery.length ? (
            <img
              src={gallery[0].url}
              alt={gallery[0].altText || product?.title || 'DTF gang sheet'}
              className="dtf-pdp-hero-img"
            />
          ) : (
            <div className="dtf-pdp-hero-fallback" aria-hidden>
              <div className="dtf-pdp-hero-sheet">
                <span>22″</span>
                <span className="dtf-pdp-hero-sheet-len">{sheet.feetLabel}</span>
              </div>
              <p className="dtf-pdp-hero-caption">Custom gang sheet builder</p>
            </div>
          )}
        </div>

        <div className="dtf-pdp-buy">
          <Link to="/dtf-sheets" className="dtf-builder-back">
            ← DTF sheets
          </Link>
          <h1 className="dtf-pdp-title">
            {product?.title || 'DTF Gang Sheet Builder'}
          </h1>
          <p className="dtf-pdp-price">
            <Money
              data={{
                amount: String(priceAmount),
                currencyCode,
              }}
            />
          </p>
          <p className="dtf-pdp-lede">
            Printed in-house in the United States. Create your 22″ gang sheet
            online and checkout for fast production.
          </p>

          <ul className="dtf-pdp-trust" aria-label="Product highlights">
            <li>Hot peel</li>
            <li>100+ washes</li>
            <li>Quality check</li>
            <li>Buy more &amp; save</li>
          </ul>

          {!product ? (
            <p className="dtf-builder-warn">
              Shopify product <code>{DTF_GANG_SHEET_PRODUCT_HANDLE}</code> is
              missing. Run{' '}
              <code>node scripts/create-dtf-products.js</code> with an Admin
              API token — see <code>docs/dtf-gang-sheet.md</code>.
            </p>
          ) : null}

          <fieldset className="dtf-pdp-sizes">
            <legend>Select size (all sizes 22 inches wide)</legend>
            <div className="dtf-pdp-size-grid" role="list">
              {DTF_GANG_SHEET_SIZES.map((s) => {
                const v = findGangSheetVariant(variants, s);
                const selected = s.id === sheetId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="listitem"
                    className={`dtf-pdp-size${selected ? ' is-selected' : ''}`}
                    onClick={() => setSheetId(s.id)}
                    aria-pressed={selected}
                  >
                    {s.badge ? (
                      <span
                        className={`dtf-pdp-size-badge dtf-pdp-size-badge--${s.badgeTone || 'popular'}`}
                      >
                        {s.badge}
                      </span>
                    ) : null}
                    <span className="dtf-pdp-size-label">{s.feetLabel}</span>
                    {v?.price?.amount ? (
                      <span className="dtf-pdp-size-price">
                        ${Number(v.price.amount).toFixed(2)}
                      </span>
                    ) : (
                      <span className="dtf-pdp-size-price">
                        ${Number(s.defaultPrice).toFixed(2)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="dtf-pdp-qty-row">
            <span className="dtf-pdp-qty-label">Quantity</span>
            <div className="dtf-pdp-qty">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                −
              </button>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) =>
                  setQty(Math.max(1, Number(e.target.value) || 1))
                }
                aria-label="Quantity"
              />
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQty((q) => q + 1)}
              >
                +
              </button>
            </div>
          </div>

          <button
            type="button"
            className="dtf-pdp-create"
            onClick={goStudio}
          >
            <Lock size={18} strokeWidth={2.25} aria-hidden />
            Create Design
          </button>

          <button
            type="button"
            className="dtf-pdp-upload"
            onClick={goUpload}
          >
            Already have a file? Upload Now
            <Upload size={16} strokeWidth={2.25} aria-hidden />
          </button>

          <p className="dtf-pdp-secure">
            Secure checkout — encrypted payment processing
          </p>
        </div>
      </div>

      <section className="dtf-pdp-about">
        <h2>Product description</h2>
        <p>
          {product?.description ||
            'Create a print-ready DTF gang sheet online. Upload artwork, arrange your layout on a 22″ sheet, and order custom transfers ready to press.'}
        </p>
        <ul>
          <li>Resolution: 300 DPI recommended</li>
          <li>Formats: PNG with transparent background, JPG, or SVG</li>
          <li>We review files before print when quality looks off</li>
        </ul>
      </section>
    </div>
  );
}
