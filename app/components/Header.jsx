import {Suspense, useEffect, useRef, useState} from 'react';
import {Await, Link, NavLink, useAsyncValue, useLocation} from 'react-router';
import {useAnalytics, useOptimisticCart} from '@shopify/hydrogen';
import {
  ArrowRight,
  ChevronDown,
  Menu,
  Phone,
  Search,
  ShoppingCart,
  User,
} from 'lucide-react';
import {useAside} from '~/components/Aside';
import {SolidButton} from '~/components/SolidButton';
import logo from '~/assets/logo.svg';

/**
 * Shared category handles. Blank collections keep these handles (now filtered
 * with fulfillment:blank). Decorated parallels use `{handle}-decorated`.
 */
export const APPAREL_CATEGORY_HANDLES = [
  {
    title: 'T-Shirts',
    handle: 't-shirts',
    blurb: 'Classic, soft, heavyweight, and performance tees',
  },
  {
    title: 'Hoodies & Sweatshirts',
    handle: 'sweatshirts',
    blurb: 'Fleece, crews, and hoodies for every season',
  },
  {
    title: 'Polos',
    handle: 'polos',
    blurb: 'Clean polos for work and branding',
  },
  {
    title: 'Hats',
    handle: 'hats',
    blurb: 'Caps and headwear for every fit',
  },
  {
    title: 'Jackets',
    handle: 'jackets',
    blurb: 'Outerwear ready to decorate',
  },
  {
    title: 'Safety',
    handle: 'safety',
    blurb: 'High-vis and jobsite apparel',
  },
];

/** Featured brands for blank / decorated apparel megas */
export const APPAREL_BRAND_LINKS = [
  {
    title: 'Gildan',
    handle: 'gildan',
    blurb: 'Core tees, fleece, youth, and performance styles',
  },
  {
    title: 'Comfort Colors',
    handle: 'comfort-colors',
    blurb: 'Garment-dyed favorites with soft hand feel',
  },
  {
    title: 'Bella + Canvas',
    handle: 'bella-canvas',
    blurb: 'Premium fits and retail-ready blanks',
  },
  {
    title: 'Next Level',
    handle: 'next-level',
    blurb: 'Soft tees and fashion-forward basics',
  },
];

const HEADER_PHONE = {
  display: '(800) 224-8476',
  href: 'tel:+18002248476',
  label: 'Talk to a print expert',
};

const HEADER_GET_IN_TOUCH_MAILTO =
  'mailto:support@example.com?subject=Inquiry%20%E2%80%94%20Plus%201%20Blanks';

/**
 * Bottom-nav IA for the site header (desktop mega + mobile accordion).
 * @type {Array<{
 *   id: string;
 *   title: string;
 *   href?: string;
 *   mega?: 'dtf' | 'blank' | 'decorated' | 'list';
 *   blurb?: string;
 *   children?: Array<{ title: string; url: string; blurb?: string; badge?: string }>;
 * }>}
 */
export const HEADER_PRIMARY_NAV = [
  {
    id: 'dtf',
    title: 'DTF Transfers',
    href: '/dtf-sheets',
    mega: 'dtf',
    blurb: 'Start with individual files or a finished gang sheet.',
  },
  {
    id: 'uv',
    title: 'UV DTF',
    href: '/dtf-sheets',
    mega: 'list',
    blurb: 'Hard-surface transfers coming soon to Plus 1.',
    children: [
      {
        title: 'DTF Sheets hub',
        url: '/dtf-sheets',
        blurb: 'Browse transfer order paths',
      },
      {
        title: 'Gang sheet builder',
        url: '/dtf-sheets/builder',
        blurb: 'Build a print-ready layout online',
      },
    ],
  },
  {
    id: 'blank',
    title: 'Blank Apparel',
    href: '/collections/t-shirts',
    mega: 'blank',
    blurb: 'Shop by garment or brand.',
  },
  {
    id: 'decorated',
    title: 'Decorated Apparel',
    href: '/collections/t-shirts-decorated',
    mega: 'decorated',
    blurb: 'Shop by garment or brand.',
  },
  {
    id: 'supplies',
    title: 'Supplies',
    href: '/dtf-sheets',
  },
  {
    id: 'resources',
    title: 'Resources',
    mega: 'list',
    blurb: 'Guides and tips for pressing and ordering.',
    children: [
      {
        title: 'DTF order hub',
        url: '/dtf-sheets',
        blurb: 'Choose how to order transfers',
      },
      {
        title: 'Gang sheet studio',
        url: '/dtf-sheets/studio',
        blurb: 'Open the online layout builder',
      },
    ],
  },
  {
    id: 'support',
    title: 'Support',
    mega: 'list',
    blurb: 'We’re here for print questions and orders.',
    children: [
      {
        title: 'Email support',
        url: HEADER_GET_IN_TOUCH_MAILTO,
        blurb: 'Reach the Plus 1 team',
      },
      {
        title: 'Call a print expert',
        url: HEADER_PHONE.href,
        blurb: HEADER_PHONE.display,
      },
    ],
  },
  {
    id: 'track',
    title: 'Track Order',
    href: '/account/orders',
  },
];

/**
 * @param {HeaderProps}
 */
export function Header({header, isLoggedIn, cart, publicStoreDomain}) {
  const {shop} = header;
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const threshold = 6;
    const onScroll = () => {
      setIsScrolled(window.scrollY > threshold);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`site-header${isScrolled ? ' site-header--scrolled' : ''}`}
    >
      <div className="site-header-top">
        <div className="site-header-top-start">
          <HeaderMenuMobileToggle />
          <NavLink
            prefetch="viewport"
            to="/"
            end
            className="site-header-logo-link"
          >
            <div className="site-header-logo">
              <img src={logo} alt={shop.name} className="logo-image" />
            </div>
          </NavLink>
        </div>

        <HeaderSearchBar />

        <div className="site-header-top-end">
          <HeaderSearchMobile />
          <a className="site-header-phone" href={HEADER_PHONE.href}>
            <span className="site-header-phone-icon" aria-hidden>
              <Phone size={16} strokeWidth={2.25} />
            </span>
            <span className="site-header-phone-copy">
              <span className="site-header-phone-label">
                {HEADER_PHONE.label}
              </span>
              <span className="site-header-phone-number">
                {HEADER_PHONE.display}
              </span>
            </span>
          </a>
          <HeaderCtas isLoggedIn={isLoggedIn} cart={cart} />
        </div>
      </div>

      <HeaderBottomNav />
    </header>
  );
}

function HeaderSearchBar() {
  const {open} = useAside();
  return (
    <button
      type="button"
      className="site-header-search"
      onClick={() => open('search')}
      aria-label="Search transfers, gang sheets, blanks"
    >
      <Search size={18} strokeWidth={2.25} aria-hidden />
      <span className="site-header-search-placeholder">
        Search transfers, gang sheets, blanks…
      </span>
    </button>
  );
}

function HeaderSearchMobile() {
  const {open} = useAside();
  return (
    <button
      type="button"
      className="site-header-search-mobile"
      onClick={() => open('search')}
      aria-label="Search"
    >
      <Search size={18} strokeWidth={2.25} aria-hidden />
    </button>
  );
}

function HeaderBottomNav() {
  const {pathname} = useLocation();
  const [openId, setOpenId] = useState(/** @type {string | null} */ (null));
  const navRef = useRef(/** @type {HTMLElement | null} */ (null));
  const closeTimer = useRef(/** @type {number | null} */ (null));

  useEffect(() => {
    setOpenId(null);
  }, [pathname]);

  useEffect(() => {
    if (!openId) return undefined;
    /** @param {MouseEvent} e */
    function onDoc(e) {
      if (!navRef.current?.contains(/** @type {Node} */ (e.target))) {
        setOpenId(null);
      }
    }
    /** @param {KeyboardEvent} e */
    function onKey(e) {
      if (e.key === 'Escape') setOpenId(null);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [openId]);

  /**
   * @param {string | null} id
   */
  function scheduleOpen(id) {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpenId(id);
  }

  function scheduleClose() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpenId(null), 140);
  }

  return (
    <div className="site-header-nav-wrap">
      <nav
        ref={navRef}
        className="site-header-nav"
        aria-label="Primary"
      >
        {HEADER_PRIMARY_NAV.map((item) => {
          const hasMega = Boolean(item.mega);
          const isOpen = openId === item.id;

          if (!hasMega) {
            return (
              <NavLink
                key={item.id}
                prefetch="intent"
                to={item.href || '/'}
                className="site-header-nav-link"
              >
                {item.title}
              </NavLink>
            );
          }

          return (
            <div
              key={item.id}
              className={[
                'site-header-nav-item',
                isOpen && 'is-open',
                'has-panel-mega',
              ]
                .filter(Boolean)
                .join(' ')}
              onMouseEnter={() => scheduleOpen(item.id)}
              onMouseLeave={scheduleClose}
            >
              <button
                type="button"
                className="site-header-nav-link site-header-nav-link--trigger"
                aria-expanded={isOpen}
                aria-haspopup="true"
                onClick={() =>
                  setOpenId((prev) => (prev === item.id ? null : item.id))
                }
              >
                {item.title}
                <ChevronDown
                  size={14}
                  strokeWidth={2.5}
                  className="site-header-nav-chevron"
                  aria-hidden
                />
              </button>
              {isOpen ? (
                <div
                  className={`site-header-mega ${
                    item.mega === 'list'
                      ? 'site-header-mega--panel'
                      : 'site-header-mega--wide'
                  }`}
                  role="menu"
                  onMouseEnter={() => scheduleOpen(item.id)}
                  onMouseLeave={scheduleClose}
                >
                  <MegaPanel item={item} onNavigate={() => setOpenId(null)} />
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    </div>
  );
}

/**
 * @param {{
 *   item: (typeof HEADER_PRIMARY_NAV)[number];
 *   onNavigate: () => void;
 * }} props
 */
function MegaPanel({item, onNavigate}) {
  if (item.mega === 'dtf') {
    return <DtfMegaPanel onNavigate={onNavigate} />;
  }
  if (item.mega === 'blank') {
    return (
      <ApparelMegaPanel
        title="Blank apparel."
        lede="Shop by garment or brand."
        cta={{label: 'View all blanks', href: '/collections/t-shirts'}}
        garmentHint="T-shirts, fleece, and more"
        brandHint="Four brands, one catalog"
        garments={APPAREL_CATEGORY_HANDLES.map((c) => ({
          title: c.title,
          blurb: c.blurb,
          url: `/collections/${c.handle}`,
        }))}
        brands={APPAREL_BRAND_LINKS.map((b) => ({
          title: b.title,
          blurb: b.blurb,
          url: `/collections/${b.handle}`,
        }))}
        onNavigate={onNavigate}
      />
    );
  }
  if (item.mega === 'decorated') {
    return (
      <ApparelMegaPanel
        title="Decorated apparel."
        lede="Shop by garment or brand."
        cta={{
          label: 'View all decorated',
          href: '/collections/t-shirts-decorated',
        }}
        garmentHint="Ready for custom logos"
        brandHint="Popular decorate-ready brands"
        garments={APPAREL_CATEGORY_HANDLES.map((c) => ({
          title: c.title,
          blurb: c.blurb,
          url: `/collections/${c.handle}-decorated`,
        }))}
        brands={APPAREL_BRAND_LINKS.map((b) => ({
          title: b.title,
          blurb: b.blurb,
          url: `/collections/${b.handle}`,
        }))}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <ListMegaPanel
      title={item.title}
      lede={item.blurb || ''}
      items={item.children || []}
      onNavigate={onNavigate}
    />
  );
}

/**
 * @param {{ onNavigate: () => void }} props
 */
function DtfMegaPanel({onNavigate}) {
  return (
    <div className="site-mega site-mega--dtf">
      <header className="site-mega-head">
        <div>
          <h2 className="site-mega-title">Choose how to order.</h2>
          <p className="site-mega-lede">
            Start with individual files or a finished gang sheet.
          </p>
        </div>
        <Link
          to="/dtf-sheets"
          className="site-mega-cta"
          onClick={onNavigate}
          prefetch="intent"
        >
          Start an order
          <ArrowRight size={15} strokeWidth={2.5} aria-hidden />
        </Link>
      </header>

      <div className="site-mega-grid site-mega-grid--dtf">
        <section className="site-mega-col" aria-label="Order path">
          <div className="site-mega-col-label-row">
            <p className="site-mega-col-label">Order path</p>
            <span className="site-mega-pill">No minimums</span>
          </div>
          <ul className="site-mega-path-list">
            <li>
              <Link
                to="/dtf-sheets/by-size"
                className="site-mega-path-card"
                onClick={onNavigate}
                prefetch="intent"
              >
                <span className="site-mega-path-copy">
                  <span className="site-mega-path-badge">No layout required</span>
                  <strong>Order individual designs</strong>
                  <span>
                    Upload each design. Choose its finished size and quantity.
                  </span>
                </span>
                <ArrowRight size={16} strokeWidth={2.5} aria-hidden />
              </Link>
            </li>
            <li>
              <Link
                to="/dtf-sheets/builder"
                className="site-mega-path-card"
                onClick={onNavigate}
                prefetch="intent"
              >
                <span className="site-mega-path-copy">
                  <span className="site-mega-path-badge">Print-ready file</span>
                  <strong>Build a gang sheet online</strong>
                  <span>
                    Arrange artwork on a 22″ sheet and send one print-ready
                    layout.
                  </span>
                </span>
                <ArrowRight size={16} strokeWidth={2.5} aria-hidden />
              </Link>
            </li>
          </ul>
          <p className="site-mega-footnote">
            Made in USA · No minimums · Ships nationwide
          </p>
        </section>

        <section className="site-mega-col" aria-label="More ways to start">
          <p className="site-mega-col-label">More ways to start</p>
          <ul className="site-mega-link-list">
            <li>
              <Link
                to="/free-sample"
                className="site-mega-text-link"
                onClick={onNavigate}
                prefetch="intent"
              >
                <span>
                  <strong>Get a free sample</strong>
                  <span>Press it before you buy.</span>
                </span>
                <ArrowRight size={15} strokeWidth={2.5} aria-hidden />
              </Link>
            </li>
            <li>
              <Link
                to="/dtf-sheets/studio"
                className="site-mega-text-link"
                onClick={onNavigate}
                prefetch="intent"
              >
                <span>
                  <strong>Open the studio</strong>
                  <span>Jump straight into the gang sheet builder.</span>
                </span>
                <ArrowRight size={15} strokeWidth={2.5} aria-hidden />
              </Link>
            </li>
            <li>
              <Link
                to="/collections/t-shirts"
                className="site-mega-text-link"
                onClick={onNavigate}
                prefetch="intent"
              >
                <span>
                  <strong>Shop blank apparel</strong>
                  <span>Pair transfers with garments from the catalog.</span>
                </span>
                <ArrowRight size={15} strokeWidth={2.5} aria-hidden />
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   title: string;
 *   lede: string;
 *   cta: { label: string; href: string };
 *   garmentHint?: string;
 *   brandHint?: string;
 *   garments: Array<{ title: string; blurb?: string; url: string }>;
 *   brands: Array<{ title: string; blurb?: string; url: string }>;
 *   onNavigate: () => void;
 * }} props
 */
function ApparelMegaPanel({
  title,
  lede,
  cta,
  garmentHint = 'T-shirts, fleece, and more',
  brandHint = 'Four brands, one catalog',
  garments,
  brands,
  onNavigate,
}) {
  return (
    <div className="site-mega site-mega--apparel">
      <header className="site-mega-head">
        <div>
          <h2 className="site-mega-title">{title}</h2>
          <p className="site-mega-lede">{lede}</p>
        </div>
        <Link
          to={cta.href}
          className="site-mega-cta"
          onClick={onNavigate}
          prefetch="intent"
        >
          {cta.label}
          <ArrowRight size={15} strokeWidth={2.5} aria-hidden />
        </Link>
      </header>

      <div className="site-mega-grid site-mega-grid--apparel">
        <section className="site-mega-col" aria-label="Shop by garment">
          <div className="site-mega-col-label-row">
            <p className="site-mega-col-label">Shop by garment</p>
            <span className="site-mega-col-hint">{garmentHint}</span>
          </div>
          <ul className="site-mega-row-list">
            {garments.map((item) => (
              <li key={item.url}>
                <Link
                  to={item.url}
                  className="site-mega-row-link"
                  onClick={onNavigate}
                  prefetch="intent"
                >
                  <span>
                    <strong>{item.title}</strong>
                    {item.blurb ? <span>{item.blurb}</span> : null}
                  </span>
                  <ArrowRight size={15} strokeWidth={2.5} aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="site-mega-col" aria-label="Shop by brand">
          <div className="site-mega-col-label-row">
            <p className="site-mega-col-label">Shop by brand</p>
            <span className="site-mega-col-hint">{brandHint}</span>
          </div>
          <ul className="site-mega-row-list">
            {brands.map((item) => (
              <li key={item.url}>
                <Link
                  to={item.url}
                  className="site-mega-row-link"
                  onClick={onNavigate}
                  prefetch="intent"
                >
                  <span>
                    <strong>{item.title}</strong>
                    {item.blurb ? <span>{item.blurb}</span> : null}
                  </span>
                  <ArrowRight size={15} strokeWidth={2.5} aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   title: string;
 *   lede: string;
 *   items: Array<{ title: string; url: string; blurb?: string }>;
 *   onNavigate: () => void;
 * }} props
 */
function ListMegaPanel({title, lede, items, onNavigate}) {
  return (
    <div className="site-mega site-mega--list">
      <header className="site-mega-head site-mega-head--compact">
        <div>
          <h2 className="site-mega-title">{title}</h2>
          {lede ? <p className="site-mega-lede">{lede}</p> : null}
        </div>
      </header>
      <ul className="site-mega-link-list">
        {items.map((item) => {
          const external =
            item.url.startsWith('mailto:') || item.url.startsWith('tel:');
          if (external) {
            return (
              <li key={item.url}>
                <a
                  href={item.url}
                  className="site-mega-text-link"
                  onClick={onNavigate}
                >
                  <span>
                    <strong>{item.title}</strong>
                    {item.blurb ? <span>{item.blurb}</span> : null}
                  </span>
                  <ArrowRight size={15} strokeWidth={2.5} aria-hidden />
                </a>
              </li>
            );
          }
          return (
            <li key={item.url}>
              <Link
                to={item.url}
                className="site-mega-text-link"
                onClick={onNavigate}
                prefetch="intent"
              >
                <span>
                  <strong>{item.title}</strong>
                  {item.blurb ? <span>{item.blurb}</span> : null}
                </span>
                <ArrowRight size={15} strokeWidth={2.5} aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * @param {{
 *   menu: HeaderProps['header']['menu'];
 *   primaryDomainUrl: HeaderProps['header']['shop']['primaryDomain']['url'];
 *   viewport: Viewport;
 *   publicStoreDomain: HeaderProps['publicStoreDomain'];
 * }}
 */
export function HeaderMenu({
  menu: _menu,
  primaryDomainUrl: _primaryDomainUrl,
  viewport,
  publicStoreDomain: _publicStoreDomain,
}) {
  const className = `header-menu-${viewport}`;
  const {close} = useAside();
  const [openId, setOpenId] = useState(/** @type {string | null} */ (null));

  const links = (
    <>
      {viewport === 'mobile' && (
        <NavLink
          end
          onClick={close}
          prefetch="viewport"
          className="header-menu-item"
          to="/"
        >
          Home
        </NavLink>
      )}
      {HEADER_PRIMARY_NAV.map((group) => {
        const children =
          group.mega === 'blank'
            ? [
                ...APPAREL_CATEGORY_HANDLES.map((c) => ({
                  title: c.title,
                  url: `/collections/${c.handle}`,
                })),
                ...APPAREL_BRAND_LINKS.map((b) => ({
                  title: b.title,
                  url: `/collections/${b.handle}`,
                })),
              ]
            : group.mega === 'decorated'
              ? [
                  ...APPAREL_CATEGORY_HANDLES.map((c) => ({
                    title: c.title,
                    url: `/collections/${c.handle}-decorated`,
                  })),
                  ...APPAREL_BRAND_LINKS.map((b) => ({
                    title: b.title,
                    url: `/collections/${b.handle}`,
                  })),
                ]
              : group.mega === 'dtf'
                ? [
                    {title: 'Choose how to order', url: '/dtf-sheets'},
                    {title: 'Transfers by size', url: '/dtf-sheets/by-size'},
                    {title: 'Gang sheet builder', url: '/dtf-sheets/builder'},
                    {title: 'Gang sheet studio', url: '/dtf-sheets/studio'},
                    {title: 'Get a free sample', url: '/free-sample'},
                  ]
                : group.children ||
                  (group.href
                    ? [{title: group.title, url: group.href}]
                    : []);

        if (!group.mega && group.href) {
          return (
            <NavLink
              key={group.id}
              className="header-menu-item"
              end
              onClick={close}
              prefetch="intent"
              to={group.href}
            >
              {group.title}
            </NavLink>
          );
        }

        const expanded = openId === group.id;
        return (
          <div key={group.id} className="header-menu-mobile-group">
            <button
              type="button"
              className={`header-menu-mobile-group-trigger ${
                expanded ? 'is-open' : ''
              }`}
              aria-expanded={expanded}
              onClick={() =>
                setOpenId((prev) => (prev === group.id ? null : group.id))
              }
            >
              <span>
                <span className="header-menu-mobile-group-title">
                  {group.title}
                </span>
                {group.blurb ? (
                  <span className="header-menu-mobile-group-blurb">
                    {group.blurb}
                  </span>
                ) : null}
              </span>
              <ChevronDown
                size={18}
                strokeWidth={2.25}
                className="header-menu-mobile-group-chevron"
                aria-hidden
              />
            </button>
            {expanded ? (
              <div className="header-menu-mobile-group-links">
                {children.map((child) => {
                  if (
                    child.url.startsWith('mailto:') ||
                    child.url.startsWith('tel:')
                  ) {
                    return (
                      <a
                        key={child.url}
                        className="header-menu-item"
                        href={child.url}
                        onClick={close}
                      >
                        {child.title}
                      </a>
                    );
                  }
                  return (
                    <NavLink
                      key={child.url}
                      className="header-menu-item"
                      end
                      onClick={close}
                      prefetch="intent"
                      to={child.url}
                    >
                      {child.title}
                    </NavLink>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );

  if (viewport === 'mobile') {
    return (
      <div className="header-menu-mobile-shell">
        <nav
          id="primary-mobile-nav"
          className={className}
          role="navigation"
          aria-label="Shop categories"
        >
          {links}
        </nav>
        <div className="header-menu-mobile-footer">
          <SolidButton
            href={HEADER_GET_IN_TOUCH_MAILTO}
            className="header-menu-mobile-cta"
            onClick={close}
          >
            Get in Touch
          </SolidButton>
        </div>
      </div>
    );
  }

  return (
    <nav
      id="primary-mobile-nav"
      className={className}
      role="navigation"
      aria-label="Shop categories"
    >
      {links}
    </nav>
  );
}

/**
 * @param {Pick<HeaderProps, 'isLoggedIn' | 'cart'>}
 */
function HeaderCtas({isLoggedIn, cart}) {
  return (
    <nav
      className="site-header-ctas"
      role="navigation"
      aria-label="Account and cart"
    >
      <Suspense fallback={<AccountControls isLoggedIn={false} />}>
        <Await
          resolve={isLoggedIn}
          errorElement={<AccountControls isLoggedIn={false} />}
        >
          {(loggedIn) => <AccountControls isLoggedIn={loggedIn} />}
        </Await>
      </Suspense>
      <CartToggle cart={cart} />
    </nav>
  );
}

/**
 * @param {{ isLoggedIn: boolean }}
 */
function AccountControls({isLoggedIn}) {
  const accountPath = isLoggedIn ? '/account' : '/account/login?redirect=1';
  const accountLabel = isLoggedIn ? 'Account' : 'Sign In';

  return (
    <NavLink
      prefetch={isLoggedIn ? 'intent' : false}
      to={accountPath}
      reloadDocument={!isLoggedIn}
      className="site-header-action"
      aria-label={accountLabel}
    >
      <User size={16} strokeWidth={2.25} aria-hidden />
      <span>{accountLabel}</span>
    </NavLink>
  );
}

function HeaderMenuMobileToggle() {
  const {open, type, close} = useAside();
  const menuOpen = type === 'mobile';

  return (
    <button
      type="button"
      className="site-header-mobile-toggle"
      onClick={() => (menuOpen ? close() : open('mobile'))}
      aria-label={menuOpen ? 'Close menu' : 'Open menu'}
      aria-expanded={menuOpen}
      aria-controls="primary-mobile-nav"
    >
      <Menu size={22} strokeWidth={2} aria-hidden />
    </button>
  );
}

/**
 * @param {{count: number | null}}
 */
function CartBadge({count}) {
  const {publish, shop, cart, prevCart} = useAnalytics();

  return (
    <Link
      to="/cart"
      prefetch="intent"
      className="site-header-action site-header-cart"
      onClick={() => {
        publish('cart_viewed', {
          cart,
          prevCart,
          shop,
          url: window.location.href || '',
        });
      }}
    >
      <ShoppingCart size={16} strokeWidth={2.25} aria-hidden />
      <span>Cart</span>
      {count !== null && count > 0 ? (
        <span className="site-header-cart-badge">{count}</span>
      ) : null}
    </Link>
  );
}

/**
 * @param {Pick<HeaderProps, 'cart'>}
 */
function CartToggle({cart}) {
  return (
    <Suspense fallback={<CartBadge count={null} />}>
      <Await resolve={cart}>
        <CartBanner />
      </Await>
    </Suspense>
  );
}

/**
 * @param {import('storefrontapi.generated').CartApiQueryFragment | null | undefined} cart
 */
function quantityFromCartLines(cart) {
  const nodes = cart?.lines?.nodes;
  if (!Array.isArray(nodes)) return 0;
  return nodes.reduce((sum, line) => sum + (Number(line?.quantity) || 0), 0);
}

function CartBanner() {
  const originalCart = useAsyncValue();
  const cart = useOptimisticCart(originalCart);
  const tq = cart?.totalQuantity;
  const fromTotal =
    typeof tq === 'number' && Number.isFinite(tq) && tq > 0 ? tq : 0;
  const fromLines = quantityFromCartLines(cart);
  const fallbackLines = quantityFromCartLines(originalCart);
  const fallbackTotal =
    typeof originalCart?.totalQuantity === 'number' &&
    Number.isFinite(originalCart.totalQuantity) &&
    originalCart.totalQuantity > 0
      ? originalCart.totalQuantity
      : 0;
  const count = fromTotal || fromLines || fallbackTotal || fallbackLines;
  return <CartBadge count={count} />;
}

/** @typedef {'desktop' | 'mobile'} Viewport */
/**
 * @typedef {Object} HeaderProps
 * @property {HeaderQuery} header
 * @property {Promise<CartApiQueryFragment|null>} cart
 * @property {Promise<boolean>} isLoggedIn
 * @property {string} publicStoreDomain
 */

/** @typedef {import('@shopify/hydrogen').CartViewPayload} CartViewPayload */
/** @typedef {import('storefrontapi.generated').HeaderQuery} HeaderQuery */
/** @typedef {import('storefrontapi.generated').CartApiQueryFragment} CartApiQueryFragment */
