import { Suspense, useState } from 'react';
import { Await, NavLink, useAsyncValue } from 'react-router';
import { useAnalytics, useOptimisticCart } from '@shopify/hydrogen';
import { useAside } from '~/components/Aside';
import { SearchFormPredictive } from '~/components/SearchFormPredictive';
import logo from '~/assets/logo.svg';

/**
 * @param {HeaderProps}
 */
export function Header({ header, isLoggedIn, cart, publicStoreDomain }) {
  const { shop, menu } = header;
  return (
    <>
      <header className="header">
        <div className="header-top">
          <div className="header-top-left">
            <NavLink prefetch="intent" to="/" style={activeLinkStyle} end className="header-logo-link">
              <div className="header-logo">
                <img src={logo} alt={shop.name} className="logo-image" />
              </div>
            </NavLink>
            <HeaderSearch />
          </div>

          <div className="header-top-right">
            <HeaderCtas isLoggedIn={isLoggedIn} cart={cart} />
          </div>
        </div>
        <div className="header-nav-bar">
          <HeaderMenu
            menu={menu}
            viewport="desktop"
            primaryDomainUrl={header.shop.primaryDomain.url}
            publicStoreDomain={publicStoreDomain}
          />
          <NavLink to="/dtf-transfers" className="header-nav-special-link" style={activeLinkStyle}>
            DTF Transfers
          </NavLink>
        </div>
      </header>
    </>
  );
}

function HeaderSearch() {
  return (
    <div className="header-search">
      <SearchFormPredictive>
        {({ inputRef, fetchResults, goToSearch }) => (
          <div className="header-search-container">
            <input
              ref={inputRef}
              type="search"
              name="q"
              placeholder="Search Blank Products"
              onChange={fetchResults}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  goToSearch();
                }
              }}
              className="header-search-input"
            />
          </div>
        )}
      </SearchFormPredictive>
    </div>
  );
}

function HeaderRewards() {
  return (
    <div className="header-rewards">
      <div className="header-rewards-icon">
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
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <path d="M12 8v8" />
          <path d="M8 12h8" />
        </svg>
      </div>
      <div className="header-rewards-text">
        <div className="header-rewards-label">Plus 1 Rewards</div>
        <div className="header-rewards-balance">$0.00</div>
      </div>
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
  menu,
  primaryDomainUrl,
  viewport,
  publicStoreDomain,
}) {
  const className = `header-menu-${viewport}`;
  const { close } = useAside();

  // Navigation items with dropdown support
  const navigationItems = [
    {
      title: 'T-Shirts',
      url: '/collections/short-sleeve-t-shirts',
      hasDropdown: true,
      dropdownContent: 'tshirts'
    },
    {
      title: 'Sweatshirts',
      url: '/collections/sweatshirts',
      hasDropdown: true,
      dropdownContent: 'sweatshirts'
    },
    {
      title: 'More',
      url: '#',
      hasDropdown: true,
      dropdownContent: 'more'
    },
  ];

  return (
    <nav className={className} role="navigation">
      {viewport === 'mobile' && (
        <NavLink
          end
          onClick={close}
          prefetch="intent"
          style={activeLinkStyle}
          to="/"
        >
          Home
        </NavLink>
      )}
      {navigationItems.map((item, index) => (
        <HeaderMenuItem
          key={index}
          item={item}
          close={close}
          activeLinkStyle={activeLinkStyle}
        />
      ))}
    </nav>
  );
}

/**
 * Header menu item with dropdown support
 */
function HeaderMenuItem({ item, close, activeLinkStyle }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="header-menu-item-wrapper"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <NavLink
        className="header-menu-item"
        end
        onClick={close}
        prefetch="intent"
        to={item.url}
      >
        {item.title}
      </NavLink>
      {item.hasDropdown && (
        <>
          <svg
            className="header-menu-chevron"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3.5 5.25l3.5 3.5 3.5-3.5" />
          </svg>
          {isHovered && item.dropdownContent === 'tshirts' && (
            <>
              <div
                className="header-menu-dropdown-bridge"
                onMouseEnter={() => setIsHovered(true)}
              />
              <TShirtsDropdown
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onLinkClick={() => setIsHovered(false)}
              />
            </>
          )}
          {isHovered && item.dropdownContent === 'sweatshirts' && (
            <>
              <div
                className="header-menu-dropdown-bridge"
                onMouseEnter={() => setIsHovered(true)}
              />
              <SweatshirtsDropdown
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onLinkClick={() => setIsHovered(false)}
              />
            </>
          )}
          {isHovered && item.dropdownContent === 'more' && (
            <>
              <div
                className="header-menu-dropdown-bridge"
                onMouseEnter={() => setIsHovered(true)}
              />
              <MoreDropdown
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onLinkClick={() => setIsHovered(false)}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * T-Shirts dropdown menu component
 */
function TShirtsDropdown({ onMouseEnter, onMouseLeave, onLinkClick }) {
  return (
    <div
      className="header-menu-dropdown"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="header-menu-dropdown-content">
        <div className="header-menu-dropdown-column">
          <div className="header-menu-dropdown-header">SHOP BY STYLE</div>
          <ul className="header-menu-dropdown-list">
            <li>
              <NavLink to="/collections/short-sleeve-t-shirts" className="header-menu-dropdown-link" onClick={onLinkClick}>
                Short Sleeve
                <span className="header-menu-dropdown-badge">Popular</span>
              </NavLink>
            </li>
            <li><NavLink to="/collections/long-sleeve-t-shirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Long Sleeve</NavLink></li>
            <li><NavLink to="/collections/3-4-sleeve-t-shirts" className="header-menu-dropdown-link" onClick={onLinkClick}>3/4 Sleeve</NavLink></li>
            <li><NavLink to="/collections/raglan-t-shirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Raglan</NavLink></li>
            <li><NavLink to="/collections/tank-tops" className="header-menu-dropdown-link" onClick={onLinkClick}>Tank Tops</NavLink></li>
            <li><NavLink to="/collections/performance-t-shirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Performance</NavLink></li>
            <li><NavLink to="/collections/safety-t-shirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Safety</NavLink></li>
          </ul>
        </div>
        <div className="header-menu-dropdown-column">
          <div className="header-menu-dropdown-header">SHOP BY FIT</div>
          <ul className="header-menu-dropdown-list">
            <li><NavLink to="/collections/unisex-t-shirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Unisex Adult</NavLink></li>
            <li><NavLink to="/collections/mens-t-shirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Men's</NavLink></li>
            <li><NavLink to="/collections/womens-t-shirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Women's</NavLink></li>
            <li><NavLink to="/collections/youth-t-shirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Youth</NavLink></li>
            <li><NavLink to="/collections/toddler-t-shirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Toddler</NavLink></li>
            <li><NavLink to="/collections/infant-t-shirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Infant</NavLink></li>
          </ul>
        </div>
        <div className="header-menu-dropdown-column">
          <div className="header-menu-dropdown-header">SHOP BY MATERIAL</div>
          <ul className="header-menu-dropdown-list">
            <li><NavLink to="/collections/cotton-t-shirts" className="header-menu-dropdown-link" onClick={onLinkClick}>100% Cotton</NavLink></li>
            <li><NavLink to="/collections/polyester-t-shirts" className="header-menu-dropdown-link" onClick={onLinkClick}>100% Polyester</NavLink></li>
            <li><NavLink to="/collections/cotton-poly-blend-t-shirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Cotton/Poly Blend</NavLink></li>
            <li><NavLink to="/collections/tri-blend-t-shirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Tri-Blend</NavLink></li>
          </ul>
        </div>
        <div className="header-menu-dropdown-column">
          <div className="header-menu-dropdown-header">SHOP BY BRAND</div>
          <ul className="header-menu-dropdown-list">
            <li><NavLink to="/collections/gildan-t-shirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Gildan</NavLink></li>
            <li><NavLink to="/collections/bella-canvas-t-shirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Bella + Canvas</NavLink></li>
            <li><NavLink to="/collections/next-level-t-shirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Next Level</NavLink></li>
            <li><NavLink to="/collections/comfort-colors-t-shirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Comfort Colors</NavLink></li>
            <li><NavLink to="/collections/champion-t-shirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Champion</NavLink></li>
            <li><NavLink to="/collections/jerzees-t-shirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Jerzees</NavLink></li>
            <li><NavLink to="/collections/hanes-t-shirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Hanes</NavLink></li>
            <li><NavLink to="/collections/team-365-t-shirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Team 365</NavLink></li>
            <li><NavLink to="/collections/all-brands-t-shirts" className="header-menu-dropdown-link" onClick={onLinkClick}>View All Brands</NavLink></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Sweatshirts dropdown menu component
 */
function SweatshirtsDropdown({ onMouseEnter, onMouseLeave, onLinkClick }) {
  return (
    <div
      className="header-menu-dropdown"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="header-menu-dropdown-content">
        <div className="header-menu-dropdown-column">
          <div className="header-menu-dropdown-header">SHOP BY STYLE</div>
          <ul className="header-menu-dropdown-list">
            <li>
              <NavLink to="/collections/hoodies" className="header-menu-dropdown-link" onClick={onLinkClick}>
                Hoodies
                <span className="header-menu-dropdown-badge">Popular</span>
              </NavLink>
            </li>
            <li><NavLink to="/collections/crewneck-sweatshirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Crewneck</NavLink></li>
            <li><NavLink to="/collections/zip-up-sweatshirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Zip Up</NavLink></li>
            <li><NavLink to="/collections/performance-sweatshirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Performance</NavLink></li>
            <li><NavLink to="/collections/safety-sweatshirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Safety</NavLink></li>
          </ul>
        </div>
        <div className="header-menu-dropdown-column">
          <div className="header-menu-dropdown-header">SHOP BY FIT</div>
          <ul className="header-menu-dropdown-list">
            <li><NavLink to="/collections/unisex-sweatshirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Unisex</NavLink></li>
            <li><NavLink to="/collections/mens-sweatshirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Men's</NavLink></li>
            <li><NavLink to="/collections/womens-sweatshirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Women's</NavLink></li>
            <li><NavLink to="/collections/youth-sweatshirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Youth</NavLink></li>
          </ul>
        </div>
        <div className="header-menu-dropdown-column">
          <div className="header-menu-dropdown-header">SHOP BY MATERIAL</div>
          <ul className="header-menu-dropdown-list">
            <li><NavLink to="/collections/cotton-sweatshirts" className="header-menu-dropdown-link" onClick={onLinkClick}>100% Cotton</NavLink></li>
            <li><NavLink to="/collections/polyester-sweatshirts" className="header-menu-dropdown-link" onClick={onLinkClick}>100% Polyester</NavLink></li>
            <li><NavLink to="/collections/cotton-poly-blend-sweatshirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Cotton/Poly Blend</NavLink></li>
            <li><NavLink to="/collections/tri-blend-sweatshirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Tri-Blend</NavLink></li>
          </ul>
        </div>
        <div className="header-menu-dropdown-column">
          <div className="header-menu-dropdown-header">SHOP BY BRAND</div>
          <ul className="header-menu-dropdown-list">
            <li><NavLink to="/collections/gildan-sweatshirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Gildan</NavLink></li>
            <li><NavLink to="/collections/hanes-sweatshirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Hanes</NavLink></li>
            <li><NavLink to="/collections/jerzees-sweatshirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Jerzees</NavLink></li>
            <li><NavLink to="/collections/bella-canvas-sweatshirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Bella + Canvas</NavLink></li>
            <li><NavLink to="/collections/champion-sweatshirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Champion</NavLink></li>
            <li><NavLink to="/collections/next-level-sweatshirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Next Level</NavLink></li>
            <li><NavLink to="/collections/threadfast-apparel-sweatshirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Threadfast Apparel</NavLink></li>
            <li><NavLink to="/collections/j-america-sweatshirts" className="header-menu-dropdown-link" onClick={onLinkClick}>J America</NavLink></li>
            <li><NavLink to="/collections/comfort-colors-sweatshirts" className="header-menu-dropdown-link" onClick={onLinkClick}>Comfort Colors</NavLink></li>
            <li><NavLink to="/collections/all-brands-sweatshirts" className="header-menu-dropdown-link" onClick={onLinkClick}>View All Brands</NavLink></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * More dropdown menu component
 */
function MoreDropdown({ onMouseEnter, onMouseLeave, onLinkClick }) {
  return (
    <div
      className="header-menu-dropdown header-menu-dropdown-more"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="header-menu-dropdown-content header-menu-dropdown-single-column">
        <ul className="header-menu-dropdown-list">
          <li>
            <NavLink to="/collections/accessories" className="header-menu-dropdown-link" onClick={onLinkClick}>
              Blank Accessories
            </NavLink>
          </li>
          <li>
            <NavLink to="/collections/blank-drinkware-hard-goods" className="header-menu-dropdown-link" onClick={onLinkClick}>
              Blank Drinkware & Hard Goods
            </NavLink>
          </li>
          <li>
            <NavLink to="/collections/blank-toddler-infant-apparel" className="header-menu-dropdown-link" onClick={onLinkClick}>
              Blank Toddler & Infant Apparel
            </NavLink>
          </li>
          <li>
            <NavLink to="/collections/blank-kids-apparel" className="header-menu-dropdown-link" onClick={onLinkClick}>
              Blank Kids Apparel
            </NavLink>
          </li>
          <li>
            <NavLink to="/collections/blank-pants" className="header-menu-dropdown-link" onClick={onLinkClick}>
              Blank Pants
            </NavLink>
          </li>
          <li>
            <NavLink to="/collections/blank-shorts" className="header-menu-dropdown-link" onClick={onLinkClick}>
              Blank Shorts
            </NavLink>
          </li>
          <li>
            <NavLink to="/collections/blank-womens-apparel" className="header-menu-dropdown-link" onClick={onLinkClick}>
              Blank Women's Apparel
            </NavLink>
          </li>
        </ul>
      </div>
    </div>
  );
}

/**
 * @param {Pick<HeaderProps, 'isLoggedIn' | 'cart'>}
 */
function HeaderCtas({ isLoggedIn, cart }) {
  return (
    <nav className="header-ctas" role="navigation">
      <HeaderMenuMobileToggle />
      <Suspense fallback={<AccountLink isLoggedIn={false} />}>
        <Await resolve={isLoggedIn} errorElement={<AccountLink isLoggedIn={false} />}>
          {(loggedIn) => <AccountLink isLoggedIn={loggedIn} />}
        </Await>
      </Suspense>
      <CartToggle cart={cart} />
    </nav>
  );
}

function AccountLink({ isLoggedIn }) {
  return (
    <NavLink prefetch="intent" to="/account" className="header-account-link" style={activeLinkStyle}>
      <div className="header-account-text">
        <div className="header-account-greeting">{isLoggedIn ? 'Hello, Guest' : 'Hello, sign in'}</div>
        <div className="header-account-subtext">My Account / Reorder</div>
      </div>
    </NavLink>
  );
}

function HeaderMenuMobileToggle() {
  const { open } = useAside();
  return (
    <button
      className="header-menu-mobile-toggle reset"
      onClick={() => open('mobile')}
    >
      <h3>☰</h3>
    </button>
  );
}


/**
 * @param {{count: number | null}}
 */
function CartBadge({ count }) {
  const { open } = useAside();
  const { publish, shop, cart, prevCart } = useAnalytics();

  return (
    <a
      href="/cart"
      className="header-cart-link"
      onClick={(e) => {
        e.preventDefault();
        open('cart');
        publish('cart_viewed', {
          cart,
          prevCart,
          shop,
          url: window.location.href || '',
        });
      }}
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
        <circle cx="9" cy="21" r="1"></circle>
        <circle cx="20" cy="21" r="1"></circle>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
      </svg>
      {count !== null && count > 0 && (
        <span className="header-cart-badge">{count}</span>
      )}
    </a>
  );
}

/**
 * @param {Pick<HeaderProps, 'cart'>}
 */
function CartToggle({ cart }) {
  return (
    <Suspense fallback={<CartBadge count={null} />}>
      <Await resolve={cart}>
        <CartBanner />
      </Await>
    </Suspense>
  );
}

function CartBanner() {
  const originalCart = useAsyncValue();
  const cart = useOptimisticCart(originalCart);
  return <CartBadge count={cart?.totalQuantity ?? 0} />;
}

const FALLBACK_HEADER_MENU = {
  id: 'gid://shopify/Menu/199655587896',
  items: [
    {
      id: 'gid://shopify/MenuItem/461609500728',
      resourceId: null,
      tags: [],
      title: 'Collections',
      type: 'HTTP',
      url: '/collections',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461609533496',
      resourceId: null,
      tags: [],
      title: 'Blog',
      type: 'HTTP',
      url: '/blogs/journal',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461609566264',
      resourceId: null,
      tags: [],
      title: 'Policies',
      type: 'HTTP',
      url: '/policies',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461609599032',
      resourceId: 'gid://shopify/Page/92591030328',
      tags: [],
      title: 'About',
      type: 'PAGE',
      url: '/pages/about',
      items: [],
    },
  ],
};

/**
 * @param {{
 *   isActive: boolean;
 *   isPending: boolean;
 * }}
 */
function activeLinkStyle({ isActive, isPending }) {
  return {
    fontWeight: isActive ? 'bold' : undefined,
    color: isPending ? 'grey' : 'black',
  };
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
