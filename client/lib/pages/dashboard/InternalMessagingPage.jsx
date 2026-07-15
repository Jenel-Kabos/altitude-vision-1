"use client";

// src/pages/dashboard/InternalMessagingPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Send, Inbox, SendHorizontal, Star, Trash2, Search, X, Loader2,
  MailOpen, MailPlus, User, Clock, Paperclip, AlertCircle, Check, Download,
  FileEdit, RotateCcw, Trash, AlertTriangle, ChevronDown
} from 'lucide-react';
import {
  sendInternalMail,
  getReceivedMessages,
  getSentMessages,
  getUnreadMessages,
  getStarredMessages,
  getDraftMessages,
  getTrashedMessages,
  markAsRead,
  addStar,
  removeStar,
  deleteMessage,
  moveToTrash,
  restoreFromTrash,
  permanentlyDelete,
  emptyTrash,
  saveDraft,
  updateDraft,
  deleteDraft,
  countUnread
} from '../../services/messageService';
import { getAllUsers } from '../../services/userService';
import { useAuth } from '../../context/AuthContext';
import toast from '@/lib/utils/toast';
import confirmDialog from '@/lib/utils/confirm';

const UPLOAD_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://altitude-vision.onrender.com/api').replace('/api', '');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

// =============================================================
// 🏠 COMPOSANT PRINCIPAL
// =============================================================
const InternalMessagingPage = () => {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState('inbox');
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [editingDraft, setEditingDraft] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [unreadCount, setUnreadCount] = useState(0);
  const [allUsers, setAllUsers] = useState([]);

  // Charger la liste des utilisateurs une seule fois
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const users = await getAllUsers();
        // Exclure l'utilisateur courant de la liste des destinataires
        setAllUsers((users || []).filter(u => u._id !== user?._id));
      } catch (err) {
        console.error('Erreur chargement utilisateurs:', err);
      }
    };
    if (user?._id) loadUsers();
  }, [user?._id]);

  useEffect(() => {
    fetchMessages();
    fetchUnreadCount();
    const interval = setInterval(() => {
      fetchMessages();
      fetchUnreadCount();
    }, 30000);
    return () => clearInterval(interval);
  }, [activeView]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      let data;
      switch (activeView) {
        case 'inbox':    data = await getReceivedMessages(); break;
        case 'sent':     data = await getSentMessages();     break;
        case 'unread':   data = await getUnreadMessages();   break;
        case 'starred':  data = await getStarredMessages();  break;
        case 'drafts':   data = await getDraftMessages();    break;
        case 'trash':    data = await getTrashedMessages();  break;
        default:         data = await getReceivedMessages();
      }
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erreur chargement messages:', err);
      showNotification('Erreur lors du chargement des messages', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const count = await countUnread();
      setUnreadCount(count || 0);
    } catch (err) {
      console.error('Erreur comptage non lus:', err);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 4000);
  };

  const handleSelectMessage = async (message) => {
    setSelectedMessage(message);
    if ((activeView === 'inbox' || activeView === 'unread') && !message.isRead) {
      try {
        await markAsRead(message._id);
        fetchMessages();
        fetchUnreadCount();
        window.dispatchEvent(new CustomEvent('altitude:dashboard-badges:refresh'));
      } catch (err) {
        console.error('Erreur mark as read:', err);
      }
    }
  };

  const handleToggleStar = async (messageId, isStarred) => {
    try {
      if (isStarred) {
        await removeStar(messageId);
        showNotification('Retiré des favoris');
      } else {
        await addStar(messageId);
        showNotification('Ajouté aux favoris');
      }
      fetchMessages();
    } catch (err) {
      showNotification('Erreur lors de la mise à jour', 'error');
    }
  };

  const handleDelete = async (messageId) => {
    if (activeView === 'trash') {
      if (!await confirmDialog('Supprimer DÉFINITIVEMENT ce message ? Cette action est irréversible.', { title: 'Suppression définitive', danger: true })) return;
      try {
        await permanentlyDelete(messageId);
        showNotification('Message supprimé définitivement');
        setSelectedMessage(null);
        fetchMessages();
      } catch (err) {
        showNotification('Erreur lors de la suppression définitive', 'error');
      }
    } else if (activeView === 'drafts') {
      if (!await confirmDialog('Supprimer ce brouillon ?', { title: 'Supprimer le brouillon', danger: true })) return;
      try {
        await deleteDraft(messageId);
        showNotification('Brouillon supprimé');
        setSelectedMessage(null);
        fetchMessages();
      } catch (err) {
        showNotification('Erreur lors de la suppression du brouillon', 'error');
      }
    } else {
      if (!await confirmDialog('Déplacer ce message vers la corbeille ?', { title: 'Mettre à la corbeille' })) return;
      try {
        await moveToTrash(messageId);
        showNotification('Message déplacé vers la corbeille');
        setSelectedMessage(null);
        fetchMessages();
      } catch (err) {
        showNotification('Erreur lors du déplacement', 'error');
      }
    }
  };

  const handleRestore = async (messageId) => {
    try {
      await restoreFromTrash(messageId);
      showNotification('Message restauré avec succès');
      setSelectedMessage(null);
      fetchMessages();
    } catch (err) {
      showNotification('Erreur lors de la restauration', 'error');
    }
  };

  const handleEmptyTrash = async () => {
    if (!await confirmDialog('Vider la corbeille ? Tous les messages seront DÉFINITIVEMENT supprimés.', { title: 'Vider la corbeille', danger: true })) return;
    try {
      await emptyTrash();
      showNotification('Corbeille vidée avec succès');
      setSelectedMessage(null);
      fetchMessages();
    } catch (err) {
      showNotification('Erreur lors du vidage de la corbeille', 'error');
    }
  };

  const handleEditDraft = (draft) => {
    setEditingDraft(draft);
    setShowComposeModal(true);
  };

  const handleSendMessage = async (messageData, isDraft = false, draftId = null) => {
    try {
      if (isDraft) {
        if (draftId) {
          await updateDraft(draftId, messageData);
          showNotification('Brouillon mis à jour');
        } else {
          await saveDraft(messageData);
          showNotification('Brouillon sauvegardé');
        }
      } else {
        await sendInternalMail(messageData);
        showNotification('Email envoyé avec succès');
        if (draftId) await deleteDraft(draftId);
      }
      setShowComposeModal(false);
      setEditingDraft(null);
      fetchMessages();
    } catch (err) {
      console.error('Erreur opération message:', err);
      showNotification(
        isDraft ? 'Erreur lors de la sauvegarde du brouillon' : 'Erreur lors de l\'envoi de l\'email',
        'error'
      );
    }
  };

  const filteredMessages = messages.filter(msg =>
    msg.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (activeView === 'sent' ? msg.receiver?.name : msg.sender?.name)
      ?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Notification toast */}
      <AnimatePresence>
        {notification.show && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg text-white ${
              notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
            }`}
          >
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b">
          <button
            onClick={() => { setEditingDraft(null); setShowComposeModal(true); }}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            <MailPlus className="w-5 h-5" />
            Nouveau Message
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {[
            { id: 'inbox',   icon: Inbox,          label: 'Boîte de réception', badge: unreadCount },
            { id: 'sent',    icon: SendHorizontal,  label: 'Messages envoyés'                      },
            { id: 'unread',  icon: MailOpen,        label: 'Non lus',            badge: unreadCount },
            { id: 'starred', icon: Star,            label: 'Favoris'                               },
            { id: 'drafts',  icon: FileEdit,        label: 'Brouillons'                            },
            { id: 'trash',   icon: Trash2,          label: 'Corbeille'                             },
          ].map(({ id, icon, label, badge }) => (
            <NavButton
              key={id}
              icon={icon}
              label={label}
              badge={badge}
              active={activeView === id}
              onClick={() => { setActiveView(id); setSelectedMessage(null); }}
            />
          ))}
        </nav>

        {activeView === 'trash' && messages.length > 0 && (
          <div className="p-4 border-t">
            <button
              onClick={handleEmptyTrash}
              className="w-full flex items-center justify-center gap-2 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition text-sm"
            >
              <Trash className="w-4 h-4" />
              Vider la corbeille
            </button>
          </div>
        )}

        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.role}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Liste des messages ── */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Rechercher une conversation"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Mail className="w-16 h-16 mb-4 text-gray-300" />
              <p className="text-lg">Aucun message</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredMessages.map((message) => (
                <MessageItem
                  key={message._id}
                  message={message}
                  selected={selectedMessage?._id === message._id}
                  onClick={() => handleSelectMessage(message)}
                  onEdit={activeView === 'drafts' ? () => handleEditDraft(message) : null}
                  activeView={activeView}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Détail du message ── */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {selectedMessage ? (
          <MessageDetail
            message={selectedMessage}
            onToggleStar={handleToggleStar}
            onDelete={handleDelete}
            onRestore={activeView === 'trash' ? handleRestore : null}
            uploadBaseUrl={UPLOAD_BASE_URL}
            isTrash={activeView === 'trash'}
            isDraft={activeView === 'drafts'}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <Mail className="w-24 h-24 mb-4 text-gray-300" />
            <p className="text-xl">Sélectionnez un message</p>
          </div>
        )}
      </div>

      {/* ── Modal Composer ── */}
      <AnimatePresence>
        {showComposeModal && (
          <ComposeModal
            onClose={() => { setShowComposeModal(false); setEditingDraft(null); }}
            onSend={handleSendMessage}
            editingDraft={editingDraft}
            allUsers={allUsers}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// =============================================================
// 🔘 NavButton
// =============================================================
const NavButton = ({ icon: Icon, label, badge, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
      active ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-700 hover:bg-gray-100'
    }`}
  >
    <Icon className="w-5 h-5" />
    <span className="flex-1 text-left">{label}</span>
    {badge > 0 && (
      <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">{badge}</span>
    )}
  </button>
);

// =============================================================
// 📨 MessageItem
// =============================================================
const MessageItem = ({ message, selected, onClick, onEdit, activeView }) => {
  const isUnread = !message.isRead;
  const isDraft  = activeView === 'drafts';

  const formatDate = (date) => {
    const d = new Date(date);
    const isToday = d.toDateString() === new Date().toDateString();
    return isToday
      ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  const senderName = isDraft
    ? 'Brouillon'
    : activeView === 'sent'
      ? message.receiver?.name
      : message.sender?.name;

  return (
    <div
      onClick={onClick}
      className={`p-4 cursor-pointer hover:bg-gray-50 transition relative ${
        selected ? 'bg-blue-50 border-l-4 border-blue-600' : ''
      } ${isUnread ? 'bg-blue-50/30' : ''}`}
    >
      {isDraft && onEdit && (
        <div className="absolute top-2 right-2">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition"
            title="Éditer le brouillon"
          >
            <FileEdit className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
          {senderName?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className={`truncate ${isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>
              {senderName || '(Inconnu)'}
            </p>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {message.isStarred && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
              {message.attachments?.length > 0 && <Paperclip className="w-4 h-4 text-gray-400" />}
              <span className="text-xs text-gray-500">{formatDate(message.createdAt)}</span>
            </div>
          </div>
          {message.subject && (
            <p className={`text-sm truncate mb-1 ${isUnread ? 'font-semibold text-gray-800' : 'text-gray-700'}`}>
              {message.subject}
            </p>
          )}
          <p className="text-sm text-gray-500 truncate">{message.content}</p>
        </div>
      </div>
    </div>
  );
};

// =============================================================
// 📄 MessageDetail
// =============================================================
const MessageDetail = ({ message, onToggleStar, onDelete, onRestore, uploadBaseUrl, isTrash, isDraft }) => {
  const formatFullDate = (date) =>
    new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <>
      <div className="bg-white border-b p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {message.sender?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-1">{message.subject || '(Sans objet)'}</h2>
              <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
                <span className="font-medium">{message.sender?.name || '(Inconnu)'}</span>
                {message.sender?.email && (
                  <>
                    <span>•</span>
                    <span className="text-gray-400">{message.sender.email}</span>
                  </>
                )}
                {message.receiver?.name && (
                  <>
                    <span>→</span>
                    <span className="font-medium">{message.receiver.name}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2 flex-shrink-0">
            {isTrash ? (
              <>
                <button
                  onClick={() => onRestore(message._id)}
                  className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition"
                  title="Restaurer"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onDelete(message._id)}
                  className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                  title="Supprimer définitivement"
                >
                  <AlertTriangle className="w-5 h-5" />
                </button>
              </>
            ) : (
              <>
                {!isDraft && (
                  <button
                    onClick={() => onToggleStar(message._id, message.isStarred)}
                    className={`p-2 rounded-lg transition ${
                      message.isStarred
                        ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title={message.isStarred ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  >
                    <Star className={`w-5 h-5 ${message.isStarred ? 'fill-yellow-500' : ''}`} />
                  </button>
                )}
                <button
                  onClick={() => onDelete(message._id)}
                  className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                  title={isDraft ? 'Supprimer le brouillon' : 'Déplacer vers la corbeille'}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          <span>{formatFullDate(message.createdAt)}</span>
          {message.priority && message.priority !== 'Normale' && (
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
              message.priority === 'Urgente' ? 'bg-red-100 text-red-700' :
              message.priority === 'Haute'   ? 'bg-orange-100 text-orange-700' :
                                               'bg-gray-100 text-gray-600'
            }`}>
              {message.priority}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-white">
        <div className="max-w-3xl">
          <div
            className="text-gray-700 text-lg leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message.content) }}
          />

          {message.attachments?.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Paperclip className="w-5 h-5" />
                📎 Pièces jointes ({message.attachments.length})
              </h3>
              <div className="space-y-3">
                {message.attachments.map((att, index) => {
                  const fileUrl  = att.url || (att.filepath ? `${uploadBaseUrl}/${att.filepath}` : null);
                  const isImage  = att.mimetype?.startsWith('image/');
                  return (
                    <div key={index}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition">
                      {/* Miniature ou icône */}
                      {isImage && fileUrl ? (
                        <img
                          src={fileUrl}
                          alt={att.filename}
                          className="w-16 h-16 object-cover rounded-lg flex-shrink-0 cursor-pointer hover:opacity-80 transition"
                          onClick={() => window.open(fileUrl, '_blank')}
                        />
                      ) : (
                        <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0 border border-blue-100">
                          <Paperclip className="w-6 h-6 text-blue-500" />
                        </div>
                      )}
                      {/* Infos + boutons */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{att.filename}</p>
                        <p className="text-sm text-gray-500 mt-0.5">{formatFileSize(att.size)}</p>
                        {fileUrl && (
                          <div className="flex gap-2 mt-2">
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition"
                            >
                              <Eye className="w-3.5 h-3.5" /> Voir
                            </a>
                            <a
                              href={fileUrl}
                              download={att.filename}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition"
                            >
                              <Download className="w-3.5 h-3.5" /> Télécharger
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// =============================================================
// ✏️ ComposeModal — Interne + Externe
// =============================================================
const ComposeModal = ({ onClose, onSend, editingDraft, allUsers }) => {
  const fileInputRef = useRef(null);
  const [searchUser, setSearchUser]     = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isExternal, setIsExternal]     = useState(false); // ← NOUVEAU
  const dropdownRef                      = useRef(null);

  const [formData, setFormData] = useState({
    recipient: editingDraft?.receiver
      ? { _id: editingDraft.receiver._id, name: editingDraft.receiver.name, email: editingDraft.receiver.email }
      : null,
    externalEmail: '',           // ← NOUVEAU
    subject:     editingDraft?.subject  || '',
    content:     editingDraft?.content  || '',
    priority:    editingDraft?.priority || 'Normale',
    attachments: [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileErrors,   setFileErrors]   = useState([]);
  const [emailError,   setEmailError]   = useState('');  // ← NOUVEAU

  // Fermer le dropdown en cliquant ailleurs
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Validation email externe
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const filteredUsers = allUsers.filter(u =>
    searchUser === '' ||
    u.name?.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchUser.toLowerCase())
  );

  const handleSelectUser = (u) => {
    setFormData(prev => ({ ...prev, recipient: u }));
    setSearchUser('');
    setShowDropdown(false);
  };

  const handleClearRecipient = () => {
    setFormData(prev => ({ ...prev, recipient: null }));
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (e.target.name === 'externalEmail') setEmailError('');
  };

  // Basculer entre interne et externe
  const handleToggleExternal = (value) => {
    setIsExternal(value);
    setEmailError('');
    setFormData(prev => ({ ...prev, recipient: null, externalEmail: '' }));
    setSearchUser('');
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const errors = [];
    if (files.length > MAX_FILES) {
      errors.push(`Maximum ${MAX_FILES} fichiers autorisés.`);
      setFileErrors(errors);
      return;
    }
    files.forEach(file => {
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name} dépasse ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
      }
    });
    if (errors.length > 0) { setFileErrors(errors); return; }
    setFileErrors([]);
    setFormData(prev => ({ ...prev, attachments: files }));
  };

  const handleRemoveFile = (idx) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== idx)
    }));
    if (fileInputRef.current) fileInputRef.current.value = null;
  };

  const handleSubmit = async (e, isDraft = false) => {
    e.preventDefault();

    // Validation destinataire
    if (!isDraft) {
      if (isExternal) {
        if (!formData.externalEmail || !isValidEmail(formData.externalEmail)) {
          setEmailError('Veuillez saisir une adresse email valide.');
          return;
        }
      } else {
        if (!formData.recipient) {
          toast.warning('Veuillez sélectionner un destinataire.');
          return;
        }
      }
      if (!formData.content.trim() && formData.attachments.length === 0) {
        toast.warning('Veuillez écrire un message ou joindre au moins un fichier.');
        return;
      }
    }

    setIsSubmitting(true);

    const data = new FormData();

    if (isExternal) {
      // ── Envoi externe via Zoho ──
      data.append('isExternal', 'true');
      data.append('receiverEmail', formData.externalEmail);
    } else {
      // ── Envoi interne classique ──
      if (formData.recipient) data.append('receiverId', formData.recipient._id);
    }

    data.append('subject',     formData.subject);
    data.append('content',     formData.content);
    data.append('priority',    formData.priority);
    data.append('messageType', 'Message');
    if (isDraft) data.append('isDraft', 'true');
    formData.attachments.forEach(file => data.append('attachments', file));

    await onSend(data, isDraft, editingDraft?._id);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-8 relative"
      >
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 text-gray-500 hover:text-red-600 transition p-2 rounded-full bg-gray-100"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-3xl font-bold text-gray-800 mb-6">
          {editingDraft ? 'Éditer le brouillon' : 'Nouveau Message'}
        </h2>

        {/* ── Toggle Interne / Externe ── */}
        <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => handleToggleExternal(false)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              !isExternal ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <User className="w-4 h-4" />
            Collaborateur interne
          </button>
          <button
            type="button"
            onClick={() => handleToggleExternal(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              isExternal ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Mail className="w-4 h-4" />
            Email externe
          </button>
        </div>

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">

          {/* ── Destinataire ── */}
          <div>
            <label className="block text-gray-700 font-semibold mb-2">
              Destinataire <span className="text-red-500">*</span>
            </label>

            {isExternal ? (
              /* ── Saisie email externe ── */
              <div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    name="externalEmail"
                    value={formData.externalEmail}
                    onChange={handleChange}
                    placeholder="destinataire@gmail.com"
                    aria-label="Email du destinataire externe"
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      emailError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300'
                    }`}
                  />
                </div>
                {emailError && (
                  <div className="flex items-center gap-2 text-red-600 text-sm mt-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>{emailError}</span>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <Check className="w-3 h-3 text-green-500" />
                  Envoyé via Zoho Mail depuis votre adresse professionnelle
                </p>
              </div>
            ) : formData.recipient ? (
              /* ── Destinataire interne sélectionné ── */
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                  {formData.recipient.name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{formData.recipient.name}</p>
                  <p className="text-sm text-gray-500 truncate">{formData.recipient.email}</p>
                </div>
                <button type="button" onClick={handleClearRecipient} className="text-gray-400 hover:text-red-500 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              /* ── Recherche collaborateur interne ── */
              <div ref={dropdownRef} className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={searchUser}
                    onChange={(e) => { setSearchUser(e.target.value); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Rechercher un collaborateur..."
                    aria-label="Rechercher un collaborateur"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                </div>
                {showDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                    {filteredUsers.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        {allUsers.length === 0 ? 'Chargement...' : 'Aucun résultat'}
                      </div>
                    ) : (
                      filteredUsers.map(u => (
                        <button
                          key={u._id}
                          type="button"
                          onClick={() => handleSelectUser(u)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition text-left"
                        >
                          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                            {u.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 truncate">{u.name}</p>
                            <p className="text-sm text-gray-400 truncate">{u.email}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Sujet ── */}
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Sujet</label>
            <input
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              placeholder="Objet du message"
              aria-label="Sujet du message"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* ── Message ── */}
          <div>
            <label className="block text-gray-700 font-semibold mb-2">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              name="content"
              value={formData.content}
              onChange={handleChange}
              rows="6"
              placeholder="Écrivez votre message..."
              aria-label="Contenu du message"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* ── Pièces jointes ── */}
          <div className="border p-4 rounded-lg bg-gray-50">
            <label className="block text-gray-700 font-semibold mb-2 flex items-center gap-2">
              <Paperclip className="w-5 h-5" />
              Pièces jointes (max {MAX_FILES} fichiers, {MAX_FILE_SIZE / (1024 * 1024)}MB chacun)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              aria-label="Pièces jointes"
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
            {fileErrors.map((err, i) => (
              <div key={i} className="flex items-center gap-2 text-red-600 text-sm mt-2">
                <AlertCircle className="w-4 h-4" />
                <span>{err}</span>
              </div>
            ))}
            {formData.attachments.length > 0 && (
              <div className="mt-3 space-y-1">
                {formData.attachments.map((file, i) => (
                  <div key={i} className="flex justify-between items-center bg-white p-2 border rounded text-sm">
                    <span className="truncate">{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                    <button type="button" onClick={() => handleRemoveFile(i)} className="text-red-500 hover:text-red-700 ml-3">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Priorité ── */}
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Priorité</label>
            <select
              name="priority"
              value={formData.priority}
              onChange={handleChange}
              aria-label="Priorité du message"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="Basse">Basse</option>
              <option value="Normale">Normale</option>
              <option value="Haute">Haute</option>
              <option value="Urgente">Urgente</option>
            </select>
          </div>

          {/* ── Boutons ── */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-lg hover:bg-blue-700 transition font-bold text-lg disabled:bg-gray-400 shadow-lg"
            >
              {isSubmitting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Envoi...</>
              ) : (
                <><Send className="w-5 h-5" /> {isExternal ? 'Envoyer par email' : 'Envoyer'}</>
              )}
            </button>
            {!isExternal && (
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 bg-gray-200 text-gray-700 px-6 py-4 rounded-lg hover:bg-gray-300 transition font-bold disabled:opacity-50"
              >
                <FileEdit className="w-5 h-5" />
                Sauvegarder
              </button>
            )}
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default InternalMessagingPage;
