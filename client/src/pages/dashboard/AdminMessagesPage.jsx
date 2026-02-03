// src/pages/dashboard/AdminMessagesPage.jsx
import React, { useState, useEffect } from 'react';
import { MessageCircle, Filter } from 'lucide-react';
import ConversationList from '../../components/messaging/ConversationList';
import ChatWindow from '../../components/messaging/ChatWindow';
import { getUserConversations } from '../../services/conversationService';
import { useAuth } from '../../context/AuthContext';

const AdminMessagesPage = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active'); // 'active' | 'archived'
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    fetchConversations();
  }, [filter]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const data = await getUserConversations(1, 50, filter);
      setConversations(data.conversations);
      setTotalUnread(data.totalUnread);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    
    setConversations(conversations.map(conv => 
      conv._id === conversation._id 
        ? { ...conv, unreadCount: 0 }
        : conv
    ));
    
    setTotalUnread(Math.max(0, totalUnread - conversation.unreadCount));
  };

  const handleArchive = () => {
    setSelectedConversation(null);
    fetchConversations();
  };

  return (
    <div className="h-screen flex flex-col">
      {/* En-tête */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Messagerie Admin</h1>
              <p className="text-sm text-gray-500">
                Gérez les conversations avec les clients
              </p>
            </div>
          </div>

          {totalUnread > 0 && (
            <div className="bg-red-600 text-white px-4 py-2 rounded-full font-bold">
              {totalUnread} non lu{totalUnread > 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-gray-600" />
          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'active'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Actives ({conversations.filter(c => c.status === 'active').length})
          </button>
          <button
            onClick={() => setFilter('archived')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'archived'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Archivées
          </button>
        </div>
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement...</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Liste */}
          <div className="w-1/3 bg-white border-r overflow-y-auto">
            <ConversationList
              conversations={conversations}
              selectedConversationId={selectedConversation?._id}
              onSelectConversation={handleSelectConversation}
              currentUserId={user.id}
            />
          </div>

          {/* Chat */}
          <div className="w-2/3 bg-gray-50">
            {selectedConversation ? (
              <ChatWindow
                conversation={selectedConversation}
                onBack={() => setSelectedConversation(null)}
                onArchive={handleArchive}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-center p-8">
                <div>
                  <MessageCircle className="w-24 h-24 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    Sélectionnez une conversation
                  </h3>
                  <p className="text-gray-500">
                    Les conversations avec vos clients apparaîtront ici
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMessagesPage;