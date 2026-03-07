import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Zap, Loader2, X, Send,
    Calendar, CalendarClock, MapPin, Sparkles,
    ArrowRight, Video, PartyPopper, Star,
    MessageSquarePlus, ChevronDown, CheckCircle,
    Heart, Camera, Clock,
} from 'lucide-react';

import HeroSliderMila  from '../components/HeroSliderMila';
import MilaContact     from '../components/MilaContact';
import ReviewCard      from '../components/ReviewCard';
import { getAllEvents }          from '../services/eventService';
import { createQuoteRequest }   from '../services/quoteService';
import { getMilaEventsReviews } from '../services/reviewService';
import { getFirstValidImage }   from '../utils/imageUtils';
import { useAuth }              from '../context/AuthContext';

<SEOHead
  title="Mila Events — Événements à Brazzaville"
  description="Découvrez les meilleurs événements à Brazzaville : concerts, conférences, mariages et soirées organisés par Mila Events."
  url="/mila-events"
/>

const EVENTS_PER_PAGE = 6;
const EVENT_TYPES = ['Tous', 'Mariage', 'Anniversaire', 'Gala', 'Conférence', 'Lancement'];

const SERVICES = [
    { id: 1, icon: Heart,  title: "Événements Privés",       desc: "Mariages, anniversaires, fêtes privées — chaque détail orchestré avec soin.", stat: '+30 événements', color: '#D42B2B' },
    { id: 2, icon: Users,  title: "Événements Corporatifs",  desc: "Séminaires, conférences, lancements de produits — une image à la hauteur.",   stat: '+20 événements', color: '#A01E1E' },
    { id: 3, icon: Camera, title: "Design & Scénographie",   desc: "Décors et ambiances thématiques uniques qui transforment l'espace.",           stat: 'Sur mesure',    color: '#D42B2B' },
];

const ATOUTS = [
    { icon: CheckCircle, label: 'Organisation clé en main' },
    { icon: Clock,       label: 'Suivi en temps réel'      },
    { icon: Star,        label: 'Prestataires certifiés'   },
    { icon: MapPin,      label: 'Brazzaville & environs'   },
];

// ── EventCard ────────────────────────────────────────────────
const EventCard = ({ event, index }) => {
    const navigate = useNavigate();
    const d = {
        _id:         event._id,
        title:       event.name || event.title,
        description: event.description,
        date:        event.date,
        location:    event.location,
        imageUrl:    getFirstValidImage(event.images, 'https://placehold.co/600x400/D42B2B/FFFFFF?text=Mila+Events'),
        category:    event.category || 'Événement',
        guests:      event.guests,
        videos:      event.videos || [],
    };
    const formattedDate = d.date
        ? new Date(d.date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'Date non définie';

    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.5, delay: index * 0.06 }}
            whileHover={{ y: -6 }}
            className="group bg-white rounded-3xl border overflow-hidden cursor-pointer transition-all duration-500 hover:shadow-2xl"
            style={{ borderColor: 'rgba(212,43,43,0.12)' }}
            onClick={() => navigate(`/mila-events/event/${d._id}`)}
        >
            <div className="relative h-52 overflow-hidden">
                <img src={d.imageUrl} alt={d.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    onError={e => { e.target.src = 'https://placehold.co/600x400/D42B2B/FFFFFF?text=Mila+Events'; }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ backgroundColor: '#D42B2B' }} />
                <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
                    <span className="text-white text-xs font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(212,43,43,0.85)', backdropFilter: 'blur(8px)' }}>{d.category}</span>
                    {d.videos?.length > 0 && (
                        <span className="flex items-center gap-1 text-white text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}>
                            <Video className="w-3 h-3" />{d.videos.length}
                        </span>
                    )}
                </div>
                {d.guests && (
                    <span className="absolute bottom-3 right-3 flex items-center gap-1.5 text-white text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
                        <Users className="w-3 h-3" />{d.guests}
                    </span>
                )}
            </div>
            <div className="p-5">
                <h3 className="font-bold text-gray-900 text-lg mb-1.5 line-clamp-1 group-hover:text-[#D42B2B] transition-colors" style={{ fontFamily: "'Outfit', sans-serif" }}>{d.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-4 line-clamp-2">{d.description}</p>
                <div className="space-y-1.5 text-xs text-gray-400 mb-4">
                    <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#D42B2B' }} />{formattedDate}</div>
                    <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#D42B2B' }} /><span className="line-clamp-1">{d.location}</span></div>
                </div>
                <div className="pt-4 border-t border-gray-100">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: '#D42B2B', fontFamily: "'Outfit', sans-serif" }}>
                        Voir les détails<ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </span>
                </div>
            </div>
        </motion.div>
    );
};

// ── Pagination ───────────────────────────────────────────────
const Pagination = ({ totalPages, currentPage, onPageChange }) => {
    if (totalPages <= 1) return null;
    return (
        <div className="flex justify-center items-center gap-2 mt-10">
            <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}
                className="p-2.5 rounded-xl bg-white border border-gray-200 shadow-sm disabled:opacity-30 hover:border-[#D42B2B]/30 transition-all">
                <ArrowRight className="w-4 h-4 rotate-180 text-gray-500" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => onPageChange(p)}
                    className="min-w-[38px] px-3 py-2 rounded-xl font-semibold text-sm transition-all"
                    style={{
                        background: p === currentPage ? 'linear-gradient(135deg, #D42B2B, #A01E1E)' : 'white',
                        color: p === currentPage ? 'white' : '#374151',
                        border: p === currentPage ? 'none' : '1px solid #E5E7EB',
                        boxShadow: p === currentPage ? '0 4px 12px rgba(212,43,43,0.35)' : 'none',
                        transform: p === currentPage ? 'scale(1.08)' : 'scale(1)',
                        fontFamily: "'Outfit', sans-serif",
                    }}>{p}
                </button>
            ))}
            <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}
                className="p-2.5 rounded-xl bg-white border border-gray-200 shadow-sm disabled:opacity-30 hover:border-[#D42B2B]/30 transition-all">
                <ArrowRight className="w-4 h-4 text-gray-500" />
            </button>
        </div>
    );
};

// ── Modal devis ──────────────────────────────────────────────
const QuoteModal = ({ serviceTitle, onClose, onFormSubmit }) => {
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', service: serviceTitle, eventType: 'Autre', date: '', guests: '', budget: '', description: '', source: 'Mila Events' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const set = field => e => setFormData(p => ({ ...p, [field]: e.target.value }));
    const cls = "w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-[#D42B2B] focus:ring-2 focus:ring-[#D42B2B]/10 focus:bg-white transition-all";
    const lbl = "block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5";
    const handleSubmit = async e => {
        e.preventDefault();
        if (!formData.name || !formData.email || !formData.description || !formData.date || !formData.guests) { alert('Veuillez remplir tous les champs obligatoires.'); return; }
        setIsSubmitting(true);
        try { await onFormSubmit(formData); onClose(); } catch (err) { alert(err.message || "Erreur."); } finally { setIsSubmitting(false); }
    };
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }}
                className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl relative max-h-[92vh] overflow-y-auto">
                <div className="sticky top-0 bg-white z-10 px-7 pt-7 pb-5 border-b border-gray-100">
                    <button onClick={onClose} disabled={isSubmitting} className="absolute top-5 right-5 w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #D42B2B, #A01E1E)' }}><Sparkles className="w-5 h-5 text-white" /></div>
                        <div>
                            <h3 className="font-bold text-gray-900 text-xl" style={{ fontFamily: "'Outfit', sans-serif" }}>Demander un Devis</h3>
                            <p className="text-xs text-gray-400">Réponse sous 24h — Sans engagement</p>
                        </div>
                    </div>
                </div>
                <form onSubmit={handleSubmit} className="px-7 py-6 space-y-4">
                    <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl" style={{ backgroundColor: 'rgba(212,43,43,0.06)', border: '1px solid rgba(212,43,43,0.15)' }}>
                        <Sparkles className="w-4 h-4" style={{ color: '#D42B2B' }} />
                        <span className="text-sm font-semibold" style={{ color: '#D42B2B', fontFamily: "'Outfit', sans-serif" }}>{formData.service}</span>
                    </div>
                    <div><label className={lbl}>Type d'événement <span className="text-red-400">*</span></label>
                        <div className="relative"><select value={formData.eventType} onChange={set('eventType')} required className={cls + " appearance-none pr-8"}>
                            {['Mariage','Anniversaire','Gala','Conférence','Lancement','Autre'].map(t => <option key={t} value={t}>{t}</option>)}
                        </select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className={lbl}>Date <span className="text-red-400">*</span></label><input type="date" value={formData.date} onChange={set('date')} required className={cls} /></div>
                        <div><label className={lbl}>Nb d'invités <span className="text-red-400">*</span></label><input type="number" value={formData.guests} onChange={set('guests')} required min="1" placeholder="Ex: 150" className={cls} /></div>
                    </div>
                    <div><label className={lbl}>Budget</label>
                        <div className="relative"><select value={formData.budget} onChange={set('budget')} className={cls + " appearance-none pr-8"}>
                            <option value="">Non précisé</option>
                            <option value="Moins de 1M">Moins de 1M FCFA</option>
                            <option value="1M-5M">1M – 5M FCFA</option>
                            <option value="5M-10M">5M – 10M FCFA</option>
                            <option value="Plus de 10M">Plus de 10M FCFA</option>
                        </select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className={lbl}>Nom <span className="text-red-400">*</span></label><input type="text" value={formData.name} onChange={set('name')} required className={cls} /></div>
                        <div><label className={lbl}>Email <span className="text-red-400">*</span></label><input type="email" value={formData.email} onChange={set('email')} required className={cls} /></div>
                    </div>
                    <div><label className={lbl}>Téléphone</label><input type="tel" value={formData.phone} onChange={set('phone')} className={cls} /></div>
                    <div><label className={lbl}>Description <span className="text-red-400">*</span></label>
                        <textarea value={formData.description} onChange={set('description')} required rows={4} maxLength={1000} placeholder="Décrivez votre projet..." className={cls + " resize-none"} style={{ fontFamily: "'Outfit', sans-serif" }} />
                        <p className="text-xs text-gray-400 mt-1 text-right">{formData.description.length}/1000</p>
                    </div>
                    <motion.button type="submit" disabled={isSubmitting} whileHover={{ scale: isSubmitting ? 1 : 1.02 }} whileTap={{ scale: 0.98 }}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-white text-sm transition-all"
                        style={{ background: isSubmitting ? '#9CA3AF' : 'linear-gradient(135deg, #D42B2B, #A01E1E)', boxShadow: isSubmitting ? 'none' : '0 4px 20px rgba(212,43,43,0.35)', fontFamily: "'Outfit', sans-serif" }}>
                        {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi...</> : <><Send className="w-4 h-4" /> Envoyer ma demande</>}
                    </motion.button>
                </form>
            </motion.div>
        </div>
    );
};

// ── Skeleton ─────────────────────────────────────────────────
const EventSkeleton = () => (
    <div className="animate-pulse bg-white rounded-3xl border border-gray-100 overflow-hidden">
        <div className="bg-gray-200 h-52" />
        <div className="p-5 space-y-3">
            <div className="h-4 bg-gray-100 rounded-full w-3/4" />
            <div className="h-3 bg-gray-100 rounded-full" />
            <div className="h-3 bg-gray-100 rounded-full w-2/3" />
        </div>
    </div>
);

// ── Page principale ──────────────────────────────────────────
const MilaEventsPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user }  = useAuth();

    const [events,         setEvents]         = useState([]);
    const [reviews,        setReviews]        = useState([]);
    const [loading,        setLoading]        = useState(true);
    const [reviewsLoading, setReviewsLoading] = useState(true);
    const [error,          setError]          = useState(null);
    const [showQuoteModal, setShowQuoteModal] = useState(false);
    const [selectedService,setSelectedService]= useState('');
    const [showNotif,      setShowNotif]      = useState({ visible: false, message: '', type: 'success' });
    const [currentPage,    setCurrentPage]    = useState(1);
    const [filterType,     setFilterType]     = useState('Tous');

    const filteredEvents = useMemo(() => filterType === 'Tous' ? events : events.filter(e => (e.category || '') === filterType), [events, filterType]);
    const currentEvents  = useMemo(() => filteredEvents.slice((currentPage - 1) * EVENTS_PER_PAGE, currentPage * EVENTS_PER_PAGE), [filteredEvents, currentPage]);

    useEffect(() => {
        const fetchEvents  = async () => { try { setEvents(await getAllEvents()); } catch { setError("Impossible de charger les événements."); } finally { setLoading(false); } };
        const fetchReviews = async () => { try { setReviews((await getMilaEventsReviews(6)) || []); } catch { setReviews([]); } finally { setReviewsLoading(false); } };
        fetchEvents(); fetchReviews();
    }, []);

    useEffect(() => {
        if (location.state?.openQuoteModal) { setSelectedService(location.state.service || 'Demande Générale'); setShowQuoteModal(true); window.history.replaceState({}, document.title); }
    }, [location.state]);

    const handleFormSubmit = async (formData) => {
        try { await createQuoteRequest(formData); setShowNotif({ visible: true, message: 'Demande envoyée !', type: 'success' }); setTimeout(() => setShowNotif({ visible: false, message: '', type: 'success' }), 5000); }
        catch (err) { setShowNotif({ visible: true, message: err.message || "Erreur.", type: 'error' }); setTimeout(() => setShowNotif({ visible: false, message: '', type: 'success' }), 5000); throw err; }
    };

    const handleLeaveReview = () => navigate(user ? '/avis/nouveau' : '/login', { state: user ? undefined : { from: '/avis/nouveau' } });
    const openQuote = title => { setSelectedService(title); setShowQuoteModal(true); };

    return (
        <div className="min-h-screen bg-white" style={{ fontFamily: "'Outfit', sans-serif" }}>

            <AnimatePresence>
                {showNotif.visible && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="fixed top-4 right-4 z-50 px-5 py-3.5 rounded-2xl shadow-2xl text-white text-sm font-semibold flex items-center gap-2"
                        style={{ background: showNotif.type === 'success' ? 'linear-gradient(135deg, #059669, #047857)' : 'linear-gradient(135deg, #D42B2B, #A01E1E)' }}>
                        {showNotif.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        {showNotif.message}
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showQuoteModal && <QuoteModal serviceTitle={selectedService} onClose={() => setShowQuoteModal(false)} onFormSubmit={handleFormSubmit} />}
            </AnimatePresence>

            {/* HERO */}
            <header className="relative text-white overflow-hidden" style={{ height: 'calc(100vh - 0px)', minHeight: '640px', maxHeight: '860px' }}>
                <HeroSliderMila />
                <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/25 to-black/70 z-[1]" />
                <div className="absolute inset-0 z-10 flex flex-col justify-center px-4 sm:px-8 lg:px-16">
                    <div className="max-w-6xl mx-auto w-full">
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-white border border-white/20 backdrop-blur-sm mb-5"
                            style={{ backgroundColor: 'rgba(212,43,43,0.25)' }}>
                            <span className="w-1.5 h-1.5 rounded-full bg-[#D42B2B] animate-pulse" />
                            Mila Events — L'Art de l'Élégance
                        </motion.div>
                        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.7 }}
                            className="text-white mb-4 max-w-3xl"
                            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(2.5rem, 5.5vw, 5rem)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                            Créateurs
                            <span className="block" style={{ color: '#F08080' }}>d'Expériences</span>
                        </motion.h1>
                        <motion.div initial={{ width: 0 }} animate={{ width: '64px' }} transition={{ delay: 0.4, duration: 0.6 }}
                            className="h-0.5 rounded-full mb-5" style={{ background: 'linear-gradient(to right, #D42B2B, #C8872A)' }} />
                        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.7 }}
                            className="text-white/75 max-w-xl mb-8 leading-relaxed font-light" style={{ fontSize: 'clamp(0.95rem, 1.6vw, 1.15rem)' }}>
                            Votre vision, notre réalisation. De l'intime au grandiose, chaque événement devient une expérience mémorable.
                        </motion.p>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="flex flex-wrap gap-3">
                            <Link to="/mila-events/annonces"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white text-sm transition-all duration-300 hover:scale-105"
                                style={{ background: 'linear-gradient(135deg, #D42B2B, #A01E1E)', boxShadow: '0 4px 20px rgba(212,43,43,0.4)', fontFamily: "'Outfit', sans-serif" }}>
                                <CalendarClock className="w-4 h-4" />Nos réalisations
                            </Link>
                            <button onClick={() => openQuote('Demande Générale')}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white text-sm border border-white/20 hover:bg-white/15 backdrop-blur-sm transition-all duration-200"
                                style={{ fontFamily: "'Outfit', sans-serif" }}>
                                <Sparkles className="w-4 h-4" />Demander un devis
                            </button>
                        </motion.div>
                    </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 z-10">
                    <div className="h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent)' }} />
                    <div className="backdrop-blur-md bg-black/30 grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/10">
                        {ATOUTS.map(({ icon: Icon, label }, i) => (
                            <div key={i} className="flex items-center gap-2.5 px-5 py-3.5">
                                <Icon className="w-4 h-4 flex-shrink-0 text-[#F08080]" />
                                <span className="text-white/70 text-xs font-medium">{label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </header>

            {/* PHILOSOPHIE */}
            <section className="py-20 sm:py-24 bg-white overflow-hidden">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
                        <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="mb-12 lg:mb-0">
                            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#D42B2B' }}>Notre Philosophie</p>
                            <h2 className="text-gray-900 mb-5" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(2rem, 4vw, 3.2rem)', fontWeight: 700, lineHeight: 1.1 }}>
                                Chaque Événement,<span className="block" style={{ color: '#D42B2B' }}>Une Signature</span>
                            </h2>
                            <div className="h-0.5 w-16 rounded-full mb-6" style={{ background: 'linear-gradient(to right, #D42B2B, #C8872A)' }} />
                            <p className="text-gray-600 leading-relaxed mb-6 text-base sm:text-lg">
                                Nous offrons une planification d'événements de A à Z avec une touche d'<span className="font-semibold text-gray-900">excellence</span> et une <span className="font-semibold text-gray-900">attention inégalée</span> aux détails.
                            </p>
                            <ul className="space-y-3 mb-8">
                                {['Coordination complète de A à Z', 'Prestataires sélectionnés avec soin', 'Décoration & scénographie personnalisées', 'Présence garantie le jour J'].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-sm text-gray-600">
                                        <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#D42B2B' }} />{item}
                                    </li>
                                ))}
                            </ul>
                            <button onClick={() => openQuote('Demande Générale')}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white text-sm transition-all hover:scale-105 group"
                                style={{ background: 'linear-gradient(135deg, #D42B2B, #A01E1E)', boxShadow: '0 4px 20px rgba(212,43,43,0.3)', fontFamily: "'Outfit', sans-serif" }}>
                                Demander un devis gratuit<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </motion.div>
                        <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.1 }} className="grid grid-cols-2 gap-4">
                            {[{ value: '50+', label: 'Événements organisés', color: '#D42B2B' }, { value: '98%', label: 'Clients satisfaits', color: '#A01E1E' }, { value: '5 ans', label: "D'expérience", color: '#D42B2B' }, { value: '24h', label: 'Délai de réponse', color: '#C8872A' }].map(({ value, label, color }, i) => (
                                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.1 }}
                                    className="p-6 rounded-2xl border text-center" style={{ backgroundColor: `${color}08`, borderColor: `${color}20` }}>
                                    <p className="mb-1" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</p>
                                    <p className="text-xs text-gray-500 font-medium">{label}</p>
                                </motion.div>
                            ))}
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* SERVICES */}
            <section className="py-16 sm:py-20 bg-gray-50">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <motion.div className="text-center mb-12" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#D42B2B' }}>Nos Engagements</p>
                        <h2 className="text-gray-900 mb-3" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, lineHeight: 1.1 }}>Nos Services Exclusifs</h2>
                        <p className="text-gray-500 text-sm max-w-xl mx-auto">De l'intime au grandiose, nos prestations couvrent tous vos besoins</p>
                    </motion.div>
                    <div className="grid md:grid-cols-3 gap-5">
                        {SERVICES.map((s, i) => {
                            const Icon = s.icon;
                            return (
                                <motion.div key={s.id} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.5, delay: i * 0.1 }} whileHover={{ y: -6 }}
                                    className="group relative bg-white rounded-3xl p-7 border transition-all duration-500 hover:shadow-xl overflow-hidden" style={{ borderColor: `${s.color}20` }}>
                                    <div className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ backgroundColor: s.color }} />
                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: `${s.color}15`, border: `1px solid ${s.color}25` }}>
                                        <Icon className="w-6 h-6" style={{ color: s.color }} />
                                    </div>
                                    <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full mb-3" style={{ backgroundColor: `${s.color}12`, color: s.color }}>{s.stat}</span>
                                    <h3 className="font-bold text-gray-900 text-lg mb-2">{s.title}</h3>
                                    <p className="text-gray-500 text-sm leading-relaxed mb-5">{s.desc}</p>
                                    <button onClick={() => openQuote(s.title)} className="inline-flex items-center gap-2 text-sm font-semibold transition-all duration-300 group-hover:gap-3" style={{ color: s.color }}>
                                        Demander un devis<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* RÉALISATIONS */}
            <section id="realisations" className="py-16 sm:py-20 bg-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
                        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#D42B2B' }}>Notre Portfolio</p>
                            <h2 className="text-gray-900" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', fontWeight: 700, lineHeight: 1.1 }}>Nos Réalisations</h2>
                        </motion.div>
                        <Link to="/mila-events/annonces" className="inline-flex items-center gap-2 text-sm font-semibold group flex-shrink-0" style={{ color: '#D42B2B' }}>
                            Voir tout<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-8">
                        {EVENT_TYPES.map(type => (
                            <button key={type} onClick={() => { setFilterType(type); setCurrentPage(1); }}
                                className="px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 border"
                                style={{ background: filterType === type ? 'linear-gradient(135deg, #D42B2B, #A01E1E)' : 'white', color: filterType === type ? 'white' : '#D42B2B', borderColor: filterType === type ? 'transparent' : 'rgba(212,43,43,0.25)', boxShadow: filterType === type ? '0 4px 12px rgba(212,43,43,0.3)' : 'none', fontFamily: "'Outfit', sans-serif" }}>
                                {type}
                            </button>
                        ))}
                    </div>
                    {error && <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl mb-8 max-w-xl"><span className="text-red-500">⚠️</span><p className="text-red-700 text-sm font-medium">{error}</p></div>}
                    {loading ? (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">{[1,2,3,4,5,6].map(i => <EventSkeleton key={i} />)}</div>
                    ) : currentEvents.length === 0 ? (
                        <div className="text-center py-16 rounded-3xl border border-dashed" style={{ borderColor: 'rgba(212,43,43,0.25)', backgroundColor: 'rgba(212,43,43,0.03)' }}>
                            <PartyPopper className="w-10 h-10 mx-auto mb-4" style={{ color: '#D42B2B' }} />
                            <p className="font-bold text-gray-700">Aucune réalisation disponible</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">{currentEvents.map((e, i) => <EventCard key={e._id} event={e} index={i} />)}</div>
                            <Pagination totalPages={Math.ceil(filteredEvents.length / EVENTS_PER_PAGE)} currentPage={currentPage} onPageChange={p => { setCurrentPage(p); document.getElementById('realisations')?.scrollIntoView({ behavior: 'smooth' }); }} />
                        </>
                    )}
                </div>
            </section>

            {/* AVIS */}
            <section className="py-16 sm:py-20 bg-gray-50">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
                        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#D42B2B' }}>Témoignages</p>
                            <h2 className="text-gray-900" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', fontWeight: 700, lineHeight: 1.1 }}>Ce Que Disent Nos Clients</h2>
                        </motion.div>
                        <motion.button onClick={handleLeaveReview} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-white text-sm flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #D42B2B, #A01E1E)', boxShadow: '0 4px 16px rgba(212,43,43,0.3)', fontFamily: "'Outfit', sans-serif" }}>
                            <MessageSquarePlus className="w-4 h-4" />Laisser un avis{!user && <span className="opacity-50 text-xs font-normal">(connexion)</span>}
                        </motion.button>
                    </div>
                    {reviewsLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {[1,2,3].map(i => <div key={i} className="animate-pulse bg-white rounded-3xl p-6 border border-gray-100"><div className="flex gap-3 mb-4"><div className="w-10 h-10 bg-gray-200 rounded-full" /><div className="flex-1 space-y-2"><div className="h-3 bg-gray-200 rounded-full w-2/3" /><div className="h-2 bg-gray-100 rounded-full w-1/3" /></div></div><div className="space-y-2"><div className="h-3 bg-gray-100 rounded-full" /><div className="h-3 bg-gray-100 rounded-full w-4/5" /></div></div>)}
                        </div>
                    ) : reviews.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {reviews.map((review, i) => <motion.div key={review._id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.08 }}><ReviewCard review={review} /></motion.div>)}
                        </div>
                    ) : (
                        <div className="text-center py-14 rounded-3xl border border-dashed" style={{ borderColor: 'rgba(212,43,43,0.2)', backgroundColor: 'rgba(212,43,43,0.03)' }}>
                            <Star className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                            <p className="font-bold text-gray-700 mb-1">Aucun avis pour le moment</p>
                            <p className="text-sm text-gray-500">Soyez le premier à partager votre expérience !</p>
                        </div>
                    )}
                </div>
            </section>

            {/* CTA FINAL */}
            <section className="py-20 px-4 sm:px-6 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0D1117 0%, #1a0808 50%, #0D1117 100%)' }}>
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-80 h-80 rounded-full blur-[120px] opacity-15" style={{ background: '#D42B2B' }} />
                    <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full blur-[120px] opacity-8" style={{ background: '#C8872A' }} />
                </div>
                <div className="container mx-auto max-w-4xl text-center relative z-10">
                    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                        <p className="text-xs font-bold uppercase tracking-widest mb-4 text-[#F08080]">Commençons</p>
                        <h2 className="text-white mb-5" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 700, lineHeight: 1.1 }}>Prêt à créer votre événement de rêve ?</h2>
                        <p className="text-white/60 mb-10 max-w-2xl mx-auto leading-relaxed">Consultation gratuite — transformons ensemble vos idées en réalité.</p>
                        <div className="flex flex-wrap justify-center gap-4">
                            <motion.button onClick={() => openQuote('Demande Générale')} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                                className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-white text-base"
                                style={{ background: 'linear-gradient(135deg, #D42B2B, #A01E1E)', boxShadow: '0 8px 32px rgba(212,43,43,0.4)', fontFamily: "'Outfit', sans-serif" }}>
                                <Sparkles className="w-5 h-5" />Lancer votre Projet
                            </motion.button>
                            <Link to="/mila-events/annonces" className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-white/80 text-base border border-white/15 hover:bg-white/10 transition-all" style={{ fontFamily: "'Outfit', sans-serif" }}>
                                <CalendarClock className="w-5 h-5" />Voir nos réalisations
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>

            <MilaContact />
        </div>
    );
};

export default MilaEventsPage;