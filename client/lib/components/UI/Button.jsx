'use client';

import React from 'react';
import Spinner from './Spinner';

const VARIANTS = {
  gold:      'bg-[var(--gold)] hover:bg-[var(--gold-dark)] text-white shadow-sm hover:shadow-[var(--shadow-gold)]',
  outline:   'border border-[var(--gold)] text-[var(--gold)] hover:bg-[var(--gold)] hover:text-white',
  ghost:     'text-[var(--gold)] hover:bg-[var(--gold-subtle)]',
  secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-800',
  danger:    'bg-red-600 hover:bg-red-700 text-white shadow-sm',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs rounded-md gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-lg gap-2',
  lg: 'px-7 py-3.5 text-base rounded-xl gap-2.5',
};

/**
 * Bouton primitif — remplace les classes btn-gold / btn-outline / btn-ghost de globals.css.
 *
 * @param {'gold'|'outline'|'ghost'|'secondary'|'danger'} variant
 * @param {'sm'|'md'|'lg'} size
 * @param {boolean} loading   Remplace les enfants par un Spinner + désactive le bouton
 * @param {boolean} disabled
 * @param {string}  className Classes supplémentaires
 * @param {React.ReactNode} leftIcon  Icône à gauche du label
 * @param {React.ReactNode} rightIcon Icône à droite du label
 */
const Button = React.forwardRef(({
  variant = 'gold',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  leftIcon,
  rightIcon,
  children,
  ...props
}, ref) => {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      aria-busy={loading}
      aria-disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-2',
        VARIANTS[variant],
        SIZES[size],
        isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer',
        className,
      ].join(' ')}
      {...props}
    >
      {loading ? (
        <Spinner size="xs" label="Chargement…" />
      ) : (
        <>
          {leftIcon && <span aria-hidden="true">{leftIcon}</span>}
          {children}
          {rightIcon && <span aria-hidden="true">{rightIcon}</span>}
        </>
      )}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
