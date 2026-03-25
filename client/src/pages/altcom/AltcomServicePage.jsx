// src/pages/altcom/AltcomServicePage.jsx
//
// Page générique pour chaque service Altcom.
// Utilisée pour : /altcom/communication-digitale
//                 /altcom/branding-design
//                 /altcom/conseil-strategie
//                 /altcom/couverture-mediatique
//
// Dans votre router, déclarez :
//   <Route path="/altcom/:serviceSlug" element={<AltcomServicePage />} />
//
import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Send, CheckCircle,
    ArrowRight, Zap, Briefcase,
} from 'lucide-react';

import SEOHead   from '../../components/SEOHead';
import QuoteModal from './QuoteModal';
import { createQuoteRequest } from '../../services/quoteService';
import { SERVICES, GOLD, GOLD_DARK, GOLD_LIGHT, BLUE } from './altcomData';

// Mapping slug → service
const SLUG_MAP = {
    'communication-digitale': '1',
    'branding-design':        '2',
    'conseil-strategie':      '3',
    'couverture-mediatique':  '4',
};

const AltcomServicePage = () => {
    const { serviceSlug } = useParams();
    const navigate        = useNavigate();

    const serviceId = SLUG_MAP[serviceSlug];
    const service   = SERVICES.find(s => s._id === serviceId);

    const [showQuote, setShowQuote] = useState(false);
    const [notif,     setNotif]     = useState({ visible: false, msg: '', ok: true });

    const showNotif = (msg, ok = true) => {
        setNotif({ visible: true, msg, ok });
        setTimeout(() => setNotif({ visible: false, msg: '', ok: true }), 5000);
    };

    const handleQuoteSubmit = async (fd) => {
        await createQuoteRequest(fd);
        showNotif(`Demande pour "${fd.service}" enregistrée. Réponse sous 24h !`);
    };

    // Service introuvable
    if (!service) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4"
                style={{ fontFamily: "'Outfit',sans-serif" }}>
                <p className="text-2xl font-bold text-gray-800">Service introuvable</p>
                <p className="text-gray-500">Ce service n'existe pas ou a été déplacé.</p>
                <Link to="/altcom"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white text-sm"
                    style={{ background: `linear-gradient(135deg,${GOLD_DARK},${GOLD})` }}>
                    <ArrowLeft className="w-4 h-4" /> Retour à Altcom
                </Link>
            </div>
        );
    }

    const Icon = service.icon;

    // Autres services (pour la section "Voir aussi")
    const otherServices = SERVICES.filter(s => s._id !== service._id);

    return (
        <div className="min-h-screen bg-white" style={{ fontFamily: "'Outfit',sans-serif" }}>

            <SEOHead
                title={`${service.title} — Altcom`}
                description={service.shortDesc}
                url={service.route}
            />

            {/* Toast */}
            <AnimatePresence>
                {notif.visible && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                        className="fixed top-20 right-4 z-50 px-5 py-3.5 rounded-2xl shadow-2xl text-white text-sm font-semibold max-w-sm"
                        style={{ background: notif.ok ? 'linear-gradient(135deg,#16a34a,#15803d)' : 'linear-gradient(135deg,#D42B2B,#A01E1E)' }}>
                        {notif.msg}
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showQuote && (
                    <QuoteModal
                        serviceTitle={service.title}
                        onClose={() => setShowQuote(false)}
                        onSubmit={handleQuoteSubmit}
                    />
                )}
            </AnimatePresence>

            {/* ══ HERO SERVICE ══════════════════════════════ */}
            <header className="relative overflow-hidden py-24 sm:py-32"
                style={{ background: 'linear-gradient(135deg,#0D1117 0%,#0e1e30 60%,#0D1117 100%)' }}>
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 right-1/3 w-72 h-72 rounded-full blur-[120px] opacity-12"
                        style={{ background: service.color }} />
                    <div className="absolute bottom-0 left-1/4 w-56 h-56 rounded-full blur-[100px] opacity-6"
                        style={{ background: GOLD }} />
                </div>
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(to right,transparent,${service.color}60,transparent)` }} />

                <div className="container mx-auto px-4 sm:px-6 max-w-4xl relative z-10">
                    {/* Breadcrumb */}
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 text-sm mb-8" style={{ color: 'rgba(232,228,220,0.4)' }}>
                        <button onClick={() => navigate('/altcom')}
                            className="flex items-center gap-1.5 hover:text-white/80 transition-colors">
                            <ArrowLeft className="w-3.5 h-3.5" /> Altcom
                        </button>
                        <span>/</span>
                        <span style={{ color: service.color }}>{service.title}</span>
                    </motion.div>

                    {/* Icône + titre */}
                    <div className="flex items-start gap-6">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                            style={{ background: `linear-gradient(135deg,${service.color}30,${service.color}15)`, border: `1px solid ${service.color}40` }}>
                            <Icon className="w-8 h-8" style={{ color: service.color }} />
                        </motion.div>

                        <div>
                            <motion.span
                                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                                className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-3"
                                style={{ backgroundColor: `${service.color}20`, color: service.color, letterSpacing: '0.08em' }}>
                                {service.stat}
                            </motion.span>

                            <motion.h1
                                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15, duration: 0.6 }}
                                className="text-white mb-3"
                                style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(2.2rem,5vw,4rem)', fontWeight: 700, lineHeight: 1.1 }}>
                                {service.title}
                            </motion.h1>

                            <div className="h-0.5 w-14 rounded-full mb-4"
                                style={{ background: `linear-gradient(to right,${service.color},${GOLD})` }} />

                            <motion.p
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                                className="text-white/65 text-base sm:text-lg leading-relaxed max-w-2xl"
                                style={{ fontWeight: 300 }}>
                                {service.shortDesc}
                            </motion.p>
                        </div>
                    </div>
                </div>
            </header>

            {/* ══ CONTENU PRINCIPAL ═════════════════════════ */}
            <section className="py-16 sm:py-20">
                <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
                    <div className="grid lg:grid-cols-3 gap-12">

                        {/* Description longue */}
                        <motion.div className="lg:col-span-2"
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}>
                            <h2 className="text-gray-900 mb-4"
                                style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(1.6rem,3vw,2.4rem)', fontWeight: 700 }}>
                                À propos de ce service
                            </h2>
                            <div className="h-0.5 w-12 rounded-full mb-6"
                                style={{ background: `linear-gradient(to right,${service.color},${GOLD})` }} />
                            <p className="text-gray-600 leading-relaxed text-base sm:text-lg mb-8">
                                {service.fullDesc}
                            </p>

                            <h3 className="font-bold text-gray-900 mb-4 text-lg"
                                style={{ fontFamily: "'Outfit',sans-serif" }}>
                                Ce que nous proposons
                            </h3>
                            <ul className="space-y-3">
                                {service.features.map((f, i) => (
                                    <motion.li key={i}
                                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.1 + i * 0.07 }}
                                        className="flex items-start gap-3 text-gray-600 text-sm">
                                        <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: service.color }} />
                                        {f}
                                    </motion.li>
                                ))}
                            </ul>
                        </motion.div>

                        {/* Sidebar CTA */}
                        <motion.aside
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.15 }}
                            className="lg:col-span-1">
                            <div className="sticky top-24 rounded-3xl border p-7 space-y-4"
                                style={{ borderColor: `${service.color}20`, background: `${service.color}05` }}>
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ background: `linear-gradient(135deg,${service.color}30,${service.color}15)` }}>
                                    <Icon className="w-5 h-5" style={{ color: service.color }} />
                                </div>
                                <h3 className="font-bold text-gray-900 text-base"
                                    style={{ fontFamily: "'Outfit',sans-serif" }}>
                                    Intéressé par ce service ?
                                </h3>
                                <p className="text-gray-500 text-sm leading-relaxed">
                                    Demandez un devis personnalisé. Notre équipe vous répondra sous 24h.
                                </p>
                                <motion.button
                                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    onClick={() => setShowQuote(true)}
                                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-white text-sm"
                                    style={{ background: `linear-gradient(135deg,${GOLD_DARK},${GOLD})`, boxShadow: `0 4px 20px ${GOLD}30`, fontFamily: "'Outfit',sans-serif" }}>
                                    <Send className="w-4 h-4" /> Demander un devis
                                </motion.button>
                                <button onClick={() => navigate('/altcom')}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
                                    style={{ fontFamily: "'Outfit',sans-serif" }}>
                                    <ArrowLeft className="w-4 h-4" /> Tous les services
                                </button>
                            </div>
                        </motion.aside>
                    </div>
                </div>
            </section>

            {/* ══ VOIR AUSSI ════════════════════════════════ */}
            <section className="py-16 bg-gray-50">
                <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
                    <h2 className="text-gray-900 mb-8"
                        style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(1.6rem,3vw,2.2rem)', fontWeight: 700 }}>
                        Nos autres services
                    </h2>
                    <div className="grid sm:grid-cols-3 gap-4">
                        {otherServices.map((s, i) => {
                            const OtherIcon = s.icon;
                            return (
                                <motion.button key={s._id}
                                    initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                                    onClick={() => navigate(s.route)}
                                    className="group text-left p-5 rounded-2xl border bg-white hover:shadow-md transition-all"
                                    style={{ borderColor: `${s.color}20` }}>
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                                        style={{ backgroundColor: `${s.color}12` }}>
                                        <OtherIcon className="w-4 h-4" style={{ color: s.color }} />
                                    </div>
                                    <p className="font-bold text-gray-800 text-sm mb-1 group-hover:text-[#C8872A] transition-colors"
                                        style={{ fontFamily: "'Outfit',sans-serif" }}>
                                        {s.title}
                                    </p>
                                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2"
                                        style={{ fontFamily: "'Outfit',sans-serif" }}>
                                        {s.shortDesc}
                                    </p>
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold mt-3 group-hover:gap-2 transition-all"
                                        style={{ color: s.color }}>
                                        Voir <ArrowRight className="w-3 h-3" />
                                    </span>
                                </motion.button>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ══ CTA BAS ═══════════════════════════════════ */}
            <section className="py-16 relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg,#0D1117 0%,#1a1505 50%,#0D1117 100%)' }}>
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(to right,transparent,${GOLD}50,transparent)` }} />
                <div className="container mx-auto px-4 sm:px-6 max-w-3xl text-center relative z-10">
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-5"
                            style={{ background: `linear-gradient(135deg,${GOLD_DARK},${GOLD})` }}>
                            <Zap className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-white mb-4"
                            style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(1.8rem,3.5vw,3rem)', fontWeight: 700, lineHeight: 1.1 }}>
                            Prêt à démarrer ?
                        </h2>
                        <p className="text-white/60 mb-8 leading-relaxed" style={{ fontSize: 'clamp(0.9rem,1.4vw,1rem)' }}>
                            Contactez-nous pour discuter de votre projet {service.title.toLowerCase()} et obtenir un devis personnalisé.
                        </p>
                        <div className="flex flex-wrap justify-center gap-3">
                            <motion.button onClick={() => setShowQuote(true)}
                                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-white text-sm"
                                style={{ background: `linear-gradient(135deg,${GOLD_DARK},${GOLD})`, boxShadow: `0 8px 32px ${GOLD}40`, fontFamily: "'Outfit',sans-serif" }}>
                                <Send className="w-4 h-4" /> Demander un devis
                            </motion.button>
                            <Link to="/altcom"
                                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-white/80 text-sm border border-white/15 hover:bg-white/10 transition-all"
                                style={{ fontFamily: "'Outfit',sans-serif" }}>
                                <Briefcase className="w-4 h-4" /> Tous les services
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>
        </div>
    );
};

export default AltcomServicePage;