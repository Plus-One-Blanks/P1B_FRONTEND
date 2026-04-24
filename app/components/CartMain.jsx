import { closestCenter, DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useOptimisticCart } from '@shopify/hydrogen';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useAside } from '~/components/Aside';
import { CartLineItem } from '~/components/CartLineItem';
import { groupCartLinesForPageDisplay } from '~/lib/cartEditSizes';
import {
  applyStoredGroupOrder,
  groupKeyForLineGroup,
  persistGroupOrder,
} from '~/lib/cartPageGroupOrder';
import { CartSummary } from './CartSummary';

/**
 * One grouped cart row: sortable shell + line content (grip holds dnd listeners only).
 * @param {{
 *   group: import('storefrontapi.generated').CartLine[];
 *   cart: import('storefrontapi.generated').CartApiQueryFragment | null;
 *   pageGroupIndex: number;
 * }} props
 */
function CartPageGroupedLineItem({ group, cart, pageGroupIndex }) {
  const gid = group.map((l) => l.id).join('::');
  const groupKey = useMemo(() => {
    const k = groupKeyForLineGroup(group);
    return k || gid;
  }, [gid, group]);

  const disabled = group.some((l) => l.isOptimistic);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: groupKey,
    disabled: disabled || !groupKey,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={
        'cart-line cart-line--page cart-page-sortable-row' +
        (isDragging ? ' cart-page-sortable-row--dragging' : '')
      }
    >
      <CartLineItem
        layout="page"
        lines={group}
        cart={cart}
        pageGroupIndex={pageGroupIndex}
        pageSortableGrip={{ listeners, attributes, isDragging }}
      />
    </li>
  );
}

/**
 * The main cart component that displays the cart items and summary.
 * It is used by both the /cart route and the cart aside dialog.
 * @param {CartMainProps}
 */
export function CartMain({ layout, cart: originalCart }) {
  const cart = useOptimisticCart(originalCart);
  const { close } = useAside();

  const groupedForPage = useMemo(
    () => groupCartLinesForPageDisplay(cart?.lines?.nodes ?? []),
    [cart?.lines?.nodes],
  );
  const cartId = cart?.id ?? '';

  const [pageDisplayGroups, setPageDisplayGroups] = useState(groupedForPage);
  const [pageListDragging, setPageListDragging] = useState(false);
  const pageDisplayGroupsRef = useRef(pageDisplayGroups);
  pageDisplayGroupsRef.current = pageDisplayGroups;

  const sortableIds = useMemo(
    () =>
      pageDisplayGroups
        .map((g) => {
          const k = groupKeyForLineGroup(g);
          return k || g.map((l) => l.id).join('::');
        })
        .filter(Boolean),
    [pageDisplayGroups],
  );

  useEffect(() => {
    setPageDisplayGroups(applyStoredGroupOrder(groupedForPage, cartId));
  }, [groupedForPage, cartId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleCartPageDragStart = useCallback(() => {
    setPageListDragging(true);
  }, []);

  const handleCartPageDragEnd = useCallback(
    (event) => {
      setPageListDragging(false);
      const { active, over } = event;
      if (!over) return;

      if (active.id !== over.id) {
        const keyOrder = pageDisplayGroupsRef.current.map((g) => {
          const k = groupKeyForLineGroup(g);
          return k || g.map((l) => l.id).join('::');
        });
        const oldIndex = keyOrder.indexOf(String(active.id));
        const newIndex = keyOrder.indexOf(String(over.id));
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

        setPageDisplayGroups((items) => {
          const next = arrayMove(items, oldIndex, newIndex);
          persistGroupOrder(next, cartId);
          return next;
        });
      }
    },
    [cartId],
  );

  const handleCartPageDragCancel = useCallback(() => {
    setPageListDragging(false);
  }, []);

  const linesCount = Boolean(cart?.lines?.nodes?.length || 0);
  const withDiscount =
    cart && Boolean(cart?.discountCodes?.filter((code) => code.applicable)?.length);
  const className = `cart-main ${layout === 'page' ? 'cart-main--page' : ''} ${withDiscount ? 'with-discount' : ''}`;
  const cartHasItems = cart?.totalQuantity ? cart.totalQuantity > 0 : false;
  const totalQuantity = cart?.totalQuantity || 0;

  if (layout === 'aside') {
    return (
      <div className="cart-aside-wrapper">
        <div className="cart-aside-content">
          <div className="cart-aside-header">
            <h3 className="cart-aside-title">SHOPPING CART ({totalQuantity})</h3>
            <button className="cart-aside-close" onClick={close} aria-label="Close">
              ×
            </button>
          </div>
          <div className={className}>
            <CartEmpty hidden={linesCount} layout={layout} />
            <div className="cart-details">
              <div className="cart-lines-container" aria-labelledby="cart-lines">
                <ul className="cart-lines-list">
                  {(cart?.lines?.nodes ?? []).map((line) => (
                    <CartLineItem key={line.id} line={line} layout={layout} cart={cart} />
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {cartHasItems && (
          <div className="cart-summary-footer">
            <CartSummary cart={cart} layout={layout} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      {!linesCount ? (
        <header className="cart-page-header">
          <h1 className="cart-page-title" id="cart-page-heading">
            Cart{totalQuantity > 0 ? ` (${totalQuantity})` : ''}
          </h1>
        </header>
      ) : null}

      <CartEmpty hidden={linesCount} layout={layout} />

      {linesCount ? (
        <>
          <div className="cart-page-layout">
            <div className="cart-page-left">
              <h1 className="cart-page-title" id="cart-page-heading">
                Cart{totalQuantity > 0 ? ` (${totalQuantity})` : ''}
              </h1>
              <p className="cart-page-drag-hint" id="cart-page-drag-hint">
                Drag the grip to reorder your cart groups.
              </p>
              <div className="cart-page-main">
                <div className="cart-page-lines-card">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleCartPageDragStart}
                    onDragEnd={handleCartPageDragEnd}
                    onDragCancel={handleCartPageDragCancel}
                  >
                    <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                      <ul
                        className={
                          'cart-lines-list cart-lines-list--page cart-page-sortable-list' +
                          (pageListDragging ? ' cart-page-sortable-list--dragging' : '')
                        }
                        id="cart-lines"
                        aria-label="Cart line items"
                        aria-describedby="cart-page-drag-hint"
                      >
                        {pageDisplayGroups.map((group, pageGroupIndex) => (
                          <CartPageGroupedLineItem
                            key={group.map((l) => l.id).join('::')}
                            group={group}
                            cart={cart}
                            pageGroupIndex={pageGroupIndex}
                          />
                        ))}
                      </ul>
                    </SortableContext>
                  </DndContext>
                </div>
              </div>
            </div>
            <aside className="cart-page-sidebar" aria-labelledby="cart-summary">
              <CartSummary cart={cart} layout={layout} />
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * @param {{
 *   hidden: boolean;
 *   layout?: CartMainProps['layout'];
 * }}
 */
function CartEmpty({ hidden = false, layout }) {
  const { close } = useAside();
  return (
    <div hidden={hidden} className={layout === 'page' ? 'cart-page-empty' : undefined}>
      <p className="cart-page-empty-text">
        Looks like you haven&rsquo;t added anything yet. Let&rsquo;s get you started.
      </p>
      <Link className="cart-page-empty-cta" to="/collections" onClick={close} prefetch="viewport">
        Continue shopping
      </Link>
    </div>
  );
}

/** @typedef {'page' | 'aside'} CartLayout */
/**
 * @typedef {{
 *   cart: CartApiQueryFragment | null;
 *   layout: CartLayout;
 * }} CartMainProps
 */

/** @typedef {import('storefrontapi.generated').CartApiQueryFragment} CartApiQueryFragment */
