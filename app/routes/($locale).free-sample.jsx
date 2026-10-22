import {useLoaderData} from 'react-router';
import {FreeSampleFlow} from '~/components/FreeSample/FreeSampleFlow';
import {FREE_SAMPLE_PRODUCT_HANDLE} from '~/lib/freeSampleConstants';

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{title: 'Free Sample Offer | Plus 1 Blanks'}];
};

const FREE_SAMPLE_PRODUCT_QUERY = `#graphql
  query FreeSampleProduct(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      id
      handle
      title
      featuredImage {
        url
        altText
      }
      variants(first: 10) {
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
    const {product} = await storefront.query(FREE_SAMPLE_PRODUCT_QUERY, {
      variables: {handle: FREE_SAMPLE_PRODUCT_HANDLE},
    });
    return {product: product || null};
  } catch (e) {
    console.error('[free-sample] product query failed', e);
    return {product: null};
  }
}

export default function FreeSamplePage() {
  /** @type {{ product: object | null }} */
  const {product} = useLoaderData();
  return <FreeSampleFlow product={product} />;
}

/** @typedef {import('./+types/free-sample').Route} Route */
