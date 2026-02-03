import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Search,
  Filter,
  Eye,
  Mail,
  CheckCircle,
  Clock,
  Send,
  Archive,
  X,
  Loader2,
  AlertCircle,
  Calendar,
  User,
  Phone,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Tag, // Ajouté pour le filtre Source
} from 'lucide-react';
import { getAllQuotes, updateQuoteStatus } from '../../services/quoteService';
import api from '../../services/api';

// --- CONFIGURATION GLOBALE ---
const QUOTES_PER_PAGE = 10;

const STATUS_CONFIG = {
  'Nouveau': { color: 'bg-blue-500', icon: Clock, label: 'Nouveau' },
  'En cours': { color: 'bg-yellow-500', icon: Clock, label: 'En cours' },
  'Devis Envoyé': { color: 'bg-purple-500', icon: Send, label: 'Devis Envoyé' },
  'Converti': { color: 'bg-green-500', icon: CheckCircle, label: 'Converti' },
  'Archivé': { color: 'bg-gray-500', icon: Archive, label: 'Archivé' },
};

const SOURCE_OPTIONS = ['Tous', 'Mila Events', 'Altcom', 'Autre'];

// --- FONCTIONS UTILITAIRES ---

/**
 * Composant Carte de Statistique
 */
const StatCard = ({ title, value, icon: Icon, color }) => {
  const iconColors = {
    blue: 'text-blue-500',
    yellow: 'text-yellow-500',
    green: 'text-green-500',
    purple: 'text-purple-500',
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-600 text-sm font-medium">{title}</span>
        <Icon className={`w-5 h-5 ${iconColors[color]}`} />
      </div>
      <p className="text-3xl font-bold text-gray-800">{value}</p>
    </div>
  );
};

/**
 * Composant Ligne de Devis
 */
const QuoteRow = ({ quote, onViewDetails, onSendResponse }) => {
  const statusConfig = STATUS_CONFIG[quote.status] || STATUS_CONFIG['Nouveau'];
  const StatusIcon = statusConfig.icon;

  const eventDate = quote.date ? new Date(quote.date) : null;
  const formattedDate = eventDate && !isNaN(eventDate) ? eventDate.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }) : 'Date inconnue';

  // Déterminer la source pour l'affichage (utilise la propriété source ou une valeur par défaut)
  const sourceLabel = quote.source || 'N/A';
  const SourceIcon = sourceLabel === 'Mila Events' ? Calendar : sourceLabel === 'Altcom' ? TrendingUp : Tag;

  return (
    <tr className="border-b hover:bg-gray-50 transition">
      <td className="px-6 py-4">
        <div>
          <p className="font-semibold text-gray-800">{quote.name}</p>
          <p className="text-sm text-gray-500">{quote.email}</p>
        </div>
      </td>
      <td className="px-6 py-4 text-gray-700">{quote.service}</td>
      <td className="px-6 py-4 text-gray-700">
        <span className="inline-flex items-center gap-1 text-sm text-gray-600">
          <SourceIcon className="w-4 h-4 text-gray-400" />
          {sourceLabel}
        </span>
      </td>
      <td className="px-6 py-4 text-gray-600 text-sm">{formattedDate}</td>
      <td className="px-6 py-4">
        <span
          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-white text-xs font-semibold ${statusConfig.color}`}
        >
          <StatusIcon className="w-3 h-3" />
          {quote.status}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex justify-center gap-2">
          <button
            onClick={() => onViewDetails(quote)}
            className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition"
            title="Voir détails"
          >
            <Eye className="w-4 h-4" />
          </button>
          {quote.status === 'Nouveau' || quote.status === 'En cours' ? (
            <button
              onClick={() => onSendResponse(quote)}
              className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition"
              title="Envoyer devis"
            >
              <Mail className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
};

// --- MODALES (Inchangées par rapport à la version corrigée) ---

const QuoteDetailModal = ({ quote, onClose, onStatusChange, onSendResponse }) => {
  const eventDate = quote.date ? new Date(quote.date) : null;
  const formattedDate = eventDate && !isNaN(eventDate) ? eventDate.toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) : 'Date non spécifiée';

  const createdAt = new Date(quote.createdAt || Date.now()).toLocaleDateString('fr-FR');

  const isCompleteProject = quote.requestType === 'Projet Complet' && quote.projectDetails;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-8 relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-red-600 transition p-2 rounded-full bg-gray-100"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-3xl font-bold text-gray-800">
            {isCompleteProject ? '📋 Projet Complet' : '📄 Demande de Devis'}
          </h2>
          <span
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-white text-sm font-semibold ${
              STATUS_CONFIG[quote.status]?.color || 'bg-gray-500'
            }`}
          >
            {quote.status}
          </span>
        </div>

        <div className="space-y-6">
          {/* Informations Client */}
          <div className="bg-blue-50 p-6 rounded-xl">
            <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Informations Client
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Nom complet</p>
                <p className="font-semibold text-gray-800">{quote.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Email</p>
                <p className="font-semibold text-gray-800">{quote.email}</p>
              </div>
              {quote.phone && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Téléphone</p>
                  <p className="font-semibold text-gray-800">{quote.phone}</p>
                </div>
              )}
              {isCompleteProject && quote.projectDetails?.clientInfo?.company && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Société</p>
                  <p className="font-semibold text-gray-800">{quote.projectDetails.clientInfo.company}</p>
                </div>
              )}
              {isCompleteProject && quote.projectDetails?.clientInfo?.address && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-600 mb-1">Adresse</p>
                  <p className="font-semibold text-gray-800">{quote.projectDetails.clientInfo.address}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600 mb-1">Demande créée le</p>
                <p className="font-semibold text-gray-800">{createdAt}</p>
              </div>
            </div>
          </div>

          {/* Détails Événement */}
          <div className="bg-purple-50 p-6 rounded-xl">
            <h3 className="text-xl font-bold text-purple-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Détails de l'Événement
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Service demandé</p>
                <p className="font-semibold text-gray-800">{quote.service}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Type d'événement</p>
                <p className="font-semibold text-gray-800">{quote.eventType}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Date souhaitée</p>
                <p className="font-semibold text-gray-800">{formattedDate}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Nombre d'invités</p>
                <p className="font-semibold text-gray-800">{quote.guests} personnes</p>
              </div>
              {quote.budget && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Budget estimé</p>
                  <p className="font-semibold text-gray-800">{quote.budget}</p>
                </div>
              )}
              {isCompleteProject && quote.projectDetails?.practicalDetails?.startTime && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Horaires</p>
                  <p className="font-semibold text-gray-800">
                    {quote.projectDetails.practicalDetails.startTime} - {quote.projectDetails.practicalDetails.endTime}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Projet Complet - Sections supplémentaires */}
          {isCompleteProject && (
            <>
              {/* Thème & Style */}
              {quote.projectDetails?.theme && (
                <div className="bg-pink-50 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-pink-900 mb-4">Thème & Style</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {quote.projectDetails.theme.theme && (
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Thème</p>
                        <p className="font-semibold text-gray-800">{quote.projectDetails.theme.theme}</p>
                      </div>
                    )}
                    {quote.projectDetails.theme.colors && (
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Couleurs</p>
                        <p className="font-semibold text-gray-800">{quote.projectDetails.theme.colors}</p>
                      </div>
                    )}
                    {quote.projectDetails.theme.styleType && (
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Style</p>
                        <p className="font-semibold text-gray-800">{quote.projectDetails.theme.styleType}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Prestations */}
              {quote.projectDetails?.services?.length > 0 && (
                <div className="bg-green-50 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-green-900 mb-4">Prestations Souhaitées</h3>
                  <ul className="grid grid-cols-2 gap-2">
                    {quote.projectDetails.services.map((service, index) => (
                      <li key={index} className="flex items-center">
                        <span className="text-green-600 mr-2">✓</span>
                        <span className="text-gray-800">{service}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Inspirations */}
              {quote.projectDetails?.inspirations?.moodboardLink && (
                <div className="bg-yellow-50 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-yellow-900 mb-3">Inspirations</h3>
                  <a
                    href={quote.projectDetails.inspirations.moodboardLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-2"
                  >
                    🔗 Voir le moodboard
                  </a>
                </div>
              )}
            </>
          )}

          {/* Description */}
          <div className="bg-gray-50 p-6 rounded-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              {isCompleteProject ? 'Objectif du Projet' : 'Description'}
            </h3>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{quote.description}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            {quote.status !== 'Devis Envoyé' && quote.status !== 'Converti' && (
              <button
                onClick={() => {
                  onClose();
                  onSendResponse(quote);
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition font-semibold"
              >
                <Mail className="w-5 h-5" />
                Envoyer un Devis
              </button>
            )}
            <select
              value={quote.status}
              onChange={(e) => {
                onStatusChange(quote._id, e.target.value);
                onClose();
              }}
              className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
            >
              <option value="Nouveau">Nouveau</option>
              <option value="En cours">En cours</option>
              <option value="Devis Envoyé">Devis Envoyé</option>
              <option value="Converti">Converti</option>
              <option value="Archivé">Archivé</option>
            </select>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const QuoteResponseModal = ({ quote, onClose, onSubmit }) => {
  const [responseData, setResponseData] = useState({
    subject: `Devis pour votre ${quote.eventType} - ${quote.service}`,
    message: `Bonjour ${quote.name},\n\nNous avons bien reçu votre demande de devis pour votre ${quote.eventType} prévu le ${new Date(
      quote.date
    ).toLocaleDateString('fr-FR')}.\n\nVoici notre proposition :\n\n[Détaillez votre offre ici]\n\nCordialement,\nL'équipe Mila Events`,
    quotedAmount: '',
    attachments: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!responseData.quotedAmount) {
      alert('Veuillez indiquer le montant du devis');
      return;
    }
    setIsSubmitting(true);
    await onSubmit(responseData);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 relative"
      >
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 text-gray-500 hover:text-red-600 transition p-2 rounded-full bg-gray-100"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-3xl font-bold text-gray-800 mb-6">Envoyer un Devis</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Client :</strong> {quote.name} ({quote.email})
            </p>
            <p className="text-sm text-gray-700">
              <strong>Événement :</strong> {quote.eventType} - {quote.guests} invités
            </p>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2">Objet de l'email</label>
            <input
              type="text"
              value={responseData.subject}
              onChange={(e) => setResponseData({ ...responseData, subject: e.target.value })}
              required
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2">
              Montant du Devis (FCFA) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={responseData.quotedAmount}
              onChange={(e) => setResponseData({ ...responseData, quotedAmount: e.target.value })}
              required
              min="0"
              placeholder="Ex: 5000000"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2">Message</label>
            <textarea
              value={responseData.message}
              onChange={(e) => setResponseData({ ...responseData, message: e.target.value })}
              required
              rows="8"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition font-bold text-lg disabled:bg-gray-400"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Envoyer le Devis
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
};


// --- COMPOSANT PRINCIPAL (Logique de filtrage mise à jour) ---

const ManageQuotesPage = () => {
  const [quotes, setQuotes] = useState([]);
  const [filteredQuotes, setFilteredQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('Tous');
  const [filterSource, setFilterSource] = useState('Tous'); // NOUVEL ÉTAT POUR LA SOURCE
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [currentPage, setCurrentPage] = useState(1);
  const [stats, setStats] = useState({
    total: 0,
    nouveau: 0,
    enCours: 0,
    converti: 0,
    tauxConversion: 0,
  });

  useEffect(() => {
    fetchQuotes();
  }, []);

  useEffect(() => {
    let filtered = quotes;

    // 1. Filtrer par statut
    if (filterStatus !== 'Tous') {
      filtered = filtered.filter((q) => q.status === filterStatus);
    }

    // 2. Filtrer par source (NOUVELLE LOGIQUE)
    if (filterSource !== 'Tous') {
      filtered = filtered.filter((q) => (q.source || 'Autre') === filterSource);
    }

    // 3. Filtrer par recherche
    if (searchTerm) {
      filtered = filtered.filter(
        (q) =>
          q.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.service?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.eventType?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredQuotes(filtered);
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterSource, quotes]); // Dépendances mises à jour

  useEffect(() => {
    calculateStats();
  }, [quotes]);

  const fetchQuotes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllQuotes();
      setQuotes(data);
      setFilteredQuotes(data);
    } catch (err) {
      console.error('Erreur lors du chargement des devis:', err);
      setError('Impossible de charger les demandes de devis');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const total = quotes.length;
    const nouveau = quotes.filter((q) => q.status === 'Nouveau').length;
    const enCours = quotes.filter((q) => q.status === 'En cours').length;
    const converti = quotes.filter((q) => q.status === 'Converti').length;
    const tauxConversion = total > 0 ? ((converti / total) * 100).toFixed(1) : 0;

    setStats({ total, nouveau, enCours, converti, tauxConversion });
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 4000);
  };

  const handleViewDetails = (quote) => {
    setSelectedQuote(quote);
    setShowDetailModal(true);
  };

  const handleSendResponse = (quote) => {
    setSelectedQuote(quote);
    setShowResponseModal(true);
  };

  const handleStatusChange = async (quoteId, newStatus) => {
    try {
      await updateQuoteStatus(quoteId, newStatus);
      showNotification(`Statut mis à jour : ${newStatus}`);
      fetchQuotes();
    } catch (err) {
      showNotification('Erreur lors de la mise à jour du statut', 'error');
    }
  };

  const handleSendQuoteResponse = async (responseData) => {
    try {
      await api.post(`/quotes/${selectedQuote._id}/respond`, responseData);
      showNotification('Devis envoyé avec succès au client');
      await handleStatusChange(selectedQuote._id, 'Devis Envoyé');
      setShowResponseModal(false);
    } catch (err) {
      showNotification("Erreur lors de l'envoi du devis", 'error');
    }
  };

  // Pagination
  const totalPages = Math.ceil(filteredQuotes.length / QUOTES_PER_PAGE);
  const startIndex = (currentPage - 1) * QUOTES_PER_PAGE;
  const currentQuotes = filteredQuotes.slice(startIndex, startIndex + QUOTES_PER_PAGE);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Notification */}
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
        <h1 className="text-4xl font-bold text-gray-800 mb-2">Gestion des Devis</h1>
        <p className="text-gray-600">Gérez et répondez aux demandes de devis</p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard title="Total" value={stats.total} icon={FileText} color="blue" />
        <StatCard title="Nouveaux" value={stats.nouveau} icon={Clock} color="blue" />
        <StatCard title="En cours" value={stats.enCours} icon={Clock} color="yellow" />
        <StatCard title="Convertis" value={stats.converti} icon={CheckCircle} color="green" />
        <StatCard
          title="Taux conversion"
          value={`${stats.tauxConversion}%`}
          icon={TrendingUp}
          color="purple"
        />
      </div>

      {/* Filtres et recherche (Mise à jour pour inclure la Source) */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher par nom, email, service..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="text-gray-500 w-5 h-5" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Tous">Tous les statuts</option>
              {Object.keys(STATUS_CONFIG).map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <Tag className="text-gray-500 w-5 h-5" />
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {SOURCE_OPTIONS.map(source => (
                <option key={source} value={source}>{source === 'Tous' ? 'Toutes les sources' : source}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Liste des devis */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded">
          <div className="flex items-center">
            <AlertCircle className="text-red-500 w-6 h-6 mr-3" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {currentQuotes.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Aucune demande de devis trouvée</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Client</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Service</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Source</th> {/* NOUVELLE COLONNE */}
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Statut</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentQuotes.map((quote) => (
                  <QuoteRow
                    key={quote._id}
                    quote={quote}
                    onViewDetails={handleViewDetails}
                    onSendResponse={handleSendResponse}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg bg-white shadow disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-4 py-2 rounded-lg font-semibold ${
                    page === currentPage
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg bg-white shadow disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showDetailModal && selectedQuote && (
          <QuoteDetailModal
            quote={selectedQuote}
            onClose={() => setShowDetailModal(false)}
            onStatusChange={handleStatusChange}
            onSendResponse={handleSendResponse}
          />
        )}
        {showResponseModal && selectedQuote && (
          <QuoteResponseModal
            quote={selectedQuote}
            onClose={() => setShowResponseModal(false)}
            onSubmit={handleSendQuoteResponse}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ManageQuotesPage;