import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, TrendingUp, FileText, Plus, Edit, Trash2, Eye, Search,
  Loader2, AlertCircle, CheckCircle, X, Save, Image as ImageIcon,
  Calendar, DollarSign, Tag, Users, Send, ChevronLeft, ChevronRight,
  Star, User, Link as LinkIcon,
} from 'lucide-react';
import { getAllServices, deleteService } from '../../services/serviceService';
import { getAllPortfolioItems, deletePortfolioItem } from '../../services/portfolioService';
import api from '../../services/api';
import ServiceFormModal from '../../components/modals/ServiceFormModal';
import PortfolioFormModal from '../../components/modals/PortfolioFormModal';

const GOLD  = '#C8872A';
const BLUE  = '#2E7BB5';
const RED   = '#D42B2B';
const ITEMS_PER_PAGE = 10;
const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

const getImageUrl = (imagePath) => {
  if (!imagePath) return 'https://placehold.co/80x80/C8872A/FFFFFF?text=Altcom';
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  if (imagePath.startsWith('/uploads')) return `${BACKEND_URL}${imagePath}`;
  return imagePath;
};

// ─── ConfirmDialog ───────────────────────────────────────────
const ConfirmDialog = ({ message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
        style={{ background: '#FEE2E2' }}>
        <AlertCircle size={22} className="text-red-500" />
      </div>
      <h3 className="font-bold text-gray-900 mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
        Confirmation
      </h3>
      <p className="text-sm text-gray-500 mb-6">{message}</p>
      <div className="flex gap-3">
        <button onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all"
          style={{ fontFamily: "'Outfit', sans-serif" }}>
          Annuler
        </button>
        <button onClick={onConfirm}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
          style={{ background: 'linear-gradient(135deg,#B91C1C,#DC2626)', fontFamily: "'Outfit', sans-serif" }}>
          Supprimer
        </button>
      </div>
    </div>
  </div>
);

// ─── StatCard ────────────────────────────────────────────────
const StatCard = ({ title, value, icon: Icon, accent }) => (
  <div className="bg-white p-6 rounded-xl shadow-md">
    <div className="flex items-center justify-between mb-2">
      <span className="text-gray-600 text-sm font-medium" style={{ fontFamily: "'Outfit', sans-serif" }}>
        {title}
      </span>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center"
        style={{ background: `${accent}15` }}>
        <Icon size={16} style={{ color: accent }} />
      </div>
    </div>
    <p className="text-3xl font-bold text-gray-800" style={{ fontFamily: "'Outfit', sans-serif" }}>
      {value}
    </p>
  </div>
);

// ─── TabButton ───────────────────────────────────────────────
const TabButton = ({ active, onClick, icon, label, accent }) => (
  <button onClick={onClick}
    className="flex-1 min-w-[140px] py-3 px-6 rounded-lg font-bold transition-all duration-300 flex items-center justify-center gap-2"
    style={{
      background: active ? `linear-gradient(135deg, ${accent}CC, ${accent})` : 'transparent',
      color: active ? '#fff' : '#374151',
      boxShadow: active ? `0 4px 16px ${accent}40` : 'none',
      fontFamily: "'Outfit', sans-serif",
    }}>
    {icon}
    {label}
  </button>
);

// ─── ServicesTable ───────────────────────────────────────────
const ServicesTable = ({ data, onEdit, onDelete }) => (
  <div className="bg-white rounded-xl shadow-md overflow-hidden">
    <table className="w-full">
      <thead style={{ background: `linear-gradient(135deg, #A06820, ${GOLD})` }}>
        <tr>
          {['Titre', 'Description', 'Prix', 'Actions'].map(h => (
            <th key={h} className={`px-6 py-4 text-sm font-bold text-white ${h === 'Actions' ? 'text-center' : 'text-left'}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((service) => (
          <tr key={service._id} className="border-b hover:bg-gray-50 transition">
            <td className="px-6 py-4 font-semibold text-gray-800">{service.title}</td>
            <td className="px-6 py-4 text-gray-600 max-w-md truncate">{service.description}</td>
            <td className="px-6 py-4 font-bold" style={{ color: '#16A34A' }}>
              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(service.price || 0)}
            </td>
            <td className="px-6 py-4">
              <div className="flex justify-center gap-2">
                <button onClick={() => onEdit('edit', service)}
                  className="p-2 rounded-lg hover:scale-105 transition-all"
                  style={{ background: `${BLUE}15`, color: BLUE }} title="Modifier">
                  <Edit size={16} />
                </button>
                <button onClick={() => onDelete(service._id, 'service')}
                  className="p-2 rounded-lg hover:scale-105 transition-all"
                  style={{ background: '#FEE2E2', color: '#DC2626' }} title="Supprimer">
                  <Trash2 size={16} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── PortfolioTable ──────────────────────────────────────────
const PortfolioTable = ({ data, onEdit, onDelete, onView }) => (
  <div className="bg-white rounded-xl shadow-md overflow-hidden">
    <table className="w-full">
      <thead style={{ background: `linear-gradient(135deg, #A06820, ${GOLD})` }}>
        <tr>
          {['Image', 'Titre', 'Catégorie', 'Client', 'Note', 'Actions'].map(h => (
            <th key={h} className={`px-6 py-4 text-sm font-bold text-white ${h === 'Actions' ? 'text-center' : 'text-left'}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((item) => (
          <tr key={item._id} className="border-b hover:bg-gray-50 transition">
            <td className="px-6 py-4">
              <img src={getImageUrl(item.images?.[0])} alt={item.title}
                className="w-16 h-16 object-cover rounded-lg"
                onError={(e) => { e.target.src = 'https://placehold.co/80x80/C8872A/FFFFFF?text=Img'; }} />
            </td>
            <td className="px-6 py-4 font-semibold text-gray-800">{item.title}</td>
            <td className="px-6 py-4 text-gray-600">{item.category}</td>
            <td className="px-6 py-4 text-gray-600">{item.client || '—'}</td>
            <td className="px-6 py-4">
              <div className="flex items-center gap-1">
                <Star size={14} className="fill-yellow-400 text-yellow-400" />
                <span className="font-bold">{item.averageRating?.toFixed(1) || 0}</span>
                <span className="text-gray-500 text-sm">({item.reviewCount || 0})</span>
              </div>
            </td>
            <td className="px-6 py-4">
              <div className="flex justify-center gap-2">
                <button onClick={() => onView('view', item)}
                  className="p-2 rounded-lg hover:scale-105 transition-all"
                  style={{ background: '#F0FDF4', color: '#16A34A' }} title="Voir">
                  <Eye size={16} />
                </button>
                <button onClick={() => onEdit('edit', item)}
                  className="p-2 rounded-lg hover:scale-105 transition-all"
                  style={{ background: `${BLUE}15`, color: BLUE }} title="Modifier">
                  <Edit size={16} />
                </button>
                <button onClick={() => onDelete(item._id, 'portfolio')}
                  className="p-2 rounded-lg hover:scale-105 transition-all"
                  style={{ background: '#FEE2E2', color: '#DC2626' }} title="Supprimer">
                  <Trash2 size={16} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── ProjectsTable ───────────────────────────────────────────
const STATUS_CONFIG = {
  'En attente':          { bg: BLUE,      label: 'En attente' },
  "En cours d'analyse":  { bg: '#D97706', label: 'En analyse' },
  'Accepté':             { bg: '#16A34A', label: 'Accepté' },
  'Refusé':              { bg: '#DC2626', label: 'Refusé' },
  'En cours':            { bg: GOLD,      label: 'En cours' },
  'Terminé':             { bg: '#6B7280', label: 'Terminé' },
};

const ProjectsTable = ({ data, onView, onStatusChange, onDelete }) => (
  <div className="bg-white rounded-xl shadow-md overflow-hidden">
    <table className="w-full">
      <thead style={{ background: `linear-gradient(135deg, #A06820, ${GOLD})` }}>
        <tr>
          {['Projet', 'Client', 'Type', 'Budget', 'Date', 'Statut', 'Actions'].map(h => (
            <th key={h} className={`px-6 py-4 text-sm font-bold text-white ${h === 'Actions' ? 'text-center' : 'text-left'}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((project) => {
          const sc = STATUS_CONFIG[project.status] || STATUS_CONFIG['En attente'];
          return (
            <tr key={project._id} className="border-b hover:bg-gray-50 transition">
              <td className="px-6 py-4 font-semibold text-gray-800">{project.projectName}</td>
              <td className="px-6 py-4 text-gray-600">{project.contactName}</td>
              <td className="px-6 py-4 text-gray-600">{project.projectType}</td>
              <td className="px-6 py-4 font-bold" style={{ color: '#16A34A' }}>{project.budget}</td>
              <td className="px-6 py-4 text-gray-600 text-sm">
                {new Date(project.submittedAt).toLocaleDateString('fr-FR')}
              </td>
              <td className="px-6 py-4">
                <select value={project.status}
                  onChange={(e) => onStatusChange(project._id, e.target.value)}
                  className="px-3 py-1 rounded-full text-white text-xs font-semibold border-0 outline-none cursor-pointer"
                  style={{ background: sc.bg, fontFamily: "'Outfit', sans-serif" }}>
                  {Object.keys(STATUS_CONFIG).map(s => (
                    <option key={s} value={s} style={{ background: '#fff', color: '#374151' }}>{s}</option>
                  ))}
                </select>
              </td>
              <td className="px-6 py-4">
                <div className="flex justify-center gap-2">
                  <button onClick={() => onView('view', project)}
                    className="p-2 rounded-lg hover:scale-105 transition-all"
                    style={{ background: `${BLUE}15`, color: BLUE }} title="Voir">
                    <Eye size={16} />
                  </button>
                  <button onClick={() => onDelete(project._id, 'project')}
                    className="p-2 rounded-lg hover:scale-105 transition-all"
                    style={{ background: '#FEE2E2', color: '#DC2626' }} title="Supprimer">
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

// ─── Pagination ──────────────────────────────────────────────
const Pagination = ({ currentPage, totalPages, onPageChange }) => (
  <div className="flex justify-center items-center gap-2 mt-6">
    <button onClick={() => onPageChange(Math.max(1, currentPage - 1))}
      disabled={currentPage === 1}
      className="p-2 rounded-lg bg-white shadow disabled:opacity-50 hover:bg-gray-100 transition">
      <ChevronLeft size={20} />
    </button>
    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
      <button key={page} onClick={() => onPageChange(page)}
        className="px-4 py-2 rounded-lg font-semibold transition-all"
        style={{
          background: page === currentPage ? `linear-gradient(135deg,#A06820,${GOLD})` : '#fff',
          color: page === currentPage ? '#fff' : '#374151',
          boxShadow: page === currentPage ? `0 2px 8px ${GOLD}40` : 'none',
          fontFamily: "'Outfit', sans-serif",
        }}>
        {page}
      </button>
    ))}
    <button onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
      disabled={currentPage === totalPages}
      className="p-2 rounded-lg bg-white shadow disabled:opacity-50 hover:bg-gray-100 transition">
      <ChevronRight size={20} />
    </button>
  </div>
);

// ─── PortfolioViewModal ──────────────────────────────────────
const PortfolioViewModal = ({ item, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
      <button onClick={onClose}
        className="absolute top-4 right-4 z-10 text-white hover:text-red-300 transition p-2 rounded-full bg-black/30">
        <X size={24} />
      </button>
      {item.images?.length > 0 && (
        <div className="relative">
          <img src={getImageUrl(item.images[0])} alt={item.title}
            className="w-full h-96 object-cover rounded-t-2xl"
            onError={(e) => { e.target.src = 'https://placehold.co/800x400/C8872A/FFFFFF?text=Image+Indisponible'; }} />
          <div className="absolute bottom-4 left-4 bg-black/70 text-white px-4 py-2 rounded-lg text-sm">
            {item.images.length} image{item.images.length > 1 ? 's' : ''}
          </div>
        </div>
      )}
      <div className="p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">{item.title}</h2>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              {item.client && <span className="flex items-center gap-1"><User size={14} />{item.client}</span>}
              {item.projectDate && (
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {new Date(item.projectDate).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })}
                </span>
              )}
            </div>
          </div>
          <span className="px-4 py-2 rounded-full font-semibold text-sm text-white"
            style={{ background: `linear-gradient(135deg,#A06820,${GOLD})` }}>
            {item.category}
          </span>
        </div>
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-2">Description</h3>
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{item.description}</p>
        </div>
        {item.tags?.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {item.tags.map((tag, i) => (
                <span key={i} className="px-3 py-1 rounded-full text-sm font-semibold"
                  style={{ background: `${GOLD}15`, color: GOLD }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
        {item.link && (
          <a href={item.link} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-semibold mb-6 hover:opacity-75 transition"
            style={{ color: BLUE }}>
            <LinkIcon size={16} /> Voir le projet en ligne
          </a>
        )}
        <div className="flex items-center gap-6 pt-6 border-t">
          <div className="flex items-center gap-2">
            <Star size={18} className="fill-yellow-400 text-yellow-400" />
            <span className="font-bold text-lg">{item.averageRating?.toFixed(1) || 0}</span>
            <span className="text-gray-500">({item.reviewCount || 0} avis)</span>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
            item.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {item.isPublished ? '✓ Publié' : '✗ Brouillon'}
          </span>
        </div>
      </div>
    </motion.div>
  </div>
);

// ─── ProjectDetailModal ──────────────────────────────────────
const ProjectDetailModal = ({ project, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-8 relative">
      <button onClick={onClose}
        className="absolute top-4 right-4 text-gray-500 hover:text-red-600 transition p-2 rounded-full bg-gray-100">
        <X size={24} />
      </button>
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Détails du Projet Soumis</h2>
      <div className="space-y-6">
        <div className="p-6 rounded-xl" style={{ background: `${BLUE}10` }}>
          <h3 className="text-xl font-bold mb-4" style={{ color: BLUE }}>Informations Générales</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              ['Nom du Projet', project.projectName],
              ['Type de Projet', project.projectType],
              ['Client', project.contactName],
              ['Email', project.email],
              project.phone && ['Téléphone', project.phone],
              project.companyName && ['Entreprise', project.companyName],
            ].filter(Boolean).map(([label, value]) => (
              <div key={label}>
                <p className="text-sm text-gray-500 mb-1">{label}</p>
                <p className="font-semibold text-gray-800">{value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="p-6 rounded-xl" style={{ background: `${GOLD}10` }}>
          <h3 className="text-xl font-bold mb-3" style={{ color: GOLD }}>Description Détaillée</h3>
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{project.detailedDescription}</p>
        </div>
        <div className="p-6 rounded-xl bg-green-50">
          <h3 className="text-xl font-bold text-green-900 mb-4">Budget & Délais</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">Budget</p>
              <p className="font-semibold text-gray-800">{project.budget}</p>
            </div>
            {project.deadline && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Échéance</p>
                <p className="font-semibold text-gray-800">{new Date(project.deadline).toLocaleDateString('fr-FR')}</p>
              </div>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-400">
          Soumis le {new Date(project.submittedAt).toLocaleDateString('fr-FR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </p>
      </div>
    </motion.div>
  </div>
);

// ─── Modal Router ────────────────────────────────────────────
const Modal = ({ mode, type, item, onClose, onSuccess }) => {
  if (type === 'services' && (mode === 'create' || mode === 'edit'))
    return <ServiceFormModal service={mode === 'edit' ? item : null} onClose={onClose} onSuccess={onSuccess} />;
  if (type === 'portfolio' && (mode === 'create' || mode === 'edit'))
    return <PortfolioFormModal item={mode === 'edit' ? item : null} onClose={onClose} onSuccess={onSuccess} />;
  if (type === 'portfolio' && mode === 'view') return <PortfolioViewModal item={item} onClose={onClose} />;
  if (type === 'projects' && mode === 'view') return <ProjectDetailModal project={item} onClose={onClose} />;
  return null;
};

// ─── MAIN ────────────────────────────────────────────────────
const ManageAltcomPage = () => {
  const [activeTab, setActiveTab]       = useState('services');
  const [services, setServices]         = useState([]);
  const [portfolio, setPortfolio]       = useState([]);
  const [projects, setProjects]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [searchTerm, setSearchTerm]     = useState('');
  const [currentPage, setCurrentPage]   = useState(1);
  const [showModal, setShowModal]       = useState(false);
  const [modalMode, setModalMode]       = useState('create');
  const [selectedItem, setSelectedItem] = useState(null);
  const [confirm, setConfirm]           = useState(null); // { id, type }
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [stats, setStats]               = useState({ totalServices: 0, totalPortfolio: 0, totalProjects: 0, avgRating: 0 });

  useEffect(() => { fetchAllData(); }, []);
  useEffect(() => { calculateStats(); }, [services, portfolio, projects]);

  const fetchAllData = async () => {
    try {
      setLoading(true); setError(null);
      const [sData, pData, prData] = await Promise.allSettled([
        getAllServices('Altcom'),
        getAllPortfolioItems('Altcom'),
        api.get('/altcom/projects'),
      ]);
      if (sData.status === 'fulfilled')  setServices(sData.value || []);
      if (pData.status === 'fulfilled')  setPortfolio(pData.value || []);
      if (prData.status === 'fulfilled') setProjects(prData.value?.data?.data?.projects || []);
    } catch {
      setError('Impossible de charger les données Altcom');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const avgRating = portfolio.length > 0
      ? (portfolio.reduce((s, i) => s + (i.averageRating || 0), 0) / portfolio.length).toFixed(1)
      : 0;
    setStats({ totalServices: services.length, totalPortfolio: portfolio.length, totalProjects: projects.length, avgRating });
  };

  const showNotif = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 4000);
  };

  const handleDeleteConfirmed = async () => {
    if (!confirm) return;
    const { id, type } = confirm;
    try {
      if (type === 'service')   { await deleteService(id);       setServices(s  => s.filter(x => x._id !== id)); showNotif('Service supprimé'); }
      if (type === 'portfolio') { await deletePortfolioItem(id); setPortfolio(p => p.filter(x => x._id !== id)); showNotif('Projet portfolio supprimé'); }
      if (type === 'project')   { await api.delete(`/altcom/projects/${id}`); setProjects(p => p.filter(x => x._id !== id)); showNotif('Projet supprimé'); }
    } catch {
      showNotif('Erreur lors de la suppression', 'error');
    } finally {
      setConfirm(null);
    }
  };

  const handleStatusChange = async (projectId, newStatus) => {
    try {
      await api.patch(`/altcom/projects/${projectId}/status`, { status: newStatus });
      setProjects(p => p.map(x => x._id === projectId ? { ...x, status: newStatus } : x));
      showNotif(`Statut mis à jour : ${newStatus}`);
    } catch {
      showNotif('Erreur lors de la mise à jour du statut', 'error');
    }
  };

  const openModal = (mode, item = null) => { setModalMode(mode); setSelectedItem(item); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setSelectedItem(null); };

  const getFilteredData = () => {
    let data = activeTab === 'services' ? services : activeTab === 'portfolio' ? portfolio : projects;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      data = data.filter(item =>
        item.title?.toLowerCase().includes(q) ||
        item.projectName?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.clientName?.toLowerCase().includes(q) ||
        item.client?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q)
      );
    }
    return data;
  };

  const filteredData = getFilteredData();
  const totalPages   = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const currentData  = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <Loader2 size={36} className="animate-spin" style={{ color: GOLD }} />
    </div>
  );

  return (
    <div className="p-6" style={{ background: '#F8FAFC', minHeight: '100vh' }}>

      {/* Notification */}
      <AnimatePresence>
        {notification.show && (
          <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-lg text-white"
            style={{ background: notification.type === 'success' ? '#16A34A' : '#DC2626', fontFamily: "'Outfit', sans-serif" }}>
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${GOLD}20` }}>
          <Sparkles size={24} style={{ color: GOLD }} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Gestion Altcom
          </h1>
          <p className="text-sm text-gray-500" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Gérez vos services, portfolio et projets de communication
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Services"      value={stats.totalServices}  icon={FileText}   accent={GOLD} />
        <StatCard title="Portfolio"     value={stats.totalPortfolio} icon={Sparkles}   accent={GOLD} />
        <StatCard title="Projets Reçus" value={stats.totalProjects}  icon={TrendingUp} accent={BLUE} />
        <StatCard title="Note Moyenne"  value={`${stats.avgRating}/5`} icon={Star}     accent="#D97706" />
      </div>

      {/* Onglets */}
      <div className="flex flex-wrap gap-2 p-2 bg-white rounded-xl shadow-md mb-6">
        <TabButton active={activeTab === 'services'}  onClick={() => { setActiveTab('services');  setCurrentPage(1); }} icon={<FileText size={18} />}   label="Services"       accent={GOLD} />
        <TabButton active={activeTab === 'portfolio'} onClick={() => { setActiveTab('portfolio'); setCurrentPage(1); }} icon={<Sparkles size={18} />}   label="Portfolio"      accent={GOLD} />
        <TabButton active={activeTab === 'projects'}  onClick={() => { setActiveTab('projects');  setCurrentPage(1); }} icon={<TrendingUp size={18} />} label="Projets Reçus"  accent={BLUE} />
      </div>

      {/* Recherche + Ajouter */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Rechercher…" value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none transition-all"
              style={{ fontFamily: "'Outfit', sans-serif" }}
              onFocus={e => { e.target.style.borderColor = GOLD; e.target.style.boxShadow = `0 0 0 3px ${GOLD}20`; }}
              onBlur={e  => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }} />
          </div>
          {activeTab !== 'projects' && (
            <button onClick={() => openModal('create')}
              className="flex items-center gap-2 px-6 py-2.5 text-white text-sm font-semibold rounded-xl transition-all hover:scale-105"
              style={{ background: `linear-gradient(135deg,#A06820,${GOLD})`, boxShadow: `0 4px 16px ${GOLD}35`, fontFamily: "'Outfit', sans-serif" }}>
              <Plus size={16} /> Ajouter
            </button>
          )}
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-6 text-sm"
          style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5', fontFamily: "'Outfit', sans-serif" }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Contenu */}
      {currentData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: `${GOLD}12` }}>
            <Sparkles size={24} style={{ color: GOLD }} />
          </div>
          <p className="font-semibold text-gray-600 mb-1" style={{ fontFamily: "'Outfit', sans-serif" }}>Aucun élément trouvé</p>
        </div>
      ) : (
        <>
          {activeTab === 'services'  && <ServicesTable  data={currentData} onEdit={openModal} onDelete={(id, t) => setConfirm({ id, type: t })} />}
          {activeTab === 'portfolio' && <PortfolioTable data={currentData} onEdit={openModal} onDelete={(id, t) => setConfirm({ id, type: t })} onView={openModal} />}
          {activeTab === 'projects'  && <ProjectsTable  data={currentData} onView={openModal} onStatusChange={handleStatusChange} onDelete={(id, t) => setConfirm({ id, type: t })} />}
          {totalPages > 1 && <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />}
        </>
      )}

      {/* Modal formulaire */}
      <AnimatePresence>
        {showModal && (
          <Modal mode={modalMode} type={activeTab} item={selectedItem} onClose={closeModal}
            onSuccess={() => { closeModal(); fetchAllData(); showNotif(modalMode === 'create' ? 'Élément créé' : 'Élément mis à jour'); }} />
        )}
      </AnimatePresence>

      {/* ConfirmDialog */}
      {confirm && (
        <ConfirmDialog
          message="Voulez-vous vraiment supprimer cet élément ? Cette action est irréversible."
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default ManageAltcomPage;