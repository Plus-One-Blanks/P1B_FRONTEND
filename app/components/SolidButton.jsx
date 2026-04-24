import { Link } from 'react-router';

/**
 * Solid pill CTA — default black, or `pastel-sky` to match homepage pastel icon wells.
 * Styles: `app.css` (`.solid-button`, `.solid-button--compact`, `.solid-button--pastel-sky`).
 *
 * @param {{
 *   to?: string;
 *   href?: string;
 *   children: import('react').ReactNode;
 *   className?: string;
 *   compact?: boolean;
 *   variant?: 'default' | 'pastel-sky';
 *   icon?: import('react').ReactNode;
 *   iconPosition?: 'start' | 'end';
 *   prefetch?: import('react-router').LinkProps['prefetch'];
 * } & Omit<import('react').ComponentProps<'a'>, 'href' | 'className' | 'children'>}
 */
export function SolidButton({
  to,
  href,
  children,
  className = '',
  compact = false,
  variant = 'default',
  icon = null,
  iconPosition = 'end',
  prefetch = 'intent',
  ...rest
}) {
  const cls = [
    'solid-button',
    compact && 'solid-button--compact',
    variant === 'pastel-sky' && 'solid-button--pastel-sky',
    className,
  ]
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
