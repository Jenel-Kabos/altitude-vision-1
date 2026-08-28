"use client";

// src/pages/dashboard/InternalMessagingPage.jsx
// INBOX-PRO-2 — voir server/docs/INBOX_PRO2_UX_AUDIT.md pour l'audit
// complet avant refonte. Architecture cible : rail de navigation compact
// (InboxNavRail) + liste dense (ConversationList/ConversationRow) +
// panneau de lecture dominant (ConversationViewer, réutilise
// SafeHtmlEmailViewer d'INBOX-PRO-1 sans le modifier) + drawer contact
// escamotable (ContactDrawer) au lieu d'une 3e colonne permanente.
// AUCUN nouveau modèle/route/Socket.IO/polling créé — mêmes services
// (`messageService.js`) qu'avant, mêmes mécanismes d'envoi/lecture.
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Send, Inbox, SendHorizontal, Star, Trash2, Search, X, Loader2,
  MailOpen, MailPlus, User, Clock, Paperclip, AlertCircle, Check,
  FileEdit, RotateCcw, Trash, AlertTriangle, ChevronDown, Info,
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
  moveToTrash,
  restoreFromTrash,
  permanentlyDelete,
  emptyTrash,
  saveDraft,
  updateDraft,
  deleteDraft,
  countUnread,
} from '../../services/messageService';
import { getAllUsers } from '../../services/userService';
import { useAuth } from '../../context/AuthContext';
import toast from '@/lib/utils/toast';
import confirmDialog from '@/lib/utils/confirm';
import BackButton from '../../components/navigation/BackButton';
import SafeHtmlEmailViewer from '../../components/messaging/SafeHtmlEmailViewer';
import ConversationRow from '../../components/messaging/ConversationRow';
import AttachmentStrip from '../../components/messaging/AttachmentStrip';
import ContactDrawer from '../../components/messaging/ContactDrawer';
import InboxToolbar from '../../components/messaging/InboxToolbar';
import InboxNavRail from '../../components/messaging/InboxNavRail';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

const FOLDER_LABELS = {
  inbox: 'Boîte de réception', sent: 'Messages envoyés', unread: 'Non lus',
  starred: 'Favoris', drafts: 'Brouillons', trash: 'Corbeille',
};

// Écran mobile "dossiers" (première étape de la navigation mono-écran,
// mandat §26) — conserve la présentation labellisée existante (plus
// lisible au doigt qu'un rail icônes-only), alimentée par les mêmes
// dossiers que InboxNavRail (aucune capacité dupliquée/divergente).
const MobileFolderList = ({ activeView, unreadCount, onSelect, onCompose, user, showEmptyTrash, onEmptyTrash }) => (
  <div className="flex lg:hidden w-full flex-shrink-0 bg-white border-r border-gray-200 flex-col">
    <div className="p-4 border-b">
      <button
        onClick={onCompose}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
      >
        <MailPlus className="w-5 h-5" />
        Nouveau Message
      </button>
    </div>
    <nav className="flex-1 p-2 space-y-1 overflow-y-auto" aria-label="Choisir un dossier">
      {[
        { id: 'inbox', icon: Inbox, badge: unreadCount },
        { id: 'sent', icon: SendHorizontal },
        { id: 'unread', icon: MailOpen, badge: unreadCount },
        { id: 'starred', icon: Star },
        { id: 'drafts', icon: FileEdit },
        { id: 'trash', icon: Trash2 },
      ].map(({ id, icon: Icon, badge }) => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
            activeView === id ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Icon className="w-5 h-5" />
          <span className="flex-1 text-left">{FOLDER_LABELS[id]}</span>
          {badge > 0 && <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">{badge}</span>}
        </button>
      ))}
    </nav>
    {showEmptyTrash && (
      <div className="p-4 border-t">
        <button onClick={onEmptyTrash} className="w-full flex items-center justify-center gap-2 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition text-sm">
          <Trash className="w-4 h-4" /> Vider la corbeille
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
);

// =============================================================
// 🏠 COMPOSANT PRINCIPAL
// =============================================================
const InternalMessagingPage = () => {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState('inbox');
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [listFilter, setListFilter] = useState('all');
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [editingDraft, setEditingDraft] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [unreadCount, setUnreadCount] = useState(0);
  const [allUsers, setAllUsers] = useState([]);
  const [mobilePane, setMobilePane] = useState('folders');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const users = await getAllUsers();
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
      fetchMessages({ silent: true });
      fetchUnreadCount();
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

  const fetchMessages = async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true); else setLoading(true);
      setLoadError(false);
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
      setLoadError(true);
      if (!silent) showNotification('Erreur lors du chargement des messages', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
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
    setMobilePane('detail');
    setDrawerOpen(false);
    if ((activeView === 'inbox' || activeView === 'unread') && !message.isRead) {
      try {
        await markAsRead(message._id);
        fetchMessages({ silent: true });
        fetchUnreadCount();
        window.dispatchEvent(new CustomEvent('altitude:dashboard-badges:refresh'));
      } catch (err) {
        console.error('Erreur mark as read:', err);
      }
    }
  };

  const handleSelectFolder = (id) => {
    setActiveView(id);
    setSelectedMessage(null);
    setListFilter('all');
    setSearchTerm('');
    setMobilePane('list');
  };

  const handleToggleStar = async (messageId, isStarred) => {
    try {
      if (isStarred) { await removeStar(messageId); showNotification('Retiré des favoris'); }
      else { await addStar(messageId); showNotification('Ajouté aux favoris'); }
      fetchMessages({ silent: true });
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
      } catch (err) { showNotification('Erreur lors de la suppression définitive', 'error'); }
    } else if (activeView === 'drafts') {
      if (!await confirmDialog('Supprimer ce brouillon ?', { title: 'Supprimer le brouillon', danger: true })) return;
      try {
        await deleteDraft(messageId);
        showNotification('Brouillon supprimé');
        setSelectedMessage(null);
        fetchMessages();
      } catch (err) { showNotification('Erreur lors de la suppression du brouillon', 'error'); }
    } else {
      if (!await confirmDialog('Déplacer ce message vers la corbeille ?', { title: 'Mettre à la corbeille' })) return;
      try {
        await moveToTrash(messageId);
        showNotification('Message déplacé vers la corbeille');
        setSelectedMessage(null);
        fetchMessages();
      } catch (err) { showNotification('Erreur lors du déplacement', 'error'); }
    }
  };

  const handleRestore = async (messageId) => {
    try {
      await restoreFromTrash(messageId);
      showNotification('Message restauré avec succès');
      setSelectedMessage(null);
      fetchMessages();
    } catch (err) { showNotification('Erreur lors de la restauration', 'error'); }
  };

  const handleEmptyTrash = async () => {
    if (!await confirmDialog('Vider la corbeille ? Tous les messages seront DÉFINITIVEMENT supprimés.', { title: 'Vider la corbeille', danger: true })) return;
    try {
      await emptyTrash();
      showNotification('Corbeille vidée avec succès');
      setSelectedMessage(null);
      fetchMessages();
    } catch (err) { showNotification('Erreur lors du vidage de la corbeille', 'error'); }
  };

  const handleEditDraft = (draft) => { setEditingDraft(draft); setShowComposeModal(true); };

  const handleSendMessage = async (messageData, isDraft = false, draftId = null) => {
    try {
      if (isDraft) {
        if (draftId) { await updateDraft(draftId, messageData); showNotification('Brouillon mis à jour'); }
        else { await saveDraft(messageData); showNotification('Brouillon sauvegardé'); }
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
      showNotification(isDraft ? 'Erreur lors de la sauvegarde du brouillon' : "Erreur lors de l'envoi de l'email", 'error');
    }
  };

  const filteredMessages = messages
    .filter(msg => listFilter === 'all' || (listFilter === 'unread' ? !msg.isRead : msg.attachments?.length > 0))
    .filter(msg =>
      msg.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (activeView === 'sent' ? msg.receiver?.name : msg.sender?.name)?.toLowerCase().includes(searchTerm.toLowerCase())
    );

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] md:h-[calc(100dvh-3rem)] min-h-[32rem] min-w-0 bg-gray-50 overflow-hidden">
      <AnimatePresence>
        {notification.show && (
          <motion.div
            initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }}
            className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg text-white ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}
          >
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile : écran "dossiers" (étape 1/3 de la navigation mono-écran) */}
      {mobilePane === 'folders' && (
        <MobileFolderList
          activeView={activeView}
          unreadCount={unreadCount}
          onSelect={handleSelectFolder}
          onCompose={() => { setEditingDraft(null); setShowComposeModal(true); }}
          user={user}
          showEmptyTrash={activeView === 'trash' && messages.length > 0}
          onEmptyTrash={handleEmptyTrash}
        />
      )}

      {/* Desktop : rail de navigation compact (remplace l'ancienne sidebar pleine largeur) */}
      <InboxNavRail
        activeView={activeView}
        unreadCount={unreadCount}
        onSelectFolder={handleSelectFolder}
        onCompose={() => { setEditingDraft(null); setShowComposeModal(true); }}
        user={user}
      />

      {/* Liste des conversations : 320-380px (mandat §4), jamais 33/33/33 */}
      <div className={`${mobilePane === 'list' ? 'flex' : 'hidden'} lg:flex w-full lg:w-[340px] flex-shrink-0 bg-white border-r border-gray-200 flex-col`}>
        <div className="lg:hidden px-2 pt-2">
          <BackButton onBack={() => setMobilePane('folders')} fallbackHref="/dashboard/messages" label="Retour aux dossiers" className="-ml-2" />
        </div>
        <InboxToolbar
          title={FOLDER_LABELS[activeView]}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filter={listFilter}
          onFilterChange={setListFilter}
          onRefresh={() => fetchMessages({ silent: true })}
          refreshing={refreshing}
        />
        <div className="min-h-0 flex-1 overflow-y-auto" data-testid="inbox-message-list-scroll">
          {loading ? (
            <ListSkeleton />
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
              <AlertTriangle className="w-10 h-10 text-gray-300" />
              <p className="text-sm text-gray-500">Impossible de charger les messages.</p>
              <button onClick={() => fetchMessages()} className="text-sm font-semibold text-blue-600 hover:underline">Réessayer</button>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 px-6 text-center">
              <Mail className="w-10 h-10 text-gray-300" />
              <p className="text-sm">{searchTerm || listFilter !== 'all' ? 'Aucun résultat.' : 'Aucun message.'}</p>
            </div>
          ) : (
            <div>
              {filteredMessages.map((message) => (
                <ConversationRow
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

      {/* Panneau de lecture : dominant, aucune 3e colonne permanente */}
      <div className={`${mobilePane === 'detail' ? 'flex' : 'hidden'} lg:flex min-w-0 flex-1 flex-col bg-white`}>
        {selectedMessage ? (
          <>
            <div className="lg:hidden bg-white border-b px-2 py-2 flex-shrink-0">
              <BackButton onBack={() => setMobilePane('list')} fallbackHref="/dashboard/messages" label="Retour aux messages" />
            </div>
            <div className="min-h-0 flex-1 flex flex-col overflow-hidden" data-testid="inbox-message-viewer">
              <ConversationViewer
                message={selectedMessage}
                activeView={activeView}
                onToggleStar={handleToggleStar}
                onDelete={handleDelete}
                onRestore={activeView === 'trash' ? handleRestore : null}
                isTrash={activeView === 'trash'}
                isDraft={activeView === 'drafts'}
                onOpenContact={() => setDrawerOpen(true)}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
            <Mail className="w-16 h-16 text-gray-200" />
            <p className="text-sm">Sélectionnez une conversation pour afficher les messages.</p>
          </div>
        )}
      </div>

      <ContactDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        message={selectedMessage ? { ...selectedMessage, __activeView: activeView } : null}
      />

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
// 💀 ListSkeleton — remplace le spinner plein écran (mandat §29)
// =============================================================
const ListSkeleton = () => (
  <div className="animate-pulse divide-y divide-gray-50" aria-hidden="true">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="flex items-start gap-2.5 px-3 py-2.5">
        <div className="w-7 h-7 rounded-full bg-gray-200 flex-shrink-0" />
        <div className="flex-1 space-y-1.5 pt-0.5">
          <div className="h-2.5 bg-gray-200 rounded w-1/3" />
          <div className="h-2 bg-gray-100 rounded w-2/3" />
        </div>
      </div>
    ))}
  </div>
);

// =============================================================
// 📄 ConversationViewer — remplace l'ancien MessageDetail (rename +
// largeur pleine, plus jamais contrainte à max-w-3xl : mandat §13,
// "utiliser tout l'espace disponible"). Réutilise SafeHtmlEmailViewer
// et AttachmentStrip TELS QUELS.
// =============================================================
const ConversationViewer = ({ message, activeView, onToggleStar, onDelete, onRestore, isTrash, isDraft, onOpenContact }) => {
  const formatFullDate = (date) =>
    new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  const senderName = activeView === 'sent' ? message.receiver?.name : (message.sender?.name || message.senderName);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-gray-100 px-6 py-4 flex-shrink-0">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-800 mb-1 break-words">{message.subject || '(Sans objet)'}</h2>
            <button
              type="button"
              onClick={onOpenContact}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition group"
              aria-label={`Voir les informations de ${senderName || 'l’expéditeur'}`}
            >
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 bg-gradient-to-br from-blue-500 to-purple-600">
                {senderName?.charAt(0)?.toUpperCase() || '?'}
              </span>
              <span className="font-medium">{senderName || '(Inconnu)'}</span>
              <Info className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500" />
            </button>
          </div>

          <div className="flex gap-1.5 flex-shrink-0">
            {isTrash ? (
              <>
                <IconButton onClick={() => onRestore(message._id)} title="Restaurer" tone="green"><RotateCcw className="w-4 h-4" /></IconButton>
                <IconButton onClick={() => onDelete(message._id)} title="Supprimer définitivement" tone="red"><AlertTriangle className="w-4 h-4" /></IconButton>
              </>
            ) : (
              <>
                {!isDraft && (
                  <IconButton onClick={() => onToggleStar(message._id, message.isStarred)} title={message.isStarred ? 'Retirer des favoris' : 'Ajouter aux favoris'} tone={message.isStarred ? 'amber' : 'gray'}>
                    <Star className={`w-4 h-4 ${message.isStarred ? 'fill-amber-500' : ''}`} />
                  </IconButton>
                )}
                <IconButton onClick={() => onDelete(message._id)} title={isDraft ? 'Supprimer le brouillon' : 'Déplacer vers la corbeille'} tone="red">
                  <Trash2 className="w-4 h-4" />
                </IconButton>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          <span>{formatFullDate(message.createdAt)}</span>
          {message.priority && message.priority !== 'Normale' && (
            <span className={`ml-1 px-2 py-0.5 rounded-full font-semibold ${
              message.priority === 'Urgente' ? 'bg-red-100 text-red-700' :
              message.priority === 'Haute' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {message.priority}
            </span>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-5" data-testid="inbox-message-body-scroll">
        <SafeHtmlEmailViewer html={message.html} text={message.content} />
        <div className="flex-shrink-0">
          <AttachmentStrip attachments={message.attachments} />
        </div>
      </div>
    </div>
  );
};

const IconButton = ({ onClick, title, tone, children }) => {
  const tones = {
    green: 'bg-green-50 text-green-600 hover:bg-green-100',
    red: 'bg-red-50 text-red-600 hover:bg-red-100',
    amber: 'bg-amber-50 text-amber-600 hover:bg-amber-100',
    gray: 'bg-gray-100 text-gray-500 hover:bg-gray-200',
  };
  return (
    <button
      type="button" onClick={onClick} title={title} aria-label={title}
      className={`p-2 rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${tones[tone]}`}
    >
      {children}
    </button>
  );
};

// =============================================================
// ✏️ ComposeModal — Interne + Externe (mécanisme inchangé, mandat §19-20 :
// conserver l'envoi existant, ne pas reconstruire un éditeur riche sans
// besoin démontré)
// =============================================================
const ComposeModal = ({ onClose, onSend, editingDraft, allUsers }) => {
  const fileInputRef = useRef(null);
  const [searchUser, setSearchUser]     = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isExternal, setIsExternal]     = useState(false);
  const dropdownRef                      = useRef(null);

  const [formData, setFormData] = useState({
    recipient: editingDraft?.receiver
      ? { _id: editingDraft.receiver._id, name: editingDraft.receiver.name, email: editingDraft.receiver.email }
      : null,
    externalEmail: '',
    subject:     editingDraft?.subject  || '',
    content:     editingDraft?.content  || '',
    priority:    editingDraft?.priority || 'Normale',
    attachments: [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileErrors,   setFileErrors]   = useState([]);
  const [emailError,   setEmailError]   = useState('');

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const filteredUsers = allUsers.filter(u =>
    searchUser === '' ||
    u.name?.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchUser.toLowerCase())
  );

  const handleSelectUser = (u) => { setFormData(prev => ({ ...prev, recipient: u })); setSearchUser(''); setShowDropdown(false); };
  const handleClearRecipient = () => setFormData(prev => ({ ...prev, recipient: null }));

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (e.target.name === 'externalEmail') setEmailError('');
  };

  const handleToggleExternal = (value) => {
    setIsExternal(value);
    setEmailError('');
    setFormData(prev => ({ ...prev, recipient: null, externalEmail: '' }));
    setSearchUser('');
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const errors = [];
    if (files.length > MAX_FILES) { errors.push(`Maximum ${MAX_FILES} fichiers autorisés.`); setFileErrors(errors); return; }
    files.forEach(file => { if (file.size > MAX_FILE_SIZE) errors.push(`${file.name} dépasse ${MAX_FILE_SIZE / (1024 * 1024)}MB`); });
    if (errors.length > 0) { setFileErrors(errors); return; }
    setFileErrors([]);
    setFormData(prev => ({ ...prev, attachments: files }));
  };

  const handleRemoveFile = (idx) => {
    setFormData(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== idx) }));
    if (fileInputRef.current) fileInputRef.current.value = null;
  };

  const handleSubmit = async (e, isDraft = false) => {
    e.preventDefault();
    if (!isDraft) {
      if (isExternal) {
        if (!formData.externalEmail || !isValidEmail(formData.externalEmail)) { setEmailError('Veuillez saisir une adresse email valide.'); return; }
      } else if (!formData.recipient) {
        toast.warning('Veuillez sélectionner un destinataire.'); return;
      }
      if (!formData.content.trim() && formData.attachments.length === 0) {
        toast.warning('Veuillez écrire un message ou joindre au moins un fichier.'); return;
      }
    }

    setIsSubmitting(true);
    const data = new FormData();
    if (isExternal) { data.append('isExternal', 'true'); data.append('receiverEmail', formData.externalEmail); }
    else if (formData.recipient) data.append('receiverId', formData.recipient._id);
    data.append('subject', formData.subject);
    data.append('content', formData.content);
    data.append('priority', formData.priority);
    data.append('messageType', 'Message');
    if (isDraft) data.append('isDraft', 'true');
    formData.attachments.forEach(file => data.append('attachments', file));

    await onSend(data, isDraft, editingDraft?._id);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-8 relative"
      >
        <button onClick={onClose} disabled={isSubmitting} className="absolute top-4 right-4 text-gray-500 hover:text-red-600 transition p-2 rounded-full bg-gray-100">
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-3xl font-bold text-gray-800 mb-6">{editingDraft ? 'Éditer le brouillon' : 'Nouveau Message'}</h2>

        <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-xl w-fit">
          <button type="button" onClick={() => handleToggleExternal(false)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${!isExternal ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <User className="w-4 h-4" /> Collaborateur interne
          </button>
          <button type="button" onClick={() => handleToggleExternal(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${isExternal ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Mail className="w-4 h-4" /> Email externe
          </button>
        </div>

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Destinataire <span className="text-red-500">*</span></label>
            {isExternal ? (
              <div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input type="email" name="externalEmail" value={formData.externalEmail} onChange={handleChange}
                    placeholder="destinataire@gmail.com" aria-label="Email du destinataire externe"
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${emailError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300'}`} />
                </div>
                {emailError && <div className="flex items-center gap-2 text-red-600 text-sm mt-1"><AlertCircle className="w-4 h-4" /><span>{emailError}</span></div>}
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Check className="w-3 h-3 text-green-500" />Envoyé via Zoho Mail depuis votre adresse professionnelle</p>
              </div>
            ) : formData.recipient ? (
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                  {formData.recipient.name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{formData.recipient.name}</p>
                  <p className="text-sm text-gray-500 truncate">{formData.recipient.email}</p>
                </div>
                <button type="button" onClick={handleClearRecipient} className="text-gray-400 hover:text-red-500 transition"><X className="w-5 h-5" /></button>
              </div>
            ) : (
              <div ref={dropdownRef} className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input type="text" value={searchUser} onChange={(e) => { setSearchUser(e.target.value); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)} placeholder="Rechercher un collaborateur..." aria-label="Rechercher un collaborateur"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                </div>
                {showDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                    {filteredUsers.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 text-sm">{allUsers.length === 0 ? 'Chargement...' : 'Aucun résultat'}</div>
                    ) : (
                      filteredUsers.map(u => (
                        <button key={u._id} type="button" onClick={() => handleSelectUser(u)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition text-left">
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

          <div>
            <label className="block text-gray-700 font-semibold mb-2">Sujet</label>
            <input type="text" name="subject" value={formData.subject} onChange={handleChange} placeholder="Objet du message" aria-label="Sujet du message"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2">Message <span className="text-red-500">*</span></label>
            <textarea name="content" value={formData.content} onChange={handleChange} rows="6" placeholder="Écrivez votre message..." aria-label="Contenu du message"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          <div className="border p-4 rounded-lg bg-gray-50">
            <label className="block text-gray-700 font-semibold mb-2 flex items-center gap-2">
              <Paperclip className="w-5 h-5" /> Pièces jointes (max {MAX_FILES} fichiers, {MAX_FILE_SIZE / (1024 * 1024)}MB chacun)
            </label>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple aria-label="Pièces jointes"
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
            {fileErrors.map((err, i) => (
              <div key={i} className="flex items-center gap-2 text-red-600 text-sm mt-2"><AlertCircle className="w-4 h-4" /><span>{err}</span></div>
            ))}
            {formData.attachments.length > 0 && (
              <div className="mt-3 space-y-1">
                {formData.attachments.map((file, i) => (
                  <div key={i} className="flex justify-between items-center bg-white p-2 border rounded text-sm">
                    <span className="truncate">{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                    <button type="button" onClick={() => handleRemoveFile(i)} className="text-red-500 hover:text-red-700 ml-3"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2">Priorité</label>
            <select name="priority" value={formData.priority} onChange={handleChange} aria-label="Priorité du message"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="Basse">Basse</option>
              <option value="Normale">Normale</option>
              <option value="Haute">Haute</option>
              <option value="Urgente">Urgente</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-lg hover:bg-blue-700 transition font-bold text-lg disabled:bg-gray-400 shadow-lg">
              {isSubmitting ? (<><Loader2 className="w-5 h-5 animate-spin" /> Envoi...</>) : (<><Send className="w-5 h-5" /> {isExternal ? 'Envoyer par email' : 'Envoyer'}</>)}
            </button>
            {!isExternal && (
              <button type="button" onClick={(e) => handleSubmit(e, true)} disabled={isSubmitting}
                className="flex items-center justify-center gap-2 bg-gray-200 text-gray-700 px-6 py-4 rounded-lg hover:bg-gray-300 transition font-bold disabled:opacity-50">
                <FileEdit className="w-5 h-5" /> Sauvegarder
              </button>
            )}
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default InternalMessagingPage;
