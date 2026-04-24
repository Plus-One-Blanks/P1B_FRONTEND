import {createContext, useContext, useEffect, useState} from 'react';

/**
 * A side bar component with Overlay
 * @example
 * ```jsx
 * <Aside type="search" heading="SEARCH">
 *  <input type="search" />
 *  ...
 * </Aside>
 * ```
 * @param {{
 *   children?: React.ReactNode;
 *   type: AsideType;
 *   heading: React.ReactNode;
 *   placement?: 'right' | 'top';
 * }}
 */
export function Aside({children, heading, type, placement = 'right'}) {
  const {type: activeType, close} = useAside();
  const expanded = type === activeType;
  const isTop = placement === 'top';

  useEffect(() => {
    const abortController = new AbortController();

    if (expanded) {
      if (type === 'cart') {
        document.body.classList.add('cart-open');
      }
      if (type === 'search' && isTop) {
        document.body.classList.add('search-drawer-open');
      }
      document.addEventListener(
        'keydown',
        function handler(event) {
          if (event.key === 'Escape') {
            close();
          }
        },
        {signal: abortController.signal},
      );
    } else {
      if (type === 'cart') {
        document.body.classList.remove('cart-open');
      }
      if (type === 'search' && isTop) {
        document.body.classList.remove('search-drawer-open');
      }
    }
    return () => {
      abortController.abort();
      if (type === 'cart') {
        document.body.classList.remove('cart-open');
      }
      if (type === 'search' && isTop) {
        document.body.classList.remove('search-drawer-open');
      }
    };
  }, [close, expanded, type, isTop]);

  return (
    <div
      aria-modal
      className={`overlay ${expanded ? 'expanded' : ''} ${isTop ? 'overlay--top' : ''}`}
      role="dialog"
      aria-label={isTop ? 'Search' : undefined}
    >
      <button
        type="button"
        className={`close-outside ${isTop ? 'close-outside--top' : ''}`}
        onClick={close}
        aria-label="Close overlay"
      />
      <aside className={isTop ? 'aside--top' : undefined}>
        {heading && (
          <header>
            <h3>{heading}</h3>
            <button className="close reset" onClick={close} aria-label="Close">
              &times;
            </button>
          </header>
        )}
        <main>{children}</main>
      </aside>
    </div>
  );
}

const AsideContext = createContext(null);

Aside.Provider = function AsideProvider({children}) {
  const [type, setType] = useState('closed');

  return (
    <AsideContext.Provider
      value={{
        type,
        open: setType,
        close: () => setType('closed'),
      }}
    >
      {children}
    </AsideContext.Provider>
  );
};

export function useAside() {
  const aside = useContext(AsideContext);
  if (!aside) {
    throw new Error('useAside must be used within an AsideProvider');
  }
  return aside;
}

/** @typedef {'search' | 'cart' | 'mobile' | 'closed'} AsideType */
/**
 * @typedef {{
 *   type: AsideType;
 *   open: (mode: AsideType) => void;
 *   close: () => void;
 * }} AsideContextValue
 */

/** @typedef {import('react').ReactNode} ReactNode */
