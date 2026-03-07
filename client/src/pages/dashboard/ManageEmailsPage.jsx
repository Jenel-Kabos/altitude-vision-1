// src/pages/dashboard/ManageEmailsPage.jsx
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Plus, Edit2, Trash2, Search, X, Loader2, AlertCircle, Save,
  CheckCircle, XCircle, Bell, Users, TrendingUp, Eye, EyeOff, Send
} from 'lucide-react';
import {
  getAllEmails, createEmail, updateEmail, deleteEmail,
  toggleEmailStatus, getGlobalStats, sendEmailViaZoho
} from '../../services/emailService';
import { useAuth } from '../../context/AuthContext';

const ManageEmailsPage = () => {
  const { user } = useAuth();
  const [emails, setEmails]               = useState([]);
  const [filteredEmails, setFiltered]     = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [searchTerm, setSearchTerm]       = useState('');
  const [showModal, setShowModal]         = useState(false);
  const [modalMode, setModalMode]         = useState('add');
  const [selectedEmail, setSelected]      = useState(null);
  const [notification, setNotif]          = useState({ show: false, message: '', type: 'success' });
  const [stats, setStats]                 = useState(null);
  const [showPassword, setShowPassword]   = useState(false);

  useEffect(() => { fetchEmails(); fetchStats(); }, []);

  useEffect(() => {
    const list = searchTerm
      ? emails.filter(e =>
          e.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.emailType?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : emails;
    setFiltered(list);
  }, [searchTerm, emails]);

  const fetchEmails = async () => {
    try {
      setLoading(true); setError(null);
      const data = await getAllEmails();
      setEmails(data); setFiltered(data);
    } catch {
      setError('Impossible de charger les emails');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await getGlobalStats();
      setStats(data);
    } catch {
      // stats optionnelles — erreur silencieuse
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotif({ show: true, message, type });
    setTimeout(() => setNotif({ show: false, message: '', type: 'success' }), 4000);
  };

  const handleAdd  = () => { setModalMode('add'); setSelected(null); setShowModal(true); };
  const handleEdit = (email) => { setSelected(email); setModalMode('edit'); setShowModal(true); };

  const handleDelete = async (emailId) => {
    try {
      await deleteEmail(emailId);
      showNotification('Email supprimé avec succès');
      fetchEmails(); fetchStats();
    } catch {
      showNotification('Erreur lors de la suppression', 'error');
    }
  };

  const handleToggleStatus = async (emailId) => {
    try {
      await toggleEmailStatus(emailId);
      showNotification('Statut mis à jour avec succès');
      fetchEmails();
    } catch {
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
      fetchEmails(); fetchStats();
    } catch (err) {
      showNotification(err.response?.data?.message || "Erreur lors de l'enregistrement", 'error');
    }
  };

  const handleSendTestEmail = async (emailAddress) => {
    try {
      showNotification('Envoi en cours…', 'success');
      const result = await sendEmailViaZoho(
        emailAddress,
        'thibautkabos@gmail.com',
        'Email de test - Altitude Vision',
        `<html><body style="font-family:Arial,sans-serif;padding:20px;background:#f5f5f5;">
          <div style="max-width:600px;margin:0 auto;background:white;padding:30px;border-radius:10px;">
            <h1 style="color:#0066cc;">🎉 Test depuis l'application</h1>
            <p>Cet email a été envoyé depuis <strong>Altitude Vision</strong>.</p>
            <p><strong>Expéditeur :</strong> ${emailAddress}</p>
            <p><strong>Date :</strong> ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Brazzaville' })}</p>
          </div>
        </body></html>`
      );
      showNotification(`✅ Email envoyé ! Total : ${result.emailsSent}`, 'success');
      fetchEmails(); fetchStats();
    } catch (error) {
      showNotification(error.message || "Erreur lors de l'envoi de l'email de test", 'error');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
    </div>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <AnimatePresence>
        {notification.show && (
          <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }}
            className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg text-white ${
              notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
            }`}>
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">Gestion des Emails Professionnels</h1>
        <p className="text-gray-600">Gérez les adresses @altitudevision.agency et leurs notifications</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard title="Total Emails"       value={stats.global.totalEmails}  icon={Mail}         color="blue"   />
          <StatCard title="Emails Actifs"      value={stats.global.activeEmails} icon={CheckCircle}  color="green"  />
          <StatCard title="Emails Envoyés"     value={stats.global.totalSent}    icon={TrendingUp}   color="purple" />
          <StatCard title="Avec Notifications" value={stats.withNotifications}   icon={Bell}         color="yellow" />
        </div>
      )}

      {/* Barre */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input type="text" placeholder="Rechercher un email…" value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <button onClick={handleAdd}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-semibold">
          <Plus className="w-5 h-5" /> Créer un Email
        </button>
      </div>

      {/* Erreur */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded flex items-center gap-3">
          <AlertCircle className="text-red-500 w-6 h-6" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Liste */}
      {filteredEmails.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Aucun email trouvé</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEmails.map(email => (
            <EmailCard key={email._id} email={email}
              onEdit={handleEdit} onDelete={handleDelete}
              onToggleStatus={handleToggleStatus} onSendTest={handleSendTestEmail} />
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <EmailModal mode={modalMode} email={selectedEmail}
            onClose={() => setShowModal(false)} onSubmit={handleFormSubmit}
            showPassword={showPassword} setShowPassword={setShowPassword} />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── StatCard ────────────────────────────────────────────────
const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition">
    <div className="flex items-center justify-between mb-2">
      <span className="text-gray-600 text-sm font-medium">{title}</span>
      <Icon className={`w-5 h-5 text-${color}-500`} />
    </div>
    <p className="text-3xl font-bold text-gray-800">{value}</p>
  </div>
);

// ─── EmailCard ────────────────────────────────────────────────
const EmailCard = ({ email, onEdit, onDelete, onToggleStatus, onSendTest }) => {
  const hasNotifications = Object.values(email.notifications || {}).some(v => v === true);
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <h3 className="text-lg font-bold text-gray-800 truncate">{email.displayName}</h3>
            </div>
            <p className="text-sm text-gray-600 truncate">{email.email}</p>
          </div>
          <button onClick={() => onToggleStatus(email._id)}
            className={`p-2 rounded-full flex-shrink-0 ${email.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}
            title={email.isActive ? 'Actif' : 'Inactif'}>
            {email.isActive ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          </button>
        </div>
        <div className="space-y-2 mb-4">
          <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium text-sm">{email.emailType}</span>
          {email.emailsSent > 0 && (
            <div className="flex items-center text-sm text-purple-600">
              <TrendingUp className="w-4 h-4 mr-2" />
              {email.emailsSent} email{email.emailsSent > 1 ? 's' : ''} envoyé{email.emailsSent > 1 ? 's' : ''}
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
              <Bell className="w-4 h-4 mr-2" /> Notifications actives
            </div>
          )}
          {email.description && <p className="text-sm text-gray-500 line-clamp-2">{email.description}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => onSendTest(email.email)}
            className="flex-1 flex items-center justify-center gap-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition text-sm">
            <Send className="w-4 h-4" /> Test
          </button>
          <button onClick={() => onEdit(email)}
            className="flex-1 flex items-center justify-center gap-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition text-sm">
            <Edit2 className="w-4 h-4" /> Modifier
          </button>
          <button onClick={() => onDelete(email._id)}
            className="flex-1 flex items-center justify-center gap-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition text-sm">
            <Trash2 className="w-4 h-4" /> Supprimer
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ─── EmailModal ───────────────────────────────────────────────
const EmailModal = ({ mode, email, onClose, onSubmit, showPassword, setShowPassword }) => {
  const [formData, setFormData] = useState({
    email:       email?.email?.split('@')[0] || '',
    displayName: email?.displayName || '',
    emailType:   email?.emailType   || 'Contact Général',
    description: email?.description || '',
    assignedTo:  email?.assignedTo?._id || '',
    password:    '',
    notifications: {
      quotes:          email?.notifications?.quotes          || false,
      contactMessages: email?.notifications?.contactMessages || false,
      systemAlerts:    email?.notifications?.systemAlerts    || false,
      properties:      email?.notifications?.properties      || false,
      events:          email?.notifications?.events          || false,
    },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.startsWith('notifications.')) {
      const key = name.split('.')[1];
      setFormData({ ...formData, notifications: { ...formData.notifications, [key]: checked } });
    } else {
      setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.displayName) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    setIsSubmitting(true);
    await onSubmit({ ...formData, email: `${formData.email}@altitudevision.agency`, assignedTo: formData.assignedTo || null });
    setIsSubmitting(false);
  };

  const inputCls = "w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-8 relative">
        <button onClick={onClose} disabled={isSubmitting}
          className="absolute top-4 right-4 text-gray-500 hover:text-red-600 transition p-2 rounded-full bg-gray-100">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-3xl font-bold text-gray-800 mb-6">
          {mode === 'add' ? 'Créer un Email Professionnel' : "Modifier l'Email"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-semibold mb-2">Adresse Email <span className="text-red-500">*</span></label>
              <div className="flex">
                <input type="text" name="email" value={formData.email} onChange={handleChange} required
                  disabled={mode === 'edit'} placeholder="contact"
                  className="flex-1 p-3 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
                <span className="bg-gray-200 px-4 py-3 border border-l-0 border-gray-300 rounded-r-lg text-gray-700 text-sm">@altitudevision.agency</span>
              </div>
            </div>
            <div>
              <label className="block text-gray-700 font-semibold mb-2">Nom d'affichage <span className="text-red-500">*</span></label>
              <input type="text" name="displayName" value={formData.displayName} onChange={handleChange} required placeholder="Ex: Service Contact" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2">Type d'email</label>
            <select name="emailType" value={formData.emailType} onChange={handleChange} className={inputCls}>
              {['Contact Général','Devis & Commercial','Support Technique','Administration','Marketing','Événementiel','Immobilier','Personnel','Autre'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2">Description</label>
            <textarea name="description" value={formData.description} onChange={handleChange} rows="3"
              placeholder="Description de l'usage de cet email…" className={inputCls} />
          </div>

          {mode === 'add' && (
            <div>
              <label className="block text-gray-700 font-semibold mb-2">Mot de passe (optionnel)</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password}
                  onChange={handleChange} placeholder="••••••••" className={`${inputCls} pr-12`} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Bell className="w-5 h-5 text-yellow-600" /> Notifications
            </h3>
            <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
              {[
                { key: 'quotes',          label: 'Demandes de devis',          icon: '💰' },
                { key: 'contactMessages', label: 'Messages de contact',         icon: '📧' },
                { key: 'systemAlerts',    label: 'Alertes système',             icon: '🔔' },
                { key: 'properties',      label: 'Notifications immobilier',    icon: '🏠' },
                { key: 'events',          label: 'Notifications événements',    icon: '🎉' },
              ].map(({ key, label, icon }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 p-2 rounded">
                  <input type="checkbox" name={`notifications.${key}`} checked={formData.notifications[key]}
                    onChange={handleChange} className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500" />
                  <span className="text-2xl">{icon}</span>
                  <span className="text-gray-700 font-medium">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t">
            <button type="submit" disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-lg hover:bg-blue-700 transition font-bold text-lg disabled:bg-gray-400 shadow-lg">
              {isSubmitting
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Enregistrement…</>
                : <><Save className="w-5 h-5" />{mode === 'add' ? "Créer l'Email" : 'Enregistrer les Modifications'}</>}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default ManageEmailsPage;