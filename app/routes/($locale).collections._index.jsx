import { useLoaderData } from 'react-router';
import { CollectionSection } from '~/components/CollectionSection';
import { HomeContactCta } from '~/components/HomeContactCta';
import { buildSiblingColorDataByProductId } from '~/lib/productGroupColorData';
import { loadFiveCategorySnippetCollections } from '~/lib/categoryCollectionSnippets.server';

/**
 * Catalog landing `/collections`: same curated category snippets as homepage.
 *
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{ title: 'Shop by category | Plus 1 Blanks' }];
};

/**
 * @param {Route.LoaderArgs} args
 */
export async function loader(args) {
  const { context } = args;
  const snippetBundles =
    await loadFiveCategorySnippetCollections(context.storefront);
  const productSiblingColorData = await buildSiblingColorDataByProductId(
    context.storefront,
    snippetBundles.sectionProductsForSiblingColors,
  );

  return {
    tshirtsCollection: snippetBundles.tshirtsCollection,
    sweatshirtsCollection: snippetBundles.sweatshirtsCollection,
    longSleeveTshirtsCollection: snippetBundles.longSleeveTshirtsCollection,
    polosCollection: snippetBundles.polosCollection,
    hatsCollection: snippetBundles.hatsCollection,
    productSiblingColorData,
  };
}

export default function CollectionsIndex() {
  /** @type {LoaderReturnData} */
  const data = useLoaderData();

  return (
    <>
      <div className="collections-index">
        {/* Same horizontal inset as homepage .collection-section (shared class) */}
        <header className="collections-index-header collection-section-inset">
          <h1 id="collections-index-heading" className="home-hero-title">
            Shop by category
          </h1>
          <p className="home-hero-lede">
            Browse our main collections—same highlights as on the homepage.
          </p>
        </header>
        {data.tshirtsCollection && (
          <CollectionSection
            title="T-Shirts"
            shopAllLabel="Shop All T-Shirts"
            collection={data.tshirtsCollection}
            siblingColorDataByProductId={data.productSiblingColorData}
          />
        )}
        {data.sweatshirtsCollection && (
          <CollectionSection
            title="Sweatshirts"
            shopAllLabel="Shop All Sweatshirts"
            collection={data.sweatshirtsCollection}
            siblingColorDataByProductId={data.productSiblingColorData}
          />
        )}
        {data.longSleeveTshirtsCollection && (
          <CollectionSection
            title="Long Sleeve T-Shirts"
            shopAllLabel="Shop All Longsleeves"
            collection={data.longSleeveTshirtsCollection}
            siblingColorDataByProductId={data.productSiblingColorData}
          />
        )}
        {data.polosCollection && (
          <CollectionSection
            title="Polos"
            shopAllLabel="Shop All Polos"
            collection={data.polosCollection}
            siblingColorDataByProductId={data.productSiblingColorData}
          />
        )}
        {data.hatsCollection && (
          <CollectionSection
            title="Hats"
            shopAllLabel="Shop All Hats"
            collection={data.hatsCollection}
            siblingColorDataByProductId={data.productSiblingColorData}
          />
        )}
      </div>
      <HomeContactCta />
    </>
  );
}

/** @typedef {import('./+types/collections._index').Route} Route */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
