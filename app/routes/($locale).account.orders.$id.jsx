import {redirect, useLoaderData, Link} from 'react-router';
import {Money, Image} from '@shopify/hydrogen';
import {CUSTOMER_ORDER_QUERY} from '~/graphql/customer-account/CustomerOrderQuery';
import {fromBase64} from '~/lib/base64';
import {guardCustomerAccountAuth} from '~/lib/customerAccountAuth';
import {
  buildDesignReorderUrl,
  readDesignFromLineAttributes,
} from '~/lib/designOrderAttributes';

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({data}) => {
  return [{title: `Order ${data?.order?.name}`}];
};

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({params, request, context}) {
  const {customerAccount} = context;
  if (!params.id) {
    return redirect('/account/orders');
  }

  const url = new URL(request.url);
  const previewParam = url.searchParams.get('preview');
  const runtimeNodeEnv =
    typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined;
  const envNodeEnv = context?.env?.NODE_ENV;
  const isDev = envNodeEnv !== 'production' && runtimeNodeEnv !== 'production';
  const isPreviewRequested =
    previewParam === '1' || previewParam === 'true' || previewParam === 'yes';
  const isPreview = Boolean(isDev && isPreviewRequested);

  const orderId = fromBase64(params.id);

  if (isPreview) {
    const mkMoney = (amount) => ({amount: String(amount), currencyCode: 'USD'});

    const order = {
      id: orderId,
      name: `#${orderId.includes('1001') ? '1001' : orderId.includes('1002') ? '1002' : '1003'}`,
      confirmationNumber: 'P1B-PREVIEW',
      statusPageUrl: 'https://example.com',
      fulfillmentStatus: 'FULFILLED',
      processedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      fulfillments: {nodes: [{status: 'DELIVERED'}]},
      totalTax: mkMoney('12.40'),
      totalPrice: mkMoney('186.40'),
      subtotal: mkMoney('174.00'),
      shippingAddress: {
        name: 'Preview Customer',
        formatted: 'Preview Customer\n123 Brand St\nLos Angeles CA 90001\nUnited States',
        formattedArea: 'Los Angeles CA 90001',
      },
      discountApplications: {
        nodes: [
          {
            value: {
              __typename: 'PricingPercentageValue',
              percentage: 10,
            },
          },
        ],
      },
      lineItems: {
        nodes: [
          {
            id: 'gid://shopify/LineItem/preview-1',
            title: 'Classic Tee',
            quantity: 2,
            price: mkMoney('32.00'),
            discountAllocations: [],
            totalDiscount: mkMoney('0.00'),
            image: {
              altText: 'Classic Tee',
              height: 800,
              width: 800,
              id: 'gid://shopify/Image/preview-1',
              url: 'https://cdn.shopify.com/s/files/1/0000/0001/files/placeholder.png',
            },
            variantTitle: 'Black / M',
          },
          {
            id: 'gid://shopify/LineItem/preview-2',
            title: 'Heavyweight Hoodie',
            quantity: 1,
            price: mkMoney('110.00'),
            discountAllocations: [],
            totalDiscount: mkMoney('0.00'),
            image: {
              altText: 'Heavyweight Hoodie',
              height: 800,
              width: 800,
              id: 'gid://shopify/Image/preview-2',
              url: 'https://cdn.shopify.com/s/files/1/0000/0001/files/placeholder.png',
            },
            variantTitle: 'Heather / L',
          },
        ],
      },
    };

    const lineItems = order.lineItems.nodes;
    const discountApplications = order.discountApplications.nodes;
    const fulfillmentStatus = order.fulfillments.nodes[0]?.status ?? 'N/A';
    const firstDiscount = discountApplications[0]?.value;
    const discountValue =
      firstDiscount?.__typename === 'MoneyV2' ? firstDiscount : null;
    const discountPercentage =
      firstDiscount?.__typename === 'PricingPercentageValue'
        ? firstDiscount.percentage
        : null;

    return {
      order,
      lineItems,
      discountValue,
      discountPercentage,
      fulfillmentStatus,
      preview: true,
    };
  }

  const authRedirect = await guardCustomerAccountAuth(customerAccount);
  if (authRedirect) {
    return authRedirect;
  }

  const {data, errors} = await customerAccount.query(CUSTOMER_ORDER_QUERY, {
    variables: {
      orderId,
      language: customerAccount.i18n.language,
    },
  });

  if (errors?.length || !data?.order) {
    throw new Error('Order not found');
  }

  const {order} = data;

  // Extract line items directly from nodes array
  const lineItems = order.lineItems.nodes;

  // Extract discount applications directly from nodes array
  const discountApplications = order.discountApplications.nodes;

  // Get fulfillment status from first fulfillment node
  const fulfillmentStatus = order.fulfillments.nodes[0]?.status ?? 'N/A';

  // Get first discount value with proper type checking
  const firstDiscount = discountApplications[0]?.value;

  // Type guard for MoneyV2 discount
  const discountValue =
    firstDiscount?.__typename === 'MoneyV2' ? firstDiscount : null;

  // Type guard for percentage discount
  const discountPercentage =
    firstDiscount?.__typename === 'PricingPercentageValue'
      ? firstDiscount.percentage
      : null;

  return {
    order,
    lineItems,
    discountValue,
    discountPercentage,
    fulfillmentStatus,
  };
}

export default function OrderRoute() {
  /** @type {LoaderReturnData} */
  const {
    order,
    lineItems,
    discountValue,
    discountPercentage,
    fulfillmentStatus,
  } = useLoaderData();
  return (
    <div className="account-section">
      <div className="account-section-header">
        <h2 className="account-section-title">Order {order.name}</h2>
        <p className="account-section-subtitle">
          Placed on {new Date(order.processedAt).toDateString()}
          {order.confirmationNumber
            ? ` · Confirmation ${order.confirmationNumber}`
            : ''}
        </p>
      </div>

      <div className="account-card">
        <div className="account-order-details-grid">
          <div className="account-order-table-wrap">
            <table className="account-table">
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col">Price</th>
              <th scope="col">Quantity</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((lineItem, lineItemIndex) => (
              // eslint-disable-next-line react/no-array-index-key
              <OrderLineRow key={lineItemIndex} lineItem={lineItem} />
            ))}
          </tbody>
          <tfoot>
            {((discountValue && discountValue.amount) ||
              discountPercentage) && (
              <tr>
                <th scope="row" colSpan={3}>
                  Discounts
                </th>
                <td className="account-table-amount">
                  {discountPercentage ? (
                    <span>-{discountPercentage}% OFF</span>
                  ) : (
                    discountValue && <Money data={discountValue} />
                  )}
                </td>
              </tr>
            )}
            <tr>
              <th scope="row" colSpan={3}>
                Subtotal
              </th>
              <td className="account-table-amount">
                <Money data={order.subtotal} />
              </td>
            </tr>
            <tr>
              <th scope="row" colSpan={3}>
                Tax
              </th>
              <td className="account-table-amount">
                <Money data={order.totalTax} />
              </td>
            </tr>
            <tr>
              <th scope="row" colSpan={3}>
                Total
              </th>
              <td className="account-table-amount account-table-amount-strong">
                <Money data={order.totalPrice} />
              </td>
            </tr>
          </tfoot>
            </table>
          </div>

          <aside className="account-order-side">
            <div className="account-card account-card-nested">
              <h3 className="account-card-title">Shipping address</h3>
              {order?.shippingAddress ? (
                <address className="account-address-block">
                  <p className="account-address-name">
                    {order.shippingAddress.name}
                  </p>
                  {order.shippingAddress.formatted ? (
                    <p>{order.shippingAddress.formatted}</p>
                  ) : null}
                  {order.shippingAddress.formattedArea ? (
                    <p>{order.shippingAddress.formattedArea}</p>
                  ) : null}
                </address>
              ) : (
                <p className="account-muted">No shipping address defined.</p>
              )}
            </div>

            <div className="account-card account-card-nested">
              <h3 className="account-card-title">Status</h3>
              <p>
                <span className="account-pill">{fulfillmentStatus}</span>
              </p>
            </div>
          </aside>
        </div>
      </div>

      <div className="account-section-footer">
        <a
          className="account-link"
          target="_blank"
          href={order.statusPageUrl}
          rel="noreferrer"
        >
          View order status →
        </a>
      </div>
    </div>
  );
}

/**
 * @param {{lineItem: OrderLineItemFullFragment}}
 */
function OrderLineRow({lineItem}) {
  const design = readDesignFromLineAttributes(lineItem.customAttributes);
  const thumbUrl = design?.previewUrl || lineItem?.image?.url || null;
  const reorderUrl = design
    ? buildDesignReorderUrl(design.productHandle, design.id)
    : null;

  return (
    <tr key={lineItem.id}>
      <td>
        <div className="account-order-line">
          {thumbUrl ? (
            <div className="account-order-line-image">
              {design?.previewUrl ? (
                <img
                  src={design.previewUrl}
                  alt=""
                  width={96}
                  height={96}
                  loading="lazy"
                  decoding="async"
                />
              ) : lineItem?.image ? (
                <Image data={lineItem.image} width={96} height={96} />
              ) : null}
            </div>
          ) : null}
          <div className="account-order-line-text">
            <p className="account-order-line-title">{lineItem.title}</p>
            {lineItem.variantTitle ? (
              <small className="account-muted">{lineItem.variantTitle}</small>
            ) : null}
            {design ? (
              <div className="account-order-line-design">
                <span className="account-order-line-design-label">
                  Decorated design
                  {design.color ? ` · ${design.color}` : ''}
                </span>
                {reorderUrl ? (
                  <Link to={reorderUrl} className="account-order-line-reorder">
                    Reorder
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </td>
      <td>
        <Money data={lineItem.price} />
      </td>
      <td>{lineItem.quantity}</td>
      <td>
        <Money data={lineItem.totalDiscount} />
      </td>
    </tr>
  );
}

/** @typedef {import('./+types/account.orders.$id').Route} Route */
/** @typedef {import('customer-accountapi.generated').OrderLineItemFullFragment} OrderLineItemFullFragment */
/** @typedef {import('customer-accountapi.generated').OrderQuery} OrderQuery */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
