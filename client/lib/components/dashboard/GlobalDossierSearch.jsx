"use client";

// DOC-EVO-1 — évolution 5 : recherche globale intelligente. Retrouve
// automatiquement les dossiers/documents liés à un propriétaire, locataire,
// bien, contrat, facture ou numéro/référence — un seul champ, visible
// depuis n'importe quel niveau du Centre documentaire.
import React, { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { searchDossiers } from "../../services/dossierService";
import DossierPanel from "./DossierPanel";

const GlobalDossierSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openDossier, setOpenDossier] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try { setResults(await searchDossiers(query)); setOpen(true); }
      catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleSelect = (result) => {
    setOpen(false);
    if (result.kind === 'dossier') setOpenDossier({ domain: result.domain, entityId: result.entityId });
  };

  return (
    <div className="relative w-full max-w-md">
      <label className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white">
        <Search size={14} className="text-gray-400 flex-shrink-0" />
        <span className="sr-only">Recherche globale</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un propriétaire, locataire, bien, contrat, facture, numéro…"
          className="text-sm outline-none flex-1 min-w-0" />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); setOpen(false); }} className="text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </label>

      {open && (
        <div className="absolute z-40 mt-1 w-full bg-white border border-gray-100 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {loading ? (
            <p className="px-3 py-2 text-xs text-gray-400">Recherche…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400">Aucun résultat.</p>
          ) : (
            <ul>
              {results.map((r, i) => (
                <li key={`${r.kind}-${r.entityId || r.documentId || r.financialDocumentId}-${i}`}>
                  <button onClick={() => handleSelect(r)} disabled={r.kind !== 'dossier'}
                    className={`w-full text-left px-3 py-2 text-sm border-b border-gray-50 last:border-0 flex items-center justify-between gap-2 ${r.kind === 'dossier' ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'}`}>
                    <span className="truncate">{r.label}</span>
                    <span className="text-[10px] uppercase text-gray-400 flex-shrink-0">{r.kind === 'dossier' ? 'dossier' : 'document'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {openDossier && (
        <DossierPanel domain={openDossier.domain} entityId={openDossier.entityId} onClose={() => setOpenDossier(null)} />
      )}
    </div>
  );
};

export default GlobalDossierSearch;
