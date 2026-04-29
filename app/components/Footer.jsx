import {Suspense} from 'react';
import {Await, Link} from 'react-router';
import {
  Instagram,
  Mail,
  MapPin,
  Phone,
  Youtube,
} from 'lucide-react';
import {ALL_PRODUCTS_COLLECTION_HANDLE} from '~/lib/searchDrawerCollection';

/** Business address (footer). */
const FOOTER_ADDRESS_LINE = '24335 Prielipp Rd Wildomar CA 92595';

/**
 * @type {Array<{ title: string; links: Array<{ label: string; to: string; external?: boolean }> }>}
 */
const FOOTER_NAV_COLUMNS = [
  {
    title: 'Catalog',
    links: [
      {
        label: 'All Product',
        to: `/collections/${ALL_PRODUCTS_COLLECTION_HANDLE}`,
      },
      {label: 'T-Shirts', to: '/collections/t-shirts'},
      {label: 'Longsleeves', to: '/collections/long-sleeve-t-shirts'},
      {label: 'Sweatshirts', to: '/collections/sweatshirts'},
      {label: 'Hats', to: '/collections/hats'},
    ],
  },
  {
    title: 'Info',
    links: [
      {label: 'About Us', to: '#'},
      {label: 'Blog', to: '#'},
      {label: 'Privacy Policy', to: '/policies/privacy-policy'},
      {label: 'Terms of Service', to: '/policies/terms-of-service'},
    ],
  },
  {
    title: 'Support',
    links: [
      {label: 'Returns & Refunds', to: '/policies/refund-policy'},
      {label: 'Shipping', to: '/policies/shipping-policy'},
      {label: 'FAQ', to: '#'},
    ],
  },
  {
    title: 'Contact',
    links: [
      {
        label: 'info@plusoneblanks.com',
        to: 'mailto:info@plusoneblanks.com',
      },
    ],
  },
];

function FooterNavLink({label, to, external}) {
  const className = 'footer-nav-link';
  if (external || to.startsWith('mailto:') || to.startsWith('tel:')) {
    return (
      <a className={className} href={to}>
        {label}
      </a>
    );
  }
  if (to === '#') {
    return (
      <a className={className} href="#" onClick={(e) => e.preventDefault()}>
        {label}
      </a>
    );
  }
  return (
    <Link className={className} to={to} prefetch="intent">
      {label}
    </Link>
  );
}

/** Simple TikTok mark (lucide has no TikTok icon). */
function TikTokIcon({size = 20, className = '', 'aria-hidden': ariaHidden = true}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden={ariaHidden}
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 1 1-5.2-1.74 2.89 2.89 0 0 1 2.31-2.83V8.4a6.16 6.16 0 0 0-1-.1A6.18 6.18 0 0 0 5 20.1a6.18 6.18 0 0 0 10.86-4.07V9.07a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.5z" />
    </svg>
  );
}

function FooterSocial() {
  const iconSize = 20;
  const items = [
    {href: '#', label: 'YouTube', Icon: Youtube, variant: 'stroke'},
    {href: '#', label: 'Instagram', Icon: Instagram, variant: 'stroke'},
    {href: '#', label: 'TikTok', Icon: TikTokIcon, variant: 'fill'},
    {href: '#', label: 'Phone', Icon: Phone, variant: 'stroke'},
    {href: '#', label: 'Email', Icon: Mail, variant: 'stroke'},
  ];
  return (
    <ul className="footer-social" aria-label="Social and contact">
      {items.map(({href, label, Icon, variant}) => (
        <li key={label}>
          <a
            href={href}
            className="footer-social-link"
            aria-label={label}
            onClick={(e) => e.preventDefault()}
          >
            {variant === 'fill' ? (
              <Icon size={iconSize} />
            ) : (
              <Icon size={iconSize} strokeWidth={1.75} aria-hidden />
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * @param {FooterProps}
 */
export function Footer({footer: footerPromise, header: _header, publicStoreDomain: _publicStoreDomain}) {
  return (
    <Suspense>
      <Await resolve={footerPromise}>
        {() => (
          <footer className="footer">
            <div className="footer-inner">
              <div className="footer-brand">
                <h2 className="footer-tagline">
                  <span className="footer-tagline-line">Built for you, delivered by</span>
                  <span className="footer-tagline-brand">Plus One Blanks</span>
                </h2>
                <FooterSocial />
                <p className="footer-address">
                  <MapPin size={16} strokeWidth={1.75} className="footer-address-icon" aria-hidden />
                  <span>{FOOTER_ADDRESS_LINE}</span>
                </p>
              </div>
              <nav className="footer-nav" aria-label="Footer">
                <div className="footer-nav-grid">
                  {FOOTER_NAV_COLUMNS.map((col) => (
                    <div key={col.title} className="footer-nav-col">
                      <h3 className="footer-nav-heading">{col.title}</h3>
                      <ul className="footer-nav-list">
                        {col.links.map((link) => (
                          <li key={link.label}>
                            <FooterNavLink {...link} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </nav>
            </div>
            <div className="footer-bottom">
              <p className="footer-copyright">
                Copyright © 2026 Plus One Blanks
              </p>
            </div>
          </footer>
        )}
      </Await>
    </Suspense>
  );
}

/**
 * @typedef {Object} FooterProps
 * @property {Promise<unknown>} footer
 * @property {import('storefrontapi.generated').HeaderQuery} [header]
 * @property {string} [publicStoreDomain]
 */

/** @typedef {import('storefrontapi.generated').FooterQuery} FooterQuery */
