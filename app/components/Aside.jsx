import {createContext, useContext, useEffect, useState} from 'react';
import {X} from 'lucide-react';

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
 *   placement?: 'right' | 'left' | 'top';
 * }}
 */
export function Aside({children, heading, type, placement = 'right'}) {
  const {type: activeType, close} = useAside();
  const expanded = type === activeType;
  const isTop = placement === 'top';
  const isLeft = placement === 'left';
  const isMobile = type === 'mobile';

  useEffect(() => {
    const abortController = new AbortController();

    if (expanded) {
      if (type === 'cart') {
        document.body.classList.add('cart-open');
      }
      if (type === 'search' && isTop) {
        document.body.classList.add('search-drawer-open');
      }
      if (type === 'mobile') {
        document.body.classList.add('mobile-menu-open');
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
      if (type === 'mobile') {
        document.body.classList.remove('mobile-menu-open');
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
      if (type === 'mobile') {
        document.body.classList.remove('mobile-menu-open');
      }
    };
  }, [close, expanded, type, isTop]);

  return (
    <div
      aria-modal
      className={[
        'overlay',
        expanded && 'expanded',
        isTop && 'overlay--top',
        isLeft && 'overlay--left',
        isMobile && 'overlay--mobile',
      ]
        .filter(Boolean)
        .join(' ')}
      role="dialog"
      aria-label={
        isTop ? 'Search' : isMobile ? 'Main menu' : undefined
      }
    >
      <button
        type="button"
        className={[
          'close-outside',
          isTop && 'close-outside--top',
          isLeft && 'close-outside--left',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={close}
        aria-label="Close overlay"
      />
      <aside
        className={[
          isTop && 'aside--top',
          isLeft && 'aside--left',
          isMobile && 'aside--mobile',
        ]
          .filter(Boolean)
          .join(' ') || undefined}
      >
        {heading && (
          <header className={isMobile ? 'aside-mobile-header' : undefined}>
            {isMobile ? (
              <>
                <div className="aside-header-brand header-top-brand">
                  {heading}
                </div>
                <div className="aside-mobile-header-end header-top-end">
                  <button
                    type="button"
                    className="aside-mobile-close header-icon-btn reset"
                    onClick={close}
                    aria-label="Close menu"
                  >
                    <X
                      className="aside-mobile-close-icon"
                      size={22}
                      strokeWidth={2}
                      aria-hidden
                    />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="aside-header-brand">{heading}</div>
                <button
                  type="button"
                  className="close reset"
                  onClick={close}
                  aria-label="Close"
                >
                  ×
                </button>
              </>
            )}
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
