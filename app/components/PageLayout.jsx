import {Await, useFetcher, useLocation} from 'react-router';
import {Suspense, useEffect, useLayoutEffect, useRef} from 'react';
import {Aside, useAside} from '~/components/Aside';
import {Footer} from '~/components/Footer';
import {Header, HeaderMenu} from '~/components/Header';
import {CartMain} from '~/components/CartMain';
import {SearchDrawer} from '~/components/SearchDrawer';

/**
 * @param {PageLayoutProps}
 */
export function PageLayout({
  cart,
  children = null,
  footer,
  header,
  isLoggedIn,
  publicStoreDomain,
}) {
  return (
    <Aside.Provider>
      <CloseAsideOnLocationChange />
      <CartAside cart={cart} />
      <SearchAside header={header} />
      <MobileMenuAside header={header} publicStoreDomain={publicStoreDomain} />
      {header && (
        <Header
          header={header}
          cart={cart}
          isLoggedIn={isLoggedIn}
          publicStoreDomain={publicStoreDomain}
        />
      )}
      <main>{children}</main>
      <Footer
        footer={footer}
        header={header}
        publicStoreDomain={publicStoreDomain}
      />
    </Aside.Provider>
  );
}

/**
 * Right/top asides use a full-viewport fixed overlay above `<main>`. If we only make that
 * overlay click-through for the header, the shell can still paint over the document after SPA
 * navigation until `type` becomes `closed`. Closing on pathname change keeps the new route
 * visible and avoids “URL changed but screen did not”.
 */
function CloseAsideOnLocationChange() {
  const {pathname} = useLocation();
  const {type, close} = useAside();
  const lastPathname = useRef(pathname);

  // useLayoutEffect so we close before paint. useEffect can leave the cart/search shell
  // (fixed overlay + body scroll lock) visible for a frame after SPA navigation — matches
  // the “URL changed but main still looks like cart” report when leaving /cart.
  useLayoutEffect(() => {
    if (lastPathname.current !== pathname) {
      if (type !== 'closed') {
        close();
      }
      document.body.classList.remove('cart-open', 'search-drawer-open');
      lastPathname.current = pathname;
    }
  }, [pathname, type, close]);

  return null;
}

/**
 * Refetches cart when drawer opens so the drawer always shows latest data (including applied discount).
 * @param {{cart: PageLayoutProps['cart']}}
 */
function CartAside({cart}) {
  const {type} = useAside();
  const fetcher = useFetcher({key: 'cart-drawer'});

  useEffect(() => {
    if (type === 'cart') {
      fetcher.load('/cart');
    }
  }, [type]);

  return (
    <Aside type="cart" heading={null}>
      <Suspense fallback={<p>Loading cart ...</p>}>
        <Await resolve={cart}>
          {(resolvedCart) => {
            const cartToShow =
              fetcher.state === 'idle' && fetcher.data != null
                ? fetcher.data
                : resolvedCart;
            return <CartMain cart={cartToShow} layout="aside" />;
          }}
        </Await>
      </Suspense>
    </Aside>
  );
}

/**
 * @param {{ header: PageLayoutProps['header'] | null | undefined }}
 */
function SearchAside({header}) {
  const shopName = header?.shop?.name ?? 'Plus One Blanks';
  return (
    <Aside type="search" placement="top" heading={null}>
      <SearchDrawer shopName={shopName} />
    </Aside>
  );
}

/**
 * @param {{
 *   header: PageLayoutProps['header'];
 *   publicStoreDomain: PageLayoutProps['publicStoreDomain'];
 * }}
 */
function MobileMenuAside({header, publicStoreDomain}) {
  if (!header?.shop) return null;

  return (
    <Aside type="mobile" heading="Menu">
      <HeaderMenu
        menu={header.menu}
        viewport="mobile"
        primaryDomainUrl={header.shop.primaryDomain?.url ?? ''}
        publicStoreDomain={publicStoreDomain}
      />
    </Aside>
  );
}

/**
 * @typedef {Object} PageLayoutProps
 * @property {Promise<CartApiQueryFragment|null>} cart
 * @property {Promise<FooterQuery|null>} footer
 * @property {HeaderQuery} header
 * @property {Promise<boolean>} isLoggedIn
 * @property {string} publicStoreDomain
 * @property {React.ReactNode} [children]
 */

/** @typedef {import('storefrontapi.generated').CartApiQueryFragment} CartApiQueryFragment */
/** @typedef {import('storefrontapi.generated').FooterQuery} FooterQuery */
/** @typedef {import('storefrontapi.generated').HeaderQuery} HeaderQuery */
