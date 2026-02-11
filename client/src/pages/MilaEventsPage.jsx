import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Target as IconTarget, 
  Users as IconUsers, 
  Zap as IconMagic, 
  Loader2 as IconSpinner, 
  X, 
  Send, 
  Calendar,
  CalendarClock,
  PrinterCheck, 
  MapPin,
  Sparkles,
  ArrowRight,
  Video,
  PartyPopper
} from 'lucide-react';

import HeroSlider from '../components/HeroSliderMila';
import MilaContact from '../components/MilaContact';
import { getAllEvents } from '../services/eventService';
import { createQuoteRequest } from '../services/quoteService';
import { getFirstValidImage } from '../utils/imageUtils';

const EVENTS_PER_PAGE = 6;

// Composant EventCard modernisé
const EventCard = ({ event, index }) => {
  const navigate = useNavigate();
  
  const displayEvent = {
    _id: event._id,
    title: event.name || event.title,
    description: event.description,
    date: event.date,
    location: event.location,
    imageUrl: getFirstValidImage(event.images, 'https://placehold.co/600x400/818CF8/FFFFFF?text=Mila+Events'),
    category: event.category || 'Événement',
    guests: event.guests,
    videos: event.videos || [],
  };

  const formattedDate = displayEvent.date ? new Date(displayEvent.date).toLocaleDateString('fr-FR', {
    year: 'numeric', month: 'long', day: 'numeric',
  }) : 'Date non définie';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="group bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-purple-200 transition-all duration-500 hover:-translate-y-1 overflow-hidden cursor-pointer"
      onClick={() => navigate(`/mila-events/event/${displayEvent._id}`)}
    >
      <div className="relative h-56 overflow-hidden">
        <img
          src={displayEvent.imageUrl}
          alt={displayEvent.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          onError={(e) => { e.target.src = 'https://placehold.co/600x400/818CF8/FFFFFF?text=Mila+Events'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
        
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
          <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
            {displayEvent.category}
          </span>
          {displayEvent.videos?.length > 0 && (
            <span className="bg-gradient-to-r from-red-600 to-pink-600 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
              <Video className="w-3.5 h-3.5" />
              {displayEvent.videos.length}
            </span>
          )}
        </div>
        
        {displayEvent.guests && (
          <span className="absolute bottom-3 right-3 bg-white/20 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg border border-white/30">
            <IconUsers className="w-3.5 h-3.5" />
            {displayEvent.guests}
          </span>
        )}
      </div>

      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-1 group-hover:text-purple-600 transition-colors">
          {displayEvent.title}
        </h3>
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{displayEvent.description}</p>
        <div className="space-y-2 text-sm text-gray-500 mb-4">
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-2 text-purple-500" />
            <span>{formattedDate}</span>
          </div>
          <div className="flex items-center">
            <MapPin className="w-4 h-4 mr-2 text-pink-500" />
            <span className="line-clamp-1">{displayEvent.location}</span>
          </div>
        </div>
        <div className="pt-4 border-t border-gray-100">
          <span className="inline-flex items-center text-sm font-semibold text-purple-600 group-hover:gap-2 transition-all">
            Voir les détails
            <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </span>
        </div>
      </div>
    </motion.div>
  );
};

// Pagination
const Pagination = ({ totalPages, currentPage, onPageChange }) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex justify-center items-center gap-2 mt-12">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2.5 rounded-xl bg-white border border-gray-200 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-purple-50 transition-all"
      >
        <ArrowRight className="w-5 h-5 rotate-180" />
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`min-w-[40px] px-4 py-2.5 rounded-xl font-semibold transition-all ${
            p === currentPage ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg scale-105' 
            : 'bg-white text-gray-700 border border-gray-200 hover:bg-purple-50'
          }`}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-2.5 rounded-xl bg-white border border-gray-200 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-purple-50 transition-all"
      >
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
};

// Modal de Devis - Version simplifiée
const QuoteRequestModal = ({ serviceTitle, onClose, onFormSubmit }) => {
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', service: serviceTitle, eventType: 'Autre',
    date: '', guests: '', budget: '', description: '', source: 'Mila Events',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.description || !formData.date || !formData.guests) {
      alert('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onFormSubmit(formData);
      onClose();
    } catch (err) {
      alert(err.message || "Erreur lors de l'envoi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-8 relative max-h-[90vh] overflow-y-auto"
      >
        <button onClick={onClose} disabled={isSubmitting} className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full">
          <X className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl text-white shadow-lg">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-3xl font-bold">Demander un Devis</h3>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-purple-50 p-4 rounded-2xl border-l-4 border-purple-600">
            <label className="block text-sm font-semibold text-purple-900 mb-1">Service</label>
            <input type="text" value={formData.service} disabled className="w-full bg-purple-50 font-bold" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">Type d'Événement <span className="text-red-500">*</span></label>
            <select name="eventType" value={formData.eventType} onChange={e => setFormData({...formData, eventType: e.target.value})} required className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500">
              <option value="Mariage">Mariage</option>
              <option value="Anniversaire">Anniversaire</option>
              <option value="Gala">Gala</option>
              <option value="Conférence">Conférence</option>
              <option value="Lancement">Lancement</option>
              <option value="Autre">Autre</option>
            </select>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Date <span className="text-red-500">*</span></label>
              <input type="date" name="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Invités <span className="text-red-500">*</span></label>
              <input type="number" name="guests" value={formData.guests} onChange={e => setFormData({...formData, guests: e.target.value})} required min="1" placeholder="Ex: 150" className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">Budget</label>
            <select name="budget" value={formData.budget} onChange={e => setFormData({...formData, budget: e.target.value})} className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500">
              <option value="">Non précisé</option>
              <option value="Moins de 1M">Moins de 1M FCFA</option>
              <option value="1M-5M">1M - 5M FCFA</option>
              <option value="5M-10M">5M - 10M FCFA</option>
              <option value="Plus de 10M">Plus de 10M FCFA</option>
            </select>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Nom <span className="text-red-500">*</span></label>
              <input type="text" name="name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Email <span className="text-red-500">*</span></label>
              <input type="email" name="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">Téléphone</label>
            <input type="tel" name="phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">Description <span className="text-red-500">*</span></label>
            <textarea name="description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows="4" required maxLength="1000" className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500 resize-y"></textarea>
            <p className="text-xs text-gray-500 mt-1">{formData.description.length}/1000</p>
          </div>
          <button type="submit" disabled={isSubmitting} className={`w-full flex justify-center gap-2 px-6 py-4 rounded-2xl font-bold shadow-lg ${isSubmitting ? 'bg-gray-400' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'} text-white`}>
            {isSubmitting ? <><IconSpinner className="w-5 h-5 animate-spin" />Envoi...</> : <><Send className="w-5 h-5" />Envoyer</>}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

// Page principale
const MilaEventsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [selectedService, setSelectedService] = useState('');
  const [showNotif, setShowNotif] = useState({ visible: false, message: '', type: 'success' });
  const [currentPage, setCurrentPage] = useState(1);
  
  const services = [
    { id: 1, title: "Organisation d'Événements Privés", description: "Mariages, anniversaires, fêtes privées.", icon: IconTarget, gradient: "from-pink-600 to-rose-500" },
    { id: 2, title: "Gestion d'Événements Corporatifs", description: "Séminaires, conférences, lancements.", icon: IconUsers, gradient: "from-purple-600 to-indigo-500" },
    { id: 3, title: "Design & Scénographie Sur Mesure", description: "Décors et ambiances thématiques uniques.", icon: IconMagic, gradient: "from-violet-600 to-purple-500" },
  ];

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const data = await getAllEvents();
        setEvents(data);
      } catch (err) {
        setError("Impossible de charger les événements.");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  useEffect(() => {
    if (location.state?.openQuoteModal) {
      setSelectedService(location.state.service || 'Demande Générale');
      setShowQuoteModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  
  const totalPages = Math.ceil(events.length / EVENTS_PER_PAGE);
  const currentEvents = useMemo(() => events.slice((currentPage - 1) * EVENTS_PER_PAGE, currentPage * EVENTS_PER_PAGE), [events, currentPage]);

  const handleFormSubmit = async (formData) => {
    try {
      await createQuoteRequest(formData);
      setShowNotif({ visible: true, message: 'Demande envoyée avec succès!', type: 'success' });
      setTimeout(() => setShowNotif({ visible: false, message: '', type: 'success' }), 5000);
    } catch (err) {
      setShowNotif({ visible: true, message: err.message || 'Erreur lors de l\'envoi.', type: 'error' });
      setTimeout(() => setShowNotif({ visible: false, message: '', type: 'success' }), 5000);
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <IconSpinner className="w-16 h-16 text-purple-600 animate-spin mx-auto mb-4" />
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
        {showNotif.visible && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-2xl shadow-2xl text-white ${showNotif.type === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-red-500 to-pink-600'}`}>
            {showNotif.message}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showQuoteModal && <QuoteRequestModal serviceTitle={selectedService} onClose={() => setShowQuoteModal(false)} onFormSubmit={handleFormSubmit} />}
      </AnimatePresence>

      {/* Hero */}
      <header className="relative text-white pt-32 pb-24 overflow-hidden h-[75vh] min-h-[600px]">
                <HeroSlider /> 
        <div className="container mx-auto px-4 sm:px-6 text-center relative z-10 max-w-6xl h-full flex flex-col justify-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }} className="inline-flex justify-center mb-6">
            <div className="p-3 bg-white/15 backdrop-blur-md rounded-2xl border border-white/30 shadow-xl">
              <PartyPopper className="w-7 h-7" />
            </div>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.7 }} className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold mb-5">
            Mila Events<br/><span className="bg-gradient-to-r from-purple-400 to-pink-300 bg-clip-text text-transparent">L'Art de l'Élégance</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.7 }} className="text-base sm:text-lg lg:text-xl font-light max-w-2xl mx-auto text-white/90">
            Créateur d'expériences événementielles inoubliables. Votre vision, notre réalisation.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-10 flex flex-wrap justify-center gap-4">
            <Link to="/mila-events/annonces" className="group flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold rounded-full shadow-2xl hover:shadow-purple-500/50 transition-all hover:scale-105">
              <CalendarClock className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              Nos Réalisations
            </Link>
            <button onClick={() => { setSelectedService('Demande Générale'); setShowQuoteModal(true); }} className="flex items-center gap-2 px-8 py-3.5 bg-white/15 backdrop-blur-md text-white font-semibold rounded-full border border-white/30 hover:bg-white/25 transition-all hover:scale-105">
              <PrinterCheck className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              Demander un Devis
            </button>
          </motion.div>
        </div>
      </header>

      {/* Philosophie */}
      <section className="bg-gradient-to-b from-white to-slate-50 py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          <div className="text-center mb-10">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">Notre Philosophie</h2>
              <div className="h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent w-32 mx-auto rounded-full"></div>
            </motion.div>
          </div>
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="max-w-3xl mx-auto text-gray-600 text-base sm:text-lg lg:text-xl leading-relaxed text-center">
            Nous offrons une planification d'événements de A à Z avec une touche d'<span className="font-semibold text-gray-900">excellence</span> et une <span className="font-semibold text-gray-900">attention inégalée</span> aux détails pour transformer chaque moment en expérience mémorable.
          </motion.p>
        </div>
      </section>

      {/* Services */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          <div className="text-center mb-14">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <p className="text-xs sm:text-sm font-bold text-purple-600 uppercase tracking-wider mb-2">Nos Engagements</p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">Nos Services Exclusifs</h2>
              <p className="text-gray-500 text-base sm:text-lg font-light max-w-2xl mx-auto">
                De l'intime au grandiose, nos prestations couvrent tous vos besoins
              </p>
            </motion.div>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {services.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="group bg-gradient-to-br from-white to-slate-50 p-7 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-purple-200 transition-all duration-500 hover:-translate-y-1">
                <div className={`p-3 inline-flex rounded-2xl mb-4 bg-gradient-to-br ${s.gradient} group-hover:scale-110 transition-transform`}>
                  <s.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors">{s.title}</h3>
                <p className="text-gray-600 text-sm sm:text-base mb-4">{s.description}</p>
                <button onClick={() => { setSelectedService(s.title); setShowQuoteModal(true); }} className="inline-flex items-center text-sm font-semibold text-purple-600 hover:text-purple-700 transition-all group-hover:gap-2">
                  Demander un devis
                  <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Réalisations */}
      <section id="realisations" className="py-16 sm:py-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          <div className="text-center mb-14">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <p className="text-xs sm:text-sm font-bold text-purple-600 uppercase tracking-wider mb-2">Notre Portfolio</p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">Nos Réalisations</h2>
              <div className="h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent w-24 mx-auto rounded-full mb-5"></div>
            </motion.div>
          </div>
          {error && <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8 rounded-xl max-w-2xl mx-auto"><p className="text-red-700 font-medium">{error}</p></div>}
          {events.length === 0 && !error ? (
            <div className="text-center py-16 bg-gradient-to-br from-slate-50 to-purple-50 rounded-3xl border border-dashed border-purple-200">
              <PartyPopper className="w-10 h-10 mx-auto mb-4 text-purple-600" />
              <p className="text-lg font-bold text-gray-700">Aucune réalisation disponible</p>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {currentEvents.map((e, i) => <EventCard key={e._id} event={e} index={i} />)}
              </div>
              <Pagination totalPages={totalPages} currentPage={currentPage} onPageChange={p => { setCurrentPage(p); document.getElementById('realisations')?.scrollIntoView({ behavior: 'smooth' }); }} />
            </>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 text-white">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">
              Prêt à créer votre événement de rêve ?
            </h2>
            <p className="text-xl lg:text-2xl font-light mb-10 max-w-3xl mx-auto opacity-95">
              Contactez-nous pour une consultation personnalisée et transformons ensemble vos idées en réalité
            </p>
            <button 
              onClick={() => navigate('/mila-events/creer-projet')}
              className="inline-flex items-center gap-3 px-10 py-4 bg-white text-purple-600 font-bold text-lg rounded-full shadow-2xl hover:bg-gray-50 transition-all hover:scale-105"
            >
              <Sparkles className="w-6 h-6" />
              Lancer votre Projet
            </button>
          </motion.div>
        </div>
        {/* Composant de Contact */}
            <MilaContact />
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 border-t border-gray-800">
        <div className="container mx-auto px-4 sm:px-6 text-center max-w-6xl">
          <div className="flex items-center justify-center gap-2 mb-3">
            <PartyPopper className="w-5 h-5 text-purple-400" />
            <p className="text-2xl font-bold text-white">Mila Events</p>
          </div>
          <p className="text-xs sm:text-sm text-gray-400">
            &copy; {new Date().getFullYear()} Tous droits réservés | 
            <Link to="/mentions-legales" className="text-gray-400 hover:text-purple-400 transition duration-200 ml-2 underline underline-offset-2">
              Mentions Légales
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default MilaEventsPage;