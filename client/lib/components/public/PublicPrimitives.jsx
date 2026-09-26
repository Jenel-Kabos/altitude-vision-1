import React from 'react';
import styles from './PublicFoundation.module.css';

export function PublicSite({ children, className = '' }) {
  return <div className={`${styles.publicSite} ${className}`.trim()} data-public-site="true">{children}</div>;
}

export function PublicContainer({ children, className = '' }) {
  return <div className={`${styles.container} ${className}`.trim()}>{children}</div>;
}

export function PublicSection({ children, className = '' }) {
  return <section className={`${styles.section} ${className}`.trim()}>{children}</section>;
}

export function PublicEyebrow({ children }) {
  return <p className={styles.eyebrow}>{children}</p>;
}

export function PublicSectionHeading({ eyebrow, children, lead, onDark = false, as: Heading = 'h2' }) {
  return (
    <div>
      {eyebrow && <PublicEyebrow>{eyebrow}</PublicEyebrow>}
      <Heading className={`${styles.heading} ${onDark ? styles.headingOnDark : ''}`.trim()}>{children}</Heading>
      {lead && <p className={styles.headingLead}>{lead}</p>}
    </div>
  );
}

export function PublicSurface({ children, className = '', ...props }) {
  return <div className={`${styles.surface} ${className}`.trim()} {...props}>{children}</div>;
}

export function PublicButton({ children, variant = 'primary', href, disabled = false, loading = false, className = '', ...props }) {
  const variantClass = {
    primary: styles.buttonPrimary,
    secondary: styles.buttonSecondary,
    text: styles.buttonText,
  }[variant];
  const content = loading ? 'Chargement…' : children;
  const classes = `${styles.button} ${variantClass} ${className}`.trim();

  if (href && !disabled && !loading) {
    return <a href={href} className={classes} data-public-button={variant} {...props}>{content}</a>;
  }

  return (
    <button type="button" className={classes} disabled={disabled || loading} aria-busy={loading}
      data-public-button={variant} {...props}>
      {content}
    </button>
  );
}
