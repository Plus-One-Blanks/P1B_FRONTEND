import {
  Link,
  useLoaderData,
  useNavigation,
  useSearchParams,
  useFetcher,
} from 'react-router';
import React, {useRef} from 'react';
import {Search} from 'lucide-react';
import {
  Money,
  getPaginationVariables,
  flattenConnection,
} from '@shopify/hydrogen';
import {
  buildOrderSearchQuery,
  parseOrderFilters,
  ORDER_FILTER_FIELDS,
} from '~/lib/orderFilters';
import {CUSTOMER_ORDERS_QUERY} from '~/graphql/customer-account/CustomerOrdersQuery';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {SolidButton} from '~/components/SolidButton';

/** @param {{nodes?: unknown[]}} connection */
function filterOrdersByBucket(connection, bucket) {
  if (!connection?.nodes?.length || bucket === 'all') return connection;
  return {
    ...connection,
    nodes: connection.nodes.filter((order) => orderMatchesBucket(order, bucket)),
  };
}

function orderMatchesBucket(order, bucket) {
  const fulfillment = flattenConnection(order.fulfillments)[0]?.status;
  const delivered =
    fulfillment === 'DELIVERED' ||
    order.fulfillmentStatus === 'FULFILLED';
  if (bucket === 'delivered') return delivered;
  if (bucket === 'processing') return !delivered;
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
  const isDev = envNodeEnv !== 'production' && runtimeNodeEnv !== 'production';

  return Boolean(isDev && isPreviewRequested);
}

function buildMockOrdersConnection() {
  const now = Date.now();
  const days = (n) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();

  const mkMoney = (amount) => ({amount: String(amount), currencyCode: 'USD'});
  const mkFulfillments = (status) => ({nodes: status ? [{status}] : []});

  const nodes = [
    {
      id: 'gid://shopify/Order/preview-1003',
      number: 1003,
      confirmationNumber: 'P1B-9X2K1',
      processedAt: days(2),
      financialStatus: 'PAID',
      fulfillmentStatus: 'FULFILLED',
      fulfillments: mkFulfillments('DELIVERED'),
      totalPrice: mkMoney('186.40'),
    },
    {
      id: 'gid://shopify/Order/preview-1002',
      number: 1002,
      confirmationNumber: 'P1B-7Q4M3',
      processedAt: days(12),
      financialStatus: 'PAID',
      fulfillmentStatus: 'IN_PROGRESS',
      fulfillments: mkFulfillments('IN_TRANSIT'),
      totalPrice: mkMoney('92.00'),
    },
    {
      id: 'gid://shopify/Order/preview-1001',
      number: 1001,
      confirmationNumber: 'P1B-3A8D2',
      processedAt: days(35),
      financialStatus: 'PAID',
      fulfillmentStatus: 'UNFULFILLED',
      fulfillments: mkFulfillments(null),
      totalPrice: mkMoney('48.00'),
    },
  ];

  return {
    nodes,
    pageInfo: {
      hasPreviousPage: false,
      hasNextPage: false,
      endCursor: null,
      startCursor: null,
    },
  };
}

function filterMockOrders(connection, filters) {
  const name = filters?.name?.replace(/^#/, '').trim();
  const confirmation = filters?.confirmationNumber?.trim();

  if (!name && !confirmation) return connection;

  const nodes = connection.nodes.filter((o) => {
    const nameOk = name ? String(o.number).includes(name) : true;
    const confOk = confirmation
      ? String(o.confirmationNumber ?? '')
          .toLowerCase()
          .includes(String(confirmation).toLowerCase())
      : true;
    return nameOk && confOk;
  });

  return {...connection, nodes};
}

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{title: 'Orders'}];
};

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({request, context}) {
  const {customerAccount} = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 20,
  });

  const url = new URL(request.url);
  const filters = parseOrderFilters(url.searchParams);
  const query = buildOrderSearchQuery(filters);
  const bucketRaw = url.searchParams.get('bucket');
  const bucket =
    bucketRaw === 'processing' || bucketRaw === 'delivered'
      ? bucketRaw
      : 'all';

  if (isDevPreview(request, context)) {
    let orders = filterMockOrders(buildMockOrdersConnection(), filters);
    orders = filterOrdersByBucket(orders, bucket);
    return {
      customer: {orders},
      filters,
      bucket,
      preview: true,
    };
  }

  const {data, errors} = await customerAccount.query(CUSTOMER_ORDERS_QUERY, {
    variables: {
      ...paginationVariables,
      query,
      language: customerAccount.i18n.language,
    },
  });

  if (errors?.length || !data?.customer) {
    throw Error('Customer orders not found');
  }

  const customer = {
    ...data.customer,
    orders: filterOrdersByBucket(data.customer.orders, bucket),
  };

  return {customer, filters, bucket};
}

export default function Orders() {
  /** @type {LoaderReturnData} */
  const {customer, filters, bucket} = useLoaderData();
  const [searchParams] = useSearchParams();
  const preview = searchParams.get('preview') === '1';
  const {orders} = customer;

  const modalFetcher = useFetcher();
  const [activeOrderPath, setActiveOrderPath] = React.useState(null);

  const closeModal = () => {
    setActiveOrderPath(null);
  };

  return (
    <div className="account-section account-section--orders">
      <header className="account-orders-page-header">
        <h2 className="account-orders-page-title">My orders</h2>
      </header>

      <div className="account-orders-toolbar">
        <OrderBucketTabs activeBucket={bucket} />
        <div className="account-orders-toolbar-search">
          <OrderSearchForm currentFilters={filters} />
        </div>
      </div>

      <div className="account-card account-card--orders-list">
        <OrdersTable
          orders={orders}
          filters={filters}
          bucket={bucket}
          preview={preview}
          onViewOrder={(orderPath) => {
            setActiveOrderPath(orderPath);
            modalFetcher.load(orderPath);
          }}
        />
      </div>

      {activeOrderPath ? (
        <OrderDetailsModal
          fetcher={modalFetcher}
          onClose={closeModal}
        />
      ) : null}
    </div>
  );
}

const ORDER_BUCKETS = /** @type {const} */ ([
  {id: 'all', label: 'All'},
  {id: 'processing', label: 'Processing'},
  {id: 'delivered', label: 'Delivered'},
]);

function OrderBucketTabs({activeBucket}) {
  const [searchParams] = useSearchParams();

  const hrefForBucket = (id) => {
    const next = new URLSearchParams(searchParams);
    if (id === 'all') {
      next.delete('bucket');
    } else {
      next.set('bucket', id);
    }
    const q = next.toString();
    return q ? `?${q}` : '';
  };

  return (
    <div className="account-orders-buckets" role="tablist" aria-label="Filter orders">
      {ORDER_BUCKETS.map(({id, label}) => {
        const isActive = activeBucket === id;
        return (
          <Link
            key={id}
            to={hrefForBucket(id)}
            className={
              isActive
                ? 'account-orders-bucket account-orders-bucket--active'
                : 'account-orders-bucket'
            }
            role="tab"
            aria-selected={isActive}
            preventScrollReset
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * @param {{
 *   orders: CustomerOrdersFragment['orders'];
 *   filters: OrderFilterParams;
 * }}
 */
function OrdersTable({orders, filters, bucket, preview, onViewOrder}) {
  const hasFilters = !!(filters.name || filters.confirmationNumber);

  return (
    <div className="account-orders" aria-live="polite">
      {orders?.nodes.length ? (
        <PaginatedResourceSection
          connection={orders}
          wrapperClassName="account-order-grid-wrap"
          resourcesClassName="account-order-grid"
        >
            {({node: order}) => (
              <OrderItem
                key={order.id}
                order={order}
                preview={preview}
                onViewOrder={onViewOrder}
              />
            )}
        </PaginatedResourceSection>
      ) : (
        <EmptyOrders
          hasFilters={hasFilters}
          bucket={bucket}
          preview={preview}
        />
      )}
    </div>
  );
}

/**
 * @param {{hasFilters?: boolean}}
 */
function EmptyOrders({hasFilters = false, bucket = 'all', preview}) {
  const previewSearch = preview ? '?preview=1' : '';
  const bucketMessage =
    bucket !== 'all'
      ? 'No orders in this view. Try another filter or show all orders.'
      : null;

  return (
    <div className="account-empty account-empty--orders-panel">
      {hasFilters ? (
        <>
          <p className="account-empty-title">No matching orders</p>
          <p className="account-empty-sub">
            Try a different order number, confirmation code, or filter.
          </p>
          <div className="account-empty-actions">
            <SolidButton variant="pastel-sky" to={`/account/orders${previewSearch}`}>
              Clear search
            </SolidButton>
          </div>
        </>
      ) : bucketMessage ? (
        <>
          <p className="account-empty-title">No orders here</p>
          <p className="account-empty-sub">{bucketMessage}</p>
          <div className="account-empty-actions">
            <SolidButton variant="pastel-sky" to={`/account/orders${previewSearch}`}>
              View all orders
            </SolidButton>
          </div>
        </>
      ) : (
        <>
          <p className="account-empty-title">You haven&apos;t placed any orders yet.</p>
          <p className="account-empty-sub">
            When you order from Plus One Blanks, your history will show up here.
          </p>
          <div className="account-empty-actions">
            <SolidButton variant="pastel-sky" to="/collections">
              Start shopping
            </SolidButton>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * @param {{
 *   currentFilters: OrderFilterParams;
 * }}
 */
function OrderSearchForm({currentFilters}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const isSearching =
    navigation.state !== 'idle' &&
    navigation.location?.pathname?.includes('orders');
  const formRef = useRef(null);

  const handleSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    const raw = formData.get('q')?.toString().trim();
    if (raw) {
      const cleaned = raw.replace(/^#/, '').trim();
      const looksLikeOrderNumber = /^\d+$/.test(cleaned);
      if (looksLikeOrderNumber) {
        params.set(ORDER_FILTER_FIELDS.NAME, cleaned);
      } else {
        // Treat anything else as a confirmation / reference search.
        params.set(ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER, raw);
      }
    }

    const bucket = searchParams.get('bucket');
    if (bucket === 'processing' || bucket === 'delivered') {
      params.set('bucket', bucket);
    }
    if (searchParams.get('preview') === '1') {
      params.set('preview', '1');
    }

    setSearchParams(params);
  };

  const hasFilters = currentFilters.name || currentFilters.confirmationNumber;
  const defaultQ =
    String(currentFilters.name || currentFilters.confirmationNumber || '');

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="order-search-form order-search-form--toolbar predictive-search-form"
      aria-label="Search orders"
    >
      <div className="order-search-bar order-search-bar--toolbar">
        <div className="order-search-query-shell">
          <div className="search-drawer-query">
            <span className="search-drawer-query-icon" aria-hidden>
              <Search size={20} strokeWidth={2} />
            </span>
            <input
              type="search"
              name="q"
              placeholder="Search orders…"
              aria-label="Search orders"
              defaultValue={defaultQ}
              className="search-drawer-query-input"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />
            <button
              type="submit"
              disabled={isSearching}
              className="search-drawer-submit order-search-submit"
            >
              {isSearching ? 'Searching…' : 'Search'}
            </button>
          </div>
        </div>
        {hasFilters ? (
          <button
            type="button"
            disabled={isSearching}
            className="order-search-clear order-search-clear--toolbar"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('name');
              next.delete('confirmation_number');
              setSearchParams(next);
              formRef.current?.reset();
            }}
          >
            Clear
          </button>
        ) : null}
      </div>
    </form>
  );
}

/**
 * @param {{order: OrderItemFragment}}
 */
function OrderItem({order, preview, onViewOrder}) {
  const fulfillmentStatus = flattenConnection(order.fulfillments)[0]?.status;
  const previewSearch = preview ? '?preview=1' : '';
  const orderPath = `/account/orders/${btoa(order.id)}${previewSearch}`;
  return (
    <article className="account-order-card">
      <div className="account-order-main">
        <div className="account-order-meta">
          <Link className="account-order-number" to={orderPath}>
            #{order.number}
          </Link>
          <div className="account-order-submeta">
            <span>
              {new Date(order.processedAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
            {order.confirmationNumber ? (
              <span>Confirmation {order.confirmationNumber}</span>
            ) : null}
          </div>
        </div>

        <div className="account-order-status">
          <span className="account-pill">{order.financialStatus}</span>
          {fulfillmentStatus ? (
            <span className="account-pill account-pill-muted">
              {fulfillmentStatus}
            </span>
          ) : null}
        </div>
      </div>

      <div className="account-order-footer">
        <div className="account-order-total">
          <span className="account-order-total-label">Total</span>
          <span className="account-order-total-value">
            <Money data={order.totalPrice} />
          </span>
        </div>
        <button
          type="button"
          className="account-link account-link-button"
          onClick={() => onViewOrder?.(orderPath)}
        >
          View order →
        </button>
      </div>
    </article>
  );
}

function OrderDetailsModal({fetcher, onClose}) {
  const isLoading = fetcher.state !== 'idle';
  const data = fetcher.data;

  return (
    <div className="account-modal-overlay" role="dialog" aria-modal="true">
      <button
        type="button"
        className="account-modal-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="account-modal">
        <div className="account-modal-header">
          <div>
            <h3 className="account-modal-title">
              {data?.order?.name ? `Order ${data.order.name}` : 'Order details'}
            </h3>
            {data?.order?.processedAt ? (
              <p className="account-modal-subtitle">
                Placed on {new Date(data.order.processedAt).toDateString()}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="account-btn account-btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {isLoading && !data ? (
          <div className="account-modal-body">
            <p className="account-muted">Loading…</p>
          </div>
        ) : (
          <div className="account-modal-body">
            {data?.lineItems?.length ? (
              <div className="account-order-table-wrap">
                <table className="account-table">
                  <thead>
                    <tr>
                      <th scope="col">Product</th>
                      <th scope="col">Price</th>
                      <th scope="col">Qty</th>
                      <th scope="col">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lineItems.map((li) => (
                      <tr key={li.id}>
                        <td>{li.title}</td>
                        <td>
                          <Money data={li.price} />
                        </td>
                        <td>{li.quantity}</td>
                        <td>
                          <Money data={li.totalDiscount} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {data.discountPercentage ? (
                      <tr>
                        <th scope="row" colSpan={3}>
                          Discounts
                        </th>
                        <td className="account-table-amount">
                          -{data.discountPercentage}% OFF
                        </td>
                      </tr>
                    ) : null}
                    <tr>
                      <th scope="row" colSpan={3}>
                        Subtotal
                      </th>
                      <td className="account-table-amount">
                        <Money data={data.order.subtotal} />
                      </td>
                    </tr>
                    <tr>
                      <th scope="row" colSpan={3}>
                        Tax
                      </th>
                      <td className="account-table-amount">
                        <Money data={data.order.totalTax} />
                      </td>
                    </tr>
                    <tr>
                      <th scope="row" colSpan={3}>
                        Total
                      </th>
                      <td className="account-table-amount account-table-amount-strong">
                        <Money data={data.order.totalPrice} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="account-muted">No line items.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * @typedef {{
 *   customer: CustomerOrdersFragment;
 *   filters: OrderFilterParams;
 * }} OrdersLoaderData
 */

/** @typedef {import('./+types/account.orders._index').Route} Route */
/** @typedef {import('~/lib/orderFilters').OrderFilterParams} OrderFilterParams */
/** @typedef {import('customer-accountapi.generated').CustomerOrdersFragment} CustomerOrdersFragment */
/** @typedef {import('customer-accountapi.generated').OrderItemFragment} OrderItemFragment */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
