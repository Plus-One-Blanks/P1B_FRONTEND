import {useFetcher, useNavigate} from 'react-router';
import React, {useCallback, useRef, useEffect} from 'react';
import {useAside} from './Aside';

export const SEARCH_ENDPOINT = '/search';

/**
 *  Search form component that sends search requests to the `/search` route
 * @param {SearchFormPredictiveProps}
 */
export function SearchFormPredictive({
  children,
  className = 'predictive-search-form',
  onSearchNavigate,
  ...props
}) {
  const fetcher = useFetcher({key: 'search'});
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const aside = useAside();

  /** Navigate to the search page with the current input value */
  const goToSearch = useCallback(() => {
    const raw = inputRef?.current?.value;
    const term = raw != null ? String(raw).trim() : '';
    if (onSearchNavigate) {
      onSearchNavigate(term);
    }
    void navigate(
      SEARCH_ENDPOINT + (term ? `?q=${encodeURIComponent(term)}` : ''),
    );
    aside.close();
  }, [aside, navigate, onSearchNavigate]);

  function handleSubmit(event) {
    event.preventDefault();
    goToSearch();
  }

  /** Fetch search results based on the input value */
  function fetchResults(event) {
    void fetcher.submit(
      {q: event.target.value || '', limit: 10, predictive: true},
      {method: 'GET', action: SEARCH_ENDPOINT},
    );
  }

  // ensure the passed input has a type of search, because SearchResults
  // will select the element based on the input
  useEffect(() => {
    inputRef?.current?.setAttribute('type', 'search');
  }, []);

  if (typeof children !== 'function') {
    return null;
  }

  return (
    <fetcher.Form {...props} className={className} onSubmit={handleSubmit}>
      {children({inputRef, fetcher, fetchResults, goToSearch})}
    </fetcher.Form>
  );
}

/**
 * @typedef {(args: {
 *   fetchResults: (event: React.ChangeEvent<HTMLInputElement>) => void;
 *   goToSearch: () => void;
 *   inputRef: React.MutableRefObject<HTMLInputElement | null>;
 *   fetcher: Fetcher<PredictiveSearchReturn>;
 * }) => React.ReactNode} SearchFormPredictiveChildren
 */
/**
 * @typedef {Omit<FormProps, 'children'> & {
 *   children: SearchFormPredictiveChildren | null;
 *   onSearchNavigate?: (term: string) => void;
 * }} SearchFormPredictiveProps
 */

/** @typedef {import('react-router').FormProps} FormProps */
/** @template T @typedef {import('react-router').Fetcher<T>} Fetcher */
/** @typedef {import('~/lib/search').PredictiveSearchReturn} PredictiveSearchReturn */
