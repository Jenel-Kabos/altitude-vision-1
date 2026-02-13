import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  Layout, 
  TrendingUp, 
  Zap, 
  Loader2 as IconSpinner, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Send, 
  Briefcase,
  Presentation,
  UserRoundPen, 
  ArrowRight, 
  Sparkles,
  Radio,
  Star,
  MessageSquarePlus
} from 'lucide-react';

import { createAltcomProject } from '../services/altcomService';
import { createQuoteRequest } from '../services/quoteService';
import { getAllPortfolioItems } from '../services/portfolioService';
import { getAltcomReviews } from '../services/reviewService';
import { useAuth } from '../context/AuthContext';
import PortfolioCard from "../components/PortfolioCard"; 
import ReviewCard from "../components/ReviewCard";
import AltcomProjectFormModal from "../components/AltcomProjectFormModal";

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'https://altitude-vision.onrender.com';
const PORTFOLIO_PER_PAGE = 6;

const defaultServices = [
  { 
    _id: 1, 
    title: "Communication Digitale", 
    description: "Création de contenus et campagnes sur mesure pour le web et les réseaux sociaux.", 
    icon: MessageSquare, 
    color: "text-blue-500",
    gradient: "from-blue-600 to-sky-500",
    route: "/altcom/service/1"
  },
  { 
    _id: 2, 
    title: "Branding & Design", 
    description: "Définition d'identité visuelle et supports graphiques professionnels.", 
    icon: Layout, 
    color: "text-purple-500",
    gradient: "from-purple-600 to-violet-500",
    route: "/altcom/service/2"
  },
  { 
    _id: 3, 
    title: "Conseil & Stratégie", 
    description: "Accompagnement stratégique pour optimiser votre communication.", 
    icon: TrendingUp, 
    color: "text-red-500",
    gradient: "from-red-600 to-pink-500",
    route: "/altcom/service/3"
  },
  { 
    _id: 4, 
    title: "Couverture Médiatique", 
    description: "Organisation et couverture complète de vos événements avec reportage photo/vidéo.", 
    icon: Radio, 
    color: "text-orange-500",
    gradient: "from-orange-600 to-amber-500",
    route: "/altcom/couverture-mediatique"
  },
];

const ServiceCard = ({ service, onQuoteRequest, index }) => {
  const navigate = useNavigate();
  const IconComponent = service.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -4 }}
      className="group bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden border border-gray-100 hover:border-blue-200 flex flex-col h-full"
    >
      <div className={`h-1.5 bg-gradient-to-r ${service.gradient} group-hover:h-2 transition-all duration-300`} />
      
      <div className="flex flex-col items-center text-center p-6 sm:p-7 flex-1">
        <motion.div 
          whileHover={{ rotate: 5, scale: 1.1 }}
          transition={{ type: "spring", stiffness: 300 }}
          className={`p-3 sm:p-4 rounded-2xl mb-4 bg-gradient-to-br ${service.gradient} bg-opacity-10 group-hover:shadow-lg transition-shadow duration-300`}
        >
          {IconComponent && <IconComponent className="w-7 h-7 sm:w-8 sm:h-8 text-white" />}
        </motion.div>
        
        <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 leading-tight group-hover:text-blue-600 transition-colors duration-300">
          {service.title}
        </h3>
        
        <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-4 flex-1 line-clamp-2">
          {service.description}
        </p>
        
        <div className="w-full space-y-3 mt-auto pt-4">
          <motion.button 
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onQuoteRequest(service.title)}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold py-3 sm:py-3.5 px-5 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl hover:shadow-blue-500/30 text-sm sm:text-base flex items-center justify-center gap-2 group/btn"
          >
            <Send className="w-4 h-4 sm:w-5 sm:h-5 group-hover/btn:translate-x-0.5 transition-transform" />
            Demander un Devis
          </motion.button>
          
          <button
            onClick={() => navigate(service.route)}
            className="inline-flex items-center justify-center gap-2 text-blue-600 hover:text-blue-700 font-semibold text-xs sm:text-sm transition-all duration-200 group/link w-full"
          >
            <span>Détails du Service</span>
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover/link:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const Pagination = ({ totalPages, currentPage, onPageChange }) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex justify-center items-center gap-2 mt-12">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2.5 rounded-xl bg-white border border-gray-200 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-50 transition-all"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`min-w-[40px] px-4 py-2.5 rounded-xl font-semibold transition-all ${
            p === currentPage 
              ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg scale-105' 
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-blue-50'
          }`}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-2.5 rounded-xl bg-white border border-gray-200 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-50 transition-all"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
};

const QuoteRequestModal = ({ serviceTitle, onClose, onFormSubmit }) => {
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', service: serviceTitle, projectType: 'Communication Digitale',
    budget: '', description: '', source: 'Altcom',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.description || !formData.projectType) {
      alert('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onFormSubmit(formData);
      onClose();
    } catch (error) {
      alert(error.message || "Erreur lors de l'envoi du devis.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto"
      >
        <button onClick={onClose} disabled={isSubmitting} className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 hover:bg-red-100 hover:text-red-600 transition">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-500 shadow-lg">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">Demander un Devis</h3>
        </div>
        
        <p className="text-gray-600 mb-6">Obtenez une consultation gratuite pour votre projet de communication.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-2xl border-l-4 border-blue-600">
            <label className="block text-sm font-semibold text-blue-800 mb-1">Service Sélectionné</label>
            <input type="text" name="service" value={formData.service} disabled className="w-full font-bold bg-blue-50 focus:outline-none" />
          </div>

          <div>
            <label htmlFor="projectType" className="block text-sm font-semibold text-gray-700 mb-2">Type de Projet <span className="text-red-500">*</span></label>
            <select id="projectType" name="projectType" value={formData.projectType} onChange={handleChange} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition">
              <option value="Communication Digitale">Communication Digitale</option>
              <option value="Branding & Design">Branding & Design</option>
              <option value="Stratégie de Contenu">Stratégie de Contenu</option>
              <option value="Campagne Publicitaire">Campagne Publicitaire</option>
              <option value="Refonte Site Web">Refonte Site Web</option>
              <option value="Couverture Médiatique">Couverture Médiatique</option>
              <option value="Autre">Autre</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">Nom Complet <span className="text-red-500">*</span></label>
              <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} required className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">Email <span className="text-red-500">*</span></label>
              <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} required className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
            </div>
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">Téléphone</label>
            <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
          </div>

          <div>
            <label htmlFor="budget" className="block text-sm font-semibold text-gray-700 mb-2">Budget Estimé</label>
            <select id="budget" name="budget" value={formData.budget} onChange={handleChange} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition">
              <option value="">Préférez ne pas préciser</option>
              <option value="Moins de 1M">Moins de 1 000 000 FCFA</option>
              <option value="1M-5M">1M - 5M FCFA</option>
              <option value="5M-10M">5M - 10M FCFA</option>
              <option value="Plus de 10M">Plus de 10M FCFA</option>
            </select>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-2">Description <span className="text-red-500">*</span></label>
            <textarea id="description" name="description" value={formData.description} onChange={handleChange} rows="4" maxLength="1000" required className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-y" placeholder="Décrivez votre projet..." />
            <p className="text-sm text-gray-500 mt-1">{formData.description.length}/1000 caractères</p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold shadow-lg ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 hover:shadow-xl hover:shadow-blue-500/30'} text-white transition-all`}
          >
            {isSubmitting ? <><IconSpinner className="w-5 h-5 animate-spin" />Envoi...</> : <><Send className="w-5 h-5" />Envoyer</>}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const AltcomPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [services, setServices] = useState([]); 
  const [portfolio, setPortfolio] = useState([]); 
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [selectedService, setSelectedService] = useState('');
  const [showNotification, setShowNotification] = useState({ visible: false, message: '', type: 'success' });
  const [currentPage, setCurrentPage] = useState(1);
  const [showProjectModal, setShowProjectModal] = useState(false);
  
  useEffect(() => {
    fetchAltcomData();
    
    if (location.state?.openQuoteModal) {
      setSelectedService(location.state.service || 'Demande Générale');
      setShowQuoteModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  
  const fetchAltcomData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const portfolioData = await getAllPortfolioItems();
      const altcomPortfolio = portfolioData.filter(
        item => item.isPublished && (item.pole === 'Altcom' || !item.pole)
      );
      setPortfolio(altcomPortfolio || []);
      
      try {
        setReviewsLoading(true);
        const reviewsData = await getAltcomReviews(6);
        setReviews(reviewsData || []);
      } catch (reviewError) {
        console.error('⚠️ Erreur lors du chargement des avis:', reviewError);
        setReviews([]);
      } finally {
        setReviewsLoading(false);
      }
      
    } catch (err) {
      console.error('❌ Erreur lors du chargement des données Altcom:', err);
      setError('Impossible de charger les données');
      setPortfolio([]);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };
  
  const displayServices = services?.length > 0 ? services : defaultServices;
  const displayPortfolio = portfolio || [];
  const displayReviews = reviews || [];

  const totalPages = Math.ceil(displayPortfolio.length / PORTFOLIO_PER_PAGE);
  const currentPortfolio = useMemo(() => {
    const startIndex = (currentPage - 1) * PORTFOLIO_PER_PAGE;
    return displayPortfolio.slice(startIndex, startIndex + PORTFOLIO_PER_PAGE);
  }, [displayPortfolio, currentPage]);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      document.getElementById('portfolio')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleQuoteRequest = (serviceTitle) => {
    setSelectedService(serviceTitle);
    setShowQuoteModal(true);
  };
  
  const handleFormSubmit = async (formData) => {
    try {
      await createQuoteRequest(formData);
      setShowNotification({ visible: true, message: `Votre demande pour "${formData.service}" a été enregistrée. Nous vous recontacterons sous 24h.`, type: 'success' });
      setTimeout(() => setShowNotification({ visible: false, message: '', type: 'success' }), 5000);
    } catch (error) {
      setShowNotification({ visible: true, message: error.message || "Erreur lors de l'envoi.", type: 'error' });
      setTimeout(() => setShowNotification({ visible: false, message: '', type: 'success' }), 5000);
      throw error;
    }
  };

  const handleProjectSubmit = async (formData) => {
    try {
      await createAltcomProject(formData);
      setShowNotification({ visible: true, message: `Votre projet "${formData.projectName}" a été soumis avec succès.`, type: 'success' });
      setTimeout(() => setShowNotification({ visible: false, message: '', type: 'success' }), 6000);
    } catch (error) {
      let errorMessage = "Erreur lors de la soumission.";
      if (error.response) errorMessage = error.response.data?.message || errorMessage;
      else if (error.request) errorMessage = "Impossible de contacter le serveur.";
      else errorMessage = error.message || errorMessage;
      
      setShowNotification({ visible: true, message: errorMessage, type: 'error' });
      setTimeout(() => setShowNotification({ visible: false, message: '', type: 'success' }), 6000);
      throw error;
    }
  };

  const handleLeaveReview = () => {
    if (user) {
      navigate('/avis/nouveau');
    } else {
      navigate('/login', { state: { from: '/avis/nouveau' } });
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <IconSpinner className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-700">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        .font-sans { font-family: 'Inter', sans-serif; }
        html { scroll-behavior: smooth; }
      `}</style>

      <AnimatePresence>
        {showNotification.visible && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-2xl shadow-2xl text-white ${
              showNotification.type === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-red-500 to-pink-600'
            }`}
          >
            {showNotification.message}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showQuoteModal && <QuoteRequestModal serviceTitle={selectedService} onClose={() => setShowQuoteModal(false)} onFormSubmit={handleFormSubmit} />}
      </AnimatePresence>

      <AnimatePresence>
        {showProjectModal && <AltcomProjectFormModal onClose={() => setShowProjectModal(false)} onFormSubmit={handleProjectSubmit} />}
      </AnimatePresence>

      {/* Hero Section */}
      <header className="relative text-white pt-32 pb-24 overflow-hidden h-[75vh] min-h-[600px]" style={{ backgroundImage: "linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url('https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=1974&auto=format&fit=crop')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/40 via-transparent to-black/60"></div>
        
        <div className="container mx-auto px-4 sm:px-6 text-center relative z-10 max-w-6xl h-full flex flex-col justify-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }} className="inline-flex items-center justify-center mb-6 mx-auto">
            <div className="p-3 bg-white/15 backdrop-blur-md rounded-2xl border border-white/30 shadow-xl">
              <MessageSquare className="w-7 h-7 text-white" />
            </div>
          </motion.div>
          
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.7 }} className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold mb-5 leading-tight">
            Altcom<br/>
            <span className="bg-gradient-to-r from-red-400 to-orange-300 bg-clip-text text-transparent">Stratégie & Créativité</span>
          </motion.h1>
          
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.7 }} className="text-base sm:text-lg lg:text-xl font-light max-w-2xl mx-auto text-white/90 leading-relaxed">
            Votre Vision, Notre Mission. Des solutions de communication percutantes et sur mesure
          </motion.p>
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.7 }} className="mt-10 flex flex-wrap justify-center gap-3 sm:gap-4">
            <button onClick={() => setShowProjectModal(true)} className="group flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold text-sm sm:text-base rounded-full shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105">
              <Presentation className="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-12 transition-transform" />
              Démarrer Votre Projet
            </button>
            <Link to="/altcom/annonces" className="flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 bg-white/15 backdrop-blur-md text-white font-semibold text-sm sm:text-base rounded-full border border-white/30 hover:bg-white/25 transition-all duration-300 hover:scale-105">
              <Briefcase className="w-4 h-4 sm:w-5 sm:h-5" />
              Voir Nos Réalisations
            </Link>
          </motion.div>
        </div>
      </header>

      {/* À Propos */}
      <section className="bg-gradient-to-b from-white to-slate-50 py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          <div className="text-center mb-10">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">Qui Sommes-Nous ?</h2>
              <div className="h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent w-32 mx-auto rounded-full"></div>
            </motion.div>
          </div>
          
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2, duration: 0.6 }} className="max-w-3xl mx-auto text-gray-600 text-base sm:text-lg lg:text-xl leading-relaxed text-center">
            Altcom est le pôle de communication d'Altitude-Vision, spécialisé dans la création de <span className="font-semibold text-gray-900">stratégies percutantes</span>. Nous aidons les marques à raconter leur histoire et à <span className="font-semibold text-gray-900">engager leur audience</span> grâce à des solutions créatives et sur mesure.
          </motion.p>
        </div>
      </section>

      {/* Services */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          <div className="text-center mb-14">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
              <p className="text-xs sm:text-sm font-bold text-blue-600 uppercase tracking-wider mb-2">Nos Expertises</p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">Nos Services</h2>
              <p className="text-gray-500 text-base sm:text-lg font-light max-w-2xl mx-auto">Des solutions sur mesure pour amplifier votre message</p>
            </motion.div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {displayServices.map((service, index) => (
              <ServiceCard key={service._id} service={service} onQuoteRequest={handleQuoteRequest} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Portfolio */}
      <section id="portfolio" className="py-16 sm:py-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          <div className="text-center mb-14">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
              <p className="text-xs sm:text-sm font-bold text-red-600 uppercase tracking-wider mb-2">Portfolio</p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">Nos Réalisations</h2>
              <div className="h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent w-24 mx-auto rounded-full mb-5"></div>
              <Link to="/altcom/annonces" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold text-sm sm:text-base transition-colors group">
                Voir tous nos projets
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          </div>
          
          {currentPortfolio.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {currentPortfolio.map((item, index) => (
                <motion.div key={item._id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.4, delay: index * 0.05 }}>
                  <PortfolioCard item={item} />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-gradient-to-br from-slate-50 to-blue-50 rounded-3xl border border-dashed border-blue-200">
              <Briefcase className="w-10 h-10 mx-auto mb-4 text-blue-600" />
              <p className="text-lg font-bold text-gray-700">Aucune réalisation disponible</p>
            </div>
          )}
          
          {displayPortfolio.length > 0 && <Pagination totalPages={totalPages} currentPage={currentPage} onPageChange={handlePageChange} />}
        </div>
      </section>

      {/* ✅ SECTION AVIS CLIENTS */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          <div className="text-center mb-12">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
              <p className="text-xs sm:text-sm font-bold text-red-600 uppercase tracking-wider mb-2">Témoignages</p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">Ils Nous Font Confiance</h2>
              <p className="text-gray-500 text-base sm:text-lg font-light">L'avis de nos clients est notre meilleure publicité</p>
            </motion.div>
          </div>
          
          {reviewsLoading ? (
            <div className="flex justify-center py-10">
              <IconSpinner className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : displayReviews.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {displayReviews.map((review, index) => (
                  <motion.div 
                    key={review._id} 
                    initial={{ opacity: 0, y: 20 }} 
                    whileInView={{ opacity: 1, y: 0 }} 
                    viewport={{ once: true }} 
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <ReviewCard review={review} />
                  </motion.div>
                ))}
              </div>

              {/* ✅ Bouton Laisser un avis */}
              <div className="text-center">
                <motion.button
                  onClick={handleLeaveReview}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-lg rounded-full shadow-2xl hover:shadow-blue-500/50 transition-all"
                >
                  <MessageSquarePlus className="w-5 h-5" />
                  Laisser un avis
                </motion.button>
                {!user && (
                  <p className="text-sm text-gray-500 mt-3">
                    (Connexion requise)
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-16 bg-gradient-to-br from-slate-50 to-purple-50 rounded-3xl border border-dashed border-purple-200">
              <Star className="w-10 h-10 mx-auto mb-4 text-purple-600" />
              <p className="text-lg font-bold text-gray-700 mb-2">Aucun avis disponible pour le moment</p>
              <p className="text-sm text-gray-500 mb-6">Soyez le premier à partager votre expérience !</p>
              
              <motion.button
                onClick={handleLeaveReview}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-full shadow-lg hover:shadow-blue-500/50 transition-all"
              >
                <MessageSquarePlus className="w-5 h-5" />
                Laisser le premier avis
              </motion.button>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 bg-gradient-to-r from-purple-700 via-blue-700 to-purple-700 text-white">
        <div className="container mx-auto max-w-5xl text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
            <Zap className="w-16 h-16 mx-auto mb-6 text-white/90" />
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">Prêt à Propulser Votre Marque ?</h2>
            <p className="text-lg sm:text-xl font-light mb-8 max-w-2xl mx-auto text-white/90">
              Discutons de votre stratégie de communication pour atteindre de nouveaux sommets
            </p>
            <button
              onClick={() => handleQuoteRequest('Projet Sur Mesure')}
              className="inline-flex items-center gap-3 px-8 py-4 bg-white text-blue-700 font-semibold text-base rounded-full shadow-2xl hover:bg-gray-50 transition-all duration-300 hover:scale-105"
            >
              <UserRoundPen className="w-5 h-5" />
              Contactez l'Équipe Altcom
            </button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 border-t border-gray-800">
        <div className="container mx-auto px-4 sm:px-6 text-center max-w-6xl">
          <div className="flex items-center justify-center gap-2 mb-3">
            <MessageSquare className="w-5 h-5 text-red-400" />
            <p className="text-2xl font-bold text-white">Altcom</p>
          </div>
          <p className="text-xs sm:text-sm text-gray-400">
            &copy; {new Date().getFullYear()} Tous droits réservés | 
            <Link to="/mentions-legales" className="text-gray-400 hover:text-blue-400 transition duration-200 ml-2 underline underline-offset-2">
              Mentions Légales
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default AltcomPage;