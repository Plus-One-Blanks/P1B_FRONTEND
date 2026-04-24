import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';

/**
 * Inline text link with optional icon — for secondary navigation (e.g. “Shop all …”).
 * Styles: `app.css` (`.text-icon-link`).
 *
 * @param {{
 *   to?: string;
 *   href?: string;
 *   children: import('react').ReactNode;
 *   className?: string;
 *   icon?: import('react').ReactNode | null;
 *   iconPosition?: 'start' | 'end';
 *   prefetch?: import('react-router').LinkProps['prefetch'];
 * } & Omit<import('react').ComponentProps<'a'>, 'href' | 'className' | 'children'>}
 */
export function TextIconLink({
  to,
  href,
  children,
  className = '',
  icon,
  iconPosition = 'end',
  prefetch = 'intent',
  ...rest
}) {
  const cls = ['text-icon-link', className].filter(Boolean).join(' ');

  const iconEl =
    icon === null ? null : (
      icon ?? (
        <ArrowRight className="text-icon-link__icon" size={18} aria-hidden />
      )
    );

  const content = (
    <>
      {iconEl && iconPosition === 'start' ? iconEl : null}
      {children}
      {iconEl && iconPosition === 'end' ? iconEl : null}
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
