import React from 'react';
import Link from 'next/link';
import { ArrowRight, Bot, Check, Search, SlidersHorizontal } from 'lucide-react';

const EXAMPLES = [
  'Je cherche une maison à louer à Brazzaville.',
  'Montre-moi les terrains disponibles.',
  'Compare les biens correspondant à mon budget.',
  'Je recherche un hébergement meublé.',
];

export default function AssistantPublicDiscovery({ compact = false }) {
  return (
    <section
      id="assistant-ia"
      aria-labelledby="assistant-public-title"
      data-testid="assistant-public-discovery"
      className={`bg-slate-950 text-white ${compact ? 'px-5 py-12' : 'px-5 py-16 sm:px-8 sm:py-20'}`}
    >
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[.16em] text-amber-200">
            <Bot size={15} aria-hidden="true" /> Assistant IA — Bientôt disponible
          </p>
          <h2 id="assistant-public-title" className="font-display text-4xl leading-tight sm:text-5xl">
            Assistant immobilier IA Altimmo
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-slate-200">
            Votre recherche immobilière commence par une conversation.
          </p>
          <p className="mt-3 max-w-2xl leading-7 text-slate-300">
            Décrivez le bien recherché. L’assistant vous aidera à explorer les annonces Altimmo,
            comparer les propriétés et ajuster vos critères. La fonctionnalité conversationnelle
            est actuellement en validation et n’est pas ouverte au public.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/immobilier/annonces" className="inline-flex min-h-11 items-center gap-2 rounded bg-amber-400 px-5 py-3 font-semibold text-slate-950 hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300">
              Voir les annonces <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link href="/immobilier" className="inline-flex min-h-11 items-center rounded border border-white/25 px-5 py-3 font-semibold hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Découvrir Altimmo
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[.06] p-5 sm:p-7">
          <div className="grid gap-3 sm:grid-cols-2">
            {EXAMPLES.map((example) => (
              <div key={example} className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-200">
                <Search className="mb-3 text-amber-300" size={18} aria-hidden="true" />
                « {example} »
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-2 text-sm text-slate-300">
            <p className="flex gap-2"><Check className="mt-0.5 shrink-0 text-emerald-300" size={16} aria-hidden="true" /> Recherche, comparaison et modification des critères.</p>
            <p className="flex gap-2"><SlidersHorizontal className="mt-0.5 shrink-0 text-amber-300" size={16} aria-hidden="true" /> Les suggestions dépendent des annonces publiques accessibles.</p>
            <p className="border-t border-white/10 pt-3 text-xs leading-5 text-slate-400">
              L’assistant accompagne la recherche : il ne réserve pas, ne paie pas et ne garantit pas la disponibilité ou la conclusion d’une transaction.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
