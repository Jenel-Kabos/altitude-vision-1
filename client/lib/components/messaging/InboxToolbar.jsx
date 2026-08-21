"use client";

// INBOX-PRO-2 — barre compacte (mandat §10). Recherche : purement
// frontend sur les messages déjà chargés pour le dossier actif — AUCUNE
// API de recherche serveur n'existe (vérifié en audit, INBOX_PRO2_UX_AUDIT.md
// §1) ; documenté comme `BACKEND SEARCH REQUIRED` plutôt que de prétendre
// une recherche globale sur toute la boîte (mandat §11).
import { Loader2, RefreshCw, Search } from 'lucide-react';

const FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: 'unread', label: 'Non lus' },
  { id: 'attachments', label: 'Avec pièce jointe' },
];

export default function InboxToolbar({
  title, searchTerm, onSearchChange, filter, onFilterChange, onRefresh, refreshing,
}) {
  return (
    <div className="flex flex-col gap-2 px-3 py-2.5 border-b border-gray-200 bg-white flex-shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-bold text-gray-800 whitespace-nowrap">{title}</h1>
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher dans ce dossier..."
            aria-label="Rechercher dans ce dossier"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg flex-shrink-0 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Actualiser"
          title="Actualiser"
        >
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </button>
      </div>
      <div className="flex items-center gap-1.5" role="group" aria-label="Filtrer les messages">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onFilterChange(f.id)}
            aria-pressed={filter === f.id}
            className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              filter === f.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
