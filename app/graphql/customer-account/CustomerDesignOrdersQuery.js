/**
 * Recent orders with line customAttributes so we can recover Design Studio
 * packets (_designId / _designPreview) that belonged to this customer.
 */
export const CUSTOMER_DESIGN_ORDERS_QUERY = `#graphql
  query CustomerDesignOrders(
    $first: Int!
    $language: LanguageCode
  ) @inContext(language: $language) {
    customer {
      orders(sortKey: PROCESSED_AT, reverse: true, first: $first) {
        nodes {
          id
          number
          processedAt
          lineItems(first: 50) {
            nodes {
              id
              title
              quantity
              productId
              variantTitle
              image {
                altText
                url
                width
                height
              }
              customAttributes {
                key
                value
              }
            }
          }
        }
      }
    }
  }
`;
