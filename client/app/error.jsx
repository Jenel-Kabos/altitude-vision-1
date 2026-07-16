'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Boundary d'erreur global Next.js App Router.
 * Reçoit `error` (l'erreur JS) et `reset` (retry handler).
 */
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('[GlobalError]', { type: error?.name || 'Error', message: error?.message || 'Erreur de rendu' });
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-[#F8F8F8]">
      <p className="text-6xl mb-6" aria-hidden="true">⚠️</p>

      <h1 className="text-2xl font-bold text-gray-900 mb-3">
        Une erreur est survenue
      </h1>
      <p className="text-gray-500 text-sm max-w-md leading-relaxed mb-8">
        La page n’a pas pu être affichée. Vous pouvez réessayer ou retourner à l’accueil.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={reset}
          className="px-6 py-3 bg-[var(--gold)] text-white font-semibold rounded-xl hover:bg-[var(--gold-dark)] transition-colors text-sm"
        >
          Réessayer
        </button>
        <Link
          href="/"
          className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:border-gray-400 transition-colors text-sm"
        >
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
