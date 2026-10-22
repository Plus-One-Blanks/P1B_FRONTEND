import {useLoaderData} from 'react-router';
import {DtfTransferBySizePage} from '~/components/DtfGangSheet/DtfTransferBySizePage';
import {DTF_TRANSFER_BY_SIZE_PRODUCT_HANDLE} from '~/lib/dtfSheetConstants';

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{title: 'DTF Transfers by Size | Plus 1 Blanks'}];
};

const DTF_SIZE_PRODUCT_QUERY = `#graphql
  query DtfTransferBySizeProduct(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      id
      handle
      title
      description
      featuredImage {
        url
        altText
      }
      images(first: 8) {
        nodes {
          url
          altText
        }
      }
      variants(first: 40) {
        nodes {
          id
          title
          availableForSale
          price {
            amount
            currencyCode
          }
        }
      }
    }
  }
`;

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context}) {
  const {storefront} = context;
  try {
    const {product} = await storefront.query(DTF_SIZE_PRODUCT_QUERY, {
      variables: {handle: DTF_TRANSFER_BY_SIZE_PRODUCT_HANDLE},
    });
    return {product: product || null};
  } catch (e) {
    console.error('[dtf-sheets/by-size] product query failed', e);
    return {product: null};
  }
}

export default function DtfTransfersBySizeRoute() {
  /** @type {{ product: object | null }} */
  const {product} = useLoaderData();
  return <DtfTransferBySizePage product={product} />;
}

/** @typedef {import('./+types/dtf-sheets.by-size').Route} Route */
