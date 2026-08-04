import {redirect, useLoaderData} from 'react-router';
import {CUSTOMER_DESIGN_ORDERS_QUERY} from '~/graphql/customer-account/CustomerDesignOrdersQuery';
import {AccountDesignCard} from '~/components/AccountDesignCard';
import {OutlineButton} from '~/components/OutlineButton';
import {
  guardCustomerAccountAuth,
  serializeCustomerAccountErrors,
} from '~/lib/customerAccountAuth';
import {
  ACCOUNT_DESIGN_ORDERS_SCAN_PAGE,
  ACCOUNT_DESIGNS_PAGE_LIMIT,
  buildMockAccountDesigns,
  collectDesignsFromOrders,
  enrichAccountDesigns,
} from '~/lib/accountDesigns.server';

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{title: 'Designs'}];
};

function isDevPreview(request, context) {
  const url = new URL(request.url);
  const previewParam = url.searchParams.get('preview');
  const isPreviewRequested =
    previewParam === '1' || previewParam === 'true' || previewParam === 'yes';

  const envNodeEnv = context?.env?.NODE_ENV;
  const runtimeNodeEnv =
    typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined;
  const isDev = envNodeEnv !== 'production' && runtimeNodeEnv !== 'production';

  return Boolean(isDev && isPreviewRequested);
}

function previewSearchSuffix(request) {
  const url = new URL(request.url);
  return url.searchParams.get('preview') ? '?preview=1' : '';
}

/**
 * @param {Route.LoaderArgs} args
 */
export async function loader({request, context}) {
  const preview = isDevPreview(request, context);
  const previewQuery = previewSearchSuffix(request);

  if (preview) {
    return {
      preview: true,
      designs: buildMockAccountDesigns(),
      previewQuery,
    };
  }

  const {customerAccount, env} = context;

  const authRedirect = await guardCustomerAccountAuth(customerAccount);
  if (authRedirect) {
    return authRedirect;
  }

  const {data, errors} = await customerAccount.query(
    CUSTOMER_DESIGN_ORDERS_QUERY,
    {
      variables: {
        first: ACCOUNT_DESIGN_ORDERS_SCAN_PAGE,
        language: customerAccount.i18n.language,
      },
    },
  );

  if (errors?.length || !data?.customer) {
    console.error('[account designs loader] query failed', {
      hasCustomer: Boolean(data?.customer),
      errors: serializeCustomerAccountErrors(errors),
    });
    return redirect('/account/login');
  }

  const orderNodes = data.customer.orders?.nodes ?? [];
  const collected = collectDesignsFromOrders(orderNodes);
  const designs = await enrichAccountDesigns(
    collected,
    env?.PUBLIC_DESIGN_API_URL,
    {limit: ACCOUNT_DESIGNS_PAGE_LIMIT},
  );

  return {
    preview: false,
    designs,
    previewQuery: '',
  };
}

export default function AccountDesignsPage() {
  /** @type {{designs: import('~/lib/accountDesigns.server').AccountDesignSummary[]; previewQuery: string}} */
  const {designs = [], previewQuery} = useLoaderData();

  return (
    <div className="account-section account-section--designs">
      <header className="account-section-header account-designs-page-header">
        <h2 className="account-section-title">Designs</h2>
        <p className="account-section-subtitle">
          Artwork from your decorated orders — reorder the same look anytime
        </p>
      </header>

      {designs.length ? (
        <>
          <p className="account-designs-page-count">
            {designs.length === 1 ? '1 design' : `${designs.length} designs`}
          </p>
          <ul className="account-designs-grid">
            {designs.map((design) => (
              <li key={design.id}>
                <AccountDesignCard
                  design={design}
                  previewQuery={previewQuery}
                />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="account-dashboard-panel account-designs-empty">
          <p className="account-designs-empty-title">No saved designs yet</p>
          <p className="account-designs-empty-copy">
            When you order decorated apparel, your Design Studio artwork shows
            up here so you can reorder the same look.
          </p>
          <OutlineButton to="/collections/t-shirts-decorated" prefetch="intent">
            Shop decorated apparel
          </OutlineButton>
        </div>
      )}
    </div>
  );
}

/** @typedef {import('./+types/account.designs').Route} Route */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
