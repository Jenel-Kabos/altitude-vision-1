'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAutomationCockpit } from '../../services/crmAutomationService';
import { resolveWebDestination } from '../../navigation/navigationSdk';

const SECTIONS = [
  ['actionsPrioritaires', 'Actions prioritaires'],
  ['relancesAujourdhui', "Relances aujourd'hui"],
  ['clientsSansSuivi', 'Clients sans suivi'],
  ['opportunitesBloquees', 'Opportunités bloquées'],
  ['prospectsInactifs', 'Prospects inactifs'],
  ['contratsProchesEcheance', "Contrats proches de l'échéance"],
  ['paiementsASuivre', 'Paiements à suivre'],
  ['documentsManquants', 'Documents manquants'],
  ['visitesSansSuite', 'Visites sans suite'],
];

const itemLabel = (item) => item.label || item.displayName || item.title || item.documentNumber || item.type || String(item._id || item.ref || '');
const customerHref = (item) => {
  const id = item.customer?._id || item.customer || null;
  return id ? resolveWebDestination('CRM_CUSTOMER_DETAILS', { id }) : null;
};

export default function CrmAutomationCockpit() {
  const [cockpit, setCockpit] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { getAutomationCockpit().then(setCockpit).catch((e) => setError(e.response?.data?.message || 'Cockpit indisponible.')); }, []);

  if (error) return <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p>;
  if (!cockpit) return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 9 }, (_, i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-slate-100" />)}</div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Cockpit commercial — données réelles uniquement, aucune valeur estimée. Généré à {new Date(cockpit.generatedAt).toLocaleTimeString('fr-FR')}.</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map(([key, label]) => {
          const items = cockpit[key] || [];
          return (
            <section key={key} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">{label}</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{items.length}</span>
              </div>
              {items.length === 0 ? (
                <p className="text-sm text-slate-400">Rien à signaler.</p>
              ) : (
                <ul className="space-y-2">
                  {items.slice(0, 8).map((item) => {
                    const href = customerHref(item);
                    const content = <span className="line-clamp-1">{itemLabel(item)}</span>;
                    return (
                      <li key={String(item._id || item.ref)} className="text-sm text-slate-700">
                        {href ? <Link href={href} className="hover:text-teal-700 hover:underline">{content}</Link> : content}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
