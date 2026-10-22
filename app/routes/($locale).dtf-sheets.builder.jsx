import {useLoaderData} from 'react-router';
import {DtfGangSheetProductPage} from '~/components/DtfGangSheet/DtfGangSheetProductPage';
import {DTF_GANG_SHEET_PRODUCT_HANDLE} from '~/lib/dtfSheetConstants';

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{title: 'DTF Gang Sheet Builder | Plus 1 Blanks'}];
};

const DTF_GANG_PRODUCT_QUERY = `#graphql
  query DtfGangSheetProduct(
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
      images(first: 6) {
        nodes {
          url
          altText
        }
      }
      variants(first: 20) {
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
    const {product} = await storefront.query(DTF_GANG_PRODUCT_QUERY, {
      variables: {handle: DTF_GANG_SHEET_PRODUCT_HANDLE},
    });
    return {product: product || null};
  } catch (e) {
    console.error('[dtf-sheets/builder] product query failed', e);
    return {product: null};
  }
}

/**
 * Product landing (DTFSheet-style): pick size → Create Design / Upload.
 */
export default function DtfGangSheetBuilderLandingPage() {
  /** @type {{ product: object | null }} */
  const {product} = useLoaderData();
  return <DtfGangSheetProductPage product={product} />;
}

/** @typedef {import('./+types/dtf-sheets.builder').Route} Route */
