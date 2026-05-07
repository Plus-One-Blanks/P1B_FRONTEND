import { Link, redirect, useLoaderData, useOutletContext } from 'react-router';
import { ArrowRight, Image, LayoutGrid, Shirt } from 'lucide-react';
import { Money, getPaginationVariables } from '@shopify/hydrogen';
import { CUSTOMER_ORDERS_QUERY } from '~/graphql/customer-account/CustomerOrdersQuery';
import { SolidButton } from '~/components/SolidButton';
import { ALL_PRODUCTS_COLLECTION_HANDLE } from '~/lib/searchDrawerCollection';
import {toBase64} from '~/lib/base64';

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{ title: 'Account' }];
};

const DTF_UPLOAD_PAGE_PATH = '/pages/dtf-upload';
const DTF_TRANSFERS_PATH = '/dtf-transfers';
/** Orders shown on the dashboard “Recent orders” block (already sorted newest first). */
const DASHBOARD_ORDERS_LIMIT = 6;

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

function buildMockRecentOrders() {
  const now = Date.now();
  const days = (n) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();
  const mkMoney = (amount) => ({ amount: String(amount), currencyCode: 'USD' });
  const mkOrder = (suffix, number, dayOffset, total) => ({
    id: `gid://shopify/Order/preview-dash-${suffix}`,
    number,
    confirmationNumber: `P1B-PV${suffix}`,
    processedAt: days(dayOffset),
    financialStatus: 'PAID',
    fulfillmentStatus: 'FULFILLED',
    totalPrice: mkMoney(total),
    fulfillments: { nodes: [{ status: 'DELIVERED' }] },
  });
  return {
    nodes: [
      mkOrder(1, 1008, 2, '42.00'),
      mkOrder(2, 1007, 5, '119.50'),
      mkOrder(3, 1006, 9, '64.00'),
      mkOrder(4, 1005, 14, '210.25'),
      mkOrder(5, 1004, 21, '88.00'),
      mkOrder(6, 1003, 35, '186.40'),
    ],
  };
}

function previewSearchSuffix(request) {
  const url = new URL(request.url);
  return url.searchParams.get('preview') ? '?preview=1' : '';
}

/**
 * @param {Route.LoaderArgs} args
 */
export async function loader({ request, context }) {
  const preview = isDevPreview(request, context);
  const previewQuery = previewSearchSuffix(request);

  if (preview) {
    return {
      preview: true,
      recentOrders: buildMockRecentOrders(),
      previewQuery,
    };
  }

  const { customerAccount } = context;
  context.customerAccount.handleAuthStatus();

  const paginationVariables = getPaginationVariables(request, {
    pageBy: DASHBOARD_ORDERS_LIMIT,
  });

  const { data, errors } = await customerAccount.query(CUSTOMER_ORDERS_QUERY, {
    variables: {
      ...paginationVariables,
      query: undefined,
      language: customerAccount.i18n.language,
    },
  });

  if (errors?.length || !data?.customer) {
    console.error('[account dashboard loader] CUSTOMER_ORDERS_QUERY failed', {
      hasCustomer: Boolean(data?.customer),
      errors,
    });
    return redirect('/account/login');
  }

  const allNodes = data.customer.orders?.nodes ?? [];
  const recentNodes = allNodes.slice(0, DASHBOARD_ORDERS_LIMIT);

  return {
    preview: false,
    recentOrders: { nodes: recentNodes },
    previewQuery: '',
  };
}

/**
 * @param {string} orderId
 * @param {string} previewQuery
 */
function orderPath(orderId, previewQuery) {
  return `/account/orders/${toBase64(orderId)}${previewQuery}`;
}

/**
 * @typedef {{customer: import('customer-accountapi.generated').CustomerDetailsQuery['customer'] & {createdAt?: string | null} | null}} AccountOutletContext
 */
export default function AccountDashboard() {
  /** @type {{preview: boolean; recentOrders: {nodes: import('customer-accountapi.generated').OrderItemFragment[]}; previewQuery: string}} */
  const { recentOrders, previewQuery } = useLoaderData();
  /** @type {AccountOutletContext} */
  const { customer } = useOutletContext();
  const nodes = recentOrders?.nodes ?? [];

  const memberDate = customer?.createdAt
    ? new Date(customer.createdAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    : null;

  const allProductsPath = `/collections/${ALL_PRODUCTS_COLLECTION_HANDLE}`;

  return (
    <div className="account-dashboard">
      <ul className="account-dashboard-action-grid" aria-label="Quick actions">
        <li>
          <div className="account-dashboard-action-card account-dashboard-action-card--sky">
            <div className="account-dashboard-action-top">
              <span className="account-dashboard-action-icon" aria-hidden>
                <Image size={22} strokeWidth={1.6} />
              </span>
              <div>
                <p className="account-dashboard-action-title">Order DTF by size</p>
                <p className="account-dashboard-action-sub">
                  Upload and pick what size best fits your needs
                </p>
              </div>
            </div>
            <SolidButton
              href={DTF_UPLOAD_PAGE_PATH}
              compact
              variant="pastel-sky"
              className="account-dashboard-action-cta"
            >
              Order
            </SolidButton>
          </div>
        </li>
        <li>
          <div className="account-dashboard-action-card account-dashboard-action-card--neutral">
            <div className="account-dashboard-action-top">
              <span className="account-dashboard-action-icon" aria-hidden>
                <LayoutGrid size={22} strokeWidth={1.6} />
              </span>
              <div>
                <p className="account-dashboard-action-title">Build a gang sheet</p>
                <p className="account-dashboard-action-sub">
                  Fill your sheet and maximize savings
                </p>
              </div>
            </div>
            <SolidButton
              to={DTF_TRANSFERS_PATH}
              compact
              className="account-dashboard-action-cta"
            >
              Build
            </SolidButton>
          </div>
        </li>
        <li>
          <div className="account-dashboard-action-card account-dashboard-action-card--butter">
            <div className="account-dashboard-action-top">
              <span className="account-dashboard-action-icon" aria-hidden>
                <Shirt size={22} strokeWidth={1.6} />
              </span>
              <div>
                <p className="account-dashboard-action-title">Blank apparel</p>
                <p className="account-dashboard-action-sub">
                  Browse T-Shirts, Hoodies, and other goods that fit your needs
                </p>
              </div>
            </div>
            <SolidButton
              to={allProductsPath}
              compact
              className="account-dashboard-action-cta account-dashboard-action-cta--shop"
            >
              Shop
            </SolidButton>
          </div>
        </li>
      </ul>

      <section className="account-dashboard-section" aria-labelledby="dash-recent-orders-heading">
        <div className="account-dashboard-section-head">
          <div>
            <h2 id="dash-recent-orders-heading" className="account-dashboard-section-title">
              Recent orders
            </h2>
            <p className="account-dashboard-section-meta">
              Your {DASHBOARD_ORDERS_LIMIT} most recent orders
            </p>
          </div>
          <Link
            to={`/account/orders${previewQuery}`}
            className="account-dashboard-section-link"
          >
            View all orders →
          </Link>
        </div>

        <div className="account-dashboard-panel">
          {nodes.length ? (
            <ul className="account-dashboard-order-list">
              {nodes.map((order) => (
                <li key={order.id}>
                  <Link
                    to={orderPath(order.id, previewQuery)}
                    className="account-dashboard-order-row"
                  >
                    <span className="account-dashboard-order-num-inner">
                      <span className="account-dashboard-order-num">
                        #{order.number}
                      </span>
                      <span
                        className="account-dashboard-order-num-arrow"
                        aria-hidden
                      >
                        <ArrowRight
                          size={16}
                          strokeWidth={2.25}
                          className="account-dashboard-order-num-arrow-icon"
                        />
                      </span>
                    </span>
                    <span className="account-dashboard-order-date">
                      {order.processedAt
                        ? new Date(order.processedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                        : '—'}
                    </span>
                    <span className="account-dashboard-order-total">
                      <Money data={order.totalPrice} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="account-dashboard-empty">
              {memberDate ? (
                <p className="account-dashboard-member-line">
                  Member since{' '}
                  <span className="account-dashboard-member-date">{memberDate}</span>
                </p>
              ) : (
                <p className="account-dashboard-member-line">Welcome to Plus One Blanks</p>
              )}
              <SolidButton variant="pastel-sky" to={allProductsPath}>
                Start shopping
              </SolidButton>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/** @typedef {import('./+types/account._index').Route} Route */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
