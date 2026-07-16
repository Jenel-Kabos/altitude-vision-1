import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
// Importations Framer Motion
import { motion, AnimatePresence, useInView } from 'framer-motion'; 
// Icônes Lucide pour Altcom (Communication)
import { MessageSquare, Layout, TrendingUp, Zap, Loader2 as IconSpinner, X, ChevronLeft, ChevronRight, Send, Briefcase, Users, Star } from 'lucide-react';

// 🔌 IMPORTATION DES SERVICES API (Simulés pour Altcom)
// Remplacer ces imports par vos vrais services Altcom
import useAltcomData from "../hooks/useAltcomData"; // Hook personnalisé de votre code initial
import { createQuoteRequest } from '../services/quoteService';
import toast from '@/lib/utils/toast';

// 🎨 IMPORTATION DES COMPOSANTS/UTILITAIRES
// Assurez-vous que ces composants existent et sont correctement importés
import ServiceCard from "../components/ServiceCard"; 
import PortfolioCard from "../components/PortfolioCard"; 
import ReviewCard from "../components/ReviewCard"; 
// import { getFirstValidImage } from '../utils/imageUtils'; 


// --- CONSTANTES & DONNÉES DE FALLBACK ---
const PORTFOLIO_PER_PAGE = 6; // Changé de EVENTS_PER_PAGE à PORTFOLIO_PER_PAGE

// Les icônes sont passées comme composants
const defaultServices = [
  { _id: 1, title: "Communication Digitale", description: "Création de contenus et campagnes sur mesure.", icon: MessageSquare, color: "text-blue-500" },
  { _id: 2, title: "Branding & Design", description: "Définition d'identité visuelle et supports graphiques.", icon: Layout, color: "text-purple-500" },
  { _id: 3, title: "Conseil & Stratégie", description: "Accompagnement stratégique pour votre communication.", icon: TrendingUp, color: "text-red-500" },
];

const defaultPortfolio = [
  { _id: 1, title: "Projet A", image: "https://via.placeholder.com/400x250/3B82F6/FFFFFF?text=Digital+Project" },
  { _id: 2, title: "Projet B", image: "https://via.placeholder.com/400x250/A855F7/FFFFFF?text=Branding+Case" },
  { _id: 3, title: "Projet C", image: "https://via.placeholder.com/400x250/EF4444/FFFFFF?text=Strategy+Work" },
  { _id: 4, title: "Projet D", image: "https://via.placeholder.com/400x250/22C55E/FFFFFF?text=Campagne+SEO" },
  { _id: 5, title: "Projet E", image: "https://via.placeholder.com/400x250/F59E0B/FFFFFF?text=Logo+Design" },
  { _id: 6, title: "Projet F", image: "https://via.placeholder.com/400x250/14B8A6/FFFFFF?text=Réseaux+Sociaux" },
];

const defaultReviews = [
  { _id: 1, author: "Client 1", content: "Excellent service et très professionnel.", rating: 5, company: "Tech Solutions" },
  { _id: 2, author: "Client 2", content: "Équipe créative et réactive.", rating: 4, company: "Global Corp" },
  { _id: 3, author: "Client 3", content: "Je recommande Altcom pour toute communication.", rating: 5, company: "StartUp Innov" },
];


// --- VARIANTS D'ANIMATION ---

// Animation de fondu pour les sections
const sectionFadeIn = {
  hidden: { opacity: 0, y: 50 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { 
      duration: 0.8, 
      ease: "easeOut" 
    } 
  },
};

// Conteneur d'animation pour les listes de cartes (staggering)
const listContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.2,
      staggerChildren: 0.15, // Légèrement plus lent pour un bon effet
    },
  },
};

// Animation pour les éléments individuels (cartes)
const itemVariant = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

// Composant utilitaire pour appliquer l'animation aux sections
const AnimatedSection = ({ children, className, id = null }) => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <motion.section
      id={id}
      ref={ref}
      className={className}
      variants={sectionFadeIn}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
    >
      {children}
    </motion.section>
  );
};

// --- SOUS-COMPOSANTS RÉUTILISÉS ET ADAPTÉS ---

// Composant Pagination 
const Pagination = ({ totalPages, currentPage, onPageChange }) => {
    if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex justify-center items-center space-x-4 mt-20">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`p-3 rounded-full transition-all duration-300 ${
          currentPage === 1 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white shadow-lg hover:bg-blue-700'
        }`}
      >
        <ChevronLeft className="w-6 h-6" />
      </motion.button>

      {pages.map((page) => (
        <motion.button
          key={page}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onPageChange(page)}
          className={`px-5 py-3 rounded-full font-extrabold transition-all duration-300 text-xl ${
            page === currentPage
              ? 'bg-blue-600 text-white shadow-xl ring-4 ring-blue-300'
              : 'bg-white text-gray-700 hover:bg-gray-100 shadow-md'
          }`}
        >
          {page}
        </motion.button>
      ))}

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`p-3 rounded-full transition-all duration-300 ${
          currentPage === totalPages ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white shadow-lg hover:bg-blue-700'
        }`}
      >
        <ChevronRight className="w-6 h-6" />
      </motion.button>
    </div>
  );
};


// Composant Modal de Demande de Devis (Adapté pour Altcom)
const QuoteRequestModal = ({ serviceTitle, onClose, onFormSubmit }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    service: serviceTitle,
    projectType: 'Communication Digitale', // Changé de eventType
    budget: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation minimale adaptée à Altcom
    if (!formData.name || !formData.email || !formData.description || !formData.projectType) {
      toast.warning('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    setIsSubmitting(true);

    try {
      await onFormSubmit(formData);
      onClose();
    } catch (error) {
      console.error("Erreur lors de la soumission du devis Altcom:", error);
      toast.error(error.message || "Erreur lors de l'envoi du devis. Veuillez réessayer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-8 md:p-10 relative overflow-hidden max-h-[90vh] overflow-y-auto"
      >
        <motion.button
          onClick={onClose}
          whileHover={{ rotate: 90 }}
          className="absolute top-4 right-4 text-gray-500 hover:text-red-600 transition duration-300 p-2 rounded-full bg-gray-100"
          disabled={isSubmitting}
        >
          <X className="w-6 h-6" />
        </motion.button>

        <h3 className="text-4xl font-extrabold text-blue-700 mb-3">Demander un Devis Altcom</h3>
        <p className="text-gray-600 mb-8 text-lg">
          Obtenez une consultation gratuite et un chiffrage pour votre projet de communication.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <label className="block text-sm font-semibold text-blue-800 mb-1">Service Sélectionné:</label>
            <input
              type="text"
              name="service"
              value={formData.service}
              disabled
              className="w-full text-lg font-bold bg-blue-50 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="projectType" className="block text-gray-700 font-semibold mb-2">Type de Projet <span className="text-red-500">*</span></label>
            <select
              id="projectType"
              name="projectType"
              value={formData.projectType}
              onChange={handleChange}
              required
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-lg"
            >
              <option value="Communication Digitale">Communication Digitale</option>
              <option value="Branding & Design">Branding & Design</option>
              <option value="Stratégie de Contenu">Stratégie de Contenu</option>
              <option value="Campagne Publicitaire">Campagne Publicitaire</option>
              <option value="Refonte Site Web">Refonte Site Web</option>
              <option value="Autre">Autre</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Champs spécifiques Altcom */}
            <div>
              <label htmlFor="name" className="block text-gray-700 font-semibold mb-2">Nom Complet <span className="text-red-500">*</span></label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-lg"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-gray-700 font-semibold mb-2">Email <span className="text-red-500">*</span></label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-lg"
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="phone" className="block text-gray-700 font-semibold mb-2">Téléphone</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-lg"
            />
          </div>

          <div>
            <label htmlFor="budget" className="block text-gray-700 font-semibold mb-2">Budget Estimé</label>
            <select
              id="budget"
              name="budget"
              value={formData.budget}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-lg"
            >
              <option value="">Préférez ne pas préciser</option>
              <option value="Moins de 1M">Moins de 1 000 000FCFA</option>
              <option value="1M-5M">1 000 000FCFA - 5 000 000FCFA</option>
              <option value="5M-10M">5 000 000FCFA - 10 000 000FCFA</option>
              <option value="Plus de 10M">Plus de 10 000 000FCFA</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="description" className="block text-gray-700 font-semibold mb-2">Description de votre Projet <span className="text-red-500">*</span></label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="4"
              required
              maxLength="1000"
              placeholder="Décrivez-nous votre projet (objectifs, cibles, délais, etc.)..."
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-lg"
            ></textarea>
            <p className="text-sm text-gray-500 mt-1">{formData.description.length}/1000 caractères</p>
          </div>

          <motion.button
            type="submit"
            disabled={isSubmitting}
            whileHover={{ scale: isSubmitting ? 1 : 1.02, boxShadow: isSubmitting ? "" : "0 10px 20px rgba(59, 130, 246, 0.4)" }}
            whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
            className={`w-full flex items-center justify-center px-6 py-4 ${
              isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            } text-white font-extrabold text-xl rounded-xl shadow-lg transition duration-300`}
          >
            {isSubmitting ? (
              <>
                <IconSpinner className="w-6 h-6 mr-3 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Send className="w-6 h-6 mr-3" />
                Envoyer la Demande de Devis
              </>
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};


// --- COMPOSANT PRINCIPAL ALTCOM ---
const AltcomPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Data hook de votre code initial (simulé ici avec des données statiques)
  const loading = false; // Supposons que le chargement initial est géré par useAltcomData
  const error = null;
  const services = []; 
  const portfolio = []; 
  const reviews = [];
  
  // Dans un vrai projet, décommentez ceci:
  // const { services, portfolio, reviews, loading, error } = useAltcomData(); 
  
  const [useFallback, setUseFallback] = useState(false);

  // États du modal et notification (provenant de MilaEvents)
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [selectedService, setSelectedService] = useState('');
  const [showNotification, setShowNotification] = useState({ visible: false, message: '', type: 'success' });
  const [currentPage, setCurrentPage] = useState(1);
  
  // LOGIQUE DE FALLBACK DE VOTRE CODE INITIAL
  useEffect(() => {
    if (!loading && error) {
      setUseFallback(true);
    }
    // Nettoyer l'état si l'API était censée ouvrir le modal
    if (location.state?.openQuoteModal) {
      const service = location.state.service || 'Demande Générale';
      setSelectedService(service);
      setShowQuoteModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [loading, error, location.state]);
  
  // Détermine les données à afficher (combinaison des deux logiques)
  const displayServices = !useFallback && services?.length > 0 ? services : defaultServices;
  const displayPortfolio = !useFallback && portfolio?.length > 0 ? portfolio : defaultPortfolio;
  const displayReviews = !useFallback && reviews?.length > 0 ? reviews : defaultReviews;

  // LOGIQUE DE PAGINATION (Adaptée au Portfolio Altcom)
  const totalPages = Math.ceil(displayPortfolio.length / PORTFOLIO_PER_PAGE);
  const currentPortfolio = useMemo(() => {
    const startIndex = (currentPage - 1) * PORTFOLIO_PER_PAGE;
    const endIndex = startIndex + PORTFOLIO_PER_PAGE;
    return displayPortfolio.slice(startIndex, endIndex);
  }, [displayPortfolio, currentPage]);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      document.getElementById('portfolio')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // LOGIQUE DE DEVIS ET NOTIFICATION (Adaptée d'MilaEvents)
  const handleQuoteRequest = (serviceTitle) => {
    setSelectedService(serviceTitle);
    setShowQuoteModal(true);
  };
  
  const handleFormSubmit = async (formData) => {
    try {
      
      // Simuler l'appel API si createQuoteRequest n'est pas implémenté
      // const response = await createQuoteRequest(formData); 
      
      
      setShowNotification({
        visible: true,
        message: `Votre demande pour "${formData.service}" a été enregistrée. Nous vous recontacterons sous 24h.`,
        type: 'success',
      });

      setTimeout(() => {
        setShowNotification({ visible: false, message: '', type: 'success' });
      }, 5000);
      
    } catch (error) {
      console.error("❌ [AltcomPage] Erreur lors de l'envoi du devis:", error);
      
      setShowNotification({
        visible: true,
        message: error.message || "Une erreur est survenue lors de l'envoi de votre demande. Veuillez réessayer.",
        type: 'error',
      });

      setTimeout(() => {
        setShowNotification({ visible: false, message: '', type: 'success' });
      }, 5000);
      
      throw error;
    }
  };


  // ÉCRAN DE CHARGEMENT
  if (loading && !useFallback) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col justify-center items-center h-screen bg-gray-50 text-gray-700"
      >
        <IconSpinner className="w-16 h-16 text-blue-600 mb-4 animate-spin" />
        <p className="text-2xl font-medium">Chargement de la page Altcom...</p>
      </motion.div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen font-['Poppins',_sans-serif] text-gray-800">
      
      {/* --- Gestion des Modals et Notifications --- */}
      <AnimatePresence>
        {showNotification.visible && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-0 left-0 right-0 p-5 text-white text-center font-bold shadow-2xl z-[70] transition-all duration-500 text-xl backdrop-blur-sm ${
              showNotification.type === 'success' ? 'bg-green-600/90' : 'bg-red-600/90'
            }`}
          >
            {showNotification.message}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showQuoteModal && (
          <QuoteRequestModal 
            serviceTitle={selectedService} 
            onClose={() => setShowQuoteModal(false)}
            onFormSubmit={handleFormSubmit}
          />
        )}
      </AnimatePresence>

      {/* --- Bannière --- */}
      <motion.header
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="bg-cover bg-center text-white py-40 relative overflow-hidden" 
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url('https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=1974&auto=format&fit=crop')",
        }}
      >
        <div className="container mx-auto px-6 text-center relative z-10">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-5xl lg:text-7xl font-extrabold tracking-tight drop-shadow-xl mb-4"
          >
            Altcom : Stratégie & Créativité
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="mt-4 text-xl lg:text-2xl font-light drop-shadow-md max-w-4xl mx-auto"
          >
            Votre Vision, Notre Mission de Communication. Des solutions percutantes et sur mesure.
          </motion.p>
          <motion.button 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7, duration: 0.5, type: "spring", stiffness: 200 }}
            whileHover={{ scale: 1.05, boxShadow: "0 8px 25px rgba(59, 130, 246, 0.4)" }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleQuoteRequest('Demande Générale')}
            className="mt-12 px-10 py-4 bg-blue-600 text-white font-extrabold text-lg rounded-full shadow-2xl hover:bg-blue-700 transition-colors duration-300 focus:outline-none focus:ring-4 focus:ring-blue-300"
          >
            Démarrer Votre Projet
          </motion.button>
        </div>
      </motion.header>
      
      {/* --- À propos --- */}
      <AnimatedSection className="bg-white py-24 shadow-inner">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-800 mb-6">Qui Sommes-Nous ?</h2>
          <motion.div 
            initial={{ width: 0 }} 
            whileInView={{ width: 100 }} 
            transition={{ delay: 0.3, duration: 0.8 }}
            viewport={{ once: true, amount: 0.5 }}
            className="h-1.5 bg-red-600 mx-auto mb-12 rounded-full"
          ></motion.div>
          <p className="max-w-5xl mx-auto text-gray-600 text-xl lg:text-2xl leading-relaxed">
            Altcom est le pôle de communication d'Altitude-Vision, spécialisé
            dans la création de stratégies de communication percutantes. Nous
            aidons les marques à raconter leur histoire, à engager leur
            audience et à atteindre leurs objectifs grâce à des solutions
            créatives et sur mesure.
          </p>
          {useFallback && (
            <motion.p 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.8 }}
              className="text-red-500 mt-8 font-bold text-lg"
            >
              ⚠️ Les données du serveur ne sont pas disponibles, affichage des informations par défaut.
            </motion.p>
          )}
        </div>
      </AnimatedSection>

      {/* --- Nos Services --- */}
      <AnimatedSection className="py-24 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-800">Nos Services</h2>
            <p className="text-gray-600 mt-4 text-lg lg:text-xl">Des solutions sur mesure pour amplifier votre message.</p>
          </div>
          
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10"
            variants={listContainer}
            initial="hidden"
            whileInView="visible" 
            viewport={{ once: true, amount: 0.1 }}
          >
            {displayServices.map((service, index) => (
              <motion.div key={service._id} variants={itemVariant}>
                {/* 🚨 MODIFICATION CRUCIALE POUR PASSER LE HANDLER DE DEVIS */}
                <ServiceCard 
                    service={service} 
                    onQuoteRequest={handleQuoteRequest} // La fonction est passée ici
                /> 
              </motion.div>
            ))}
          </motion.div>
        </div>
      </AnimatedSection>

      {/* --- Portfolio (Réalisations) --- */}
      <AnimatedSection id="portfolio" className="bg-white py-24">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-800">Nos Réalisations</h2>
            <p className="text-gray-600 mt-4 text-lg lg:text-xl">
              Découvrez les projets qui ont marqué notre expertise en communication.
            </p>
          </div>
          
          {!loading && currentPortfolio.length > 0 && (
            <motion.div 
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10"
              variants={listContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.1 }}
            >
              {currentPortfolio.map((item, index) => (
                <motion.div key={item._id} variants={itemVariant}>
                  {/* Assurez-vous que PortfolioCard existe et utilise item */}
                  <PortfolioCard item={item} />
                </motion.div>
              ))}
            </motion.div>
          )}
          
          {!loading && displayPortfolio.length > 0 && (
            <Pagination 
              totalPages={totalPages}
              currentPage={currentPage}
              onPageChange={handlePageChange}
            />
          )}

          {!loading && displayPortfolio.length === 0 && (
             <motion.p 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="text-center text-2xl text-gray-500 mt-16"
              >
                Aucune réalisation à afficher pour le moment.
              </motion.p>
          )}
        </div>
      </AnimatedSection>

      {/* --- Avis Clients --- */}
      <AnimatedSection className="py-24 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-800">Ils Nous Font Confiance</h2>
            <p className="text-gray-600 mt-4 text-lg lg:text-xl">L'avis de nos clients est notre meilleure publicité.</p>
          </div>
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10"
            variants={listContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
          >
            {displayReviews.map((review) => (
              <motion.div key={review._id} variants={itemVariant}>
                {/* Assurez-vous que ReviewCard existe et utilise review */}
                <ReviewCard review={review} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </AnimatedSection>

      {/* --- Appel à l'Action Final --- */}
      <motion.section 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
        variants={sectionFadeIn}
        className="bg-gray-50 py-20 shadow-sm border-t border-gray-100"
      >
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl lg:text-5xl font-extrabold mb-6 text-gray-900">Prêt à propulser votre marque ?</h2>
          <p className="text-xl lg:text-2xl font-light mb-10 max-w-3xl mx-auto text-gray-600">Discutons de votre stratégie de communication pour atteindre de nouveaux sommets.</p>
          <motion.button
            whileHover={{ scale: 1.08, boxShadow: "0 10px 30px rgba(200,150,12,0.3)" }}
            whileTap={{ scale: 0.92 }}
            onClick={() => handleQuoteRequest('Projet Sur Mesure')}
            className="px-10 py-5 font-bold text-xl rounded-full shadow-lg transition-colors duration-300 focus:outline-none focus:ring-4"
            style={{ background: '#C8960C', color: '#0A0C0F', focusRingColor: '#C8960C' }}
          >
            Contactez l'Équipe Altcom
          </motion.button>
        </div>
      </motion.section>

      {/* --- Footer --- */}
      <footer className="bg-white border-t border-gray-100 py-12">
        <div className="container mx-auto px-6 text-center">
          <p className="text-3xl font-extrabold text-gray-800 mb-3">Altcom</p>
          <p className="text-md text-gray-500">&copy; {new Date().getFullYear()} Tous droits réservés. | Communication d'Altitude.</p>
          <div className="mt-6 flex justify-center space-x-8 text-lg">
            <a href="/communication" className="text-gray-500 hover:text-gray-900 transition duration-200">Services Altcom</a>
            <a href="#portfolio" className="text-gray-500 hover:text-gray-900 transition duration-200">Réalisations</a>
            <a href="/contact" className="text-gray-500 hover:text-gray-900 transition duration-200">Contacter l'agence</a>
            <a href="/mentions-legales" className="text-gray-500 hover:text-gray-900 transition duration-200">Mentions légales</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AltcomPage;
