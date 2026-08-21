"use client";

// INBOX-PRO-2 — nouveau panneau contextuel escamotable (mandat §5/§23).
// N'existait pas avant : le "problème 3 colonnes" d'INBOX-PRO-1 venait de
// sidebar+liste+détail, pas d'un panneau de contact permanent qui
// n'existait pas dans le code. Affiche uniquement les données réellement
// disponibles sur `InternalMail` (expéditeur/destinataire, rôle) —
// n'invente aucune relation CRM/bien/réservation inexistante pour ce
// modèle (mandat §23 : "ne fabrique aucune relation CRM inexistante").
import { AnimatePresence, motion } from 'framer-motion';
import { Mail, User, X } from 'lucide-react';

export default function ContactDrawer({ open, onClose, message }) {
  if (!message) return null;
  const isSent = message.__activeView === 'sent';
  const person = isSent ? message.receiver : message.sender;
  const label = isSent ? 'Destinataire' : 'Expéditeur';

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 z-40"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.2 }}
            className="fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col"
            role="dialog"
            aria-label="Informations sur le contact"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
              <h2 className="font-semibold text-gray-800">Informations</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label="Fermer le panneau d'informations"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0 bg-gradient-to-br from-blue-500 to-purple-600">
                  {(person?.name || message.senderName)?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{person?.name || message.senderName || '(Inconnu)'}</p>
                  <p className="text-xs text-gray-400">{label}</p>
                </div>
              </div>

              <dl className="space-y-3 text-sm">
                {(person?.email || message.senderEmail) && (
                  <div className="flex items-start gap-2">
                    <Mail className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <dt className="text-xs text-gray-400">Email</dt>
                      <dd className="text-gray-700 truncate">{person?.email || message.senderEmail}</dd>
                    </div>
                  </div>
                )}
                {person?.role && (
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <dt className="text-xs text-gray-400">Rôle</dt>
                      <dd className="text-gray-700">{person.role}</dd>
                    </div>
                  </div>
                )}
                {message.isExternalMail && (
                  <div className="flex items-start gap-2">
                    <Mail className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <dt className="text-xs text-gray-400">Origine</dt>
                      <dd className="text-gray-700">Email externe (Zoho)</dd>
                    </div>
                  </div>
                )}
              </dl>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
