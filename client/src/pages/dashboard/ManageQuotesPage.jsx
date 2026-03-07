import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Search, Filter, Eye, Mail, CheckCircle, Clock, Send, Archive,
  X, Loader2, AlertCircle, Calendar, User, ChevronLeft, ChevronRight,
  TrendingUp, Tag,
} from 'lucide-react';
import { getAllQuotes, updateQuoteStatus } from '../../services/quoteService';
import api from '../../services/api';

const QUOTES_PER_PAGE = 10;

const STATUS_CONFIG = {
  'Nouveau':      { color: 'bg-blue-500',   icon: Clock,         label: 'Nouveau'      },
  'En cours':     { color: 'bg-yellow-500', icon: Clock,         label: 'En cours'     },
  'Devis Envoyé': { color: 'bg-purple-500', icon: Send,          label: 'Devis Envoyé' },
  'Converti':     { color: 'bg-green-500',  icon: CheckCircle,   label: 'Converti'     },
  'Archivé':      { color: 'bg-gray-500',   icon: Archive,       label: 'Archivé'      },
};

const SOURCE_OPTIONS = ['Tous', 'Mila Events', 'Altcom', 'Autre'];

// ─── StatCard ────────────────────────────────────────────────
const StatCard = ({ title, value, icon: Icon, color }) => {
  const colors = { blue:'text-blue-500', yellow:'text-yellow-500', green:'text-green-500', purple:'text-purple-500' };
  return (
    <div className="bg-white p-6 rounded-xl shadow-md">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-600 text-sm font-medium">{title}</span>
        <Icon className={`w-5 h-5 ${colors[color]}`} />
      </div>
      <p className="text-3xl font-bold text-gray-800">{value}</p>
    </div>
  );
};

// ─── QuoteRow ────────────────────────────────────────────────
const QuoteRow = ({ quote, onViewDetails, onSendResponse }) => {
  const statusConfig = STATUS_CONFIG[quote.status] || STATUS_CONFIG['Nouveau'];
  const StatusIcon   = statusConfig.icon;
  const eventDate    = quote.date ? new Date(quote.date) : null;
  const formattedDate = eventDate && !isNaN(eventDate)
    ? eventDate.toLocaleDateString('fr-FR', { year:'numeric', month:'short', day:'numeric' })
    : 'Date inconnue';
  const sourceLabel = quote.source || 'N/A';
  const SourceIcon  = sourceLabel === 'Mila Events' ? Calendar : sourceLabel === 'Altcom' ? TrendingUp : Tag;

  return (
    <tr className="border-b hover:bg-gray-50 transition">
      <td className="px-6 py-4">
        <p className="font-semibold text-gray-800">{quote.name}</p>
        <p className="text-sm text-gray-500">{quote.email}</p>
      </td>
      <td className="px-6 py-4 text-gray-700">{quote.service}</td>
      <td className="px-6 py-4">
        <span className="inline-flex items-center gap-1 text-sm text-gray-600">
          <SourceIcon className="w-4 h-4 text-gray-400" />{sourceLabel}
        </span>
      </td>
      <td className="px-6 py-4 text-gray-600 text-sm">{formattedDate}</td>
      <td className="px-6 py-4">
        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-white text-xs font-semibold ${statusConfig.color}`}>
          <StatusIcon className="w-3 h-3" />{quote.status}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex justify-center gap-2">
          <button onClick={() => onViewDetails(quote)}
            className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition" title="Voir détails">
            <Eye className="w-4 h-4" />
          </button>
          {(quote.status === 'Nouveau' || quote.status === 'En cours') && (
            <button onClick={() => onSendResponse(quote)}
              className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition" title="Envoyer devis">
              <Mail className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

// ─── QuoteDetailModal ─────────────────────────────────────────
const QuoteDetailModal = ({ quote, onClose, onStatusChange, onSendResponse }) => {
  const eventDate   = quote.date ? new Date(quote.date) : null;
  const formattedDate = eventDate && !isNaN(eventDate)
    ? eventDate.toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
    : 'Date non spécifiée';
  const createdAt = new Date(quote.createdAt || Date.now()).toLocaleDateString('fr-FR');
  const isCompleteProject = quote.requestType === 'Projet Complet' && quote.projectDetails;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-8 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-red-600 transition p-2 rounded-full bg-gray-100">
          <X className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-3xl font-bold text-gray-800">
            {isCompleteProject ? '📋 Projet Complet' : '📄 Demande de Devis'}
          </h2>
          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-white text-sm font-semibold ${STATUS_CONFIG[quote.status]?.color || 'bg-gray-500'}`}>
            {quote.status}
          </span>
        </div>

        <div className="space-y-6">
          {/* Client */}
          <div className="bg-blue-50 p-6 rounded-xl">
            <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2"><User className="w-5 h-5" />Informations Client</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Nom complet', quote.name],
                ['Email', quote.email],
                quote.phone && ['Téléphone', quote.phone],
                isCompleteProject && quote.projectDetails?.clientInfo?.company && ['Société', quote.projectDetails.clientInfo.company],
                ['Demande créée le', createdAt],
              ].filter(Boolean).map(([label, value]) => (
                <div key={label}>
                  <p className="text-sm text-gray-600 mb-1">{label}</p>
                  <p className="font-semibold text-gray-800">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Événement */}
          <div className="bg-purple-50 p-6 rounded-xl">
            <h3 className="text-xl font-bold text-purple-900 mb-4 flex items-center gap-2"><Calendar className="w-5 h-5" />Détails de l'Événement</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Service demandé', quote.service],
                ['Type d\'événement', quote.eventType],
                ['Date souhaitée', formattedDate],
                ['Nombre d\'invités', `${quote.guests} personnes`],
                quote.budget && ['Budget estimé', quote.budget],
              ].filter(Boolean).map(([label, value]) => (
                <div key={label}>
                  <p className="text-sm text-gray-600 mb-1">{label}</p>
                  <p className="font-semibold text-gray-800">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Projet complet */}
          {isCompleteProject && quote.projectDetails?.theme && (
            <div className="bg-pink-50 p-6 rounded-xl">
              <h3 className="text-xl font-bold text-pink-900 mb-4">Thème & Style</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  quote.projectDetails.theme.theme      && ['Thème',  quote.projectDetails.theme.theme],
                  quote.projectDetails.theme.colors     && ['Couleurs', quote.projectDetails.theme.colors],
                  quote.projectDetails.theme.styleType  && ['Style',  quote.projectDetails.theme.styleType],
                ].filter(Boolean).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-sm text-gray-600 mb-1">{label}</p>
                    <p className="font-semibold text-gray-800">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isCompleteProject && quote.projectDetails?.services?.length > 0 && (
            <div className="bg-green-50 p-6 rounded-xl">
              <h3 className="text-xl font-bold text-green-900 mb-4">Prestations Souhaitées</h3>
              <ul className="grid grid-cols-2 gap-2">
                {quote.projectDetails.services.map((s, i) => (
                  <li key={i} className="flex items-center"><span className="text-green-600 mr-2">✓</span>{s}</li>
                ))}
              </ul>
            </div>
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
              <button onClick={() => { onClose(); onSendResponse(quote); }}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition font-semibold">
                <Mail className="w-5 h-5" /> Envoyer un Devis
              </button>
            )}
            <select value={quote.status}
              onChange={(e) => { onStatusChange(quote._id, e.target.value); onClose(); }}
              className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold">
              {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ─── QuoteResponseModal ───────────────────────────────────────
const QuoteResponseModal = ({ quote, onClose, onSubmit }) => {
  const [responseData, setResponseData] = useState({
    subject: `Devis pour votre ${quote.eventType} - ${quote.service}`,
    message: `Bonjour ${quote.name},\n\nNous avons bien reçu votre demande de devis.\n\n[Détaillez votre offre ici]\n\nCordialement,\nL'équipe Mila Events`,
    quotedAmount: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!responseData.quotedAmount) {
      toast.error('Veuillez indiquer le montant du devis');
      return;
    }
    setIsSubmitting(true);
    await onSubmit(responseData);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 relative">
        <button onClick={onClose} disabled={isSubmitting}
          className="absolute top-4 right-4 text-gray-500 hover:text-red-600 transition p-2 rounded-full bg-gray-100">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Envoyer un Devis</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg text-sm text-gray-700">
            <p><strong>Client :</strong> {quote.name} ({quote.email})</p>
            <p><strong>Événement :</strong> {quote.eventType} — {quote.guests} invités</p>
          </div>
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Objet de l'email</label>
            <input type="text" value={responseData.subject}
              onChange={(e) => setResponseData({ ...responseData, subject: e.target.value })} required
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Montant du Devis (FCFA) <span className="text-red-500">*</span></label>
            <input type="number" value={responseData.quotedAmount}
              onChange={(e) => setResponseData({ ...responseData, quotedAmount: e.target.value })} required
              min="0" placeholder="Ex: 5000000"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Message</label>
            <textarea value={responseData.message}
              onChange={(e) => setResponseData({ ...responseData, message: e.target.value })} required
              rows="8" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition font-bold text-lg disabled:bg-gray-400">
            {isSubmitting
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Envoi en cours…</>
              : <><Send className="w-5 h-5" /> Envoyer le Devis</>}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

// ─── MAIN ────────────────────────────────────────────────────
const ManageQuotesPage = () => {
  const [quotes, setQuotes]               = useState([]);
  const [filteredQuotes, setFiltered]     = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [searchTerm, setSearchTerm]       = useState('');
  const [filterStatus, setFilterStatus]   = useState('Tous');
  const [filterSource, setFilterSource]   = useState('Tous');
  const [selectedQuote, setSelected]      = useState(null);
  const [showDetailModal, setShowDetail]  = useState(false);
  const [showResponseModal, setShowResp]  = useState(false);
  const [notification, setNotif]          = useState({ show: false, message: '', type: 'success' });
  const [currentPage, setCurrentPage]     = useState(1);
  const [stats, setStats]                 = useState({ total:0, nouveau:0, enCours:0, converti:0, tauxConversion:0 });

  useEffect(() => { fetchQuotes(); }, []);

  useEffect(() => {
    let list = quotes;
    if (filterStatus !== 'Tous')  list = list.filter(q => q.status === filterStatus);
    if (filterSource !== 'Tous')  list = list.filter(q => (q.source || 'Autre') === filterSource);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(x =>
        x.name?.toLowerCase().includes(q) ||
        x.email?.toLowerCase().includes(q) ||
        x.service?.toLowerCase().includes(q) ||
        x.eventType?.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterSource, quotes]);

  useEffect(() => {
    const total   = quotes.length;
    const nouveau = quotes.filter(q => q.status === 'Nouveau').length;
    const enCours = quotes.filter(q => q.status === 'En cours').length;
    const converti = quotes.filter(q => q.status === 'Converti').length;
    setStats({ total, nouveau, enCours, converti, tauxConversion: total > 0 ? ((converti / total) * 100).toFixed(1) : 0 });
  }, [quotes]);

  const fetchQuotes = async () => {
    try {
      setLoading(true); setError(null);
      const data = await getAllQuotes();
      setQuotes(data); setFiltered(data);
    } catch {
      setError('Impossible de charger les demandes de devis');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotif({ show: true, message, type });
    setTimeout(() => setNotif({ show: false, message: '', type: 'success' }), 4000);
  };

  const handleStatusChange = async (quoteId, newStatus) => {
    try {
      await updateQuoteStatus(quoteId, newStatus);
      showNotification(`Statut mis à jour : ${newStatus}`);
      fetchQuotes();
    } catch {
      showNotification('Erreur lors de la mise à jour du statut', 'error');
    }
  };

  const handleSendQuoteResponse = async (responseData) => {
    try {
      await api.post(`/quotes/${selectedQuote._id}/respond`, responseData);
      showNotification('Devis envoyé avec succès au client');
      await handleStatusChange(selectedQuote._id, 'Devis Envoyé');
      setShowResp(false);
    } catch {
      showNotification("Erreur lors de l'envoi du devis", 'error');
    }
  };

  const totalPages   = Math.ceil(filteredQuotes.length / QUOTES_PER_PAGE);
  const currentQuotes = filteredQuotes.slice((currentPage - 1) * QUOTES_PER_PAGE, currentPage * QUOTES_PER_PAGE);

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
        <h1 className="text-4xl font-bold text-gray-800 mb-2">Gestion des Devis</h1>
        <p className="text-gray-600">Gérez et répondez aux demandes de devis</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard title="Total"           value={stats.total}            icon={FileText}    color="blue"   />
        <StatCard title="Nouveaux"        value={stats.nouveau}          icon={Clock}       color="blue"   />
        <StatCard title="En cours"        value={stats.enCours}          icon={Clock}       color="yellow" />
        <StatCard title="Convertis"       value={stats.converti}         icon={CheckCircle} color="green"  />
        <StatCard title="Taux conversion" value={`${stats.tauxConversion}%`} icon={TrendingUp}  color="purple" />
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input type="text" placeholder="Rechercher par nom, email, service…" value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="text-gray-500 w-5 h-5" />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="Tous">Tous les statuts</option>
              {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Tag className="text-gray-500 w-5 h-5" />
            <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s === 'Tous' ? 'Toutes les sources' : s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded flex items-center gap-3">
          <AlertCircle className="text-red-500 w-6 h-6" /><p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Table */}
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
                  {['Client', 'Service', 'Source', 'Date', 'Statut', 'Actions'].map(h => (
                    <th key={h} className={`px-6 py-4 text-sm font-semibold text-gray-700 ${h === 'Actions' ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentQuotes.map(quote => (
                  <QuoteRow key={quote._id} quote={quote}
                    onViewDetails={(q) => { setSelected(q); setShowDetail(true); }}
                    onSendResponse={(q) => { setSelected(q); setShowResp(true); }} />
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="p-2 rounded-lg bg-white shadow disabled:opacity-50 hover:bg-gray-100">
                <ChevronLeft className="w-5 h-5" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button key={page} onClick={() => setCurrentPage(page)}
                  className={`px-4 py-2 rounded-lg font-semibold ${page === currentPage ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}>
                  {page}
                </button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="p-2 rounded-lg bg-white shadow disabled:opacity-50 hover:bg-gray-100">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showDetailModal && selectedQuote && (
          <QuoteDetailModal quote={selectedQuote} onClose={() => setShowDetail(false)}
            onStatusChange={handleStatusChange} onSendResponse={(q) => { setSelected(q); setShowResp(true); }} />
        )}
        {showResponseModal && selectedQuote && (
          <QuoteResponseModal quote={selectedQuote} onClose={() => setShowResp(false)} onSubmit={handleSendQuoteResponse} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ManageQuotesPage;