// src/pages/dashboard/InternalMessagingPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Send, Inbox, SendHorizontal, Star, Trash2, Search, X, Loader2,
  MailOpen, MailPlus, User, Clock, Paperclip, AlertCircle, Check, Download,
  FileEdit, RotateCcw, Trash, AlertTriangle
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
import { useAuth } from '../../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const UPLOAD_BASE_URL = `${API_BASE_URL.replace('/api', '')}`; 

// Taille max par fichier : 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;

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
  const messagesEndRef = useRef(null);

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
        case 'inbox':
          data = await getReceivedMessages();
          break;
        case 'sent':
          data = await getSentMessages();
          break;
        case 'unread':
          data = await getUnreadMessages();
          break;
        case 'starred':
          data = await getStarredMessages();
          break;
        case 'drafts':
          data = await getDraftMessages();
          break;
        case 'trash':
          data = await getTrashedMessages();
          break;
        default:
          data = await getReceivedMessages();
      }
      
      setMessages(data);
    } catch (err) {
      console.error('Erreur lors du chargement des messages:', err);
      showNotification('Erreur lors du chargement des messages', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const count = await countUnread();
      setUnreadCount(count);
    } catch (err) {
      console.error('Erreur lors du comptage des messages non lus:', err);
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
      } catch (err) {
        console.error('Erreur lors du marquage comme lu:', err);
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
      // Suppression définitive depuis la corbeille
      if (!window.confirm('⚠️ Supprimer DÉFINITIVEMENT ce message ? Cette action est irréversible.')) return;
      
      try {
        await permanentlyDelete(messageId);
        showNotification('Message supprimé définitivement');
        setSelectedMessage(null);
        fetchMessages();
      } catch (err) {
        showNotification('Erreur lors de la suppression définitive', 'error');
      }
    } else if (activeView === 'drafts') {
      // Suppression d'un brouillon
      if (!window.confirm('Supprimer ce brouillon ?')) return;
      
      try {
        await deleteDraft(messageId);
        showNotification('Brouillon supprimé');
        setSelectedMessage(null);
        fetchMessages();
      } catch (err) {
        showNotification('Erreur lors de la suppression du brouillon', 'error');
      }
    } else {
      // Déplacement vers la corbeille
      if (!window.confirm('Déplacer ce message vers la corbeille ?')) return;

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
    if (!window.confirm('⚠️ Vider la corbeille ? Tous les messages seront DÉFINITIVEMENT supprimés.')) return;

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
        // Sauvegarde d'un brouillon
        if (draftId) {
          await updateDraft(draftId, messageData);
          showNotification('Brouillon mis à jour');
        } else {
          await saveDraft(messageData);
          showNotification('Brouillon sauvegardé');
        }
      } else {
        // Envoi d'un email interne
        await sendInternalMail(messageData);
        showNotification('Email envoyé avec succès');
        
        // Si c'était un brouillon, le supprimer
        if (draftId) {
          await deleteDraft(draftId);
        }
      }
      
      setShowComposeModal(false);
      setEditingDraft(null);
      fetchMessages();
    } catch (err) {
      console.error('Erreur lors de l\'opération:', err);
      showNotification(isDraft ? 'Erreur lors de la sauvegarde du brouillon' : 'Erreur lors de l\'envoi de l\'email', 'error');
    }
  };

  const filteredMessages = messages.filter(msg =>
    msg.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (activeView === 'sent' ? msg.receiver?.name : msg.sender?.name)?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
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

      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b">
          <button
            onClick={() => {
              setEditingDraft(null);
              setShowComposeModal(true);
            }}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            <MailPlus className="w-5 h-5" />
            Nouveau Message
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          <NavButton
            icon={Inbox}
            label="Boîte de réception"
            badge={unreadCount}
            active={activeView === 'inbox'}
            onClick={() => setActiveView('inbox')}
          />
          <NavButton
            icon={SendHorizontal}
            label="Messages envoyés"
            active={activeView === 'sent'}
            onClick={() => setActiveView('sent')}
          />
          <NavButton
            icon={MailOpen}
            label="Non lus"
            badge={unreadCount}
            active={activeView === 'unread'}
            onClick={() => setActiveView('unread')}
          />
          <NavButton
            icon={Star}
            label="Favoris"
            active={activeView === 'starred'}
            onClick={() => setActiveView('starred')}
          />
          <NavButton
            icon={FileEdit}
            label="Brouillons"
            active={activeView === 'drafts'}
            onClick={() => setActiveView('drafts')}
          />
          <NavButton
            icon={Trash2}
            label="Corbeille"
            active={activeView === 'trash'}
            onClick={() => setActiveView('trash')}
          />
        </nav>

        {/* Bouton vider la corbeille */}
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

      {/* Liste des messages */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
                  currentUserId={user._id}
                  activeView={activeView}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Détails du message */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {selectedMessage ? (
          <MessageDetail
            message={selectedMessage}
            onToggleStar={handleToggleStar}
            onDelete={handleDelete}
            onRestore={activeView === 'trash' ? handleRestore : null}
            currentUserId={user._id}
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

      {/* Modal Composer */}
      <AnimatePresence>
        {showComposeModal && (
          <ComposeModal
            onClose={() => {
              setShowComposeModal(false);
              setEditingDraft(null);
            }}
            onSend={handleSendMessage}
            editingDraft={editingDraft}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// Bouton de navigation
const NavButton = ({ icon: Icon, label, badge, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
      active
        ? 'bg-blue-50 text-blue-600 font-semibold'
        : 'text-gray-700 hover:bg-gray-100'
    }`}
  >
    <Icon className="w-5 h-5" />
    <span className="flex-1 text-left">{label}</span>
    {badge > 0 && (
      <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">
        {badge}
      </span>
    )}
  </button>
);

// Item de message dans la liste
const MessageItem = ({ message, selected, onClick, onEdit, currentUserId, activeView }) => {
  const isUnread = !message.isRead; 
  const isStarred = message.isStarred; 
  const hasAttachments = message.attachments && message.attachments.length > 0;
  const isDraft = activeView === 'drafts';

  const formatDate = (date) => {
    const d = new Date(date);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    
    if (isToday) {
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  return (
    <div
      onClick={onClick}
      className={`p-4 cursor-pointer hover:bg-gray-50 transition relative ${
        selected ? 'bg-blue-50 border-l-4 border-blue-600' : ''
      } ${isUnread ? 'bg-blue-50/30' : ''}`}
    >
      {isDraft && (
        <div className="absolute top-2 right-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition"
            title="Éditer le brouillon"
          >
            <FileEdit className="w-4 h-4" />
          </button>
        </div>
      )}
      
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
          {activeView === 'sent' ? message.receiver?.name?.charAt(0) || 'U' : message.sender?.name?.charAt(0) || 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className={`truncate ${isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>
              {isDraft ? 'Brouillon' : (activeView === 'sent' ? message.receiver?.name : message.sender?.name)}
            </p>
            <div className="flex items-center gap-2">
              {isStarred && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
              {hasAttachments && <Paperclip className="w-4 h-4 text-gray-500" />}
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

// Détails du message
const MessageDetail = ({ message, onToggleStar, onDelete, onRestore, currentUserId, uploadBaseUrl, isTrash, isDraft }) => {
  const isStarred = message.isStarred;

  const formatFullDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      <div className="bg-white border-b p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
              {message.sender?.name?.charAt(0) || 'U'}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-1">{message.subject || '(Sans objet)'}</h2>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="font-medium">{message.sender?.name}</span>
                <span>•</span>
                <span>{message.sender?.email}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
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
                    onClick={() => onToggleStar(message._id, isStarred)}
                    className={`p-2 rounded-lg transition ${
                      isStarred
                        ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title={isStarred ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  >
                    <Star className={`w-5 h-5 ${isStarred ? 'fill-yellow-500' : ''}`} />
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
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-white">
        <div className="max-w-3xl">
          <div className="prose prose-blue max-w-none">
            <p className="text-gray-700 text-lg leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          </div>

          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Paperclip className="w-5 h-5" />
                Pièces jointes ({message.attachments.length})
              </h3>
              <div className="space-y-2">
                {message.attachments.map((attachment, index) => (
                  <a
                    key={index}
                    href={`${uploadBaseUrl}/${attachment.filepath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={attachment.filename}
                    className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition border"
                  >
                    <div className="flex items-center min-w-0 gap-2">
                      <Paperclip className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <span className="text-blue-600 hover:underline truncate font-medium">{attachment.filename}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 flex-shrink-0">
                      <span>{formatFileSize(attachment.size)}</span>
                      <Download className='w-4 h-4' />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// Modal Composer
const ComposeModal = ({ onClose, onSend, editingDraft }) => {
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    recipients: editingDraft?.receiver?._id ? [editingDraft.receiver._id] : [],
    recipientInput: '',
    subject: editingDraft?.subject || '',
    content: editingDraft?.content || '',
    priority: editingDraft?.priority || 'Normale',
    attachments: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileErrors, setFileErrors] = useState([]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const errors = [];
    
    if (files.length > MAX_FILES) {
      errors.push(`Vous ne pouvez joindre que ${MAX_FILES} fichiers maximum.`);
      setFileErrors(errors);
      return;
    }
    
    // Vérifier la taille de chaque fichier
    files.forEach((file, index) => {
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name} dépasse la taille maximale de ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
      }
    });
    
    if (errors.length > 0) {
      setFileErrors(errors);
      return;
    }
    
    setFileErrors([]);
    setFormData({ ...formData, attachments: files });
  };
  
  const handleRemoveFile = (indexToRemove) => {
    setFormData({
      ...formData,
      attachments: formData.attachments.filter((_, index) => index !== indexToRemove)
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
    }
  };

  const handleSubmit = async (e, isDraft = false) => {
    e.preventDefault();

    if (formData.recipients.length === 0 && !isDraft) {
      alert('Veuillez ajouter au moins un destinataire');
      return;
    }

    if (!formData.content.trim() && formData.attachments.length === 0 && !isDraft) {
      alert('Veuillez écrire un message ou joindre au moins un fichier.');
      return;
    }

    setIsSubmitting(true);

    const dataToSend = new FormData();
    
    if (formData.recipients.length > 0) {
      dataToSend.append('receiverId', formData.recipients[0]);
    }
    
    dataToSend.append('subject', formData.subject);
    dataToSend.append('content', formData.content);
    dataToSend.append('priority', formData.priority);
    dataToSend.append('messageType', 'Message');
    
    if (isDraft) {
      dataToSend.append('isDraft', 'true');
    }
    
    formData.attachments.forEach((file) => {
      dataToSend.append('attachments', file); 
    });

    await onSend(dataToSend, isDraft, editingDraft?._id);
    setIsSubmitting(false);
  };

  const handleAddRecipient = () => {
    if (formData.recipientInput && !formData.recipients.includes(formData.recipientInput)) {
      setFormData({
        ...formData,
        recipients: [...formData.recipients, formData.recipientInput],
        recipientInput: '',
      });
    }
  };

  const handleRemoveRecipient = (id) => {
    setFormData({
      ...formData,
      recipients: formData.recipients.filter(r => r !== id),
    });
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

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
          {/* Destinataires */}
          <div>
            <label className="block text-gray-700 font-semibold mb-2">
              Destinataires {!editingDraft && <span className="text-red-500">*</span>}
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                name="recipientInput"
                value={formData.recipientInput}
                onChange={handleChange}
                placeholder="ID utilisateur destinataire"
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddRecipient}
                className="bg-blue-600 text-white px-4 rounded-lg hover:bg-blue-700"
              >
                Ajouter
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.recipients.map((recipient, index) => (
                <span
                  key={index}
                  className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full flex items-center gap-2"
                >
                  {recipient}
                  <button
                    type="button"
                    onClick={() => handleRemoveRecipient(recipient)}
                    className="hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Sujet */}
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Sujet</label>
            <input
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              placeholder="Objet du message"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-gray-700 font-semibold mb-2">
              Message {!editingDraft && <span className="text-red-500">*</span>}
            </label>
            <textarea
              name="content"
              value={formData.content}
              onChange={handleChange}
              rows="6"
              placeholder="Écrivez votre message..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* Pièces jointes */}
          <div className="border p-4 rounded-lg bg-gray-50">
            <label className="block text-gray-700 font-semibold mb-2 flex items-center gap-2">
              <Paperclip className='w-5 h-5' /> Pièces Jointes (Max {MAX_FILES} fichiers, {MAX_FILE_SIZE / (1024 * 1024)}MB chacun)
            </label>
            <input
              type="file"
              name="attachments"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
            
            {fileErrors.length > 0 && (
              <div className="mt-2 space-y-1">
                {fileErrors.map((error, index) => (
                  <div key={index} className="flex items-center gap-2 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            )}
            
            {formData.attachments.length > 0 && (
              <div className="mt-3 space-y-1">
                {formData.attachments.map((file, index) => (
                  <div key={index} className="flex justify-between items-center bg-white p-2 border rounded text-sm">
                    <span className='truncate'>{file.name} ({(file.size / 1024).toFixed(2)} KB)</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(index)}
                      className="text-red-500 hover:text-red-700 ml-3"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Priorité */}
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Priorité</label>
            <select
              name="priority"
              value={formData.priority}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="Basse">Basse</option>
              <option value="Normale">Normale</option>
              <option value="Haute">Haute</option>
              <option value="Urgente">Urgente</option>
            </select>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-lg hover:bg-blue-700 transition font-bold text-lg disabled:bg-gray-400 shadow-lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Envoyer
                </>
              )}
            </button>
            
            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 bg-gray-200 text-gray-700 px-6 py-4 rounded-lg hover:bg-gray-300 transition font-bold disabled:bg-gray-400"
            >
              <FileEdit className="w-5 h-5" />
              Sauvegarder
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default InternalMessagingPage;