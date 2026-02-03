import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  TrendingUp,
  FileText,
  Plus,
  Edit,
  Trash2,
  Eye,
  Search,
  Filter,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Save,
  Image as ImageIcon,
  Calendar,
  DollarSign,
  Tag,
  Users,
  Send,
  ChevronLeft,
  ChevronRight,
  Star,
  User,
  Link as LinkIcon,
} from 'lucide-react';
import { getAllServices, deleteService } from '../../services/serviceService';
import { getAllPortfolioItems, deletePortfolioItem } from '../../services/portfolioService';
import api from '../../services/api';
import ServiceFormModal from '../../components/modals/ServiceFormModal';
import PortfolioFormModal from '../../components/modals/PortfolioFormModal';


const getImageUrl = (imagePath) => {
  if (!imagePath) return 'https://via.placeholder.com/80';
  
  // Si l'image commence par http:// ou https://, c'est déjà une URL complète
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // Si l'image commence par /uploads, ajouter le BACKEND_URL
  if (imagePath.startsWith('/uploads')) {
    return `${BACKEND_URL}${imagePath}`;
  }
  
  // Par défaut, retourner l'image telle quelle
  return imagePath;
};

const ITEMS_PER_PAGE = 10;
const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

const ManageAltcomPage = () => {
  const [activeTab, setActiveTab] = useState('services'); // services, portfolio, projects
  const [services, setServices] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // create, edit, view
  const [selectedItem, setSelectedItem] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [stats, setStats] = useState({
    totalServices: 0,
    totalPortfolio: 0,
    totalProjects: 0,
    avgRating: 0,
  });

  // Charger les données au montage
  useEffect(() => {
    fetchAllData();
  }, []);

  // Calculer les stats
  useEffect(() => {
    calculateStats();
  }, [services, portfolio, projects]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [servicesData, portfolioData, projectsData] = await Promise.allSettled([
        getAllServices('Altcom'),
        getAllPortfolioItems('Altcom'),
        api.get('/altcom/projects'),
      ]);

      if (servicesData.status === 'fulfilled') {
        setServices(servicesData.value || []);
      }

      if (portfolioData.status === 'fulfilled') {
        setPortfolio(portfolioData.value || []);
      }

      if (projectsData.status === 'fulfilled') {
        setProjects(projectsData.value?.data?.data?.projects || []);
      }
    } catch (err) {
      console.error('Erreur lors du chargement:', err);
      setError('Impossible de charger les données Altcom');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const totalServices = services.length;
    const totalPortfolio = portfolio.length;
    const totalProjects = projects.length;
    
    const avgRating = portfolio.length > 0
      ? (portfolio.reduce((sum, item) => sum + (item.averageRating || 0), 0) / portfolio.length).toFixed(1)
      : 0;

    setStats({ totalServices, totalPortfolio, totalProjects, avgRating });
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 4000);
  };

  const handleDelete = async (id, type) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer cet élément ?`)) return;

    try {
      if (type === 'service') {
        await deleteService(id);
        setServices(services.filter(s => s._id !== id));
        showNotification('Service supprimé avec succès');
      } else if (type === 'portfolio') {
        await deletePortfolioItem(id);
        setPortfolio(portfolio.filter(p => p._id !== id));
        showNotification('Projet portfolio supprimé avec succès');
      } else if (type === 'project') {
        await api.delete(`/altcom/projects/${id}`);
        setProjects(projects.filter(p => p._id !== id));
        showNotification('Projet soumis supprimé avec succès');
      }
    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
      showNotification('Erreur lors de la suppression', 'error');
    }
  };

  const handleStatusChange = async (projectId, newStatus) => {
    try {
      await api.patch(`/altcom/projects/${projectId}/status`, { status: newStatus });
      setProjects(projects.map(p => p._id === projectId ? { ...p, status: newStatus } : p));
      showNotification(`Statut mis à jour : ${newStatus}`);
    } catch (err) {
      showNotification('Erreur lors de la mise à jour du statut', 'error');
    }
  };

  const openModal = (mode, item = null) => {
    setModalMode(mode);
    setSelectedItem(item);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedItem(null);
  };

  // Filtrer les données selon la recherche
  const getFilteredData = () => {
    let data = [];
    if (activeTab === 'services') data = services;
    else if (activeTab === 'portfolio') data = portfolio;
    else if (activeTab === 'projects') data = projects;

    if (searchTerm) {
      data = data.filter(item => {
        const searchLower = searchTerm.toLowerCase();
        return (
          item.title?.toLowerCase().includes(searchLower) ||
          item.projectName?.toLowerCase().includes(searchLower) ||
          item.description?.toLowerCase().includes(searchLower) ||
          item.clientName?.toLowerCase().includes(searchLower) ||
          item.client?.toLowerCase().includes(searchLower) ||
          item.category?.toLowerCase().includes(searchLower)
        );
      });
    }

    return data;
  };

  const filteredData = getFilteredData();
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentData = filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);

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
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-gray-800">Gestion Altcom</h1>
            <p className="text-gray-600">Gérez vos services, portfolio et projets de communication</p>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Services" value={stats.totalServices} icon={FileText} color="blue" />
        <StatCard title="Portfolio" value={stats.totalPortfolio} icon={Sparkles} color="purple" />
        <StatCard title="Projets Reçus" value={stats.totalProjects} icon={TrendingUp} color="green" />
        <StatCard
          title="Note Moyenne"
          value={`${stats.avgRating}/5`}
          icon={Star}
          color="yellow"
        />
      </div>

      {/* Onglets */}
      <div className="flex flex-wrap gap-2 p-2 bg-white rounded-xl shadow-md mb-6">
        <TabButton
          active={activeTab === 'services'}
          onClick={() => { setActiveTab('services'); setCurrentPage(1); }}
          icon={<FileText className="w-5 h-5" />}
          label="Services"
        />
        <TabButton
          active={activeTab === 'portfolio'}
          onClick={() => { setActiveTab('portfolio'); setCurrentPage(1); }}
          icon={<Sparkles className="w-5 h-5" />}
          label="Portfolio"
        />
        <TabButton
          active={activeTab === 'projects'}
          onClick={() => { setActiveTab('projects'); setCurrentPage(1); }}
          icon={<TrendingUp className="w-5 h-5" />}
          label="Projets Reçus"
        />
      </div>

      {/* Barre de recherche et actions */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {activeTab !== 'projects' && (
            <button
              onClick={() => openModal('create')}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 transition font-semibold shadow-md"
            >
              <Plus className="w-5 h-5" />
              Ajouter
            </button>
          )}
        </div>
      </div>

      {/* Contenu selon l'onglet actif */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded">
          <div className="flex items-center">
            <AlertCircle className="text-red-500 w-6 h-6 mr-3" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {currentData.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Aucun élément trouvé</p>
        </div>
      ) : (
        <>
          {activeTab === 'services' && <ServicesTable data={currentData} onEdit={openModal} onDelete={handleDelete} />}
          {activeTab === 'portfolio' && <PortfolioTable data={currentData} onEdit={openModal} onDelete={handleDelete} onView={openModal} />}
          {activeTab === 'projects' && <ProjectsTable data={currentData} onView={openModal} onStatusChange={handleStatusChange} onDelete={handleDelete} />}

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <Modal
            mode={modalMode}
            type={activeTab}
            item={selectedItem}
            onClose={closeModal}
            onSuccess={() => {
              closeModal();
              fetchAllData();
              showNotification(
                modalMode === 'create' ? 'Élément créé avec succès' : 'Élément mis à jour avec succès'
              );
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ===========================
// COMPOSANTS AUXILIAIRES
// ===========================

const StatCard = ({ title, value, icon: Icon, color }) => {
  const colors = {
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-600 text-sm font-medium">{title}</span>
        <Icon className={`w-5 h-5 text-${color}-500`} />
      </div>
      <p className="text-3xl font-bold text-gray-800">{value}</p>
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex-1 min-w-[140px] py-3 px-6 rounded-lg font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
      active
        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
        : 'text-gray-700 hover:bg-gray-100'
    }`}
  >
    {icon}
    {label}
  </button>
);

const ServicesTable = ({ data, onEdit, onDelete }) => (
  <div className="bg-white rounded-xl shadow-md overflow-hidden">
    <table className="w-full">
      <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <tr>
          <th className="px-6 py-4 text-left text-sm font-bold">Titre</th>
          <th className="px-6 py-4 text-left text-sm font-bold">Description</th>
          <th className="px-6 py-4 text-left text-sm font-bold">Prix</th>
          <th className="px-6 py-4 text-center text-sm font-bold">Actions</th>
        </tr>
      </thead>
      <tbody>
        {data.map((service) => (
          <tr key={service._id} className="border-b hover:bg-gray-50 transition">
            <td className="px-6 py-4 font-semibold text-gray-800">{service.title}</td>
            <td className="px-6 py-4 text-gray-600 max-w-md truncate">{service.description}</td>
            <td className="px-6 py-4 text-green-600 font-bold">
              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(service.price || 0)}
            </td>
            <td className="px-6 py-4">
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => onEdit('edit', service)}
                  className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition"
                  title="Modifier"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(service._id, 'service')}
                  className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const PortfolioTable = ({ data, onEdit, onDelete, onView }) => (
  <div className="bg-white rounded-xl shadow-md overflow-hidden">
    <table className="w-full">
      <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <tr>
          <th className="px-6 py-4 text-left text-sm font-bold">Image</th>
          <th className="px-6 py-4 text-left text-sm font-bold">Titre</th>
          <th className="px-6 py-4 text-left text-sm font-bold">Catégorie</th>
          <th className="px-6 py-4 text-left text-sm font-bold">Client</th>
          <th className="px-6 py-4 text-left text-sm font-bold">Note</th>
          <th className="px-6 py-4 text-center text-sm font-bold">Actions</th>
        </tr>
      </thead>
      <tbody>
        {data.map((item) => (
          <tr key={item._id} className="border-b hover:bg-gray-50 transition">
            <td className="px-6 py-4">
              <img
                src={getImageUrl(item.images?.[0])}
                alt={item.title}
                className="w-16 h-16 object-cover rounded-lg"
                onError={(e) => {
                  console.error('❌ Erreur de chargement image:', item.images?.[0]);
                  e.target.src = 'https://via.placeholder.com/80?text=Image';
                }}
                onLoad={() => {
                  console.log('✅ Image chargée:', item.images?.[0]);
                }}
              />
            </td>
            <td className="px-6 py-4 font-semibold text-gray-800">{item.title}</td>
            <td className="px-6 py-4 text-gray-600">{item.category}</td>
            <td className="px-6 py-4 text-gray-600">{item.client || '-'}</td>
            <td className="px-6 py-4">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="font-bold">{item.averageRating?.toFixed(1) || 0}</span>
                <span className="text-gray-500 text-sm">({item.reviewCount || 0})</span>
              </div>
            </td>
            <td className="px-6 py-4">
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => onView('view', item)}
                  className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition"
                  title="Voir"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onEdit('edit', item)}
                  className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition"
                  title="Modifier"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(item._id, 'portfolio')}
                  className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const ProjectsTable = ({ data, onView, onStatusChange, onDelete }) => {
  const STATUS_CONFIG = {
    'En attente': { color: 'bg-blue-500', label: 'En attente' },
    'En cours d\'analyse': { color: 'bg-yellow-500', label: 'En analyse' },
    'Accepté': { color: 'bg-green-500', label: 'Accepté' },
    'Refusé': { color: 'bg-red-500', label: 'Refusé' },
    'En cours': { color: 'bg-purple-500', label: 'En cours' },
    'Terminé': { color: 'bg-gray-500', label: 'Terminé' },
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <table className="w-full">
        <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <tr>
            <th className="px-6 py-4 text-left text-sm font-bold">Projet</th>
            <th className="px-6 py-4 text-left text-sm font-bold">Client</th>
            <th className="px-6 py-4 text-left text-sm font-bold">Type</th>
            <th className="px-6 py-4 text-left text-sm font-bold">Budget</th>
            <th className="px-6 py-4 text-left text-sm font-bold">Date</th>
            <th className="px-6 py-4 text-left text-sm font-bold">Statut</th>
            <th className="px-6 py-4 text-center text-sm font-bold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((project) => {
            const statusConfig = STATUS_CONFIG[project.status] || STATUS_CONFIG['En attente'];
            return (
              <tr key={project._id} className="border-b hover:bg-gray-50 transition">
                <td className="px-6 py-4 font-semibold text-gray-800">{project.projectName}</td>
                <td className="px-6 py-4 text-gray-600">{project.contactName}</td>
                <td className="px-6 py-4 text-gray-600">{project.projectType}</td>
                <td className="px-6 py-4 text-green-600 font-bold">{project.budget}</td>
                <td className="px-6 py-4 text-gray-600 text-sm">
                  {new Date(project.submittedAt).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-6 py-4">
                  <select
                    value={project.status}
                    onChange={(e) => onStatusChange(project._id, e.target.value)}
                    className={`px-3 py-1 rounded-full text-white text-xs font-semibold ${statusConfig.color}`}
                  >
                    <option value="En attente">En attente</option>
                    <option value="En cours d'analyse">En analyse</option>
                    <option value="Accepté">Accepté</option>
                    <option value="Refusé">Refusé</option>
                    <option value="En cours">En cours</option>
                    <option value="Terminé">Terminé</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => onView('view', project)}
                      className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition"
                      title="Voir détails"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(project._id, 'project')}
                      className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
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
};

const Pagination = ({ currentPage, totalPages, onPageChange }) => (
  <div className="flex justify-center items-center gap-2 mt-6">
    <button
      onClick={() => onPageChange(Math.max(1, currentPage - 1))}
      disabled={currentPage === 1}
      className="p-2 rounded-lg bg-white shadow disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
    >
      <ChevronLeft className="w-5 h-5" />
    </button>
    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
      <button
        key={page}
        onClick={() => onPageChange(page)}
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
      onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
      disabled={currentPage === totalPages}
      className="p-2 rounded-lg bg-white shadow disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
    >
      <ChevronRight className="w-5 h-5" />
    </button>
  </div>
);

// ===========================
// COMPOSANTS MODALS
// ===========================

// Modal Router - Gère l'affichage des différents modals
const Modal = ({ mode, type, item, onClose, onSuccess }) => {
  // Service Modal
  if (type === 'services' && (mode === 'create' || mode === 'edit')) {
    return (
      <ServiceFormModal
        service={mode === 'edit' ? item : null}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );
  }

  // Portfolio Modal
  if (type === 'portfolio' && (mode === 'create' || mode === 'edit')) {
    return (
      <PortfolioFormModal
        item={mode === 'edit' ? item : null}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );
  }

  // View Portfolio
  if (type === 'portfolio' && mode === 'view') {
    return <PortfolioViewModal item={item} onClose={onClose} />;
  }

  // View Project
  if (type === 'projects' && mode === 'view') {
    return <ProjectDetailModal project={item} onClose={onClose} />;
  }

  return null;
};

// Modal de visualisation Portfolio
const PortfolioViewModal = ({ item, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-white hover:text-red-300 transition p-2 rounded-full bg-black/30"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Images Carousel - CORRECTION ICI */}
        {item.images && item.images.length > 0 && (
          <div className="relative">
            <img
              src={getImageUrl(item.images[0])}
              alt={item.title}
              className="w-full h-96 object-cover rounded-t-2xl"
              onError={(e) => {
                console.error('❌ Erreur modal view:', item.images[0]);
                e.target.src = 'https://via.placeholder.com/800x400?text=Image+Indisponible';
              }}
            />
            <div className="absolute bottom-4 left-4 bg-black/70 text-white px-4 py-2 rounded-lg">
              {item.images.length} image{item.images.length > 1 ? 's' : ''}
            </div>
          </div>
        )}

        <div className="p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">{item.title}</h2>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                {item.client && (
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {item.client}
                  </span>
                )}
                {item.projectDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(item.projectDate).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'long',
                    })}
                  </span>
                )}
              </div>
            </div>
            <span className="px-4 py-2 bg-purple-100 text-purple-700 rounded-full font-semibold">
              {item.category}
            </span>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Description</h3>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{item.description}</p>
          </div>

          {item.tags && item.tags.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-800 mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {item.tags.map((tag, index) => (
                  <span key={index} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {item.link && (
            <div className="mb-6">
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold"
              >
                <LinkIcon className="w-4 h-4" />
                Voir le projet en ligne
              </a>
            </div>
          )}

          <div className="flex items-center gap-6 pt-6 border-t">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              <span className="font-bold text-lg">{item.averageRating?.toFixed(1) || 0}</span>
              <span className="text-gray-500">({item.reviewCount || 0} avis)</span>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
              item.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            }`}>
              {item.isPublished ? '✓ Publié' : '✗ Brouillon'}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// Modal de visualisation Projet
const ProjectDetailModal = ({ project, onClose }) => {
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

        <h2 className="text-3xl font-bold text-gray-800 mb-6">Détails du Projet Soumis</h2>

        <div className="space-y-6">
          {/* Informations Générales */}
          <div className="bg-blue-50 p-6 rounded-xl">
            <h3 className="text-xl font-bold text-blue-900 mb-4">Informations Générales</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Nom du Projet</p>
                <p className="font-semibold text-gray-800">{project.projectName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Type de Projet</p>
                <p className="font-semibold text-gray-800">{project.projectType}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Client</p>
                <p className="font-semibold text-gray-800">{project.contactName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Email</p>
                <p className="font-semibold text-gray-800">{project.email}</p>
              </div>
              {project.phone && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Téléphone</p>
                  <p className="font-semibold text-gray-800">{project.phone}</p>
                </div>
              )}
              {project.companyName && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Entreprise</p>
                  <p className="font-semibold text-gray-800">{project.companyName}</p>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="bg-purple-50 p-6 rounded-xl">
            <h3 className="text-xl font-bold text-purple-900 mb-3">Description Détaillée</h3>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{project.detailedDescription}</p>
          </div>

          {/* Budget et Délais */}
          <div className="bg-green-50 p-6 rounded-xl">
            <h3 className="text-xl font-bold text-green-900 mb-4">Budget & Délais</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Budget</p>
                <p className="font-semibold text-gray-800">{project.budget}</p>
              </div>
              {project.deadline && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Échéance</p>
                  <p className="font-semibold text-gray-800">
                    {new Date(project.deadline).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Date de soumission */}
          <div className="text-sm text-gray-500">
            Soumis le {new Date(project.submittedAt).toLocaleDateString('fr-FR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ManageAltcomPage;