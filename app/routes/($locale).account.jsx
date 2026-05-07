import {
  data as remixData,
  Form,
  NavLink,
  Outlet,
  useLoaderData,
} from 'react-router';
import {LayoutGrid, LogOut, MapPin, Package, User} from 'lucide-react';
import {CUSTOMER_DETAILS_QUERY} from '~/graphql/customer-account/CustomerDetailsQuery';

export function shouldRevalidate() {
  return true;
}

function isDevPreview(request, context) {
  const url = new URL(request.url);
  const previewParam = url.searchParams.get('preview');
  const isPreviewRequested =
    previewParam === '1' || previewParam === 'true' || previewParam === 'yes';

  const envNodeEnv = context?.env?.NODE_ENV;
  const runtimeNodeEnv =
    typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined;
  // In Hydrogen local dev / preview tunnels, NODE_ENV can vary by runtime.
  // We treat anything that's not explicitly production as "dev" for this preview flag.
  const isDev = envNodeEnv !== 'production' && runtimeNodeEnv !== 'production';

  return Boolean(isDev && isPreviewRequested);
}

function buildMockCustomer() {
  return {
    id: 'gid://shopify/Customer/preview',
    createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
    firstName: 'Preview',
    lastName: 'Customer',
    emailAddress: {emailAddress: 'preview.customer@example.com'},
    phoneNumber: {phoneNumber: '+1 555-0100'},
    defaultAddress: {
      id: 'gid://shopify/CustomerAddress/preview-default',
      formatted: ['123 Brand St', 'Los Angeles CA 90001', 'United States'],
      firstName: 'Preview',
      lastName: 'Customer',
      company: 'P1 Blanks',
      address1: '123 Brand St',
      address2: '',
      territoryCode: 'US',
      zoneCode: 'CA',
      city: 'Los Angeles',
      zip: '90001',
      phoneNumber: '+1 555 0100',
    },
    addresses: {
      nodes: [
        {
          id: 'gid://shopify/CustomerAddress/preview-1',
          formatted: ['123 Brand St', 'Los Angeles CA 90001', 'United States'],
          firstName: 'Preview',
          lastName: 'Customer',
          company: 'P1 Blanks',
          address1: '123 Brand St',
          address2: '',
          territoryCode: 'US',
          zoneCode: 'CA',
          city: 'Los Angeles',
          zip: '90001',
          phoneNumber: '+1 555 0100',
        },
      ],
    },
  };
}

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({ request, context }) {
  const { customerAccount } = context;
  const preview = isDevPreview(request, context);

  if (preview) {
    return remixData(
      { customer: buildMockCustomer(), preview },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      },
    );
  }

  context.customerAccount.handleAuthStatus();
  const { data, errors } = await customerAccount.query(CUSTOMER_DETAILS_QUERY, {
    variables: {
      language: customerAccount.i18n.language,
    },
  });

  if (errors?.length || !data?.customer) {
    console.error('[account layout loader] CUSTOMER_DETAILS_QUERY failed', {
      hasCustomer: Boolean(data?.customer),
      errors,
    });
    throw new Error('Customer not found');
  }

  return remixData(
    { customer: data.customer },
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    },
  );
}

export default function AccountLayout() {
  /** @type {LoaderReturnData} */
  const { customer, preview } = useLoaderData();

  const heading = customer
    ? customer.firstName
      ? `Welcome, ${customer.firstName}`
      : `Welcome to your account.`
    : 'Account Details';

  return (
    <div className="account-page">
      <div className="account-container">
        <header className="account-header">
          <div>
            <h1 className="account-title">{heading}</h1>
            {preview ? (
              <p className="account-preview-note">
                Preview mode (dev only). Customer data is mocked.
              </p>
            ) : null}
          </div>
        </header>

        <div className="account-shell">
          <aside className="account-nav" aria-label="Account navigation">
            <AccountMenu preview={preview} />
          </aside>

          <section className="account-content">
            <Outlet context={{ customer }} />
          </section>
        </div>
      </div>
    </div>
  );
}

function AccountMenu({preview}) {
  function navLinkClassName({isActive, isPending}) {
    return [
      'account-nav-link',
      isActive ? 'is-active' : '',
      isPending ? 'is-pending' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  const previewSearch = preview ? '?preview=1' : '';

  return (
    <nav className="account-nav-inner" role="navigation">
      <div className="account-nav-main">
        <div className="account-nav-section">
          <p className="account-nav-section-title">My account</p>
          <ul className="account-nav-list">
          <li>
            <NavLink
              end
              to={{pathname: '/account', search: previewSearch}}
              className={navLinkClassName}
            >
              <span className="account-nav-link-icon" aria-hidden>
                <LayoutGrid size={20} strokeWidth={1.75} />
              </span>
              <span>Dashboard</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to={{pathname: '/account/orders', search: previewSearch}}
              className={navLinkClassName}
            >
              <span className="account-nav-link-icon" aria-hidden>
                <Package size={20} strokeWidth={1.75} />
              </span>
              <span>Orders</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to={{pathname: '/account/profile', search: previewSearch}}
              className={navLinkClassName}
            >
              <span className="account-nav-link-icon" aria-hidden>
                <User size={20} strokeWidth={1.75} />
              </span>
              <span>Profile</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to={{pathname: '/account/addresses', search: previewSearch}}
              className={navLinkClassName}
            >
              <span className="account-nav-link-icon" aria-hidden>
                <MapPin size={20} strokeWidth={1.75} />
              </span>
              <span>Addresses</span>
            </NavLink>
          </li>
          </ul>
        </div>
      </div>

      <div className="account-nav-footer">
        <div className="account-nav-sep" role="separator" aria-hidden="true" />
        <Logout />
      </div>
    </nav>
  );
}

function Logout() {
  return (
    <Form className="account-logout" method="POST" action="/account/logout">
      <button type="submit" className="account-nav-link account-nav-link--logout">
        <span className="account-nav-link-icon" aria-hidden>
          <LogOut size={20} strokeWidth={1.75} />
        </span>
        <span>Log out</span>
      </button>
    </Form>
  );
}

/** @typedef {import('./+types/account').Route} Route */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
