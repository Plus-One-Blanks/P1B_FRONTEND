import { ArrowRight } from 'lucide-react';
import { SolidButton } from '~/components/SolidButton';

/** Customer inquiries — replace with your team inbox. */
export const CONTACT_MAILTO =
  'mailto:support@example.com?subject=Product%20inquiry%20%E2%80%94%20Plus%201%20Blanks';

/** Contact CTA collage (grid positions 1–6). */
const HOME_CONTACT_COLLAGE = [
  {
    src: 'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/PHOTO1.jpg?v=1775515866',
    alt: 'Wholesale apparel and production',
  },
  {
    src: 'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/PHOTO2.jpg?v=1775515866',
    alt: 'Blank apparel and fulfillment',
  },
  {
    src: 'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/PHOTO5.jpg?v=1775515866',
    alt: 'Decorated apparel',
  },
  {
    src: 'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/PHOTO4.jpg?v=1775515866',
    alt: 'Print shop production',
  },
  {
    src: 'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/PHOTO3.jpg?v=1775515866',
    alt: 'Team and workspace',
  },
  {
    src: 'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/PHOTO6.png?v=1775515866',
    alt: 'Branded apparel',
  },
];

/**
 * “Don’t see what you’re looking for?” panel — shared by homepage and `/collections`.
 */
export function HomeContactCta() {
  return (
    <section className="home-contact" aria-labelledby="home-contact-heading">
      <div className="home-contact-wrap">
        <div className="home-contact-panel">
          <div className="home-contact-main">
            <div className="home-contact-copy">
              <h2 id="home-contact-heading" className="home-contact-title">
                Don&apos;t see what you&apos;re looking for?
              </h2>
              <p className="home-contact-text">
                Tell us the brand, style, color, or quantity you need—we&apos;ll confirm
                availability, suggest alternates, or help you plan a larger buy.
              </p>
            </div>
            <div className="home-contact-actions">
              <SolidButton
                href={CONTACT_MAILTO}
                variant="pastel-sky"
                icon={<ArrowRight className="button-icon" size={18} aria-hidden />}
              >
                Email our team
              </SolidButton>
            </div>
          </div>
          <div className="home-contact-collage">
            {HOME_CONTACT_COLLAGE.map(({ src, alt }, i) => {
              const n = i + 1;
              const imgProps = {
                className: `home-contact-collage-img home-contact-collage-img--${n}`,
                src,
                alt,
                width: 400,
                height: 320,
                loading: 'lazy',
                decoding: 'async',
              };
              if (n === 1 || n === 3) {
                return (
                  <div
                    key={src}
                    className={`home-contact-collage-tile home-contact-collage-tile--${n}`}
                  >
                    <img {...imgProps} />
                  </div>
                );
              }
              return <img key={src} {...imgProps} />;
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
