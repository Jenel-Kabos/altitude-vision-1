'use client';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

/**
 * Breadcrumb — fil d'Ariane cohérent avec le thème sombre.
 *
 * @param {Array<{label: string, href?: string}>} items
 *   Le dernier élément (page courante) n'a pas de href.
 *
 * Usage:
 *   <Breadcrumb items={[
 *     { label: 'Altimmo', href: '/altimmo' },
 *     { label: 'Annonces', href: '/altimmo/annonces' },
 *     { label: 'Villa Résidentielle' },
 *   ]} />
 */
export default function Breadcrumb({ items = [] }) {
  if (items.length < 2) return null;

  return (
    <nav
      aria-label="Fil d'Ariane"
      className="flex items-center gap-1 flex-wrap text-xs"
      style={{ color: 'rgba(232,228,220,0.45)', fontFamily: "'DM Sans', sans-serif" }}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight
                size={12}
                aria-hidden="true"
                style={{ color: 'rgba(232,228,220,0.25)', flexShrink: 0 }}
              />
            )}
            {isLast || !item.href ? (
              <span
                style={{ color: isLast ? '#E8E4DC' : undefined }}
                aria-current={isLast ? 'page' : undefined}
                className="truncate max-w-[180px]"
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="transition-colors hover:text-white truncate max-w-[180px]"
                style={{ color: 'rgba(232,228,220,0.45)' }}
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
