import {useLocation} from 'react-router';
import {useMemo} from 'react';

/**
 * @param {string} handle
 * @param {SelectedOption[]} [selectedOptions]
 * @param {string[] | null} [tags] product tags — routes decorated SKUs to /decorated-products
 */
export function useVariantUrl(handle, selectedOptions, tags) {
  const {pathname} = useLocation();

  return useMemo(() => {
    return getVariantUrl({
      handle,
      pathname,
      searchParams: new URLSearchParams(),
      selectedOptions,
      tags,
    });
  }, [handle, selectedOptions, pathname, tags]);
}

/**
 * @param {{
 *   handle: string;
 *   pathname: string;
 *   searchParams: URLSearchParams;
 *   selectedOptions?: SelectedOption[];
 *   tags?: string[] | null;
 *   pathPrefix?: 'products' | 'decorated-products';
 * }}
 */
export function getVariantUrl({
  handle,
  pathname,
  searchParams,
  selectedOptions,
  tags,
  pathPrefix,
}) {
  const match = /(\/[a-zA-Z]{2}-[a-zA-Z]{2}\/)/g.exec(pathname);
  const isLocalePathname = match && match.length > 0;
  const prefix =
    pathPrefix ||
    (tags?.some((t) => String(t).trim().toLowerCase() === 'fulfillment:decorated') ||
    /-decorated$/i.test(String(handle || ''))
      ? 'decorated-products'
      : 'products');

  const path = isLocalePathname
    ? `${match[0]}${prefix}/${handle}`
    : `/${prefix}/${handle}`;

  selectedOptions?.forEach((option) => {
    searchParams.set(option.name, option.value);
  });

  const searchString = searchParams.toString();

  return path + (searchString ? '?' + searchString : '');
}

/** @typedef {import('@shopify/hydrogen/storefront-api-types').SelectedOption} SelectedOption */
