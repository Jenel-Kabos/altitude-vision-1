"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Loader2, X, Send,
    Calendar, CalendarClock, MapPin, Sparkles,
    ArrowRight, Video, PartyPopper, Star,
    MessageSquarePlus, ChevronDown, CheckCircle,
    Heart, Camera, Clock,
} from 'lucide-react';
import Image from 'next/image';

import HeroSliderMila  from '../components/HeroSliderMila';
import ReviewCard      from '../components/ReviewCard';
import MilaContact     from '../components/MilaContact';
import { getAllEvents }          from '../services/eventService';
import { createQuoteRequest }   from '../services/quoteService';
import { getMilaEventsReviews } from '../services/reviewService';
import { getFirstValidImage }   from '../utils/imageUtils';
import { useAuth }              from '../context/AuthContext';
import toast from '@/lib/utils/toast';

const EVENTS_PER_PAGE = 6;
const EVENT_TYPES = ['Tous', 'Mariage', 'Anniversaire', 'Gala', 'Conférence', 'Lancement'];
const RED      = '#D42B2B';
const RED_DARK = '#A01E1E';
const RED_SOFT = '#F08080';
const GOLD     = '#C8960C';

const SERVICES = [
    { id: 1, icon: Heart,  title: "Événements Privés",      desc: "Mariages, anniversaires, fêtes privées — chaque détail orchestré avec soin.", stat: '+50 événements', color: RED      },
    { id: 2, icon: Users,  title: "Événements Corporatifs", desc: "Séminaires, conférences, lancements de produits — une image à la hauteur.",   stat: '+30 événements', color: RED_DARK },
    { id: 3, icon: Camera, title: "Design & Scénographie",  desc: "Décors et ambiances thématiques uniques qui transforment l'espace.",           stat: 'Sur mesure',    color: RED      },
];

const ATOUTS = [
    { icon: CheckCircle, label: 'Organisation clé en main' },
    { icon: Clock,       label: 'Suivi en temps réel'      },
    { icon: Star,        label: 'Prestataires certifiés'   },
    { icon: MapPin,      label: 'Brazzaville & environs'   },
];

// ─── EventCard ────────────────────────────────────────────────
const MILA_FALLBACK = 'https://placehold.co/600x400/D42B2B/FFFFFF?text=Mila+Events';

const EventCard = ({ event, index }) => {
    const router = useRouter();
    const d = {
        _id:         event._id,
        title:       event.name || event.title,
        description: event.description,
        date:        event.date,
        location:    event.location,
        imageUrl:    getFirstValidImage(event.images, MILA_FALLBACK),
        category:    event.category || 'Événement',
        guests:      event.guests,
        videos:      event.videos || [],
    };
    const [imgSrc, setImgSrc] = useState(d.imageUrl);
    const formattedDate = d.date
        ? new Date(d.date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'Date non définie';

    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.5, delay: index * 0.06 }}
            whileHover={{ y: -5 }}
            className="group rounded-2xl border overflow-hidden cursor-pointer"
            style={{ background: '#FFFFFF', borderColor: `${RED}22`, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'all 0.4s ease' }}
            onClick={() => router.push(`/mila-events/event/${d._id}`)}
        >
            <div className="relative h-52 overflow-hidden">
                <Image
                    src={imgSrc} alt={d.title} fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    className="object-cover group-hover:scale-110 transition-transform duration-700"
                    onError={() => setImgSrc(MILA_FALLBACK)}
                />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(5,5,8,0.85) 0%, rgba(5,5,8,0.15) 60%, transparent 100%)' }} />
                <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: RED }} />
                <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
                    <span className="text-white text-xs font-bold px-3 py-1 rounded-full"
                        style={{ background: `${RED}CC`, backdropFilter: 'blur(8px)', fontFamily: "'DM Sans', sans-serif" }}>
                        {d.category}
                    </span>
                    {d.videos?.length > 0 && (
                        <span className="flex items-center gap-1 text-white text-xs font-bold px-2.5 py-1 rounded-full"
                            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}>
                            <Video className="w-3 h-3" />{d.videos.length}
                        </span>
                    )}
                </div>
                {d.guests && (
                    <span className="absolute bottom-3 right-3 flex items-center gap-1.5 text-white text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
                        <Users className="w-3 h-3" />{d.guests}
                    </span>
                )}
            </div>
            <div style={{ padding: '18px' }}>
                <h3 className="font-bold line-clamp-1 mb-1.5"
                    style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '1rem', color: '#111827' }}>
                    {d.title}
                </h3>
                <p className="text-sm leading-relaxed mb-4 line-clamp-2"
                    style={{ color: '#6B7280', fontFamily: "'DM Sans', sans-serif" }}>
                    {d.description}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '14px' }}>
                    <div className="flex items-center gap-2" style={{ color: '#4B5563', fontSize: '0.82rem', fontFamily: "'DM Sans', sans-serif" }}>
                        <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: RED }} />
                        {formattedDate}
                    </div>
                    <div className="flex items-center gap-2" style={{ color: '#4B5563', fontSize: '0.82rem', fontFamily: "'DM Sans', sans-serif" }}>
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: RED }} />
                        <span className="line-clamp-1">{d.location}</span>
                    </div>
                </div>
                <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(17,24,39,0.08)' }}>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold group-hover:gap-2.5 transition-all"
                        style={{ color: RED, fontFamily: "'DM Sans', sans-serif" }}>
                        Voir les détails
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </span>
                </div>
            </div>
        </motion.div>
    );
};

// ─── Pagination ───────────────────────────────────────────────
const Pagination = ({ totalPages, currentPage, onPageChange }) => {
    if (totalPages <= 1) return null;
    return (
        <div className="flex justify-center items-center gap-2 mt-10">
            <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}
                aria-label="Page précédente"
                className="p-2.5 rounded-xl disabled:opacity-30"
                style={{ background: 'rgba(17,24,39,0.05)', border: '1px solid rgba(17,24,39,0.12)' }}>
                <ArrowRight className="w-4 h-4 rotate-180" style={{ color: '#6B7280' }} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => onPageChange(p)}
                    aria-label={`Page ${p}`}
                    aria-current={p === currentPage ? 'page' : undefined}
                    className="min-w-[38px] px-3 py-2 rounded-xl font-semibold text-sm"
                    style={{
                        background: p === currentPage ? `linear-gradient(135deg, ${RED}, ${RED_DARK})` : 'rgba(17,24,39,0.04)',
                        color:      p === currentPage ? 'white' : '#374151',
                        border:     p === currentPage ? 'none' : '1px solid rgba(17,24,39,0.12)',
                        boxShadow:  p === currentPage ? `0 4px 12px ${RED}55` : 'none',
                        transform:  p === currentPage ? 'scale(1.08)' : 'scale(1)',
                        fontFamily: "'DM Sans', sans-serif",
                    }}>
                    {p}
                </button>
            ))}
            <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}
                aria-label="Page suivante"
                className="p-2.5 rounded-xl disabled:opacity-30"
                style={{ background: 'rgba(17,24,39,0.05)', border: '1px solid rgba(17,24,39,0.12)' }}>
                <ArrowRight className="w-4 h-4" style={{ color: '#6B7280' }} />
            </button>
        </div>
    );
};

// ─── Modal devis ──────────────────────────────────────────────
const QuoteModal = ({ serviceTitle, onClose, onFormSubmit }) => {
    const [formData, setFormData] = useState({
        name: '', email: '', phone: '', service: serviceTitle,
        eventType: 'Autre', date: '', guests: '', budget: '',
        description: '', source: 'MilaEvents',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const set = field => e => setFormData(p => ({ ...p, [field]: e.target.value }));

    const inputStyle = {
        width: '100%', padding: '10px 14px',
        background: 'rgba(232,228,220,0.05)',
        border: '1px solid rgba(232,228,220,0.1)',
        borderRadius: '10px', color: '#E8E4DC',
        fontSize: '0.85rem', fontFamily: "'DM Sans', sans-serif",
        outline: 'none',
    };
    const labelStyle = {
        display: 'block', fontSize: '0.72rem', fontWeight: 700,
        letterSpacing: '0.15em', textTransform: 'uppercase',
        color: 'rgba(232,228,220,0.75)', fontFamily: "'DM Sans', sans-serif", marginBottom: '6px',
    };

    const handleSubmit = async e => {
        e.preventDefault();
        if (!formData.name || !formData.email || !formData.description || !formData.date || !formData.guests) {
            toast.warning('Veuillez remplir tous les champs obligatoires.');
            return;
        }
        setIsSubmitting(true);
        try { await onFormSubmit(formData); onClose(); }
        catch (err) { toast.error(err.message || "Erreur."); }
        finally { setIsSubmitting(false); }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-2xl rounded-2xl relative max-h-[92vh] overflow-y-auto"
                style={{ background: '#0F1117', border: '1px solid rgba(232,228,220,0.1)' }}>

                <div className="sticky top-0 z-10 px-7 pt-6 pb-5"
                    style={{ background: '#0F1117', borderBottom: '1px solid rgba(232,228,220,0.07)' }}>
                    <button onClick={onClose} disabled={isSubmitting}
                        className="absolute top-5 right-5 w-9 h-9 flex items-center justify-center rounded-xl"
                        style={{ background: 'rgba(232,228,220,0.06)', border: '1px solid rgba(232,228,220,0.1)' }}>
                        <X className="w-4 h-4" style={{ color: 'rgba(232,228,220,0.5)' }} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: `linear-gradient(135deg, ${RED}, ${RED_DARK})` }}>
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg" style={{ color: '#E8E4DC', fontFamily: "'DM Sans', sans-serif" }}>
                                Demander un Devis
                            </h3>
                            <p className="text-xs" style={{ color: 'rgba(232,228,220,0.70)', fontFamily: "'DM Sans', sans-serif" }}>
                                Réponse sous 24h — Sans engagement
                            </p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
                        style={{ background: `${RED}12`, border: `1px solid ${RED}28` }}>
                        <Sparkles className="w-4 h-4" style={{ color: RED }} />
                        <span className="text-sm font-semibold" style={{ color: RED, fontFamily: "'DM Sans', sans-serif" }}>
                            {formData.service}
                        </span>
                    </div>

                    <div>
                        <label style={labelStyle}>Type d'événement <span style={{ color: RED }}>*</span></label>
                        <div style={{ position: 'relative' }}>
                            <select value={formData.eventType} onChange={set('eventType')} required style={inputStyle}>
                                {['Mariage','Anniversaire','Gala','Conférence','Lancement','Autre'].map(t => (
                                    <option key={t} value={t} style={{ background: '#1A1E28' }}>{t}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                                style={{ color: 'rgba(232,228,220,0.3)' }} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label style={labelStyle}>Date <span style={{ color: RED }}>*</span></label>
                            <input type="date" value={formData.date} onChange={set('date')} required
                                style={{ ...inputStyle, colorScheme: 'dark' }} />
                        </div>
                        <div>
                            <label style={labelStyle}>Nb d'invités <span style={{ color: RED }}>*</span></label>
                            <input type="number" value={formData.guests} onChange={set('guests')} required min="1" placeholder="150"
                                style={inputStyle} />
                        </div>
                    </div>

                    <div>
                        <label style={labelStyle}>Budget</label>
                        <div style={{ position: 'relative' }}>
                            <select value={formData.budget} onChange={set('budget')} style={inputStyle}>
                                <option value="" style={{ background: '#1A1E28' }}>Non précisé</option>
                                {['Moins de 1M FCFA','1M – 5M FCFA','5M – 10M FCFA','Plus de 10M FCFA'].map(b => (
                                    <option key={b} value={b} style={{ background: '#1A1E28' }}>{b}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                                style={{ color: 'rgba(232,228,220,0.3)' }} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label style={labelStyle}>Nom <span style={{ color: RED }}>*</span></label>
                            <input type="text" value={formData.name} onChange={set('name')} required style={inputStyle} placeholder="Votre nom" />
                        </div>
                        <div>
                            <label style={labelStyle}>Email <span style={{ color: RED }}>*</span></label>
                            <input type="email" value={formData.email} onChange={set('email')} required style={inputStyle} placeholder="votre@email.com" />
                        </div>
                    </div>

                    <div>
                        <label style={labelStyle}>Téléphone</label>
                        <input type="tel" value={formData.phone} onChange={set('phone')} style={inputStyle} placeholder="+242..." />
                    </div>

                    <div>
                        <label style={labelStyle}>Description <span style={{ color: RED }}>*</span></label>
                        <textarea value={formData.description} onChange={set('description')} required rows={4}
                            maxLength={1000} placeholder="Décrivez votre projet..."
                            style={{ ...inputStyle, resize: 'none' }} />
                        <p style={{ textAlign: 'right', fontSize: '0.72rem', color: 'rgba(232,228,220,0.60)', marginTop: '4px', fontFamily: "'DM Sans', sans-serif" }}>
                            {formData.description.length}/1000
                        </p>
                    </div>

                    <motion.button type="submit" disabled={isSubmitting}
                        whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white text-sm"
                        style={{
                            background:    isSubmitting ? 'rgba(232,228,220,0.1)' : `linear-gradient(135deg, ${RED}, ${RED_DARK})`,
                            boxShadow:     isSubmitting ? 'none' : `0 4px 20px ${RED}55`,
                            border:        'none', cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            fontFamily:    "'DM Sans', sans-serif",
                            letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.76rem',
                        }}>
                        {isSubmitting
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi...</>
                            : <><Send className="w-4 h-4" /> Envoyer ma demande</>}
                    </motion.button>
                </form>
            </motion.div>
        </div>
    );
};

// ─── Skeleton chargement ──────────────────────────────────────
const EventSkeleton = () => (
    <div className="rounded-2xl overflow-hidden animate-pulse"
        style={{ background: '#FFFFFF', border: '1px solid rgba(17,24,39,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ height: '208px', background: '#F3F4F6' }} />
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ height: '14px', background: '#E5E7EB', borderRadius: '6px', width: '70%' }} />
            <div style={{ height: '11px', background: '#F3F4F6', borderRadius: '5px' }} />
            <div style={{ height: '11px', background: '#F3F4F6', borderRadius: '5px', width: '60%' }} />
        </div>
    </div>
);

// ─── Page principale ──────────────────────────────────────────
const MilaEventsPage = () => {
    const router = useRouter();
    const { user } = useAuth();

    const [events,         setEvents]         = useState([]);
    const [reviews,        setReviews]        = useState([]);
    const [loading,        setLoading]        = useState(true);
    const [reviewsLoading, setReviewsLoading] = useState(true);
    const [error,          setError]          = useState(null);
    const [showQuoteModal, setShowQuoteModal] = useState(false);
    const [selectedService,setSelectedService]= useState('');
    const [currentPage,    setCurrentPage]    = useState(1);
    const [filterType,     setFilterType]     = useState('Tous');

    const filteredEvents = useMemo(() =>
        filterType === 'Tous' ? events : events.filter(e => (e.category || '') === filterType),
        [events, filterType]
    );
    const currentEvents = useMemo(() =>
        filteredEvents.slice((currentPage - 1) * EVENTS_PER_PAGE, currentPage * EVENTS_PER_PAGE),
        [filteredEvents, currentPage]
    );

    useEffect(() => {
        const fetchEvents = async () => {
            try { setEvents(await getAllEvents()); }
            catch { setError("Impossible de charger les événements."); }
            finally { setLoading(false); }
        };
        const fetchReviews = async () => {
            try { setReviews((await getMilaEventsReviews(6)) || []); }
            catch { setReviews([]); }
            finally { setReviewsLoading(false); }
        };
        fetchEvents();
        fetchReviews();
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('openQuoteModal') === 'true') {
                setSelectedService(params.get('service') || 'Demande Générale');
                setShowQuoteModal(true);
                params.delete('openQuoteModal');
                params.delete('service');
                const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
                window.history.replaceState({}, document.title, newUrl);
            }
        }
    }, []);

    const handleFormSubmit = async (formData) => {
        try {
            await createQuoteRequest(formData);
            toast.success('Demande envoyée avec succès !');
        } catch (err) {
            toast.error(err.message || "Erreur lors de l'envoi.");
            throw err;
        }
    };

    const handleLeaveReview = () => router.push(user ? '/avis/nouveau' : '/login');
    const openQuote = title => { setSelectedService(title); setShowQuoteModal(true); };

    return (
        <div style={{ minHeight: '100vh', background: '#F8F8F8', fontFamily: "'DM Sans', sans-serif" }}>

            <AnimatePresence>
                {showQuoteModal && (
                    <QuoteModal
                        serviceTitle={selectedService}
                        onClose={() => setShowQuoteModal(false)}
                        onFormSubmit={handleFormSubmit}
                    />
                )}
            </AnimatePresence>

            {/* ══ HERO ═════════════════════════════════════════════════ */}
            <header className="relative text-white overflow-hidden"
                style={{ height: '100svh', minHeight: '620px', maxHeight: '860px' }}>
                <HeroSliderMila />
                <div className="absolute bottom-0 left-0 right-0 z-10">
                    <div className="h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.07), transparent)' }} />
                    <div style={{ backdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.35)', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}
                        className="sm:grid-cols-4">
                        {ATOUTS.map(({ icon: Icon, label }, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                                <Icon style={{ width: '14px', height: '14px', color: RED_SOFT, flexShrink: 0 }} />
                                <span style={{ color: 'rgba(255,255,255,0.88)', fontSize: '0.76rem' }}>{label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </header>

            {/* ══ PHILOSOPHIE ══════════════════════════════════════════ */}
            <section style={{ padding: 'clamp(52px,9vw,96px) 0', background: '#F8F8F8', position: 'relative', overflow: 'hidden' }}>
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(to right, transparent, ${RED}22, transparent)` }} />
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
                        <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.7 }} className="mb-12 lg:mb-0">
                            <p style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: RED, marginBottom: '12px' }}>
                                Notre Philosophie
                            </p>
                            <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(2rem, 4vw, 4.5rem)', fontWeight: 300, lineHeight: 1.08, color: '#111827', marginBottom: '16px' }}>
                                Chaque Événement,
                                <span style={{ display: 'block', color: RED }}>Une Signature</span>
                            </h2>
                            <div style={{ height: '2px', width: '48px', borderRadius: '2px', marginBottom: '22px', background: `linear-gradient(to right, ${RED}, ${GOLD})` }} />
                            <p style={{ color: '#6B7280', lineHeight: 1.75, marginBottom: '20px', fontSize: 'clamp(0.9rem,2vw,1rem)' }}>
                                Nous offrons une planification d'événements de A à Z avec une touche d'
                                <strong style={{ color: '#111827' }}>excellence</strong> et une{' '}
                                <strong style={{ color: '#111827' }}>attention inégalée</strong> aux détails.
                            </p>
                            <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                                {[
                                    'Coordination complète de A à Z',
                                    'Prestataires sélectionnés avec soin',
                                    'Décoration & scénographie personnalisées',
                                    'Présence garantie le jour J',
                                ].map((item, i) => (
                                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#374151' }}>
                                        <CheckCircle style={{ width: '14px', height: '14px', color: RED, flexShrink: 0 }} />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <button onClick={() => openQuote('Demande Générale')}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white text-sm group"
                                style={{ background: `linear-gradient(135deg, ${RED}, ${RED_DARK})`, boxShadow: `0 4px 20px ${RED}4D`, fontFamily: "'DM Sans', sans-serif", border: 'none', cursor: 'pointer' }}>
                                Demander un devis gratuit
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.1 }}
                            className="grid grid-cols-2 gap-4">
                            {[
                                { value: '80+',   label: 'Événements organisés', color: RED      },
                                { value: '98%',   label: 'Clients satisfaits',   color: RED_DARK },
                                { value: '5 ans', label: "D'expérience",          color: RED      },
                                { value: '24h',   label: 'Délai de réponse',      color: GOLD     },
                            ].map(({ value, label, color }, i) => (
                                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.1 }}
                                    style={{ padding: 'clamp(18px,3.5vw,26px)', borderRadius: '10px', textAlign: 'center', background: `${color}08`, border: `1px solid ${color}20` }}>
                                    <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2rem,6vw,4rem)', fontWeight: 300, color, lineHeight: 1, marginBottom: '6px' }}>
                                        {value}
                                    </p>
                                    <p style={{ fontSize: '0.74rem', color: '#4B5563', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>
                                        {label}
                                    </p>
                                </motion.div>
                            ))}
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ══ SERVICES ═════════════════════════════════════════════ */}
            <section style={{ padding: 'clamp(52px,9vw,96px) 0', background: '#FFFFFF', position: 'relative' }}>
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(to right, transparent, ${RED}18, transparent)` }} />
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <motion.div className="text-center mb-12" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                        <p style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: RED, marginBottom: '10px' }}>
                            Nos Engagements
                        </p>
                        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2rem, 4vw, 4.5rem)', fontWeight: 300, lineHeight: 1.08, color: '#111827', marginBottom: '8px' }}>
                            Nos Services Exclusifs
                        </h2>
                        <p style={{ fontSize: '0.85rem', color: '#6B7280', maxWidth: '480px', margin: '0 auto' }}>
                            De l'intime au grandiose, nos prestations couvrent tous vos besoins
                        </p>
                    </motion.div>
                    <div className="grid md:grid-cols-3 gap-5">
                        {SERVICES.map((s, i) => {
                            const Icon = s.icon;
                            return (
                                <motion.div key={s.id}
                                    initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.5, delay: i * 0.1 }}
                                    whileHover={{ y: -5 }}
                                    className="group relative rounded-2xl p-7 overflow-hidden"
                                    style={{ background: '#FFFFFF', border: `1px solid ${s.color}18`, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'all 0.4s ease' }}>
                                    <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity"
                                        style={{ backgroundColor: s.color }} />
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                                        style={{ background: `${s.color}16`, border: `1px solid ${s.color}28` }}>
                                        <Icon className="w-6 h-6" style={{ color: s.color }} />
                                    </div>
                                    <span style={{ display: 'inline-block', fontSize: '0.64rem', fontWeight: 700, padding: '3px 9px', borderRadius: '40px', marginBottom: '10px', background: `${s.color}12`, color: s.color }}>
                                        {s.stat}
                                    </span>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', marginBottom: '8px', fontFamily: "'DM Sans', sans-serif" }}>
                                        {s.title}
                                    </h3>
                                    <p style={{ fontSize: '0.83rem', color: '#6B7280', lineHeight: 1.7, marginBottom: '18px' }}>
                                        {s.desc}
                                    </p>
                                    <button onClick={() => openQuote(s.title)}
                                        className="inline-flex items-center gap-2 text-sm font-semibold group-hover:gap-3 transition-all"
                                        style={{ color: s.color, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: "'DM Sans', sans-serif" }}>
                                        Demander un devis
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ══ RÉALISATIONS ═════════════════════════════════════════ */}
            <section id="realisations" style={{ padding: 'clamp(52px,9vw,96px) 0', background: '#F8F8F8', position: 'relative' }}>
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(to right, transparent, ${RED}15, transparent)` }} />
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
                        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                            <p style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: RED, marginBottom: '8px' }}>
                                Notre Portfolio
                            </p>
                            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.8rem, 3.5vw, 4rem)', fontWeight: 300, lineHeight: 1.1, color: '#111827' }}>
                                Nos Réalisations
                            </h2>
                        </motion.div>
                        <Link href="/mila-events/annonces"
                            className="inline-flex items-center gap-2 text-sm font-semibold group flex-shrink-0"
                            style={{ color: RED }}>
                            Voir tout <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>

                    {/* Filtres */}
                    <div className="flex flex-wrap gap-2 mb-8">
                        {EVENT_TYPES.map(type => {
                            const count = type === 'Tous' ? events.length : events.filter(e => (e.category || '') === type).length;
                            const isActive = filterType === type;
                            return (
                                <button key={type} onClick={() => { setFilterType(type); setCurrentPage(1); }}
                                    className="px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2"
                                    style={{
                                        background: isActive ? `linear-gradient(135deg, ${RED}, ${RED_DARK})` : 'transparent',
                                        color:      isActive ? 'white' : `${RED}CC`,
                                        border:     isActive ? 'none' : `1px solid ${RED}28`,
                                        boxShadow:  isActive ? `0 4px 12px ${RED}4D` : 'none',
                                        fontFamily: "'DM Sans', sans-serif",
                                        cursor:     'pointer',
                                        transition: 'all 0.25s ease',
                                    }}>
                                    {type}
                                    <span style={{
                                        fontSize: '0.7rem', fontWeight: 700,
                                        padding: '1px 6px', borderRadius: '20px',
                                        background: isActive ? 'rgba(255,255,255,0.2)' : `${RED}22`,
                                        color:      isActive ? 'white' : RED,
                                    }}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {error && (
                        <div className="flex items-center gap-3 p-4 rounded-xl mb-8 max-w-xl"
                            style={{ background: `${RED}10`, border: `1px solid ${RED}22` }}>
                            <span>⚠️</span>
                            <p style={{ color: RED_SOFT, fontSize: '0.85rem', fontWeight: 500 }}>{error}</p>
                        </div>
                    )}

                    {loading ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'clamp(14px,2vw,22px)' }}>
                            {[1,2,3,4,5,6].map(i => <EventSkeleton key={i} />)}
                        </div>
                    ) : currentEvents.length === 0 ? (
                        <div className="text-center py-16 rounded-2xl"
                            style={{ border: `1px dashed ${RED}35`, background: `${RED}06` }}>
                            <PartyPopper className="w-10 h-10 mx-auto mb-4" style={{ color: `${RED}66` }} />
                            <p style={{ fontWeight: 600, color: '#374151' }}>Aucune réalisation disponible</p>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'clamp(14px,2vw,22px)' }}>
                                {currentEvents.map((e, i) => <EventCard key={e._id} event={e} index={i} />)}
                            </div>
                            <Pagination
                                totalPages={Math.ceil(filteredEvents.length / EVENTS_PER_PAGE)}
                                currentPage={currentPage}
                                onPageChange={p => {
                                    setCurrentPage(p);
                                    document.getElementById('realisations')?.scrollIntoView({ behavior: 'smooth' });
                                }}
                            />
                        </>
                    )}
                </div>
            </section>

            {/* ══ AVIS ═════════════════════════════════════════════════ */}
            <section style={{ padding: 'clamp(52px,9vw,96px) 0', background: '#FFFFFF', position: 'relative' }}>
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(to right, transparent, ${RED}18, transparent)` }} />
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
                        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                            <p style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: RED, marginBottom: '8px' }}>
                                Témoignages
                            </p>
                            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.8rem, 3.5vw, 4rem)', fontWeight: 300, lineHeight: 1.1, color: '#111827' }}>
                                Ce Que Disent Nos Clients
                            </h2>
                        </motion.div>
                        <motion.button onClick={handleLeaveReview} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-white text-sm flex-shrink-0"
                            style={{ background: `linear-gradient(135deg, ${RED}, ${RED_DARK})`, boxShadow: `0 4px 16px ${RED}4D`, fontFamily: "'DM Sans', sans-serif", border: 'none', cursor: 'pointer' }}>
                            <MessageSquarePlus className="w-4 h-4" />
                            Laisser un avis
                            {!user && <span style={{ opacity: 0.5, fontSize: '0.64rem', fontWeight: 400 }}>(connexion)</span>}
                        </motion.button>
                    </div>

                    {reviewsLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {[1,2,3].map(i => (
                                <div key={i} className="rounded-2xl p-6 animate-pulse"
                                    style={{ background: '#FFFFFF', border: `1px solid rgba(17,24,39,0.08)` }}>
                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                                        <div style={{ width: '36px', height: '36px', background: '#E5E7EB', borderRadius: '50%', flexShrink: 0 }} />
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '7px' }}>
                                            <div style={{ height: '11px', background: '#E5E7EB', borderRadius: '5px', width: '58%' }} />
                                            <div style={{ height: '9px', background: '#F3F4F6', borderRadius: '4px', width: '32%' }} />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                                        <div style={{ height: '11px', background: '#F3F4F6', borderRadius: '5px' }} />
                                        <div style={{ height: '11px', background: '#F3F4F6', borderRadius: '5px', width: '78%' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : reviews.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {reviews.map((review, i) => (
                                <motion.div key={review._id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.08 }}>
                                    <ReviewCard review={review} />
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-14 rounded-2xl"
                            style={{ border: `1px dashed ${RED}28`, background: `${RED}06` }}>
                            <Star className="w-8 h-8 mx-auto mb-3" style={{ color: '#9CA3AF' }} />
                            <p style={{ fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Aucun avis pour le moment</p>
                            <p style={{ fontSize: '0.85rem', color: '#6B7280' }}>Soyez le premier à partager votre expérience !</p>
                        </div>
                    )}
                </div>
            </section>

            {/* ══ CONTACT ══════════════════════════════════════════════ */}
            <MilaContact />

            {/* ══ CTA FINAL ════════════════════════════════════════════ */}
            <section style={{ padding: 'clamp(52px,9vw,96px) 0', position: 'relative', overflow: 'hidden', background: '#F8F8F8' }}>
                <div className="container mx-auto max-w-4xl text-center" style={{ position: 'relative', zIndex: 10, padding: '0 20px' }}>
                    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                        <p style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: RED, marginBottom: '14px' }}>
                            Commençons
                        </p>
                        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2rem, 4vw, 4.5rem)', fontWeight: 300, lineHeight: 1.08, color: '#111827', marginBottom: '16px' }}>
                            Prêt à créer votre événement de rêve ?
                        </h2>
                        <p style={{ color: '#6B7280', marginBottom: '36px', maxWidth: '520px', margin: '0 auto 36px', lineHeight: 1.7 }}>
                            Consultation gratuite — transformons ensemble vos idées en réalité.
                        </p>
                        <div className="flex flex-wrap justify-center gap-4">
                            <motion.button onClick={() => openQuote('Demande Générale')}
                                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                                className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-white text-base"
                                style={{ background: `linear-gradient(135deg, ${RED}, ${RED_DARK})`, boxShadow: `0 8px 32px ${RED}66`, fontFamily: "'DM Sans', sans-serif", border: 'none', cursor: 'pointer' }}>
                                <Sparkles className="w-5 h-5" /> Lancer votre Projet
                            </motion.button>
                            <Link href="/mila-events/annonces"
                                className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-base hover:bg-gray-100 transition-all"
                                style={{ color: '#374151', border: '1px solid rgba(17,24,39,0.15)', fontFamily: "'DM Sans', sans-serif" }}>
                                <CalendarClock className="w-5 h-5" /> Voir nos réalisations
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>

        </div>
    );
};

export default MilaEventsPage;
