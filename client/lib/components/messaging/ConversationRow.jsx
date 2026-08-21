"use client";

// INBOX-PRO-2 — extraction dense de l'ancien `MessageItem` (inline dans
// InternalMessagingPage.jsx). Même données, présentation resserrée :
// avatar plus petit, moins de padding, hiérarchie typographique claire
// (non-lu = plus fort, lu = poids normal) sans gros badges décoratifs.
import { FileEdit, Paperclip, Star } from 'lucide-react';

const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isToday) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === yesterday.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};

export default function ConversationRow({ message, selected, onClick, onEdit, activeView }) {
  const isUnread = !message.isRead;
  const isDraft = activeView === 'drafts';
  const senderName = isDraft ? 'Brouillon' : activeView === 'sent' ? message.receiver?.name : message.sender?.name;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? 'true' : undefined}
      className={`w-full text-left px-3 py-2.5 border-b border-gray-100 transition-colors relative focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset ${
        selected ? 'bg-blue-50 border-l-[3px] border-l-blue-600 pl-[9px]' : 'hover:bg-gray-50 border-l-[3px] border-l-transparent pl-[9px]'
      }`}
    >
      {isDraft && onEdit && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onEdit(); } }}
          className="absolute top-1.5 right-1.5 p-1 text-blue-500 hover:bg-blue-100 rounded"
          title="Éditer le brouillon"
          aria-label="Éditer le brouillon"
        >
          <FileEdit className="w-3.5 h-3.5" />
        </span>
      )}
      <div className="flex items-start gap-2.5">
        <div className="w-7 h-7 mt-0.5 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 bg-gradient-to-br from-blue-500 to-purple-600">
          {senderName?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`truncate text-sm ${isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
              {senderName || '(Inconnu)'}
            </p>
            <div className="flex items-center gap-1 flex-shrink-0">
              {message.isStarred && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
              {message.attachments?.length > 0 && <Paperclip className="w-3 h-3 text-gray-400" />}
              <span className="text-[11px] text-gray-400 whitespace-nowrap">{formatDate(message.createdAt)}</span>
            </div>
          </div>
          {message.subject && (
            <p className={`text-xs truncate ${isUnread ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
              {message.subject}
            </p>
          )}
          <p className="text-xs text-gray-400 truncate">{message.content}</p>
        </div>
        {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 flex-shrink-0" aria-hidden="true" />}
      </div>
    </button>
  );
}
