"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { io } from "socket.io-client";
import {
  MessageCircle, Send, Loader2, Home, Paperclip, X,
} from "lucide-react";
import {
  getMyInbox,
  getConversationMessages,
  sendStaffReply,
  sendStaffReplyWithAttachments,
  markConversationAsRead,
  startStaffConversation,
} from "../services/conversationService";
import { useAuth } from "../context/AuthContext";
import BackButton from "../components/navigation/BackButton";

const GOLD = "#C8960C";
const BLUE = "#2E7BB5";
// L'équipe répond de façon anonymisée — jamais le nom du collaborateur
const TEAM_LABEL = "Équipe Altitude Vision";

const EMOJIS = [
  '😊', '😂', '❤️', '👍', '🙏', '😍', '😭',
  '🔥', '✅', '👋', '🎉', '💪', '😎', '🤝', '💯', '👏',
  '🙌', '😅', '🥰', '✨',
];

const renderAttachment = (att) => {
  switch (att.type) {
    case 'image':
      return (
        <img src={att.url} alt={att.nom}
          className="max-w-xs rounded-lg cursor-pointer"
          onClick={() => window.open(att.url, '_blank')} />
      );
    case 'video':
      return <video src={att.url} controls className="max-w-xs rounded-lg" />;
    case 'audio':
      return <audio src={att.url} controls className="w-48" />;
    default:
      return (
        <a href={att.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-blue-400 underline text-sm">
          <Paperclip size={12} /> {att.nom || 'Fichier'}
        </a>
      );
  }
};

const formatTime = (d) => {
  if (!d) return "";
  const date = new Date(d);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

const STAFF_ROLES = ["Admin", "Collaborateur"];

const MessagesPage = () => {
  const { user, isInitialized } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected]           = useState(null);
  const [messages, setMessages]           = useState([]);
  const [input, setInput]                 = useState("");
  const [loadingList, setLoadingList]     = useState(true);
  const [loadingMsgs, setLoadingMsgs]     = useState(false);
  const [sending, setSending]             = useState(false);
  const [starting, setStarting]           = useState(false);
  const [notif, setNotif]                 = useState(null);
  const [pendingFiles, setPendingFiles]   = useState([]);
  const [showEmoji, setShowEmoji]         = useState(false);
  const bottomRef    = useRef(null);
  const fileInputRef = useRef(null);
  const listScrollRef = useRef(null);
  const requestedConversationId = searchParams.get('conversationId') || searchParams.get('conversation');

  // Le staff a sa propre boîte partagée (/dashboard/conversations) — pas cette page.
  useEffect(() => {
    if (isInitialized && user && STAFF_ROLES.includes(user.role)) {
      router.replace('/dashboard/conversations');
    }
  }, [isInitialized, user, router]);

  const fetchConversations = async () => {
    try {
      const data = await getMyInbox();
      setConversations(data);
      if (requestedConversationId) {
        const requested = data.find(conv => conv._id === requestedConversationId);
        if (requested) setSelected(requested);
      }
    } catch {
      showNotif("Impossible de charger vos messages.", "error");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { fetchConversations(); }, [requestedConversationId]);

  const openConversation = (conversation) => {
    setSelected(conversation);
    router.replace(`/messages?conversationId=${encodeURIComponent(conversation._id)}`, { scroll: false });
  };

  const closeConversation = () => {
    setSelected(null);
    router.replace('/messages', { scroll: false });
    requestAnimationFrame(() => {
      if (listScrollRef.current) listScrollRef.current.scrollTop = Number(listScrollRef.current.dataset.scrollTop || 0);
    });
  };

  useEffect(() => {
    if (!selected) return;
    (async () => {
      setMessages([]);
      setLoadingMsgs(true);
      try {
        const msgs = await getConversationMessages(selected._id);
        setMessages(msgs);
        await markConversationAsRead(selected._id);
        setConversations(prev =>
          prev.map(c => c._id === selected._id ? { ...c, unreadCount: 0 } : c)
        );
      } catch {
        showNotif("Impossible de charger les messages.", "error");
      } finally {
        setLoadingMsgs(false);
      }
    })();
  }, [selected?._id]);

  // Socket.IO temps réel — écoute 'new-message' (réponses du staff), pas
  // 'new-staff-message' (réservé à la boîte partagée du staff).
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if ((!user?.id && !user?._id) || !token) return;

    const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';
    const socket = io(SOCKET_URL, { auth: { token } });

    socket.on('new-message', ({ conversationId, message }) => {
      setSelected(prevSelected => {
        if (prevSelected?._id === conversationId) {
          setMessages(prev => [...prev, message]);
        }
        return prevSelected;
      });
      setConversations(prev => prev.map(c =>
        c._id === conversationId
          ? { ...c, lastMessage: message.content || '📎 Fichier', updatedAt: new Date().toISOString() }
          : c
      ));
    });

    return () => socket.disconnect();
  }, [user?.id, user?._id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages]);

  const showNotif = (message, type = "success") => {
    setNotif({ message, type });
    setTimeout(() => setNotif(null), 4000);
  };

  // Crée (ou récupère) la conversation avec l'équipe, sans message initial —
  // l'utilisateur écrit ensuite dans la zone de saisie normale.
  const contacterAgence = async () => {
    setStarting(true);
    try {
      const conv = await startStaffConversation();
      if (conv) {
        setConversations(prev => prev.some(c => c._id === conv._id) ? prev : [conv, ...prev]);
        openConversation(conv);
      }
    } catch {
      showNotif("Impossible de démarrer la conversation.", "error");
    } finally {
      setStarting(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!input.trim() && pendingFiles.length === 0) || !selected || sending) return;
    setSending(true);
    try {
      const msg = pendingFiles.length > 0
        ? await sendStaffReplyWithAttachments(selected._id, input.trim(), pendingFiles)
        : await sendStaffReply(selected._id, input.trim());
      if (msg) {
        setMessages(prev => [...prev, msg]);
      }
      setConversations(prev =>
        prev.map(c => c._id === selected._id
          ? { ...c, lastMessage: input.trim() || '📎 Fichier', updatedAt: new Date().toISOString() }
          : c
        )
      );
      setInput("");
      setPendingFiles([]);
    } catch (err) {
      showNotif(err?.response?.data?.message || "Erreur lors de l'envoi.", "error");
    } finally {
      setSending(false);
    }
  };

  const removePendingFile = (idx) => setPendingFiles(prev => prev.filter((_, i) => i !== idx));

  const convDisplay = (conv) => ({
    propertyTitle: conv?.relatedProperty?.title || null,
  });

  return (
    <div className="h-[calc(100dvh-5rem)] min-h-[32rem] flex flex-col overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {notif && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-xl text-white text-sm font-semibold ${
          notif.type === "error"
            ? "bg-gradient-to-r from-red-500 to-pink-600"
            : "bg-gradient-to-r from-emerald-500 to-green-600"
        }`}>
          {notif.message}
        </div>
      )}

      {/* Header */}
      <div className={`${selected ? 'hidden lg:flex' : 'flex'} items-center gap-3 px-4 sm:px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0`}>
        <div className="p-2 rounded-xl" style={{ background: `linear-gradient(135deg, #1A5A8A, ${BLUE})` }}>
          <MessageCircle className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-800">Mes messages</h1>
          <p className="text-xs text-gray-400">Discutez directement avec {TEAM_LABEL}</p>
        </div>
      </div>

      <div className="flex flex-1 min-w-0 overflow-hidden">

        {/* ── Colonne gauche ── */}
        <aside
          ref={listScrollRef}
          onScroll={event => { event.currentTarget.dataset.scrollTop = String(event.currentTarget.scrollTop); }}
          className={`${selected ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 flex-shrink-0 border-r border-gray-200 bg-white flex-col overflow-y-auto`}
          aria-label="Mes conversations"
        >
          {loadingList ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <MessageCircle className="w-10 h-10 text-gray-200" />
              <p className="text-sm text-gray-500 font-medium">Aucune conversation pour le moment</p>
              <button
                onClick={contacterAgence}
                disabled={starting}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: `linear-gradient(135deg, #1A5A8A, ${BLUE})` }}
              >
                {starting ? "Ouverture..." : "Contacter l'agence"}
              </button>
            </div>
          ) : (
            conversations.map(conv => {
              const { propertyTitle } = convDisplay(conv);
              const unread = conv.unreadCount || 0;
              const isActive = selected?._id === conv._id;

              return (
                <button
                  key={conv._id}
                  onClick={() => openConversation(conv)}
                  className={`w-full text-left px-4 py-3.5 border-b border-gray-100 transition-colors ${
                    isActive ? "bg-blue-50 border-l-4 border-l-blue-400" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: `linear-gradient(135deg, #1A5A8A, ${BLUE})` }}>
                        AV
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-800 truncate">{TEAM_LABEL}</p>
                        {propertyTitle && (
                          <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                            <Home className="w-3 h-3 flex-shrink-0" />
                            {propertyTitle}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-xs text-gray-400">{formatTime(conv.updatedAt)}</span>
                      {unread > 0 && (
                        <span className="text-xs font-bold text-white px-1.5 py-0.5 rounded-full"
                          style={{ background: GOLD }}>
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                  {conv.lastMessage && (
                    <p className="text-xs text-gray-400 mt-1.5 truncate pl-10">{conv.lastMessage}</p>
                  )}
                </button>
              );
            })
          )}
        </aside>

        {/* ── Colonne droite : chat ── */}
        <main className={`${selected ? 'flex' : 'hidden lg:flex'} min-w-0 flex-1 flex-col bg-gray-50 overflow-hidden`}>
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
              <MessageCircle className="w-12 h-12 text-gray-200" />
              <p className="text-gray-400 font-medium">
                {conversations.length === 0 ? "Contactez l'agence pour démarrer" : "Sélectionnez une conversation"}
              </p>
            </div>
          ) : (
            <>
              <div className="px-2 sm:px-5 py-2.5 sm:py-3.5 bg-white border-b border-gray-200 flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <BackButton
                  onBack={closeConversation}
                  fallbackHref="/messages"
                  label="Retour aux conversations"
                  className="lg:hidden px-2"
                />
                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: `linear-gradient(135deg, #1A5A8A, ${BLUE})` }}>
                  AV
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-gray-800">{TEAM_LABEL}</p>
                  {convDisplay(selected).propertyTitle && (
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Home className="w-3 h-3" />
                      {convDisplay(selected).propertyTitle}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-5 py-4 space-y-3">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-gray-400">Écrivez votre premier message ci-dessous.</p>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isMine = msg.sender?._id === user?._id || msg.sender?.toString() === user?._id;
                    return (
                      <div key={msg._id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        {!isMine && (
                          <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold mr-2 self-end"
                            style={{ background: `linear-gradient(135deg, #1A5A8A, ${BLUE})` }}>
                            AV
                          </div>
                        )}
                        <div className="max-w-[85%] sm:max-w-[68%] min-w-0">
                          <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                            isMine
                              ? "text-white rounded-br-sm"
                              : "bg-white text-gray-800 shadow-sm rounded-bl-sm border border-gray-100"
                          }`}
                            style={isMine ? { background: `linear-gradient(135deg, #1A5A8A, ${BLUE})` } : {}}>
                            {msg.attachments?.length > 0 && (
                              <div className="flex flex-col gap-1.5 mb-1.5">
                                {msg.attachments.map((att, i) => (
                                  <div key={i}>{renderAttachment(att)}</div>
                                ))}
                              </div>
                            )}
                            {!!msg.content && msg.content}
                          </div>
                          <p className={`text-xs text-gray-400 mt-1 ${isMine ? "text-right" : "text-left"}`}>
                            {/* Anonymat de l'équipe : jamais le nom du collaborateur qui a répondu */}
                            {isMine ? "Vous" : TEAM_LABEL} · {formatTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {pendingFiles.length > 0 && (
                <div className="px-4 pt-2.5 bg-white flex flex-wrap gap-2 flex-shrink-0">
                  {pendingFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-2.5 py-1.5 text-xs text-gray-600">
                      <Paperclip size={12} className="flex-shrink-0" />
                      <span className="truncate max-w-[140px]">{f.name}</span>
                      <button type="button" onClick={() => removePendingFile(i)}
                        className="text-gray-400 hover:text-red-500 transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form
                onSubmit={handleSend}
                className="relative px-2 sm:px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white border-t border-gray-200 flex items-end gap-1 sm:gap-2 flex-shrink-0"
              >
                {showEmoji && (
                  <div className="absolute bottom-full left-4 mb-2 bg-white border border-gray-200 rounded-xl shadow-xl p-3 grid grid-cols-6 gap-1 z-20">
                    {EMOJIS.map(e => (
                      <button key={e} type="button"
                        onClick={() => setInput(t => t + e)}
                        className="text-xl p-1 rounded hover:bg-gray-100 transition-colors">
                        {e}
                      </button>
                    ))}
                  </div>
                )}

                <input
                  type="file"
                  multiple
                  accept="image/*,video/*,audio/*,application/pdf"
                  ref={fileInputRef}
                  onChange={e => {
                    setPendingFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0 p-2.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  aria-label="Joindre un fichier"
                >
                  <Paperclip size={18} />
                </button>

                <button
                  type="button"
                  onClick={() => setShowEmoji(v => !v)}
                  className="flex-shrink-0 p-2.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-lg"
                  aria-label="Emojis"
                >
                  😊
                </button>

                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e); }
                  }}
                  placeholder="Écrivez à l'équipe…"
                  rows={2}
                  className="flex-1 resize-none text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={(!input.trim() && pendingFiles.length === 0) || sending}
                  className="flex-shrink-0 p-2.5 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105"
                  style={{ background: `linear-gradient(135deg, #1A5A8A, ${BLUE})` }}
                >
                  {sending
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : <Send className="w-5 h-5" />
                  }
                </button>
              </form>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default MessagesPage;
