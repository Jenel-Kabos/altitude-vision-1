"use client";

import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, ChevronDown, Inbox, Loader2, MoreHorizontal } from "lucide-react";

export const DashboardPage = ({ children, className = "", ...props }) => (
  <div className={`dashboard-page ${className}`.trim()} {...props}>{children}</div>
);

export const DashboardPageHeader = ({ icon: Icon, title, description, actions, eyebrow }) => (
  <header className="dashboard-page-header">
    <div className="dashboard-page-heading">
      {Icon && <span className="dashboard-page-icon" aria-hidden="true"><Icon /></span>}
      <div>
        {eyebrow && <p className="dashboard-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
    </div>
    {actions && <div className="dashboard-header-actions">{actions}</div>}
  </header>
);

export const DashboardToolbar = ({ children, className = "", label = "Filtres et actions" }) => (
  <section className={`dashboard-toolbar ${className}`.trim()} aria-label={label}>{children}</section>
);

export const DashboardCard = ({ children, className = "", ...props }) => (
  <section className={`dashboard-card ${className}`.trim()} {...props}>{children}</section>
);

export const DashboardSection = ({ title, description, actions, children, className = "", as: Tag = "section" }) => (
  <Tag className={`dashboard-section ${className}`.trim()}>
    {(title || description || actions) && <div className="dashboard-section-header">
      <div>{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div>
      {actions && <div className="dashboard-section-actions">{actions}</div>}
    </div>}
    {children}
  </Tag>
);

export const DashboardKpiGrid = ({ children, className = "" }) => (
  <div className={`dashboard-kpi-grid ${className}`.trim()}>{children}</div>
);

export const DashboardKpiCard = ({ label, value, icon: Icon, tone = "blue", detail }) => (
  <article className={`dashboard-kpi-card dashboard-tone-${tone}`}>
    <div className="dashboard-kpi-label">{Icon && <Icon aria-hidden="true" />}{label}</div>
    <p className="dashboard-kpi-value">{value ?? "—"}</p>
    {detail && <p className="dashboard-kpi-detail">{detail}</p>}
  </article>
);

export const DashboardBadge = ({ children, tone = "neutral", className = "" }) => (
  <span className={`dashboard-status-badge dashboard-badge-${tone} ${className}`.trim()}>{children}</span>
);

export const DashboardTabs = ({ tabs, value, onChange, label = "Sections" }) => (
  <div className="dashboard-tabs" role="tablist" aria-label={label}>
    {tabs.map((tab) => {
      const Icon = tab.icon;
      return <button key={tab.value} type="button" role="tab" aria-selected={value === tab.value}
        onClick={() => onChange(tab.value)}>{Icon && <Icon aria-hidden="true" />}{tab.label}</button>;
    })}
  </div>
);

export const DashboardSkeleton = ({ count = 4, className = "" }) => (
  <div className={`dashboard-skeleton-grid ${className}`.trim()} role="status" aria-label="Chargement en cours">
    {Array.from({ length: count }, (_, index) => <span key={index} className="dashboard-skeleton" />)}
  </div>
);

export const DashboardContextSwitcher = ({ label = "Espace de travail", value, options, onChange, loading = false }) => (
  <label className="dashboard-context-switcher">
    <span>{label}</span>
    <span className="dashboard-context-select">
      <select aria-label={label} value={value || ""} disabled={loading || options.length < 2}
        onChange={(event) => onChange(event.target.value)}>
        {loading && <option value="">Chargement…</option>}
        {!loading && options.length === 0 && <option value="">Aucun espace disponible</option>}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <ChevronDown aria-hidden="true" />
    </span>
  </label>
);

export const DashboardActionMenu = ({ label = "Plus d’actions", items = [], align = "right" }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div className="dashboard-action-menu" ref={rootRef}>
    <button type="button" className="dashboard-icon-button" aria-label={label} aria-expanded={open}
      aria-haspopup="menu" onClick={() => setOpen((current) => !current)}><MoreHorizontal aria-hidden="true" /></button>
    {open && <div className={`dashboard-action-popover dashboard-action-${align}`} role="menu">
      {items.map((item) => {
        const Icon = item.icon;
        return item.href
          ? <a key={item.label} href={item.href} role="menuitem" className={item.danger ? "is-danger" : ""}
              onClick={() => setOpen(false)}>{Icon && <Icon aria-hidden="true" />}{item.label}</a>
          : <button key={item.label} type="button" role="menuitem" className={item.danger ? "is-danger" : ""}
              disabled={item.disabled} onClick={() => { setOpen(false); item.onSelect?.(); }}>{Icon && <Icon aria-hidden="true" />}{item.label}{item.selected && <Check aria-hidden="true" />}</button>;
      })}
    </div>}
  </div>;
};

export const DashboardTableContainer = ({ children, label, className = "" }) => (
  <div className={`dashboard-table-container ${className}`.trim()} role="region" aria-label={label} tabIndex="0">
    {children}
  </div>
);

export const DashboardState = ({ type = "empty", title, description, action }) => {
  const Icon = type === "loading" ? Loader2 : type === "error" ? AlertCircle : Inbox;
  return (
    <div className={`dashboard-state dashboard-state-${type}`} role={type === "loading" ? "status" : type === "error" ? "alert" : undefined} aria-live="polite">
      <span className="dashboard-state-icon" aria-hidden="true"><Icon className={type === "loading" ? "animate-spin" : ""} /></span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
};

export const DashboardPagination = ({ page, totalPages, onPrevious, onNext, previousAriaLabel, nextAriaLabel }) => (
  <nav className="dashboard-pagination" aria-label="Pagination">
    <button type="button" aria-label={previousAriaLabel} onClick={onPrevious} disabled={page <= 1}>Précédent</button>
    <span>Page {page} sur {totalPages}</span>
    <button type="button" aria-label={nextAriaLabel} onClick={onNext} disabled={page >= totalPages}>Suivant</button>
  </nav>
);
