import {useLoaderData} from 'react-router';
import {DtfGangSheetBuilder} from '~/components/DtfGangSheet/DtfGangSheetBuilder';
import {DTF_GANG_SHEET_PRODUCT_HANDLE} from '~/lib/dtfSheetConstants';

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{title: 'Gang sheet studio | Plus 1 Blanks'}];
};

const DTF_GANG_PRODUCT_QUERY = `#graphql
  query DtfGangSheetStudioProduct(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      id
      handle
      title
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
    console.error('[dtf-sheets/studio] product query failed', e);
    return {product: null};
  }
}

/**
 * Full-screen layout tool — opened from Create Design / Upload Now.
 */
export default function DtfGangSheetStudioPage() {
  /** @type {{ product: object | null }} */
  const {product} = useLoaderData();
  return <DtfGangSheetBuilder product={product} />;
}

/** @typedef {import('./+types/dtf-sheets.studio').Route} Route */
