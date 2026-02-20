// src/pages/dashboard/ManageEmailsPage.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Plus, Edit2, Trash2, Search, X, Loader2, AlertCircle, Save,
  CheckCircle, XCircle, Bell, BellOff, Users, TrendingUp, Shield, Eye, EyeOff, Send
} from 'lucide-react';
import {
  getAllEmails,
  createEmail,
  updateEmail,
  deleteEmail,
  toggleEmailStatus,
  updateNotifications,
  getGlobalStats,
  sendEmailViaZoho
} from '../../services/emailService';
import { useAuth } from '../../context/AuthContext';

const ManageEmailsPage = () => {
  const { user } = useAuth();
  const [emails, setEmails] = useState([]);
  const [filteredEmails, setFilteredEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [stats, setStats] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchEmails();
    fetchStats();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = emails.filter((email) =>
        email.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.emailType?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredEmails(filtered);
    } else {
      setFilteredEmails(emails);
    }
  }, [searchTerm, emails]);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllEmails();
      setEmails(data);
      setFilteredEmails(data);
    } catch (err) {
      console.error('Erreur lors du chargement des emails:', err);
      setError('Impossible de charger les emails');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await getGlobalStats();
      setStats(data);
    } catch (err) {
      console.error('Erreur lors du chargement des statistiques:', err);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 4000);
  };

  const handleAdd = () => {
    setModalMode('add');
    setSelectedEmail(null);
    setShowModal(true);
  };

  const handleEdit = (email) => {
    setSelectedEmail(email);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleDelete = async (emailId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet email ?')) return;

    try {
      await deleteEmail(emailId);
      showNotification('Email supprimé avec succès');
      fetchEmails();
      fetchStats();
    } catch (err) {
      showNotification('Erreur lors de la suppression', 'error');
    }
  };

  const handleToggleStatus = async (emailId) => {
    try {
      await toggleEmailStatus(emailId);
      showNotification('Statut mis à jour avec succès');
      fetchEmails();
    } catch (err) {
      showNotification('Erreur lors de la mise à jour du statut', 'error');
    }
  };

  const handleFormSubmit = async (formData) => {
    try {
      if (modalMode === 'add') {
        await createEmail(formData);
        showNotification('Email créé avec succès');
      } else {
        await updateEmail(selectedEmail._id, formData);
        showNotification('Email modifié avec succès');
      }
      setShowModal(false);
      fetchEmails();
      fetchStats();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Erreur lors de l\'enregistrement', 'error');
    }
  };

  // ✅ NOUVELLE FONCTION : Envoyer un email de test
  const handleSendTestEmail = async (emailAddress) => {
    try {
      showNotification('Envoi en cours...', 'success');
      
      const result = await sendEmailViaZoho(
        emailAddress,
        'thibautkabos@gmail.com',
        'Email de test - Altitude Vision',
        `<html>
          <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h1 style="color: #0066cc; border-bottom: 3px solid #0066cc; padding-bottom: 10px;">
                🎉 Test depuis l'application
              </h1>
              <p style="font-size: 16px; line-height: 1.6; color: #333;">
                Cet email a été envoyé depuis votre application <strong>Altitude Vision</strong> !
              </p>
              <div style="background-color: #e8f4fd; padding: 15px; border-left: 4px solid #0066cc; margin: 20px 0;">
                <p style="margin: 0;"><strong>Expéditeur:</strong> ${emailAddress}</p>
                <p style="margin: 10px 0 0 0;"><strong>Date:</strong> ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Brazzaville' })}</p>
              </div>
              <p style="font-size: 14px; color: #999; text-align: center; margin-top: 30px;">
                © 2026 Altitude Vision Agency - Brazzaville, Congo
              </p>
            </div>
          </body>
        </html>`
      );
      
      showNotification(`✅ Email envoyé avec succès ! Total envoyé: ${result.emailsSent}`, 'success');
      fetchEmails(); // Rafraîchir pour voir le compteur mis à jour
      fetchStats(); // Rafraîchir les statistiques
    } catch (error) {
      console.error('Erreur envoi test:', error);
      showNotification(error.message || 'Erreur lors de l\'envoi de l\'email de test', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
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

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">Gestion des Emails Professionnels</h1>
        <p className="text-gray-600">Gérez les adresses @altitudevision.agency et leurs notifications</p>
      </div>

      {/* Statistiques */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard title="Total Emails" value={stats.global.totalEmails} icon={Mail} color="blue" />
          <StatCard title="Emails Actifs" value={stats.global.activeEmails} icon={CheckCircle} color="green" />
          <StatCard title="Emails Envoyés" value={stats.global.totalSent} icon={TrendingUp} color="purple" />
          <StatCard title="Avec Notifications" value={stats.withNotifications} icon={Bell} color="yellow" />
        </div>
      )}

      {/* Barre de recherche et bouton */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Rechercher un email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-semibold"
        >
          <Plus className="w-5 h-5" />
          Créer un Email
        </button>
      </div>

      {/* Erreur */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded">
          <div className="flex items-center">
            <AlertCircle className="text-red-500 w-6 h-6 mr-3" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Liste des emails */}
      {filteredEmails.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Aucun email trouvé</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEmails.map((email) => (
            <EmailCard
              key={email._id}
              email={email}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleStatus={handleToggleStatus}
              onSendTest={handleSendTestEmail}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <EmailModal
            mode={modalMode}
            email={selectedEmail}
            onClose={() => setShowModal(false)}
            onSubmit={handleFormSubmit}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// Composant Carte de Statistique
const StatCard = ({ title, value, icon: Icon, color }) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-600 text-sm font-medium">{title}</span>
        <Icon className={`w-5 h-5 text-${color}-500`} />
      </div>
      <p className="text-3xl font-bold text-gray-800">{value}</p>
    </div>
  );
};

// ✅ COMPOSANT EmailCard MIS À JOUR
const EmailCard = ({ email, onEdit, onDelete, onToggleStatus, onSendTest }) => {
  const hasNotifications = Object.values(email.notifications || {}).some(v => v === true);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition"
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-bold text-gray-800 truncate">{email.displayName}</h3>
            </div>
            <p className="text-sm text-gray-600 truncate">{email.email}</p>
          </div>
          <button
            onClick={() => onToggleStatus(email._id)}
            className={`p-2 rounded-full ${
              email.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
            }`}
            title={email.isActive ? 'Actif' : 'Inactif'}
          >
            {email.isActive ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          </button>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm">
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
              {email.emailType}
            </span>
          </div>

          {/* Compteur d'emails envoyés */}
          {email.emailsSent > 0 && (
            <div className="flex items-center text-sm text-purple-600">
              <TrendingUp className="w-4 h-4 mr-2" />
              <span>{email.emailsSent} email{email.emailsSent > 1 ? 's' : ''} envoyé{email.emailsSent > 1 ? 's' : ''}</span>
            </div>
          )}

          {email.assignedTo && (
            <div className="flex items-center text-sm text-gray-600">
              <Users className="w-4 h-4 mr-2" />
              <span className="truncate">{email.assignedTo.name}</span>
            </div>
          )}

          {hasNotifications && (
            <div className="flex items-center text-sm text-green-600">
              <Bell className="w-4 h-4 mr-2" />
              <span>Notifications actives</span>
            </div>
          )}

          {email.description && (
            <p className="text-sm text-gray-500 line-clamp-2">{email.description}</p>
          )}
        </div>

        {/* ✅ BOUTONS MIS À JOUR AVEC LE BOUTON TEST */}
        <div className="flex gap-2">
          <button
            onClick={() => onSendTest(email.email)}
            className="flex-1 flex items-center justify-center gap-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition text-sm"
            title="Envoyer un email de test"
          >
            <Send className="w-4 h-4" />
            Test
          </button>
          <button
            onClick={() => onEdit(email)}
            className="flex-1 flex items-center justify-center gap-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition text-sm"
          >
            <Edit2 className="w-4 h-4" />
            Modifier
          </button>
          <button
            onClick={() => onDelete(email._id)}
            className="flex-1 flex items-center justify-center gap-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Supprimer
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// Modal de Création/Modification
const EmailModal = ({ mode, email, onClose, onSubmit, showPassword, setShowPassword }) => {
  const [formData, setFormData] = useState({
    email: email?.email?.split('@')[0] || '',
    displayName: email?.displayName || '',
    emailType: email?.emailType || 'Contact Général',
    description: email?.description || '',
    assignedTo: email?.assignedTo?._id || '',
    password: '',
    notifications: {
      quotes: email?.notifications?.quotes || false,
      contactMessages: email?.notifications?.contactMessages || false,
      systemAlerts: email?.notifications?.systemAlerts || false,
      properties: email?.notifications?.properties || false,
      events: email?.notifications?.events || false,
    },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('notifications.')) {
      const notifKey = name.split('.')[1];
      setFormData({
        ...formData,
        notifications: {
          ...formData.notifications,
          [notifKey]: checked,
        },
      });
    } else {
      setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const fullEmail = `${formData.email}@altitudevision.agency`;
    
    if (!formData.email || !formData.displayName) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setIsSubmitting(true);
    
    const submitData = {
      ...formData,
      email: fullEmail,
      assignedTo: formData.assignedTo || null,
    };

    await onSubmit(submitData);
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
          {mode === 'add' ? 'Créer un Email Professionnel' : 'Modifier l\'Email'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations de base */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Adresse Email <span className="text-red-500">*</span>
              </label>
              <div className="flex">
                <input
                  type="text"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={mode === 'edit'}
                  placeholder="contact"
                  className="flex-1 p-3 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
                <span className="bg-gray-200 px-4 py-3 border border-l-0 border-gray-300 rounded-r-lg text-gray-700">
                  @altitudevision.agency
                </span>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Nom d'affichage <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="displayName"
                value={formData.displayName}
                onChange={handleChange}
                required
                placeholder="Ex: Service Contact"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2">Type d'email</label>
            <select
              name="emailType"
              value={formData.emailType}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="Contact Général">Contact Général</option>
              <option value="Devis & Commercial">Devis & Commercial</option>
              <option value="Support Technique">Support Technique</option>
              <option value="Administration">Administration</option>
              <option value="Marketing">Marketing</option>
              <option value="Événementiel">Événementiel</option>
              <option value="Immobilier">Immobilier</option>
              <option value="Personnel">Personnel</option>
              <option value="Autre">Autre</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              placeholder="Description de l'usage de cet email..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Mot de passe (optionnel) */}
          {mode === 'add' && (
            <div>
              <label className="block text-gray-700 font-semibold mb-2">Mot de passe (optionnel)</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}

          {/* Notifications */}
          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Bell className="w-5 h-5 text-yellow-600" />
              Notifications
            </h3>
            <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
              {[
                { key: 'quotes', label: 'Demandes de devis', icon: '💰' },
                { key: 'contactMessages', label: 'Messages de contact', icon: '📧' },
                { key: 'systemAlerts', label: 'Alertes système', icon: '🔔' },
                { key: 'properties', label: 'Notifications immobilier', icon: '🏠' },
                { key: 'events', label: 'Notifications événements', icon: '🎉' },
              ].map((notif) => (
                <label key={notif.key} className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 p-2 rounded">
                  <input
                    type="checkbox"
                    name={`notifications.${notif.key}`}
                    checked={formData.notifications[notif.key]}
                    onChange={handleChange}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-2xl">{notif.icon}</span>
                  <span className="text-gray-700 font-medium">{notif.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Bouton de soumission */}
          <div className="pt-4 border-t">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-lg hover:bg-blue-700 transition font-bold text-lg disabled:bg-gray-400 shadow-lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {mode === 'add' ? 'Créer l\'Email' : 'Enregistrer les Modifications'}
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default ManageEmailsPage;