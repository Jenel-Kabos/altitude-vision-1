"use client";

import React from "react";
import { AlertCircle, Inbox, Loader2 } from "lucide-react";

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

export const DashboardPagination = ({ page, totalPages, onPrevious, onNext }) => (
  <nav className="dashboard-pagination" aria-label="Pagination">
    <button type="button" onClick={onPrevious} disabled={page <= 1}>Précédent</button>
    <span>Page {page} sur {totalPages}</span>
    <button type="button" onClick={onNext} disabled={page >= totalPages}>Suivant</button>
  </nav>
);
