import { useState, useEffect, useRef } from 'react';
import { Suspense } from 'react';
import { useLoaderData, Await, useFetcher } from 'react-router';
import {
  getSelectedProductOptions,
  Analytics,
  useOptimisticVariant,
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  useSelectedOptionInUrlParam,
} from '@shopify/hydrogen';
import { ProductPrice } from '~/components/ProductPrice';
import { ProductImage } from '~/components/ProductImage';
import { ColorDropdown } from '~/components/ColorDropdown';
import { ProductForm } from '~/components/ProductForm';
import { ProductItem } from '~/components/ProductItem';
import { BulkPricingTiers, getActiveTier } from '~/components/BulkPricingTiers';
import { redirectIfHandleIsLocalized } from '~/lib/redirect';

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({ data }) => {
  return [
    { title: `Hydrogen | ${data?.product.title ?? ''}` },
    {
      rel: 'canonical',
      href: `/products/${data?.product.handle}`,
    },
  ];
};

/**
 * @param {Route.LoaderArgs} args
 */
export async function loader(args) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return { ...deferredData, ...criticalData };
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 * @param {Route.LoaderArgs}
 */
async function loadCriticalData({ context, params, request }) {
  const { handle } = params;
  const { storefront } = context;

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  const [{ product }] = await Promise.all([
    storefront.query(PRODUCT_QUERY, {
      variables: { handle, selectedOptions: getSelectedProductOptions(request) },
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  if (!product?.id) {
    throw new Response(null, { status: 404 });
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, { handle, data: product });

  // Extract ProductID from tags
  const productIdTag = product.tags?.find((tag) => tag.startsWith('ProductID:'));
  const productId = productIdTag ? productIdTag.replace('ProductID:', '') : null;

  return {
    product,
    productId,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 * @param {Route.LoaderArgs}
 */
function loadDeferredData({ context, params, request }) {
  const { handle } = params;
  const { storefront } = context;

  // Create a promise chain that:
  // 1. First gets the current product to find its ProductID tag
  // 2. Then searches for related products
  const relatedProducts = storefront
    .query(PRODUCT_QUERY, {
      variables: { handle, selectedOptions: getSelectedProductOptions(request) },
    })
    .then(({ product: currentProduct }) => {
      if (!currentProduct?.id) {
        return { products: { nodes: [] } };
      }

      // Extract ProductID from tags
      const productIdTag = currentProduct.tags?.find((tag) =>
        tag.startsWith('ProductID:'),
      );
      const productId = productIdTag
        ? productIdTag.replace('ProductID:', '').trim()
        : null;

      if (!productId) {
        return { products: { nodes: [] } };
      }

      // Search for all products with the same ProductID tag
      const searchTerm = `tag:ProductID:${productId}`;

      return storefront.query(RELATED_PRODUCTS_QUERY, {
        variables: {
          query: searchTerm,
          first: 100, // Get up to 100 products
        },
      });
    })
    .then((result) => {
      // Ensure we return the result even if nodes is empty
      return result || { products: { nodes: [] } };
    })
    .catch((error) => {
      console.error('Error fetching related products:', error);
      // Return empty result instead of null to prevent rendering issues
      return { products: { nodes: [] } };
    });

  return {
    relatedProducts,
  };
}

export default function Product() {
  /** @type {LoaderReturnData} */
  const { product, relatedProducts } = useLoaderData();

  // Get current product's colorCode to initialize selected color
  const currentColorCodeTag = product.tags?.find((tag) =>
    tag.startsWith('colorCode:'),
  );
  const initialColorCode = currentColorCodeTag
    ? currentColorCodeTag.replace('colorCode:', '').trim()
    : null;

  const [selectedColor, setSelectedColor] = useState(initialColorCode);
  const [selectedColorProduct, setSelectedColorProduct] = useState(product);
  // Cache for color code to image mapping for faster lookups
  const colorImageCache = useRef(new Map());
  // Track projected cart total for bulk pricing
  const [projectedCartTotal, setProjectedCartTotal] = useState(null);
  const [activeTier, setActiveTier] = useState(null);

  const cartFetcher = useFetcher();
  const isMountedRef = useRef(true);
  const hasInitialFetchRef = useRef(false);
  const fetchTimeoutRef = useRef(null);

  // Fetch current cart to determine active tier (only once on mount)
  useEffect(() => {
    isMountedRef.current = true;

    if (typeof window !== 'undefined' &&
      !hasInitialFetchRef.current &&
      cartFetcher.state === 'idle' &&
      isMountedRef.current &&
      !cartFetcher.data) {
      hasInitialFetchRef.current = true;
      const timeoutId = setTimeout(() => {
        if (isMountedRef.current && cartFetcher.state === 'idle' && !cartFetcher.data) {
          cartFetcher.load('/cart');
        }
      }, 100);

      return () => {
        clearTimeout(timeoutId);
      };
    }

    return () => {
      isMountedRef.current = false;
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
    };
  }, []);

  // Listen for cart update events (debounced)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleCartUpdate = () => {
      if (!isMountedRef.current) return;

      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }

      fetchTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current &&
          cartFetcher.state === 'idle') {
          cartFetcher.load('/cart');
        }
      }, 750);
    };

    window.addEventListener('cartUpdated', handleCartUpdate);

    return () => {
      window.removeEventListener('cartUpdated', handleCartUpdate);
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
    };
  }, []);

  // Calculate active tier based on cart subtotal or projected total
  useEffect(() => {
    if (!isMountedRef.current) return;

    const cartSubtotal = cartFetcher.data?.cart?.cost?.subtotalAmount?.amount
      ? parseFloat(cartFetcher.data.cart.cost.subtotalAmount.amount)
      : 0;

    // Use projected total if provided (includes items in quantity inputs), otherwise use current cart
    const totalToCheck = projectedCartTotal !== null && projectedCartTotal !== undefined
      ? projectedCartTotal
      : cartSubtotal;

    // Find the highest tier that applies
    const tier = getActiveTier(totalToCheck);

    // Only update state if component is still mounted
    if (isMountedRef.current) {
      setActiveTier(tier);
    }
  }, [cartFetcher.data, projectedCartTotal]);

  // Optimistically selects a variant with given available variant information
  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );

  // Sets the search param to the selected variant without navigation
  // only when no search params are set in the url
  useSelectedOptionInUrlParam(selectedVariant.selectedOptions);

  // Get the product options array
  const productOptions = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });

  // Get title and remove everything after the last "-"
  const fullTitle = product.title;
  const title = fullTitle?.includes('-')
    ? fullTitle.substring(0, fullTitle.lastIndexOf('-')).trim()
    : fullTitle;
  const { descriptionHtml } = product;

  // Collect all product images for carousel
  // Priority: selected color product images > current product images
  const allImages = [];

  // Use selected color product if available, otherwise use current product
  const productToUse = selectedColorProduct || product;

  // Add images from product media first
  if (productToUse.media?.nodes) {
    productToUse.media.nodes.forEach((mediaNode) => {
      if (mediaNode?.image) {
        allImages.push(mediaNode.image);
      }
    });
  }

  // Add variant images if not already included
  if (productToUse.adjacentVariants) {
    productToUse.adjacentVariants.forEach((variant) => {
      if (variant?.image && !allImages.find(img => img.id === variant.image.id)) {
        allImages.push(variant.image);
      }
    });
  }

  // Fallback: if no images found, use the display image
  if (allImages.length === 0) {
    const cachedImage = selectedColor ? colorImageCache.current.get(selectedColor) : null;
    const displayImage = cachedImage || selectedColorProduct?.selectedOrFirstAvailableVariant?.image || selectedVariant?.image;
    if (displayImage) {
      allImages.push(displayImage);
    }
  }



  return (
    <>
      <div className="product">
        <div className="product-left">
          <ProductImage images={allImages} />
          {relatedProducts && (
            <Suspense fallback={null}>
              <Await resolve={relatedProducts}>
                {(data) => {
                  if (!data?.products?.nodes) {
                    return selectedVariant?.price?.amount ? (
                      <BulkPricingTiers
                        basePrice={parseFloat(selectedVariant.price.amount)}
                      />
                    ) : null;
                  }

                  const allProducts = [product, ...data.products.nodes];

                  // Helper to check if a product is white
                  const isWhiteProduct = (product) => {
                    const colorNameTag = product.tags?.find((tag) =>
                      tag.startsWith('colorName:'),
                    );
                    const colorName = colorNameTag
                      ? colorNameTag.replace('colorName:', '').trim().toLowerCase()
                      : '';

                    const colorCodeTag = product.tags?.find((tag) =>
                      tag.startsWith('colorCode:'),
                    );
                    const colorCode = colorCodeTag
                      ? colorCodeTag.replace('colorCode:', '').trim().toLowerCase()
                      : '';

                    return (
                      colorName === 'white' ||
                      colorCode === '#ffffff' ||
                      colorCode === 'ffffff' ||
                      colorCode === '#fff' ||
                      colorCode === 'fff'
                    );
                  };

                  // Get all variants from products and calculate min prices
                  const whiteVariants = [];
                  const colorVariants = [];

                  allProducts.forEach((product) => {
                    if (isWhiteProduct(product)) {
                      if (product.adjacentVariants) {
                        whiteVariants.push(...product.adjacentVariants);
                      }
                      if (product.selectedOrFirstAvailableVariant) {
                        whiteVariants.push(product.selectedOrFirstAvailableVariant);
                      }
                    } else {
                      if (product.adjacentVariants) {
                        colorVariants.push(...product.adjacentVariants);
                      }
                      if (product.selectedOrFirstAvailableVariant) {
                        colorVariants.push(product.selectedOrFirstAvailableVariant);
                      }
                    }
                  });

                  // Find minimum prices
                  const getMinPrice = (variants) => {
                    if (!variants || variants.length === 0) return null;
                    const availableVariants = variants.filter(v => v?.availableForSale && v?.price);
                    if (availableVariants.length === 0) return null;
                    const prices = availableVariants.map(v => parseFloat(v.price.amount));
                    return Math.min(...prices);
                  };

                  const whitePrice = getMinPrice(whiteVariants);
                  const colorPrice = getMinPrice(colorVariants);

                  if (!whitePrice && !colorPrice) {
                    return selectedVariant?.price?.amount ? (
                      <BulkPricingTiers
                        basePrice={parseFloat(selectedVariant.price.amount)}
                      />
                    ) : null;
                  }

                  return (
                    <BulkPricingTiers
                      whiteBasePrice={whitePrice}
                      colorBasePrice={colorPrice}
                    />
                  );
                }}
              </Await>
            </Suspense>
          )}
          {!relatedProducts && selectedVariant?.price?.amount && (
            <BulkPricingTiers
              basePrice={parseFloat(selectedVariant.price.amount)}
            />
          )}
        </div>
        <div className="product-main">
          <h1>{title}</h1>
          {relatedProducts && (
            <ProductPricingBoxes relatedProducts={relatedProducts} currentProduct={product} />
          )}
          {relatedProducts && (
            <ProductColorSwatches
              relatedProducts={relatedProducts}
              selectedColor={selectedColor}
              onColorSelect={(color, product, image) => {
                setSelectedColor(color);
                setSelectedColorProduct(product);
                // Cache the image for this color code
                if (color && image) {
                  colorImageCache.current.set(color, image);
                }
              }}
              onColorsExtracted={(colorImageMap) => {
                // Store all color-to-image mappings for fast lookup
                colorImageMap.forEach((image, colorCode) => {
                  colorImageCache.current.set(colorCode, image);
                });
              }}
              currentProductId={product.id}
              currentProduct={product}
            />
          )}
          <ProductForm
            productOptions={productOptions}
            selectedVariant={selectedVariant}
            selectedColorProduct={selectedColorProduct}
            activeTier={activeTier}
            currentCartTotal={cartFetcher.data?.cart?.cost?.subtotalAmount?.amount
              ? parseFloat(cartFetcher.data.cart.cost.subtotalAmount.amount)
              : 0}
            onProjectedTotalChange={setProjectedCartTotal}
          />
          <ProductFeatures />
        </div>
      </div>
      {descriptionHtml && (
        <ProductDescriptionSection descriptionHtml={descriptionHtml} />
      )}
      <Analytics.ProductView
        data={{
          products: [
            {
              id: product.id,
              title: product.title,
              price: selectedVariant?.price.amount || '0',
              vendor: product.vendor,
              variantId: selectedVariant?.id || '',
              variantTitle: selectedVariant?.title || '',
              quantity: 1,
            },
          ],
        }}
      />
    </>
  );
}

/**
 * Product description section with split content and dropdown
 */
function ProductDescriptionSection({ descriptionHtml }) {
  const [isFeaturesOpen, setIsFeaturesOpen] = useState(false);
  const [isSizingGuideOpen, setIsSizingGuideOpen] = useState(false);

  // Early return if no description
  if (!descriptionHtml) {
    return null;
  }

  // Ensure descriptionHtml is a string
  const description = typeof descriptionHtml === 'string' ? descriptionHtml : String(descriptionHtml || '');

  if (!description || description.trim().length === 0) {
    return null;
  }

  // Declare variables outside try block so they're accessible in return
  let userFriendlyDescription = description;
  let featuresList = [];
  let sizingGuideTable = null;

  try {
    // Split description by "S&S DESCRIPTION" (case-insensitive, handle HTML entities)
    // Try multiple variations: "S&S DESCRIPTION", "S&amp;S DESCRIPTION", "S & S DESCRIPTION"
    const descriptionSplitPatterns = [
      /S&amp;S\s+DESCRIPTION/i,
      /S&S\s+DESCRIPTION/i,
      /S\s*&\s*S\s+DESCRIPTION/i,
    ];

    let descriptionSplitIndex = -1;
    let descriptionSplitLength = 0;

    for (const pattern of descriptionSplitPatterns) {
      try {
        const match = description.match(pattern);
        if (match && typeof match.index === 'number' && match.index >= 0) {
          descriptionSplitIndex = match.index;
          descriptionSplitLength = match[0].length;
          break;
        }
      } catch (e) {
        // Continue to next pattern if this one fails
        continue;
      }
    }

    let featuresContent = '';
    let contentAfterDescription = '';

    if (descriptionSplitIndex !== -1 && descriptionSplitIndex < description.length) {
      try {
        userFriendlyDescription = description.substring(0, descriptionSplitIndex).trim();
        const endIndex = descriptionSplitIndex + descriptionSplitLength;
        if (endIndex < description.length) {
          contentAfterDescription = description.substring(endIndex).trim();
        }
      } catch (e) {
        // If substring fails, use original description
        userFriendlyDescription = description;
      }
    } else {
      // If no "S&S DESCRIPTION" found, use entire description as content to check for specs
      contentAfterDescription = description;
    }

    // Now split contentAfterDescription by "S&S SPECS" to get sizing guide
    const specsSplitPatterns = [
      /S&amp;S\s+SPECS/i,
      /S&S\s+SPECS/i,
      /S\s*&\s*S\s+SPECS/i,
    ];

    let specsSplitIndex = -1;
    let specsSplitLength = 0;

    for (const pattern of specsSplitPatterns) {
      try {
        const match = contentAfterDescription.match(pattern);
        if (match && typeof match.index === 'number' && match.index >= 0) {
          specsSplitIndex = match.index;
          specsSplitLength = match[0].length;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    let sizingGuideContent = '';

    if (specsSplitIndex !== -1 && specsSplitIndex < contentAfterDescription.length) {
      try {
        // Everything before "S&S SPECS" is features content
        featuresContent = contentAfterDescription.substring(0, specsSplitIndex).trim();
        const specsEndIndex = specsSplitIndex + specsSplitLength;
        if (specsEndIndex < contentAfterDescription.length) {
          sizingGuideContent = contentAfterDescription.substring(specsEndIndex).trim();
        }
      } catch (e) {
        // If split fails, use contentAfterDescription as features
        featuresContent = contentAfterDescription;
      }
    } else {
      // If no "S&S SPECS" found, everything after description is features
      featuresContent = contentAfterDescription;
    }

    // Convert features content to bullet points
    // First, try to extract list items if they exist in HTML
    if (featuresContent && featuresContent.length > 0) {
      try {
        // Try to find <ul> or <ol> lists first
        const listMatch = featuresContent.match(/<(ul|ol)[^>]*>([\s\S]*?)<\/\1>/i);
        if (listMatch && listMatch[2]) {
          // Extract <li> items
          const liMatches = listMatch[2].match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
          if (liMatches && Array.isArray(liMatches)) {
            featuresList = liMatches
              .map(li => {
                if (typeof li === 'string') {
                  return li.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
                }
                return '';
              })
              .filter(item => item && item.length > 0);
          }
        }

        // If no list found, try to parse as plain text with delimiters
        if (featuresList.length === 0) {
          const featuresText = featuresContent
            .replace(/<[^>]*>/g, ' ') // Replace HTML tags with space
            .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
            .replace(/&amp;/g, '&') // Replace &amp; with &
            .replace(/&lt;/g, '<') // Replace &lt; with <
            .replace(/&gt;/g, '>') // Replace &gt; with >
            .trim();

          // Split by common delimiters (newlines, <br>, etc.)
          if (featuresText.length > 0) {
            featuresList = featuresText
              .split(/\n|<br\s*\/?>/i)
              .map(item => (typeof item === 'string' ? item.trim() : ''))
              .filter(item => item && item.length > 0 && !item.match(/^<[^>]+>$/));
          }
        }
      } catch (e) {
        // If parsing features fails, just show empty list
        featuresList = [];
      }
    }

    // Parse sizing guide content into a table
    if (sizingGuideContent && sizingGuideContent.length > 0) {
      try {
        // First, try to find an existing HTML table
        const tableMatch = sizingGuideContent.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
        if (tableMatch && tableMatch[1]) {
          // Extract table HTML
          sizingGuideTable = sizingGuideContent.match(/<table[^>]*>[\s\S]*?<\/table>/i)?.[0] || null;
        } else {
          // Try to parse as structured data (rows separated by newlines, columns by tabs or pipes)
          const tableText = sizingGuideContent
            .replace(/<[^>]*>/g, ' ') // Remove HTML tags
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .trim();

          // Try to detect if it's pipe-separated or tab-separated
          const lines = tableText.split(/\n/).map(line => line.trim()).filter(line => line.length > 0);

          if (lines.length > 0) {
            // Detect delimiter (pipe | or tab)
            const firstLine = lines[0];
            const hasPipes = firstLine.includes('|');
            const delimiter = hasPipes ? '|' : '\t';

            // Parse rows
            const rows = lines.map(line => {
              const cells = line.split(delimiter).map(cell => cell.trim()).filter(cell => cell.length > 0);
              return cells;
            });

            // Only create table if we have at least 2 rows and consistent column count
            if (rows.length >= 2 && rows.every(row => row.length === rows[0].length)) {
              const headerRow = rows[0];
              const dataRows = rows.slice(1);

              sizingGuideTable = (
                <table className="sizing-guide-table">
                  <thead>
                    <tr>
                      {headerRow.map((header, idx) => (
                        <th key={idx}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataRows.map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            } else {
              // If not structured as table, show as HTML
              sizingGuideTable = (
                <div
                  className="sizing-guide-content"
                  dangerouslySetInnerHTML={{ __html: sizingGuideContent }}
                />
              );
            }
          } else {
            // Fallback: show raw HTML
            sizingGuideTable = (
              <div
                className="sizing-guide-content"
                dangerouslySetInnerHTML={{ __html: sizingGuideContent }}
              />
            );
          }
        }
      } catch (e) {
        // If parsing fails, show raw content
        sizingGuideTable = (
          <div
            className="sizing-guide-content"
            dangerouslySetInnerHTML={{ __html: sizingGuideContent }}
          />
        );
      }
    }
  } catch (error) {
    console.error('Error parsing product description:', error);
    // Fallback: show entire description if parsing fails
    userFriendlyDescription = description;
    featuresList = [];
    sizingGuideTable = null;
  }

  // Ensure userFriendlyDescription is safe for dangerouslySetInnerHTML
  if (!userFriendlyDescription || typeof userFriendlyDescription !== 'string') {
    userFriendlyDescription = '';
  }

  // Final safety check before rendering
  if (!userFriendlyDescription) {
    return null;
  }

  return (
    <div className="product-description-section">
      <div className="product-description-container">
        <div className="product-description-left">
          <h2 className="product-description-title">Description</h2>
          <div
            className="product-description-content"
            dangerouslySetInnerHTML={{ __html: userFriendlyDescription }}
          />
        </div>
        <div className="product-description-right">
          <div className="product-description-dropdown">
            <button
              type="button"
              className="product-description-dropdown-button"
              onClick={() => setIsFeaturesOpen(!isFeaturesOpen)}
              aria-expanded={isFeaturesOpen}
            >
              <span className="product-description-dropdown-title">Features</span>
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`product-description-dropdown-icon ${isFeaturesOpen ? 'open' : ''}`}
              >
                <path d="M6 9l4 4 4-4" />
              </svg>
            </button>
            {isFeaturesOpen && (
              <div className="product-description-dropdown-content">
                <ul className="product-description-features-list">
                  {featuresList.map((feature, index) => (
                    <li key={index}>{feature}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {sizingGuideTable && (
            <div className="product-description-dropdown">
              <button
                type="button"
                className="product-description-dropdown-button"
                onClick={() => setIsSizingGuideOpen(!isSizingGuideOpen)}
                aria-expanded={isSizingGuideOpen}
              >
                <span className="product-description-dropdown-title">Sizing Guide</span>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`product-description-dropdown-icon ${isSizingGuideOpen ? 'open' : ''}`}
                >
                  <path d="M6 9l4 4 4-4" />
                </svg>
              </button>
              {isSizingGuideOpen && (
                <div className="product-description-dropdown-content">
                  {typeof sizingGuideTable === 'string' ? (
                    <div
                      className="sizing-guide-content"
                      dangerouslySetInnerHTML={{ __html: sizingGuideTable }}
                    />
                  ) : (
                    sizingGuideTable
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Product features snippet component
 */
function ProductFeatures() {
  return (
    <div className="product-features">
      <div className="product-feature-item">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="product-feature-icon"
        >
          <path d="M1 3h15v13H1z" />
          <path d="M16 8h4l3 3v5h-7V8z" />
          <path d="M5 8v9" />
        </svg>
        <span className="product-feature-text">Free Shipping on $50+</span>
      </div>
      <div className="product-feature-item">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="product-feature-icon"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
        <span className="product-feature-text">No Minimums</span>
      </div>
      <div className="product-feature-item">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="product-feature-icon"
        >
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
        <span className="product-feature-text">Free 45-Day Returns</span>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   relatedProducts: Promise<any>;
 *   selectedColor: string | null;
 *   onColorSelect: (color: string | null) => void;
 *   currentProductId: string;
 * }}
 */
function RelatedProductsSection({
  relatedProducts,
  selectedColor,
  onColorSelect,
  currentProductId,
}) {
  return (
    <Suspense fallback={<div>Loading related products...</div>}>
      <Await resolve={relatedProducts}>
        {(data) => {
          if (!data?.products?.nodes) {
            return null;
          }

          const products = data.products.nodes.filter(
            (p) => p.id !== currentProductId,
          );

          if (products.length === 0) {
            return null;
          }

          // Extract unique colors from products
          const colorMap = new Map();
          products.forEach((product) => {
            const colorCodeTag = product.tags?.find((tag) =>
              tag.startsWith('colorCode:'),
            );

            if (colorCodeTag) {
              const colorCode = colorCodeTag.replace('colorCode:', '').trim();
              // Extract color name from colorName tag, fallback to colorCode
              const colorNameTag = product.tags?.find((tag) =>
                tag.startsWith('colorName:'),
              );
              const colorName = colorNameTag
                ? colorNameTag.replace('colorName:', '').trim()
                : colorCode;

              if (!colorMap.has(colorCode)) {
                // Ensure color code starts with # if it's a hex code
                const formattedColorCode = colorCode.startsWith('#')
                  ? colorCode
                  : `#${colorCode}`;
                colorMap.set(colorCode, {
                  code: colorCode,
                  formattedCode: formattedColorCode,
                  name: colorName,
                  product: product, // Store product for image access
                });
              }
            }
          });

          const colors = Array.from(colorMap.values());

          // Filter products by selected color
          const filteredProducts = selectedColor
            ? products.filter((product) => {
              const colorCodeTag = product.tags?.find((tag) =>
                tag.startsWith('colorCode:'),
              );
              return colorCodeTag?.replace('colorCode:', '') === selectedColor;
            })
            : products;

          return (
            <div className="related-products-section">
              <h2>Available Colors</h2>
              <div className="related-products-grid">
                {filteredProducts.map((product) => (
                  <ProductItem key={product.id} product={product} />
                ))}
              </div>
            </div>
          );
        }}
      </Await>
    </Suspense>
  );
}


/**
 * Component to display color swatches in the main product area
 * @param {{
 *   relatedProducts: Promise<any>;
 *   selectedColor: string | null;
 *   onColorSelect: (color: string | null, product?: any, image?: any) => void;
 *   onColorsExtracted: (colorImageMap: Map<string, any>) => void;
 *   currentProductId: string;
 *   currentProduct: any;
 * }}
 */
function ProductColorSwatches({
  relatedProducts,
  selectedColor,
  onColorSelect,
  onColorsExtracted,
  currentProductId,
  currentProduct,
}) {
  return (
    <Suspense fallback={null}>
      <Await resolve={relatedProducts}>
        {(data) => {
          if (!data?.products?.nodes) {
            return null;
          }

          const allProducts = data.products.nodes;

          // Extract unique colors from all products (including current)
          const colorMap = new Map();
          // Map to store color code to image for fast lookup and preloading
          const colorImageMap = new Map();

          // First, add the current product to the map
          const currentColorCodeTag = currentProduct.tags?.find((tag) =>
            tag.startsWith('colorCode:'),
          );
          if (currentColorCodeTag) {
            const colorCode = currentColorCodeTag.replace('colorCode:', '').trim();
            // Extract color name from colorName tag, fallback to colorCode
            const colorNameTag = currentProduct.tags?.find((tag) =>
              tag.startsWith('colorName:'),
            );
            const colorName = colorNameTag
              ? colorNameTag.replace('colorName:', '').trim()
              : colorCode;
            const formattedColorCode = colorCode.startsWith('#')
              ? colorCode
              : `#${colorCode}`;
            const currentImage = currentProduct.selectedOrFirstAvailableVariant?.image;
            colorMap.set(colorCode, {
              code: colorCode,
              formattedCode: formattedColorCode,
              name: colorName,
              product: currentProduct,
              image: currentImage, // Store image directly
            });
            if (currentImage) {
              colorImageMap.set(colorCode, currentImage);
            }
          }

          // Then add all other products
          allProducts.forEach((product) => {
            const colorCodeTag = product.tags?.find((tag) =>
              tag.startsWith('colorCode:'),
            );

            if (colorCodeTag) {
              const colorCode = colorCodeTag.replace('colorCode:', '').trim();
              // Extract color name from colorName tag, fallback to colorCode
              const colorNameTag = product.tags?.find((tag) =>
                tag.startsWith('colorName:'),
              );
              const colorName = colorNameTag
                ? colorNameTag.replace('colorName:', '').trim()
                : colorCode;

              if (!colorMap.has(colorCode)) {
                const formattedColorCode = colorCode.startsWith('#')
                  ? colorCode
                  : `#${colorCode}`;
                const productImage = product.selectedOrFirstAvailableVariant?.image;
                colorMap.set(colorCode, {
                  code: colorCode,
                  formattedCode: formattedColorCode,
                  name: colorName,
                  product: product, // Store the product so we can use its image
                  image: productImage, // Store image directly
                });
                if (productImage) {
                  colorImageMap.set(colorCode, productImage);
                }
              }
            }
          });

          const colors = Array.from(colorMap.values());

          if (colors.length === 0) {
            return null;
          }

          // Notify parent component about extracted colors and images for caching
          if (onColorsExtracted) {
            onColorsExtracted(colorImageMap);
          }

          return (
            <div className="product-color-selector">
              <div className="color-selector-label">
                <label htmlFor="color-dropdown">Selected Color</label>
              </div>
              <ColorDropdown
                colors={colors}
                selectedColor={selectedColor}
                onColorSelect={onColorSelect}
              />
              <ColorSwatchSelectorWithPreload
                colors={colors}
                selectedColor={selectedColor}
                onColorSelect={onColorSelect}
              />
            </div>
          );
        }}
      </Await>
    </Suspense>
  );
}

/**
 * Color swatch selector with image preloading
 * @param {{
 *   colors: Array<{code: string; name: string; product?: any; image?: any}>;
 *   selectedColor: string | null;
 *   onColorSelect: (color: string | null, product?: any, image?: any) => void;
 * }}
 */
function ColorSwatchSelectorWithPreload({ colors, selectedColor, onColorSelect }) {
  // Pre-load all images when component mounts or colors change
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const linkElements = [];
    const imageObjects = [];

    colors.forEach((color) => {
      if (color.image?.url) {
        // Create image object for preloading
        const img = new Image();
        img.src = color.image.url;
        imageObjects.push(img);

        // Create preload link for higher priority
        try {
          const link = document.createElement('link');
          link.rel = 'preload';
          link.as = 'image';
          link.href = color.image.url;
          document.head.appendChild(link);
          linkElements.push(link);
        } catch (error) {
          // Silently ignore errors if document context is invalid
          if (process.env.NODE_ENV === 'development') {
            console.warn('Could not create preload link:', error);
          }
        }
      }
    });

    // Cleanup: remove link elements and abort image loading if possible
    return () => {
      linkElements.forEach((link) => {
        try {
          if (link.parentNode) {
            link.parentNode.removeChild(link);
          }
        } catch (error) {
          // Silently ignore cleanup errors
        }
      });
      // Note: Image objects can't be aborted, but they'll be garbage collected
      // when the component unmounts and references are cleared
    };
  }, [colors]);

  return (
    <div className="product-color-swatches">
      <div className="color-swatch-selector">
        <div className="color-swatches">
          {colors.map((color) => (
            <button
              key={color.code}
              type="button"
              className={`color-swatch ${selectedColor === color.code ? 'selected' : ''
                }`}
              onClick={() => onColorSelect(color.code, color.product, color.image)}
              style={{
                backgroundColor: color.formattedCode || `#${color.code}`,
              }}
              aria-label={color.name}
              title={color.name}
            >
              {selectedColor === color.code && (
                <svg
                  className="color-swatch-check"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M13 3L6 10l-3-3" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Pricing boxes component to show starting prices for White and Colors
 * @param {{
 *   relatedProducts: Promise<any>;
 *   currentProduct: any;
 * }}
 */
function ProductPricingBoxes({ relatedProducts, currentProduct }) {
  return (
    <Suspense fallback={null}>
      <Await resolve={relatedProducts}>
        {(data) => {
          if (!data?.products?.nodes) {
            return null;
          }

          const allProducts = [currentProduct, ...data.products.nodes];

          // Helper to check if a product is white
          const isWhiteProduct = (product) => {
            const colorNameTag = product.tags?.find((tag) =>
              tag.startsWith('colorName:'),
            );
            const colorName = colorNameTag
              ? colorNameTag.replace('colorName:', '').trim().toLowerCase()
              : '';

            const colorCodeTag = product.tags?.find((tag) =>
              tag.startsWith('colorCode:'),
            );
            const colorCode = colorCodeTag
              ? colorCodeTag.replace('colorCode:', '').trim().toLowerCase()
              : '';

            return (
              colorName === 'white' ||
              colorCode === '#ffffff' ||
              colorCode === 'ffffff' ||
              colorCode === '#fff' ||
              colorCode === 'fff'
            );
          };

          // Get all variants from products and calculate min prices
          const whiteVariants = [];
          const colorVariants = [];

          allProducts.forEach((product) => {
            if (isWhiteProduct(product)) {
              // Add all variants from white products
              if (product.adjacentVariants) {
                whiteVariants.push(...product.adjacentVariants);
              }
              if (product.selectedOrFirstAvailableVariant) {
                whiteVariants.push(product.selectedOrFirstAvailableVariant);
              }
            } else {
              // Add all variants from colored products
              if (product.adjacentVariants) {
                colorVariants.push(...product.adjacentVariants);
              }
              if (product.selectedOrFirstAvailableVariant) {
                colorVariants.push(product.selectedOrFirstAvailableVariant);
              }
            }
          });

          // Find minimum prices
          const getMinPrice = (variants) => {
            if (!variants || variants.length === 0) return null;

            const availableVariants = variants.filter(v => v?.availableForSale && v?.price);
            if (availableVariants.length === 0) return null;

            const prices = availableVariants.map(v => parseFloat(v.price.amount));
            return Math.min(...prices);
          };

          const getMinCompareAtPrice = (variants) => {
            if (!variants || variants.length === 0) return null;

            const availableVariants = variants.filter(
              v => v?.availableForSale && v?.compareAtPrice?.amount
            );
            if (availableVariants.length === 0) return null;

            const prices = availableVariants
              .map(v => parseFloat(v.compareAtPrice.amount))
              .filter(p => !isNaN(p));
            return prices.length > 0 ? Math.min(...prices) : null;
          };

          const whitePrice = getMinPrice(whiteVariants);
          const whiteCompareAtPrice = getMinCompareAtPrice(whiteVariants);
          const colorPrice = getMinPrice(colorVariants);
          const colorCompareAtPrice = getMinCompareAtPrice(colorVariants);

          // Calculate discount percentage
          const calculateDiscount = (price, compareAtPrice) => {
            if (!price || !compareAtPrice) return null;
            const discount = ((compareAtPrice - price) / compareAtPrice) * 100;
            return Math.round(discount);
          };

          const whiteDiscount = whitePrice && whiteCompareAtPrice
            ? calculateDiscount(whitePrice, whiteCompareAtPrice)
            : null;
          const colorDiscount = colorPrice && colorCompareAtPrice
            ? calculateDiscount(colorPrice, colorCompareAtPrice)
            : null;

          // Get currency code from first available variant
          const currencyCode = whiteVariants[0]?.price?.currencyCode ||
            colorVariants[0]?.price?.currencyCode ||
            'USD';

          return (
            <div className="product-pricing-boxes">
              {whitePrice && (
                <div className="pricing-box">
                  <div className="pricing-box-header">
                    <h3 className="pricing-box-title">White</h3>
                    <span className="pricing-box-badge">Save 50%</span>
                  </div>
                  <div className="pricing-box-content">
                    <div className="pricing-box-label">Starting at</div>
                    <div className="pricing-box-price">
                      {currencyCode === 'USD' ? '$' : ''}
                      {whitePrice.toFixed(2)}
                    </div>
                    <div className="pricing-box-retail">
                      Retail Price:{' '}
                      <span className="pricing-box-retail-price">
                        {currencyCode === 'USD' ? '$' : ''}
                        {(whitePrice * 2).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {colorPrice && (
                <div className="pricing-box">
                  <div className="pricing-box-header">
                    <h3 className="pricing-box-title">Colors</h3>
                    <span className="pricing-box-badge">Save 50%</span>
                  </div>
                  <div className="pricing-box-content">
                    <div className="pricing-box-label">Starting at</div>
                    <div className="pricing-box-price">
                      {currencyCode === 'USD' ? '$' : ''}
                      {colorPrice.toFixed(2)}
                    </div>
                    <div className="pricing-box-retail">
                      Retail Price:{' '}
                      <span className="pricing-box-retail-price">
                        {currencyCode === 'USD' ? '$' : ''}
                        {(colorPrice * 2).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        }}
      </Await>
    </Suspense>
  );
}

const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    quantityAvailable
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      __typename
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
    }
    selectedOptions {
      name
      value
    }
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
  }
`;

const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    tags
    descriptionHtml
    description
    encodedVariantExistence
    encodedVariantAvailability
    media(first: 10) {
      nodes {
        ... on MediaImage {
          id
          image {
            id
            url
            altText
            width
            height
          }
        }
      }
    }
    options {
      name
      optionValues {
        name
        firstSelectableVariant {
          ...ProductVariant
        }
        swatch {
          color
          image {
            previewImage {
              url
            }
          }
        }
      }
    }
    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      ...ProductVariant
    }
    adjacentVariants (selectedOptions: $selectedOptions) {
      ...ProductVariant
    }
    seo {
      description
      title
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
`;

const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
`;

const RELATED_PRODUCTS_QUERY = `#graphql
  fragment RelatedProduct on Product {
    id
    handle
    title
    tags
    encodedVariantExistence
    encodedVariantAvailability
    featuredImage {
      id
      altText
      url
      width
      height
    }
    media(first: 10) {
      nodes {
        ... on MediaImage {
          id
          image {
            id
            url
            altText
            width
            height
          }
        }
      }
    }
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    options {
      name
      optionValues {
        name
        firstSelectableVariant {
          ...ProductVariant
        }
        swatch {
          color
          image {
            previewImage {
              url
            }
          }
        }
      }
    }
    selectedOrFirstAvailableVariant(
      selectedOptions: []
      ignoreUnknownOptions: true
      caseInsensitiveMatch: true
    ) {
      ...ProductVariant
    }
    adjacentVariants(selectedOptions: []) {
      ...ProductVariant
    }
  }
  query RelatedProducts($query: String!, $first: Int!) {
    products(first: $first, query: $query) {
      nodes {
        ...RelatedProduct
      }
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
`;

/** @typedef {import('./+types/products.$handle').Route} Route */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
