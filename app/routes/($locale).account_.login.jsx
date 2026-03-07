import { Link, useLoaderData } from 'react-router';
import logo from '~/assets/logo.svg';

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({ request, context }) {
  const url = new URL(request.url);
  // Only redirect to Shopify customer account when user has clicked Continue
  if (url.searchParams.get('redirect') === '1') {
    const env = context.env || {};
    const shopId = env.SHOP_ID;
    const clientId = env.PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID;
    if (!shopId || !clientId) {
      return { customerAccountMisconfigured: true };
    }
    return context.customerAccount.login({
      countryCode: context.storefront.i18n.country,
    });
  }
  const requestUrl = new URL(request.url);
  const origin = requestUrl.protocol === 'http:' ? requestUrl.origin.replace('http', 'https') : requestUrl.origin;
  const callbackUrl = `${origin}/account/authorize`;
  return { callbackUrl };
}

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{ title: 'Sign in' }];
};

/** @typedef {import('./+types/account_.login').Route} Route */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */

export default function Login() {
  const data = useLoaderData();
  const misconfigured = data?.customerAccountMisconfigured;
  const callbackUrl = data?.callbackUrl ?? (typeof window !== 'undefined' ? `${window.location.origin}/account/authorize` : '');

  return (
    <div className="login-page">
      <div className="login-card">
        <Link to="/" className="login-logo-link">
          <img src={logo} alt="Logo" className="login-logo" />
        </Link>
        <h1 className="login-title">Sign in</h1>
        <p className="login-subtitle">Sign in or create an account</p>

        {misconfigured ? (
          <div className="login-misconfigured">
            <p className="login-misconfigured-text">
              Customer account login isn’t configured yet. In your project root, run:
            </p>
            <code className="login-misconfigured-code">
              npx shopify hydrogen env pull
            </code>
            <p className="login-misconfigured-note">
              That links your store and adds <strong>SHOP_ID</strong> and{' '}
              <strong>PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID</strong> to <code>.env</code>.
              Restart the dev server after updating.
            </p>
          </div>
        ) : (
          <div className="login-actions">
            <a
              href="/account/login?redirect=1"
              className="login-button login-button-primary"
            >
              Continue
            </a>
            <p className="login-hint">
              You’ll sign in on a secure page, then return here.
            </p>
            <p className="login-or">or</p>
            <Link to="/" className="login-shop-link">
              Continue shopping
            </Link>
          </div>
        )}

        <details className="login-callback-help">
          <summary>Getting &quot;redirect_uri mismatch&quot;?</summary>
          <p className="login-callback-text">
            Add this exact callback URL in Shopify:{' '}
            <strong className="login-callback-url">{callbackUrl}</strong>
          </p>
          <p className="login-callback-where">
            In Shopify Admin: <strong>Sales channels → Headless</strong> (or your Hydrogen app) → <strong>Customer Account API</strong> → Application setup → <strong>Callback URL(s)</strong>. Add the URL above and save. Use HTTPS (localhost is not allowed; use a tunnel like ngrok for local dev).
          </p>
        </details>
      </div>

      <footer className="login-footer">
        <Link to="/policies/privacy-policy" className="login-footer-link">
          Privacy policy
        </Link>
        <span className="login-footer-sep"> · </span>
        <Link to="/policies/terms-of-service" className="login-footer-link">
          Terms of service
        </Link>
      </footer>
    </div>
  );
}
