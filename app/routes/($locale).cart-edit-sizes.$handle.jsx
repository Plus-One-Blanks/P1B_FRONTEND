import {
  isColorLikeOptionName,
  isSizeOption,
  sameNonSizeSelection,
} from '~/lib/cartEditSizes';
import {
  buildSiblingColorRows,
  fetchSiblingProductNodesForAddColor,
  pickDefaultSiblingProductHandle,
} from '~/lib/cartAddColorSiblings';
import {extractColorCodeHex} from '~/lib/featuredProductCard';

/**
 * @param {unknown} v
 * @returns {v is { id: string; selectedOptions: Array<{ name: string; value: string }>; price?: { amount: string; currencyCode: string }; compareAtPrice?: { amount: string; currencyCode: string } | null; availableForSale: boolean }}
 */
function isVariantNode(v) {
  return (
    Boolean(v) &&
    typeof v === 'object' &&
    'id' in v &&
    'selectedOptions' in v &&
    Array.isArray(/** @type {{ selectedOptions: unknown }} */ (v).selectedOptions)
  );
}

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context, params, request}) {
  const {storefront} = context;
  const handle = params.handle;
  if (!handle) {
    return Response.json({error: 'Missing handle'}, {status: 400});
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') === 'addColor' ? 'addColor' : '';
  const colorFilter = (url.searchParams.get('color') || '').trim();
  const optionNameFilter = (url.searchParams.get('optionName') || '').trim();
  const anchorVariantId = (url.searchParams.get('anchorVariant') || '').trim();
  const currentColor = (url.searchParams.get('currentColor') || '').trim();

  let {product, errors} = await storefront.query(CART_EDIT_SIZES_PRODUCT_QUERY, {
    variables: {handle},
  });

  if (errors?.length) {
    console.error('cart-edit-sizes:', errors);
  }

  if (!product?.id) {
    return Response.json({error: 'Product not found'}, {status: 404});
  }

  /** @type {ReturnType<typeof buildSiblingColorRows>} */
  let siblingColors = [];
  let addColorUsesSiblings = false;

  if (mode === 'addColor') {
    const relatedNodes = await fetchSiblingProductNodesForAddColor(
      storefront,
      product.tags,
    );
    siblingColors = buildSiblingColorRows(product, relatedNodes);
    if (siblingColors.length > 0) {
      addColorUsesSiblings = true;
      const shouldPickDefault =
        !colorFilter.length && Boolean(currentColor.length);
      if (shouldPickDefault) {
        const preferred = pickDefaultSiblingProductHandle(
          siblingColors,
          handle,
          currentColor,
        );
        if (preferred && preferred !== handle) {
          const r2 = await storefront.query(CART_EDIT_SIZES_PRODUCT_QUERY, {
            variables: {handle: preferred},
          });
          if (r2.product?.id) {
            product = r2.product;
          }
        }
      }
    }
  }

  const rawNodes = product.variants?.nodes ?? [];
  /** @type {Array<{ id: string; selectedOptions: Array<{ name: string; value: string }>; price?: { amount: string; currencyCode: string }; compareAtPrice?: { amount: string; currencyCode: string } | null; availableForSale: boolean; image?: { url?: string; altText?: string } | null }>} */
  const variants = rawNodes.filter(isVariantNode);

  const colorOptionMeta = product.options?.find((o) =>
    isColorLikeOptionName(o.name),
  );
  const sizeOptionMeta = product.options?.find(
    (o) => o.name.toLowerCase().trim() === 'size',
  );

  const norm = (s) => String(s || '').toLowerCase().trim();

  /** @type {string[]} */
  let resolvedColorFilter = colorFilter;
  /** @type {string} */
  let resolvedOptionNameFilter = optionNameFilter;

  if (mode === 'addColor' && !addColorUsesSiblings) {
    resolvedOptionNameFilter =
      optionNameFilter ||
      (colorOptionMeta?.name ? String(colorOptionMeta.name) : '');
    if (!colorFilter.length) {
      const fromMeta = colorOptionMeta?.values?.map(String) ?? [];
      /** @type {string[]} */
      let valueOrder = fromMeta;
      if (!valueOrder.length) {
        const seen = new Set();
        for (const v of variants) {
          const c = v.selectedOptions.find((x) => isColorLikeOptionName(x.name));
          if (!c?.value) continue;
          const key = norm(c.value);
          if (seen.has(key)) continue;
          seen.add(key);
          valueOrder.push(c.value);
        }
      }
      const cur = norm(currentColor);
      const pick =
        valueOrder.find((val) => norm(val) !== cur) ?? valueOrder[0] ?? '';
      resolvedColorFilter = String(pick || '').trim();
    }
  } else if (mode === 'addColor' && addColorUsesSiblings) {
    resolvedColorFilter = '';
    resolvedOptionNameFilter = '';
  }

  const useAnchor = Boolean(anchorVariantId) && mode !== 'addColor';

  /** @type {typeof variants} */
  let filtered = variants;

  if (useAnchor) {
    const anchor = variants.find((v) => v.id === anchorVariantId);
    if (!anchor) {
      return Response.json({
        error: 'Could not load sizes for this item.',
        variants: [],
      });
    }
    filtered = variants.filter((v) =>
      sameNonSizeSelection(anchor.selectedOptions, v.selectedOptions),
    );
  } else if (
    (mode === 'addColor' ? resolvedColorFilter : colorFilter).length > 0
  ) {
    const cf = mode === 'addColor' ? resolvedColorFilter : colorFilter;
    const onf = mode === 'addColor' ? resolvedOptionNameFilter : optionNameFilter;
    filtered = variants.filter((v) => {
      if (onf) {
        const o = v.selectedOptions.find(
          (x) =>
            x.name.toLowerCase().trim() === onf.toLowerCase().trim(),
        );
        return (
          o &&
          String(o.value).toLowerCase().trim() === cf.toLowerCase().trim()
        );
      }
      const c = v.selectedOptions.find((x) => isColorLikeOptionName(x.name));
      return (
        c &&
        String(c.value).toLowerCase().trim() === cf.toLowerCase().trim()
      );
    });
  }

  const sizeOrder = sizeOptionMeta?.values ?? [];
  const sizeLabelByVariantId = new Map();
  for (const v of filtered) {
    const s = v.selectedOptions.find(isSizeOption);
    if (s) sizeLabelByVariantId.set(v.id, s.value);
  }

  /** @type {Map<string, (typeof variants)[0]>} */
  const bySize = new Map();
  for (const v of filtered) {
    const s = v.selectedOptions.find(isSizeOption);
    if (!s) continue;
    if (!bySize.has(s.value)) bySize.set(s.value, v);
  }

  const orderedSizes = [];
  for (const sz of sizeOrder) {
    const v = bySize.get(sz);
    if (v) orderedSizes.push(v);
  }
  for (const v of filtered) {
    if (!orderedSizes.some((x) => x.id === v.id)) {
      orderedSizes.push(v);
    }
  }

  const currencyCode =
    orderedSizes[0]?.price?.currencyCode ?? 'USD';

  const colorHex = extractColorCodeHex(product.tags ?? undefined);

  /** @type {Array<{ value: string; previewVariantId: string; imageUrl: string | null; imageAlt: string | null }>} */
  let palette = [];
  if (mode === 'addColor' && !addColorUsesSiblings) {
    const fromMeta = colorOptionMeta?.values?.map(String) ?? [];
    /** @type {string[]} */
    let valueOrder = fromMeta;
    if (!valueOrder.length) {
      const seen = new Set();
      for (const v of variants) {
        const c = v.selectedOptions.find((x) => isColorLikeOptionName(x.name));
        if (!c?.value) continue;
        const key = norm(c.value);
        if (seen.has(key)) continue;
        seen.add(key);
        valueOrder.push(c.value);
      }
    }
    for (const val of valueOrder) {
      const v = variants.find((vv) => {
        const c = vv.selectedOptions.find((x) => isColorLikeOptionName(x.name));
        return c && norm(c.value) === norm(val);
      });
      if (v) {
        palette.push({
          value: String(val),
          previewVariantId: v.id,
          imageUrl: v.image?.url ? String(v.image.url) : null,
          imageAlt: v.image?.altText ? String(v.image.altText) : null,
        });
      }
    }
  }

  const selectedSiblingRow =
    mode === 'addColor' && addColorUsesSiblings
      ? siblingColors.find((r) => r.productHandle === product.handle) ?? null
      : null;

  const activeColorDisplay =
    mode === 'addColor' && addColorUsesSiblings
      ? String(selectedSiblingRow?.name ?? '')
      : mode === 'addColor'
        ? resolvedColorFilter
        : colorFilter;

  /** @type {{ url: string; alt: string } | null} */
  let heroImage = null;
  if (mode === 'addColor') {
    const withVariantImg = orderedSizes.find((x) => x.image?.url);
    if (withVariantImg?.image?.url) {
      heroImage = {
        url: String(withVariantImg.image.url),
        alt: String(withVariantImg.image.altText ?? product.title ?? 'Product'),
      };
    } else if (product.featuredImage?.url) {
      heroImage = {
        url: String(product.featuredImage.url),
        alt: String(product.featuredImage.altText ?? product.title ?? 'Product'),
      };
    }
  }

  return Response.json({
    productTitle: product.title,
    colorOptionName: colorOptionMeta?.name ?? 'Color',
    colorValue: activeColorDisplay,
    colorHex,
    mode: mode || undefined,
    palette: mode === 'addColor' && !addColorUsesSiblings ? palette : undefined,
    heroImage: mode === 'addColor' ? heroImage : undefined,
    colorCount:
      mode === 'addColor'
        ? addColorUsesSiblings
          ? siblingColors.length
          : palette.length
        : undefined,
    productHandle: mode === 'addColor' ? product.handle : undefined,
    siblingColors: mode === 'addColor' ? siblingColors : undefined,
    addColorUsesSiblings:
      mode === 'addColor' ? addColorUsesSiblings : undefined,
    selectedColorCode:
      mode === 'addColor' ? selectedSiblingRow?.code ?? null : undefined,
    selectedFormattedCode:
      mode === 'addColor'
        ? selectedSiblingRow?.formattedCode ?? null
        : undefined,
    sizeOptionName: sizeOptionMeta?.name ?? 'Size',
    currencyCode,
    variants: orderedSizes.map((v) => {
      const sizeOpt = v.selectedOptions.find(isSizeOption);
      return {
        id: v.id,
        sizeLabel: sizeOpt?.value ?? '—',
        price: v.price?.amount ?? '0',
        compareAtPrice: v.compareAtPrice?.amount ?? null,
        currencyCode: v.price?.currencyCode ?? currencyCode,
        availableForSale: Boolean(v.availableForSale),
      };
    }),
  });
}

/**
 * @param {Route.ActionArgs}
 */
export async function action({request, context}) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {status: 405});
  }

  const {cart} = context;

  const formData = await request.formData();
  const raw = formData.get('payload');
  /** @type {{ changes?: Array<{ variantId: string; quantity: number; lineId?: string | null }> } | null} */
  let body = null;
  try {
    body = raw ? JSON.parse(String(raw)) : null;
  } catch {
    return Response.json({error: 'Invalid payload'}, {status: 400});
  }

  const changes = Array.isArray(body?.changes) ? body.changes : [];
  if (!changes.length) {
    return Response.json({error: 'No changes'}, {status: 400});
  }

  const toRemove = [];
  const toUpdate = [];
  const toAdd = [];

  for (const row of changes) {
    const qty = Math.max(0, Math.floor(Number(row.quantity) || 0));
    const lineId = row.lineId || null;
    const variantId = row.variantId;
    if (!variantId) continue;

    if (qty <= 0 && lineId) {
      toRemove.push(lineId);
    } else if (qty > 0 && lineId) {
      toUpdate.push({id: lineId, quantity: qty});
    } else if (qty > 0 && !lineId) {
      toAdd.push({merchandiseId: variantId, quantity: qty});
    }
  }

  let lastResult = null;

  if (toRemove.length) {
    lastResult = await cart.removeLines(toRemove);
  }
  if (toUpdate.length) {
    lastResult = await cart.updateLines(toUpdate);
  }
  if (toAdd.length) {
    lastResult = await cart.addLines(toAdd);
  }

  if (!lastResult && !toRemove.length && !toUpdate.length && !toAdd.length) {
    return Response.json({ok: true, cart: await cart.get()});
  }

  const cartResult = lastResult?.cart ?? (await cart.get());
  const cartId = cartResult?.id;
  const headers = cartId ? cart.setCartId(cartResult.id) : new Headers();

  return Response.json(
    {ok: true, cart: cartResult, errors: lastResult?.errors},
    {headers},
  );
}

const CART_EDIT_SIZES_PRODUCT_QUERY = `#graphql
  query CartEditSizesProduct(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      id
      title
      handle
      tags
      featuredImage {
        url
        altText
        width
        height
      }
      options {
        name
        values
      }
      variants(first: 250) {
        nodes {
          id
          title
          availableForSale
          image {
            url
            altText
            width
            height
          }
          price {
            amount
            currencyCode
          }
          compareAtPrice {
            amount
            currencyCode
          }
          selectedOptions {
            name
            value
          }
        }
      }
    }
  }
`;

/** @typedef {import('./+types/cart-edit-sizes.$handle').Route} Route */
