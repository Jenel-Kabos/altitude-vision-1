"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  MessageCircle, Send, Loader2, Home, User, AlertTriangle,
} from "lucide-react";
import {
  getStaffInbox,
  getConversationMessages,
  sendStaffReply,
  markConversationAsRead,
} from "../../services/conversationService";
import { useAuth } from "../../context/AuthContext";

const GOLD = "#C8960C";

const formatTime = (d) => {
  if (!d) return "";
  const date = new Date(d);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

const StaffInboxPage = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected]           = useState(null);
  const [messages, setMessages]           = useState([]);
  const [input, setInput]                 = useState("");
  const [loadingList, setLoadingList]     = useState(true);
  const [loadingMsgs, setLoadingMsgs]     = useState(false);
  const [sending, setSending]             = useState(false);
  const [notif, setNotif]                 = useState(null);
  const bottomRef = useRef(null);

  // Charger la liste des conversations staff-inbox
  const fetchConversations = async () => {
    try {
      const data = await getStaffInbox();
      setConversations(data);
    } catch {
      showNotif("Impossible de charger les conversations.", "error");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { fetchConversations(); }, []);

  // Charger les messages d'une conversation sélectionnée
  const openConversation = async (conv) => {
    setSelected(conv);
    setMessages([]);
    setLoadingMsgs(true);
    try {
      const msgs = await getConversationMessages(conv._id);
      setMessages(msgs);
      await markConversationAsRead(conv._id);
      // Mettre à jour le badge non-lu localement
      setConversations(prev =>
        prev.map(c => c._id === conv._id ? { ...c, unreadCount: 0 } : c)
      );
    } catch {
      showNotif("Impossible de charger les messages.", "error");
    } finally {
      setLoadingMsgs(false);
    }
  };

  // Scroller en bas à chaque mise à jour des messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !selected || sending) return;
    setSending(true);
    try {
      const msg = await sendStaffReply(selected._id, input.trim());
      if (msg) {
        setMessages(prev => [...prev, msg]);
      }
      // Mettre à jour lastMessage dans la liste
      setConversations(prev =>
        prev.map(c => c._id === selected._id
          ? { ...c, lastMessage: input.trim(), updatedAt: new Date().toISOString() }
          : c
        )
      );
      setInput("");
    } catch (err) {
      showNotif(err?.response?.data?.message || "Erreur lors de l'envoi.", "error");
    } finally {
      setSending(false);
    }
  };

  const showNotif = (message, type = "success") => {
    setNotif({ message, type });
    setTimeout(() => setNotif(null), 4000);
  };

  // Données d'affichage d'une conversation
  const convDisplay = (conv) => {
    const client = conv.participants?.[0];
    const clientName = client?.name || "Client";
    const propertyTitle = conv.relatedProperty?.title || null;
    return { clientName, propertyTitle, client };
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* Notification */}
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
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="p-2 rounded-xl" style={{ background: `linear-gradient(135deg, #A06820, ${GOLD})` }}>
          <MessageCircle className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-800">Messages clients</h1>
          <p className="text-xs text-gray-400">
            {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Body : liste + chat */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Colonne gauche : liste des conversations ── */}
        <aside className="w-72 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-y-auto">
          {loadingList ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertTriangle className="w-8 h-8 text-gray-300" />
              <p className="text-sm text-gray-400 font-medium">Aucune demande client</p>
            </div>
          ) : (
            conversations.map(conv => {
              const { clientName, propertyTitle } = convDisplay(conv);
              const unread = conv.unreadCount || 0;
              const isActive = selected?._id === conv._id;

              return (
                <button
                  key={conv._id}
                  onClick={() => openConversation(conv)}
                  className={`w-full text-left px-4 py-3.5 border-b border-gray-100 transition-colors ${
                    isActive ? "bg-amber-50 border-l-4 border-l-amber-400" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: `linear-gradient(135deg, #A06820, ${GOLD})` }}>
                        {clientName[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-800 truncate">{clientName}</p>
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

        {/* ── Colonne droite : zone de chat ── */}
        <main className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
              <MessageCircle className="w-12 h-12 text-gray-200" />
              <p className="text-gray-400 font-medium">Sélectionnez une conversation</p>
            </div>
          ) : (
            <>
              {/* En-tête de la conversation */}
              <div className="px-5 py-3.5 bg-white border-b border-gray-200 flex items-center gap-3 flex-shrink-0">
                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: `linear-gradient(135deg, #A06820, ${GOLD})` }}>
                  {convDisplay(selected).clientName[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-800">{convDisplay(selected).clientName}</p>
                  {convDisplay(selected).propertyTitle && (
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Home className="w-3 h-3" />
                      {convDisplay(selected).propertyTitle}
                    </p>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-gray-400">Aucun message dans cette conversation.</p>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isMine = msg.sender?._id === user?._id || msg.sender?.toString() === user?._id;
                    return (
                      <div key={msg._id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        {!isMine && (
                          <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold mr-2 self-end"
                            style={{ background: `linear-gradient(135deg, #A06820, ${GOLD})` }}>
                            <User className="w-3 h-3" />
                          </div>
                        )}
                        <div className={`max-w-[68%]`}>
                          <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                            isMine
                              ? "text-white rounded-br-sm"
                              : "bg-white text-gray-800 shadow-sm rounded-bl-sm border border-gray-100"
                          }`}
                            style={isMine ? { background: `linear-gradient(135deg, #A06820, ${GOLD})` } : {}}>
                            {msg.content}
                          </div>
                          <p className={`text-xs text-gray-400 mt-1 ${isMine ? "text-right" : "text-left"}`}>
                            {isMine ? "Vous" : (msg.sender?.name || "Client")} · {formatTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Zone de saisie */}
              <form
                onSubmit={handleSend}
                className="px-4 py-3 bg-white border-t border-gray-200 flex items-end gap-3 flex-shrink-0"
              >
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e); }
                  }}
                  placeholder="Répondre au client…"
                  rows={2}
                  className="flex-1 resize-none text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  className="flex-shrink-0 p-2.5 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105"
                  style={{ background: `linear-gradient(135deg, #A06820, ${GOLD})` }}
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

export default StaffInboxPage;
