// src/components/messaging/ChatWindow.jsx
import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, MoreVertical, Archive, RefreshCw, MessageCircle } from 'lucide-react';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import ScrollToBottomButton from './ScrollToBottomButton';
import { getMessages, sendMessage, deleteMessage } from '../../services/messageService';
import { markConversationAsRead, archiveConversation } from '../../services/conversationService';
import { useAuth } from '../../context/AuthContext';
import { useSmartScroll } from '../../hooks/useSmartScroll';

const ChatWindow = ({ conversation, onBack, onArchive }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const pollIntervalRef = useRef(null);
  const previousMessagesCountRef = useRef(0);

  const userId = user?._id || user?.id;
  const conversationId = conversation._id;
  const otherParticipant =
    conversation.participants?.find(p => String(p._id) !== String(userId)) ||
    conversation.user;

  const {
    messagesEndRef,
    containerRef,
    showScrollButton,
    unreadCount,
    scrollToBottom,
    handleScroll,
  } = useSmartScroll(messages, userId);

  useEffect(() => {
    if (!conversationId) return;

    fetchMessages(conversationId);
    markAsRead(conversationId);

    pollIntervalRef.current = setInterval(() => {
      fetchMessages(conversationId, true);
    }, 3000);

    return () => clearInterval(pollIntervalRef.current);
  }, [conversationId]);

  const fetchMessages = async (convId, silent = false) => {
    try {
      if (!silent) setLoading(true);

      const data = await getMessages(convId);
      const newMessages = data.messages || [];
      const hasNewMessages = newMessages.length > previousMessagesCountRef.current;

      setMessages(newMessages);
      previousMessagesCountRef.current = newMessages.length;

      if (hasNewMessages && silent) {
        markAsRead(convId);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des messages:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const markAsRead = async (convId) => {
    try {
      await markConversationAsRead(convId);
    } catch (error) {
      console.error('Erreur mark as read:', error);
    }
  };

  const handleSendMessage = async (content) => {
    if (!content.trim()) return;

    setSending(true);
    try {
      await sendMessage(conversationId, content);
      await fetchMessages(conversationId, true);
    } catch (error) {
      console.error("Erreur lors de l'envoi:", error);
      alert("Erreur lors de l'envoi du message");
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await deleteMessage(messageId);
      setMessages(prev =>
        prev.map(m =>
          m._id === messageId
            ? { ...m, isDeleted: true, content: 'Message supprimé' }
            : m
        )
      );
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression du message');
    }
  };

  const handleArchive = async () => {
    if (!confirm('Archiver cette conversation ?')) return;

    try {
      await archiveConversation(conversationId);
      onArchive();
    } catch (error) {
      console.error("Erreur lors de l'archivage:", error);
      alert("Erreur lors de l'archivage");
    }
  };

  const handleRefresh = () => {
    fetchMessages(conversationId);
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* En-tête */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="lg:hidden p-2 hover:bg-gray-200 rounded-lg transition"
          >
            <ArrowLeft size={20} />
          </button>

          {otherParticipant?.avatar ? (
            <img
              src={otherParticipant.avatar}
              alt={otherParticipant.name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
              {otherParticipant?.name?.[0]?.toUpperCase() || '?'}
            </div>
          )}

          <div>
            <h3 className="font-semibold text-gray-900">
              {otherParticipant?.name || 'Utilisateur inconnu'}
            </h3>
            <p className="text-xs text-gray-500">
              {otherParticipant?.role || 'Utilisateur'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-2 hover:bg-gray-200 rounded-lg transition"
            title="Rafraîchir les messages"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>

          <div className="relative group">
            <button className="p-2 hover:bg-gray-200 rounded-lg transition">
              <MoreVertical size={20} />
            </button>
            <div className="hidden group-hover:block absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-10">
              <button
                onClick={handleArchive}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-left"
              >
                <Archive size={16} />
                Archiver
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 bg-gray-50 scroll-smooth"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(102, 126, 234, 0.3) transparent',
        }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Chargement des messages...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Aucun message</p>
              <p className="text-gray-400 text-sm mt-2">
                Commencez la conversation en envoyant un message !
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message._id}
                message={message}
                isOwnMessage={String(message.sender?._id) === String(userId)}
                onDelete={handleDeleteMessage}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <ScrollToBottomButton
        show={showScrollButton}
        unreadCount={unreadCount}
        onClick={() => scrollToBottom('smooth')}
      />

      <MessageInput onSendMessage={handleSendMessage} isLoading={sending} />
    </div>
  );
};

export default ChatWindow;