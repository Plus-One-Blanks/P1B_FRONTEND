import {useState, useEffect} from 'react';
import {Image} from '@shopify/hydrogen';
import {DEFAULT_DESIGN_TRANSFORM} from '~/lib/designStudioApi';

/**
 * @typedef {{
 *   logoDataUrl: string;
 *   transform?: {x: number; y: number; scale: number; rotation: number};
 * }} DesignOverlay
 */

/**
 * Original product image carousel. Optional design overlays are used only by
 * decorated PDPs — blanks pass images only and look unchanged.
 *
 * @param {{
 *   images?: Array<(ProductVariantFragment['image'] & { mockupView?: 'front' | 'back' | 'side' }) | null | undefined>;
 *   image?: ProductVariantFragment['image'];
 *   designOverlay?: DesignOverlay | null;
 *   designOverlayByView?: { front?: DesignOverlay; back?: DesignOverlay } | null;
 * }}
 */
export function ProductImage({
  images,
  image,
  designOverlay = null,
  designOverlayByView = null,
}) {
  const imageArray = (images || (image ? [image] : [])).filter(Boolean);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [imageArray.length, imageArray[0]?.id, imageArray[0]?.url]);

  if (imageArray.length === 0) {
    return <div className="product-image" />;
  }

  const currentImage = imageArray[currentImageIndex];
  const hasMultipleImages = imageArray.length > 1;
  const view = currentImage.mockupView;
  // Only show artwork on the view it was designed for — never reuse front art on back.
  const overlay = view
    ? designOverlayByView?.[view] || null
    : designOverlay || null;
  const t = overlay?.transform || DEFAULT_DESIGN_TRANSFORM;

  const goToPrevious = () => {
    setCurrentImageIndex((prev) =>
      prev === 0 ? imageArray.length - 1 : prev - 1,
    );
  };

  const goToNext = () => {
    setCurrentImageIndex((prev) =>
      prev === imageArray.length - 1 ? 0 : prev + 1,
    );
  };

  return (
    <div className="product-image-container">
      <div className="product-image">
        <Image
          alt={currentImage.altText || 'Product Image'}
          data={currentImage}
          key={currentImage.id || currentImage.url}
          sizes="(min-width: 45em) 50vw, 100vw"
        />
        {overlay?.logoDataUrl ? (
          <img
            src={overlay.logoDataUrl}
            alt=""
            className="product-image-design-overlay"
            draggable={false}
            style={{
              left: `${t.x * 100}%`,
              top: `${t.y * 100}%`,
              width: `${t.scale * 100}%`,
              transform: `translate(-50%, -50%) rotate(${t.rotation || 0}deg)`,
            }}
          />
        ) : null}
        {hasMultipleImages ? (
          <>
            <button
              type="button"
              className="product-image-nav product-image-nav-prev"
              onClick={goToPrevious}
              aria-label="Previous image"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              className="product-image-nav product-image-nav-next"
              onClick={goToNext}
              aria-label="Next image"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** @typedef {import('storefrontapi.generated').ProductVariantFragment} ProductVariantFragment */
