// src/components/messaging/ConversationList.jsx
import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MessageCircle } from 'lucide-react';

const ConversationList = ({ conversations, selectedConversationId, onSelectConversation, currentUserId }) => {
  
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <MessageCircle className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-gray-500 text-lg">Aucune conversation</p>
        <p className="text-gray-400 text-sm mt-2">
          Vos conversations apparaîtront ici
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      {conversations.map((conversation) => {
        // Trouver l'autre participant (pas l'utilisateur actuel)
        const otherParticipant = conversation.participants.find(
          p => p._id !== currentUserId
        );

        const isSelected = conversation._id === selectedConversationId;
        const hasUnread = conversation.unreadCount > 0;
        
        const timeAgo = conversation.lastMessageAt 
          ? formatDistanceToNow(new Date(conversation.lastMessageAt), {
              addSuffix: true,
              locale: fr
            })
          : '';

        return (
          <div
            key={conversation._id}
            onClick={() => onSelectConversation(conversation)}
            className={`
              p-4 border-b cursor-pointer transition-colors
              ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-gray-50'}
            `}
          >
            <div className="flex items-start gap-3">
              {/* Avatar */}
              {otherParticipant?.avatar ? (
                <img
                  src={otherParticipant.avatar}
                  alt={otherParticipant.name}
                  className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {otherParticipant?.name?.[0]?.toUpperCase() || '?'}
                </div>
              )}

              {/* Contenu */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className={`font-semibold truncate ${hasUnread ? 'text-gray-900' : 'text-gray-700'}`}>
                    {otherParticipant?.name || 'Utilisateur inconnu'}
                  </h3>
                  <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                    {timeAgo}
                  </span>
                </div>

                {/* Dernier message */}
                <p className={`text-sm truncate ${hasUnread ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                  {conversation.lastMessage || 'Aucun message'}
                </p>

                {/* Badge non lu */}
                {hasUnread && (
                  <span className="inline-block mt-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {conversation.unreadCount} nouveau{conversation.unreadCount > 1 ? 'x' : ''}
                  </span>
                )}

                {/* Propriété/Événement lié */}
                {(conversation.relatedProperty || conversation.relatedEvent) && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      📎 {conversation.relatedProperty ? 'Propriété' : 'Événement'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ConversationList;