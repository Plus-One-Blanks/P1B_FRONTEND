import {Link, useLoaderData} from 'react-router';
import {Image, getPaginationVariables} from '@shopify/hydrogen';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';

/** Shopify blog handle for the feed shown at `/blogs` (create a blog with this URL handle in Admin). */
const NEWS_BLOG_HANDLE = 'news';

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({data}) => {
  const seoTitle = data?.newsBlog?.seo?.title;
  const title = data?.newsBlog?.title;
  if (seoTitle) return [{title: seoTitle}];
  if (title) return [{title: `${title} | Plus 1 Blanks`}];
  return [{title: 'News | Plus 1 Blanks'}];
};

/**
 * @param {Route.LoaderArgs} args
 */
export async function loader(args) {
  const deferredData = loadDeferredData(args);
  const criticalData = await loadCriticalData(args);
  return {...deferredData, ...criticalData};
}

/**
 * @param {Route.LoaderArgs}
 */
async function loadCriticalData({context, request}) {
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 9,
  });

  const [{blog}] = await Promise.all([
    context.storefront.query(NEWS_BLOG_QUERY, {
      variables: {
        blogHandle: NEWS_BLOG_HANDLE,
        ...paginationVariables,
      },
    }),
  ]);

  if (blog?.handle) {
    redirectIfHandleIsLocalized(request, {
      handle: NEWS_BLOG_HANDLE,
      data: blog,
    });
  }

  return {newsBlog: blog};
}

/**
 * @param {Route.LoaderArgs}
 */
function loadDeferredData() {
  return {};
}

export default function Blogs() {
  /** @type {LoaderReturnData} */
  const {newsBlog} = useLoaderData();
  const articles = newsBlog?.articles;

  return (
    <div className="blogs-index-page">
      <header className="blogs-index-hero">
        <div className="blogs-index-hero-inner">
          <p className="blogs-index-eyebrow">Updates</p>
          <h1 className="blogs-index-title">
            {newsBlog?.title ?? 'News'}
          </h1>
          <p className="blogs-index-lede">
            {newsBlog?.seo?.description?.trim() ||
              'Product drops, decoration tips, and wholesale notes from the Plus 1 Blanks team.'}
          </p>
        </div>
      </header>

      <div className="blogs-index-body">
        {!newsBlog ? (
          <div className="blogs-index-empty">
            <p className="blogs-index-empty-title">News is almost here</p>
            <p className="blogs-index-empty-text">
              Add a blog in Shopify Admin with the URL handle{' '}
              <code className="blogs-index-code">{NEWS_BLOG_HANDLE}</code>, then
              publish posts to this blog so they appear here.
            </p>
          </div>
        ) : !articles ? (
          <div className="blogs-index-empty">
            <p className="blogs-index-empty-title">Could not load articles</p>
          </div>
        ) : (
          <PaginatedResourceSection
            connection={articles}
            resourcesClassName="blogs-index-grid"
            wrapperClassName="blogs-index-pagination"
          >
            {({node: article, index}) => (
              <ArticleCard
                article={article}
                key={article.id}
                loading={index < 3 ? 'eager' : 'lazy'}
              />
            )}
          </PaginatedResourceSection>
        )}
      </div>
    </div>
  );
}

/**
 * @param {{
 *   article: NewsBlogArticleFragment;
 *   loading?: HTMLImageElement['loading'];
 * }}
 */
function ArticleCard({article, loading}) {
  const publishedAt = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(article.publishedAt));

  return (
    <article className="blogs-index-card">
      <Link
        className="blogs-index-card-link"
        prefetch="intent"
        to={`/blogs/${article.blog.handle}/${article.handle}`}
      >
        <div className="blogs-index-card-media">
          {article.image ? (
            <Image
              alt={article.image.altText || article.title}
              aspectRatio="4/3"
              className="blogs-index-card-img"
              data={article.image}
              loading={loading}
              sizes="(min-width: 64rem) 28vw, (min-width: 42rem) 42vw, 100vw"
            />
          ) : (
            <div className="blogs-index-card-placeholder" aria-hidden />
          )}
        </div>
        <div className="blogs-index-card-body">
          <time className="blogs-index-card-date" dateTime={article.publishedAt}>
            {publishedAt}
          </time>
          <h2 className="blogs-index-card-title">{article.title}</h2>
          {article.author?.name ? (
            <p className="blogs-index-card-author">{article.author.name}</p>
          ) : null}
        </div>
      </Link>
    </article>
  );
}

const NEWS_BLOG_QUERY = `#graphql
  query NewsBlog(
    $language: LanguageCode
    $blogHandle: String!
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(language: $language) {
    blog(handle: $blogHandle) {
      title
      handle
      seo {
        title
        description
      }
      articles(
        first: $first
        last: $last
        before: $startCursor
        after: $endCursor
      ) {
        nodes {
          ...NewsBlogArticle
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
    }
  }
  fragment NewsBlogArticle on Article {
    id
    handle
    title
    publishedAt
    author: authorV2 {
      name
    }
    image {
      id
      altText
      url
      width
      height
    }
    blog {
      handle
    }
  }
`;

/** @typedef {import('storefrontapi.generated').NewsBlogArticleFragment} NewsBlogArticleFragment */

/** @typedef {import('./+types/blogs._index').Route} Route */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
