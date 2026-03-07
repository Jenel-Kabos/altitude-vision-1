// src/pages/dashboard/AdminMessagesPage.jsx
import React, { useState, useEffect } from 'react';
import { MessageCircle, Filter, Inbox, Archive, Loader2 } from 'lucide-react';
import ConversationList from '../../components/messaging/ConversationList';
import ChatWindow from '../../components/messaging/ChatWindow';
import { getUserConversations } from '../../services/conversationService';
import { useAuth } from '../../context/AuthContext';

const BLUE = '#2E7BB5';
const GOLD = '#C8872A';
const RED  = '#D42B2B';

const AdminMessagesPage = () => {
  const { user } = useAuth();
  const [conversations, setConversations]       = useState([]);
  const [selectedConversation, setSelected]     = useState(null);
  const [loading, setLoading]                   = useState(true);
  const [filter, setFilter]                     = useState('active');
  const [totalUnread, setTotalUnread]           = useState(0);

  useEffect(() => { fetchConversations(); }, [filter]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const data = await getUserConversations(1, 50, filter);
      setConversations(data.conversations);
      setTotalUnread(data.totalUnread);
    } catch {
      // erreur silencieuse — l'UI gère l'état vide
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (conv) => {
    setSelected(conv);
    setConversations(prev =>
      prev.map(c => c._id === conv._id ? { ...c, unreadCount: 0 } : c)
    );
    setTotalUnread(prev => Math.max(0, prev - (conv.unreadCount || 0)));
  };

  const handleArchive = () => { setSelected(null); fetchConversations(); };

  const activeCount   = conversations.filter(c => c.status === 'active').length;
  const archivedCount = conversations.filter(c => c.status !== 'active').length;

  return (
    <div className="flex flex-col h-full" style={{ background: '#F8FAFC' }}>

      {/* ── En-tête ────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-5 py-4 shadow-sm flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${BLUE}15` }}>
              <MessageCircle size={20} style={{ color: BLUE }} />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-base leading-tight"
                style={{ fontFamily: "'Outfit', sans-serif" }}>
                Messagerie
              </h1>
              <p className="text-xs text-gray-400"
                style={{ fontFamily: "'Outfit', sans-serif" }}>
                Conversations avec les clients
              </p>
            </div>
          </div>

          {totalUnread > 0 && (
            <span className="text-white text-xs font-bold px-3 py-1.5 rounded-full"
              style={{ background: RED, fontFamily: "'Outfit', sans-serif" }}>
              {totalUnread} non lu{totalUnread > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400 flex-shrink-0" />
          {[
            { id: 'active',   label: 'Actives',   count: activeCount,   Icon: Inbox   },
            { id: 'archived', label: 'Archivées',  count: archivedCount, Icon: Archive },
          ].map(({ id, label, count, Icon }) => (
            <button key={id} onClick={() => setFilter(id)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                fontFamily: "'Outfit', sans-serif",
                background: filter === id ? `linear-gradient(135deg, #1A5A8A, ${BLUE})` : '#F1F5F9',
                color:      filter === id ? '#fff' : '#64748B',
                boxShadow:  filter === id ? `0 2px 8px ${BLUE}30` : 'none',
              }}>
              <Icon size={12} />
              {label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                filter === id ? 'bg-white/20 text-white' : 'bg-white text-gray-500'
              }`}>
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenu ─────────────────────────────────────────── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 size={32} className="animate-spin mx-auto mb-3" style={{ color: BLUE }} />
            <p className="text-sm text-gray-400" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Chargement des conversations…
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">

          {/* Liste conversations */}
          <div className="w-full md:w-80 lg:w-96 bg-white border-r border-gray-100 overflow-y-auto flex-shrink-0"
            style={{ display: selectedConversation ? 'none' : undefined }}>
            <div className="md:block" style={{ display: '' }}>
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: `${BLUE}12` }}>
                    <Inbox size={24} style={{ color: BLUE }} />
                  </div>
                  <p className="font-semibold text-gray-600 mb-1"
                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                    Aucune conversation
                  </p>
                  <p className="text-xs text-gray-400"
                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                    {filter === 'active' ? 'Les nouvelles conversations apparaîtront ici.' : 'Aucune conversation archivée.'}
                  </p>
                </div>
              ) : (
                <ConversationList
                  conversations={conversations}
                  selectedConversationId={selectedConversation?._id}
                  onSelectConversation={handleSelect}
                  currentUserId={user?.id}
                />
              )}
            </div>
          </div>

          {/* Fenêtre de chat */}
          <div className="flex-1 flex flex-col" style={{ background: '#F8FAFC' }}>
            {selectedConversation ? (
              <ChatWindow
                conversation={selectedConversation}
                onBack={() => setSelected(null)}
                onArchive={handleArchive}
              />
            ) : (
              /* État vide desktop */
              <div className="hidden md:flex flex-1 items-center justify-center p-8">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5"
                    style={{ background: `${BLUE}10` }}>
                    <MessageCircle size={36} style={{ color: `${BLUE}60` }} />
                  </div>
                  <h3 className="font-bold text-gray-700 mb-2"
                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                    Sélectionnez une conversation
                  </h3>
                  <p className="text-sm text-gray-400"
                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                    Choisissez une conversation dans la liste pour commencer.
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