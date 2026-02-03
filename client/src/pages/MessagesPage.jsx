// src/pages/MessagesPage.jsx
import React, { useState, useEffect } from 'react';
import { MessageCircle, Loader2, Plus, X, Search } from 'lucide-react';
import ConversationList from '../components/messaging/ConversationList';
import ChatWindow from '../components/messaging/ChatWindow';
import { getUserConversations, createOrGetConversation } from '../services/conversationService';
import { useAuth } from '../context/AuthContext';

const MessagesPage = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [totalUnread, setTotalUnread] = useState(0);
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const data = await getUserConversations();
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
    
    // Mettre à jour le compteur non lu localement
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

  const handleNewConversation = () => {
    setShowNewConversationModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Chargement des conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* En-tête */}
        <div className="bg-white rounded-t-lg border-b p-6 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-10 h-10 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Ma Messagerie</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {totalUnread > 0 ? `${totalUnread} message${totalUnread > 1 ? 's' : ''} non lu${totalUnread > 1 ? 's' : ''}` : 'Aucun message non lu'}
                </p>
              </div>
            </div>

            {/* Bouton Nouvelle Conversation */}
            <button
              onClick={handleNewConversation}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold shadow-lg"
            >
              <Plus size={20} />
              Nouvelle Conversation
            </button>
          </div>
        </div>

        {/* Contenu principal */}
        <div className="bg-white rounded-b-lg shadow-lg" style={{ height: '600px' }}>
          <div className="flex h-full">
            {/* Liste des conversations - Desktop toujours visible, Mobile conditionnelle */}
            <div className={`
              w-full lg:w-1/3 border-r overflow-y-auto
              ${selectedConversation ? 'hidden lg:block' : 'block'}
            `}>
              <ConversationList
                conversations={conversations}
                selectedConversationId={selectedConversation?._id}
                onSelectConversation={handleSelectConversation}
                currentUserId={user.id}
              />
            </div>

            {/* Fenêtre de chat - Desktop toujours visible, Mobile conditionnelle */}
            <div className={`
              w-full lg:w-2/3 bg-gray-50
              ${selectedConversation ? 'block' : 'hidden lg:flex lg:items-center lg:justify-center'}
            `}>
              {selectedConversation ? (
                <ChatWindow
                  conversation={selectedConversation}
                  onBack={() => setSelectedConversation(null)}
                  onArchive={handleArchive}
                />
              ) : (
                <div className="text-center p-8">
                  <MessageCircle className="w-24 h-24 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    Sélectionnez une conversation
                  </h3>
                  <p className="text-gray-500">
                    Choisissez une conversation dans la liste pour commencer à discuter
                  </p>
                  <button
                    onClick={handleNewConversation}
                    className="mt-6 flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold mx-auto"
                  >
                    <Plus size={20} />
                    Démarrer une conversation
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Nouvelle Conversation */}
      <NewConversationModal
        isOpen={showNewConversationModal}
        onClose={() => setShowNewConversationModal(false)}
        onConversationCreated={(conv) => {
          setShowNewConversationModal(false);
          fetchConversations();
          setSelectedConversation(conv);
        }}
      />
    </div>
  );
};

// ===================================================
// MODAL NOUVELLE CONVERSATION
// ===================================================
const NewConversationModal = ({ isOpen, onClose, onConversationCreated }) => {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Pour simplifier, on utilise un email admin par défaut
  const ADMIN_EMAIL = 'altitudevis3n@gmail.com'; // 🔧 Remplacez par votre email admin

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!message.trim()) {
      setError('Veuillez écrire un message');
      return;
    }

    setIsLoading(true);

    try {
      // Pour l'instant, on contacte toujours l'admin
      // TODO: Ajouter une recherche d'utilisateurs par email
      const adminId = import.meta.env.VITE_ADMIN_ID || '68f8edbad1e9333e12874f8c'; // 🔧 À remplacer

      const conversation = await createOrGetConversation(
        adminId,
        message
      );

      onConversationCreated(conversation);
      setRecipientEmail('');
      setMessage('');
    } catch (error) {
      console.error('Erreur:', error);
      setError('Erreur lors de la création de la conversation. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          <X size={24} />
        </button>

        <h3 className="text-2xl font-bold text-gray-800 mb-6">
          Nouvelle Conversation
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              💬 Vous allez contacter l'équipe d'Altitude-Vision. Notre équipe vous répondra dans les plus brefs délais.
            </p>
          </div>

          {/* Message */}
          <div>
            <label htmlFor="message" className="block text-gray-700 font-semibold mb-2">
              Votre message <span className="text-red-500">*</span>
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows="6"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Écrivez votre message..."
              maxLength={2000}
              required
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-gray-500">{message.length}/2000</span>
            </div>
          </div>

          {/* Erreur */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Boutons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-100 transition font-semibold disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading || !message.trim()}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-gray-400"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <MessageCircle size={20} />
                  Envoyer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MessagesPage;