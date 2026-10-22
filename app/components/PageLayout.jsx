import {Await, Link, useFetcher, useLocation} from 'react-router';
import {Suspense, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {Aside, useAside} from '~/components/Aside';
import {Footer} from '~/components/Footer';
import {Header, HeaderMenu} from '~/components/Header';
import logo from '~/assets/logo.svg';
import {CartMain} from '~/components/CartMain';
import {CartSkeleton, ContentReveal} from '~/components/LoadingUI';
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
  const {pathname} = useLocation();
  const isDtfStudio = /\/dtf-sheets\/studio\/?$/.test(pathname);

  return (
    <Aside.Provider>
      <CloseAsideOnLocationChange />
      <CartAside cart={cart} />
      <SearchAside header={header} />
      <MobileMenuAside header={header} publicStoreDomain={publicStoreDomain} />
      {!isDtfStudio && header ? (
        <Header
          header={header}
          cart={cart}
          isLoggedIn={isLoggedIn}
          publicStoreDomain={publicStoreDomain}
        />
      ) : null}
      <main className={isDtfStudio ? 'main--dtf-studio' : undefined}>
        {children}
      </main>
      {!isDtfStudio ? (
        <Footer
          footer={footer}
          header={header}
          publicStoreDomain={publicStoreDomain}
        />
      ) : null}
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
      document.body.classList.remove(
        'cart-open',
        'search-drawer-open',
        'mobile-menu-open',
      );
      lastPathname.current = pathname;
    }
  }, [pathname, type, close]);

  return null;
}

/**
 * Refetches cart when drawer opens. Shows a skeleton until that fetch settles
 * so customers never see a stale or empty flash.
 * @param {{cart: PageLayoutProps['cart']}}
 */
function CartAside({cart}) {
  const {type} = useAside();
  const fetcher = useFetcher({key: 'cart-drawer'});
  const [ready, setReady] = useState(false);
  const sawLoading = useRef(false);

  useEffect(() => {
    if (type !== 'cart') {
      setReady(false);
      sawLoading.current = false;
      return;
    }

    sawLoading.current = false;
    setReady(false);
    fetcher.load('/cart');

    // If the fetcher never enters "loading" (cached/instant), reveal shortly.
    const safety = window.setTimeout(() => {
      if (!sawLoading.current) {
        sawLoading.current = true;
        setReady(true);
      }
    }, 120);

    return () => window.clearTimeout(safety);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh only when drawer opens
  }, [type]);

  useEffect(() => {
    if (type !== 'cart') return;
    if (fetcher.state === 'loading' || fetcher.state === 'submitting') {
      sawLoading.current = true;
      setReady(false);
      return;
    }
    if (fetcher.state === 'idle' && sawLoading.current) {
      setReady(true);
    }
  }, [type, fetcher.state]);

  return (
    <Aside type="cart" heading={null}>
      {!ready ? (
        <CartSkeleton layout="aside" />
      ) : (
        <Suspense fallback={<CartSkeleton layout="aside" />}>
          <Await resolve={cart}>
            {(resolvedCart) => {
              const cartToShow =
                fetcher.data !== undefined ? fetcher.data : resolvedCart;
              return (
                <ContentReveal className="cart-aside-reveal">
                  <CartMain cart={cartToShow} layout="aside" />
                </ContentReveal>
              );
            }}
          </Await>
        </Suspense>
      )}
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
function MobileMenuLogo({shopName}) {
  const {close} = useAside();
  return (
    <Link
      to="/"
      prefetch="viewport"
      className="header-logo-link"
      onClick={close}
    >
      <div className="header-logo">
        <img src={logo} alt={shopName} className="logo-image" decoding="async" />
      </div>
    </Link>
  );
}

function MobileMenuAside({header, publicStoreDomain}) {
  if (!header?.shop) return null;

  const shopName = header.shop.name ?? 'Plus 1 Blanks';

  return (
    <Aside
      type="mobile"
      placement="left"
      heading={<MobileMenuLogo shopName={shopName} />}
    >
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
