// src/components/messaging/MessageBubble.jsx
import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';

const MessageBubble = ({ message, isOwnMessage, onDelete }) => {
  const timeAgo = formatDistanceToNow(new Date(message.createdAt), {
    addSuffix: true,
    locale: fr
  });

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[70%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
        {/* Avatar (pour les messages des autres) */}
        {!isOwnMessage && (
          <div className="flex items-center gap-2 mb-1">
            {message.sender.avatar ? (
              <img
                src={message.sender.avatar}
                alt={message.sender.name}
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-bold">
                {message.sender.name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <span className="text-xs text-gray-600 font-medium">
              {message.sender.name}
            </span>
          </div>
        )}

        {/* Bulle de message */}
        <div
          className={`
            relative px-4 py-3 rounded-2xl
            ${isOwnMessage
              ? 'bg-blue-600 text-white rounded-br-none'
              : 'bg-gray-200 text-gray-900 rounded-bl-none'
            }
            ${message.isDeleted ? 'italic opacity-60' : ''}
          `}
        >
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>

          {/* Pièces jointes */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 space-y-1">
              {message.attachments.map((attachment, index) => (
                
                <a  
                  key={index}
                  href={attachment}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs underline hover:no-underline"
                >
                  📎 Pièce jointe {index + 1}
                </a>
              ))}
            </div>
          )}

          {/* Heure et statut */}
          <div className={`flex items-center justify-end gap-2 mt-1 text-xs ${isOwnMessage ? 'text-blue-100' : 'text-gray-600'}`}>
            <span>{timeAgo}</span>
            {isOwnMessage && !message.isDeleted && (
              <button
                onClick={() => onDelete(message._id)}
                className="hover:text-red-300 transition"
                title="Supprimer"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;