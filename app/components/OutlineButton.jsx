import { Link } from 'react-router';

/**
 * Outline pill / secondary CTA — white fill, black border; hover inverts to black + white text.
 * Styles: `app.css` (`.outline-button`, `.outline-button--compact`).
 *
 * @param {{
 *   to?: string;
 *   href?: string;
 *   children: import('react').ReactNode;
 *   className?: string;
 *   compact?: boolean;
 *   icon?: import('react').ReactNode;
 *   iconPosition?: 'start' | 'end';
 *   prefetch?: import('react-router').LinkProps['prefetch'];
 * } & Omit<import('react').ComponentProps<'a'>, 'href' | 'className' | 'children'>}
 */
export function OutlineButton({
  to,
  href,
  children,
  className = '',
  compact = false,
  icon = null,
  iconPosition = 'end',
  prefetch = 'intent',
  ...rest
}) {
  const cls = ['outline-button', compact && 'outline-button--compact', className]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {icon && iconPosition === 'start' ? icon : null}
      {children}
      {icon && iconPosition === 'end' ? icon : null}
    </>
  );

  if (href) {
    return (
      <a href={href} className={cls} {...rest}>
        {content}
      </a>
    );
  }

  return (
    <Link to={to ?? '/'} className={cls} prefetch={prefetch} {...rest}>
      {content}
    </Link>
  );
}
