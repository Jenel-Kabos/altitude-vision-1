import Link from 'next/link';

export const metadata = {
  title: 'Page introuvable — Altitude Vision',
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-[#F8F8F8]">
      <p className="text-8xl font-bold text-gray-100 select-none mb-2" aria-hidden="true">404</p>

      <h1 className="text-2xl font-bold text-gray-900 mb-3">
        Page introuvable
      </h1>
      <p className="text-gray-500 text-sm max-w-sm leading-relaxed mb-8">
        La page que vous recherchez n'existe pas ou a été déplacée.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="px-6 py-3 bg-[var(--gold)] text-white font-semibold rounded-xl hover:bg-[var(--gold-dark)] transition-colors text-sm"
        >
          Retour à l'accueil
        </Link>
        <Link
          href="/altimmo"
          className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:border-gray-400 transition-colors text-sm"
        >
          Voir les biens
        </Link>
      </div>
    </div>
  );
}
