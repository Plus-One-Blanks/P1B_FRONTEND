import {redirect} from 'react-router';
import {ALL_PRODUCTS_COLLECTION_HANDLE} from '~/lib/searchDrawerCollection';

/**
 * Legacy storefront path from the Hydrogen scaffold (`/collections/all`).
 * The real catalog is Shopify collection `all-products` — same page as
 * `($locale).collections.$handle.jsx` (featured cards, filters), not the old
 * `products` catalog query + `ProductItem` grid.
 *
 * @param {Route.LoaderArgs} args
 */
export async function loader({params}) {
  const prefix = params?.locale ? `/${params.locale}` : '';
  throw redirect(`${prefix}/collections/${ALL_PRODUCTS_COLLECTION_HANDLE}`);
}

/** Never rendered — loader always redirects. */
export default function CollectionsAllLegacyAlias() {
  return null;
}

/** @typedef {import('./+types/collections.all').Route} Route */
