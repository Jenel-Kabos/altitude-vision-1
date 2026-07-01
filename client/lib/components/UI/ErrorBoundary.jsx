'use client';

import React from 'react';

/**
 * ErrorBoundary — piège les erreurs JS dans l'arbre enfant.
 * Doit être un composant classe (exigence React).
 * Usage : <ErrorBoundary fallback={<p>Erreur</p>}><MonComposant /></ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback({ error: this.state.error, reset: this.reset })
          : this.props.fallback;
      }

      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center py-16 px-6 text-center"
        >
          <p className="text-4xl mb-4" aria-hidden="true">⚠️</p>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            Une erreur est survenue
          </h2>
          <p className="text-sm text-gray-500 mb-6 max-w-sm">
            Ce bloc n'a pas pu s'afficher. Vous pouvez réessayer ou revenir à l'accueil.
          </p>
          <button
            onClick={this.reset}
            className="px-5 py-2.5 bg-[var(--gold)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--gold-dark)] transition-colors"
          >
            Réessayer
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
