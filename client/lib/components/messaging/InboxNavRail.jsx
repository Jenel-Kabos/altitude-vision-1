"use client";

// INBOX-PRO-2 — remplace l'ancienne colonne "Sidebar" pleine largeur
// (256px, labels + bouton "Nouveau Message" en toute lettres) par un rail
// compact icônes-seules (mandat §5/§24 : navigation compacte, pas de
// deuxième grande colonne). Les dossiers restent exactement ceux déjà
// gérés par InternalMessagingPage (aucune capacité inventée).
import { FileEdit, Inbox, MailOpen, MailPlus, SendHorizontal, Star, Trash2 } from 'lucide-react';

const FOLDERS = [
  { id: 'inbox', icon: Inbox, label: 'Boîte de réception' },
  { id: 'sent', icon: SendHorizontal, label: 'Messages envoyés' },
  { id: 'unread', icon: MailOpen, label: 'Non lus' },
  { id: 'starred', icon: Star, label: 'Favoris' },
  { id: 'drafts', icon: FileEdit, label: 'Brouillons' },
  { id: 'trash', icon: Trash2, label: 'Corbeille' },
];

export default function InboxNavRail({ activeView, unreadCount, onSelectFolder, onCompose, user }) {
  return (
    <div className="hidden lg:flex w-14 flex-shrink-0 bg-white border-r border-gray-200 flex-col items-center py-3 gap-1">
      <button
        type="button"
        onClick={onCompose}
        className="w-9 h-9 flex items-center justify-center rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition mb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label="Nouveau message"
        title="Nouveau message"
      >
        <MailPlus className="w-4.5 h-4.5" />
      </button>

      <nav className="flex-1 flex flex-col gap-1" aria-label="Dossiers de la boîte de réception">
        {FOLDERS.map(({ id, icon: Icon, label }) => {
          const badge = (id === 'inbox' || id === 'unread') ? unreadCount : 0;
          const active = activeView === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectFolder(id)}
              aria-current={active ? 'true' : undefined}
              aria-label={badge > 0 ? `${label} (${badge} non lus)` : label}
              title={label}
              className={`relative w-9 h-9 flex items-center justify-center rounded-xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                active ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
              }`}
            >
              <Icon className="w-4.5 h-4.5" />
              {badge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div
        className="w-9 h-9 rounded-full bg-gray-700 text-white text-xs font-bold flex items-center justify-center flex-shrink-0"
        title={user?.name}
        aria-label={`Connecté en tant que ${user?.name || ''}`}
      >
        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
      </div>
    </div>
  );
}
