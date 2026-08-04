import {Analytics, getShopAnalytics, useNonce} from '@shopify/hydrogen';
import {useEffect} from 'react';
import {
  Outlet,
  useRouteError,
  isRouteErrorResponse,
  Links,
  Meta,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from 'react-router';
import favicon from '~/assets/P1B_FAVICON.png';
import {FOOTER_QUERY, HEADER_QUERY} from '~/lib/fragments';
import {setDesignApiBase} from '~/lib/designStudioApi';
import resetStyles from '~/styles/reset.css?url';
import appStyles from '~/styles/app.css?url';
import tailwindCss from './styles/tailwind.css?url';
import {PageLayout} from './components/PageLayout';

/**
 * Keep root data (header, cart, footer) warm on normal link navigations.
 * Re-running root on every click (logo → home, collections, etc.) makes SPA
 * transitions feel sluggish because those loaders block in parallel with the
 * destination route.
 *
 * @type {ShouldRevalidateFunction}
 */
export const shouldRevalidate = ({
  formMethod,
  formAction,
  currentUrl,
  nextUrl,
  actionResult,
}) => {
  // Mutations (add to cart, login, etc.) — including `/cart` fetcher submits.
  if (formMethod && formMethod !== 'GET') return true;
  if (formAction && /\/cart(?:$|\?)/.test(formAction)) return true;
  if (actionResult != null) return true;

  // Same-URL revalidation (useRevalidator / soft refresh)
  if (currentUrl.toString() === nextUrl.toString()) return true;

  // Pure link navigations: reuse existing root loader data
  return false;
};

/**
 * The main and reset stylesheets are added in the Layout component
 * to prevent a bug in development HMR updates.
 *
 * This avoids the "failed to execute 'insertBefore' on 'Node'" error
 * that occurs after editing and navigating to another page.
 *
 * It's a temporary fix until the issue is resolved.
 * https://github.com/remix-run/remix/issues/9242
 */
export function links() {
  return [
    {
      rel: 'preconnect',
      href: 'https://fonts.googleapis.com',
    },
    {
      rel: 'preconnect',
      href: 'https://fonts.gstatic.com',
      crossOrigin: 'anonymous',
    },
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap',
    },
    {
      rel: 'preconnect',
      href: 'https://cdn.shopify.com',
    },
    {
      rel: 'preconnect',
      href: 'https://shop.app',
    },
    {rel: 'icon', type: 'image/png', href: favicon},
  ];
}

/**
 * @param {Route.LoaderArgs} args
 */
export async function loader(args) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  const {storefront, env} = args.context;
  const checkoutDomain = env.PUBLIC_CHECKOUT_DOMAIN;

  if (!checkoutDomain) {
    console.error(
      [
        '[root loader] Missing env.PUBLIC_CHECKOUT_DOMAIN.',
        'This breaks Analytics consent and can cause hydration errors.',
        'Set it to your checkout domain (typically `your-store.myshopify.com`).',
      ].join(' '),
    );
  }

  return {
    ...deferredData,
    ...criticalData,
    publicStoreDomain: env.PUBLIC_STORE_DOMAIN,
    designApiUrl: env.PUBLIC_DESIGN_API_URL || '',
    shop: getShopAnalytics({
      storefront,
      publicStorefrontId: env.PUBLIC_STOREFRONT_ID,
    }),
    consent: checkoutDomain
      ? {
          checkoutDomain,
          storefrontAccessToken: env.PUBLIC_STOREFRONT_API_TOKEN,
          withPrivacyBanner: false,
          // localize the privacy banner
          country: args.context.storefront.i18n.country,
          language: args.context.storefront.i18n.language,
        }
      : null,
  };
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 * @param {Route.LoaderArgs}
 */
async function loadCriticalData({context}) {
  const {storefront} = context;

  const [header] = await Promise.all([
    storefront.query(HEADER_QUERY, {
      cache: storefront.CacheLong(),
      variables: {
        headerMenuHandle: 'main-menu', // Adjust to your header menu handle
      },
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  return {header};
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 * @param {Route.LoaderArgs}
 */
function loadDeferredData({context}) {
  const {storefront, customerAccount, cart} = context;

  // defer the footer query (below the fold)
  const footer = storefront
    .query(FOOTER_QUERY, {
      cache: storefront.CacheLong(),
      variables: {
        footerMenuHandle: 'footer', // Adjust to your footer menu handle
      },
    })
    .catch((error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error);
      return null;
    });
  return {
    cart: cart.get(),
    isLoggedIn: customerAccount.isLoggedIn(),
    footer,
  };
}

export function Layout({children}) {
  const nonce = useNonce();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="stylesheet" href={tailwindCss}></link>
        <link rel="stylesheet" href={resetStyles}></link>
        <link rel="stylesheet" href={appStyles}></link>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export default function App() {
  /** @type {RootLoader} */
  const data = useRouteLoaderData('root');

  // Hydrogen puts PUBLIC_* on worker `env`, not browser import.meta.env.
  // Sync into the design-studio client helper ASAP (render + effect).
  if (data?.designApiUrl) {
    setDesignApiBase(data.designApiUrl);
  }
  useEffect(() => {
    setDesignApiBase(data?.designApiUrl);
  }, [data?.designApiUrl]);

  if (!data) {
    return <Outlet />;
  }

  // If analytics consent can't be built, render the app without analytics.
  // (Missing checkout domain is a deployment/config issue, not a page-level fatal error.)
  if (!data.consent?.checkoutDomain) {
    return (
      <PageLayout {...data}>
        <Outlet />
      </PageLayout>
    );
  }

  return (
    <Analytics.Provider
      cart={data.cart}
      shop={data.shop}
      consent={data.consent}
    >
      <PageLayout {...data}>
        <Outlet />
      </PageLayout>
    </Analytics.Provider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  let errorMessage = 'Unknown error';
  let errorStatus = 500;

  if (isRouteErrorResponse(error)) {
    errorMessage = error?.data?.message ?? error.data;
    errorStatus = error.status;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <div className="route-error">
      <h1>Oops</h1>
      <h2>{errorStatus}</h2>
      {errorMessage && (
        <fieldset>
          <pre>{errorMessage}</pre>
        </fieldset>
      )}
    </div>
  );
}

/** @typedef {LoaderReturnData} RootLoader */

/** @typedef {import('react-router').ShouldRevalidateFunction} ShouldRevalidateFunction */
/** @typedef {import('./+types/root').Route} Route */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
