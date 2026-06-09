"use client";
// src/pages/altcom/AltcomServicePage.jsx
import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Send, CheckCircle,
    ArrowRight, Zap, Briefcase, Clock,
} from 'lucide-react';

import QuoteModal from './QuoteModal';
import { createQuoteRequest }           from '../../services/quoteService';
import { SERVICES, GOLD, GOLD_DARK, GOLD_LIGHT, BLUE } from './altcomData';
import Image from 'next/image';

// Mapping slug → service
const SLUG_MAP = {
    'communication-digitale': '1',
    'branding-design':        '2',
    'conseil-strategie':      '3',
    'couverture-mediatique':  '4',
};

// ── Composant image avec lazy loading ────────────────────────
const ServiceImage = ({ src, alt, className = '' }) => {
    const [loaded, setLoaded] = useState(false);
    return (
        <div className={`relative overflow-hidden rounded-2xl bg-gray-100 ${className}`}>
            {!loaded && (
                <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
            )}
            <Image src={src} alt={alt} fill
                sizes="(max-width: 768px) 100vw, 50vw"
                onLoad={() => setLoaded(true)}
                className={`object-cover transition-all duration-700 ${loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}
            />
        </div>
    );
};

const AltcomServicePage = () => {
    const { serviceSlug } = useParams();
    const router          = useRouter();

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

    if (!service) return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4"
            style={{ fontFamily: "'Outfit',sans-serif" }}>
            <p className="text-2xl font-bold text-gray-800">Service introuvable</p>
            <p className="text-gray-500">Ce service n'existe pas ou a été déplacé.</p>
            <Link href="/altcom"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white text-sm"
                style={{ background: `linear-gradient(135deg,${GOLD_DARK},${GOLD})` }}>
                <ArrowLeft className="w-4 h-4" /> Retour à Altcom
            </Link>
        </div>
    );

    const Icon          = service.icon;
    const otherServices = SERVICES.filter(s => s._id !== service._id);

    return (
        <div className="min-h-screen bg-white" style={{ fontFamily: "'Outfit',sans-serif" }}>


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
                    <QuoteModal serviceTitle={service.title} onClose={() => setShowQuote(false)} onSubmit={handleQuoteSubmit} />
                )}
            </AnimatePresence>

            {/* ══ HERO ══════════════════════════════════════ */}
            <header className="relative overflow-x-hidden"
                style={{ background: 'linear-gradient(135deg,#0D1117 0%,#0e1e30 60%,#0D1117 100%)' }}>

                {/* Image hero en arrière-plan avec overlay */}
                {service.images[0] && (
                    <div className="absolute inset-0">
                        <Image src={service.images[0]} alt={service.title}
                            fill sizes="100vw" className="object-cover opacity-20" />
                        <div className="absolute inset-0"
                            style={{ background: 'linear-gradient(135deg,rgba(13,17,23,0.95) 40%,rgba(14,30,48,0.85) 100%)' }} />
                    </div>
                )}

                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 right-1/3 w-72 h-72 rounded-full blur-[120px] opacity-15"
                        style={{ background: service.color }} />
                    <div className="absolute bottom-0 left-1/4 w-56 h-56 rounded-full blur-[100px] opacity-8"
                        style={{ background: GOLD }} />
                </div>
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(to right,transparent,${service.color}60,transparent)` }} />

                <div className="container mx-auto px-4 sm:px-6 max-w-6xl relative z-10 pt-24 pb-28 sm:pt-32 sm:pb-36">
                    {/* Breadcrumb */}
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 text-sm mb-10" style={{ color: 'rgba(232,228,220,0.4)' }}>
                        <button onClick={() => router.push('/altcom')}
                            className="flex items-center gap-1.5 hover:text-white/80 transition-colors">
                            <ArrowLeft className="w-3.5 h-3.5" /> Altcom
                        </button>
                        <span>/</span>
                        <span style={{ color: service.color }}>{service.title}</span>
                    </motion.div>

                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        {/* Texte gauche */}
                        <div>
                            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-4"
                                style={{ backgroundColor: `${service.color}20`, color: service.color, letterSpacing: '0.08em' }}>
                                <Icon className="w-3.5 h-3.5" />
                                {service.stat}
                            </motion.div>

                            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1, duration: 0.6 }}
                                className="text-white mb-4"
                                style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(2.4rem,5vw,4.2rem)', fontWeight: 700, lineHeight: 1.1 }}>
                                {service.h1 || service.title}
                            </motion.h1>

                            <div className="h-0.5 w-14 rounded-full mb-5"
                                style={{ background: `linear-gradient(to right,${service.color},${GOLD})` }} />

                            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
                                className="text-white/65 text-base sm:text-lg leading-relaxed mb-8"
                                style={{ fontWeight: 300 }}>
                                {service.fullDesc}
                            </motion.p>

                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.35 }}
                                className="flex flex-wrap gap-3">
                                <button onClick={() => setShowQuote(true)}
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white text-sm transition-all hover:scale-105"
                                    style={{ background: `linear-gradient(135deg,${GOLD_DARK},${GOLD})`, boxShadow: `0 4px 20px ${GOLD}50` }}>
                                    <Send className="w-4 h-4" /> Demander un devis
                                </button>
                                <button onClick={() => router.push('/altcom')}
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white/70 text-sm border border-white/15 hover:bg-white/10 transition-all">
                                    <ArrowLeft className="w-4 h-4" /> Tous les services
                                </button>
                            </motion.div>
                        </div>

                        {/* Image droite avec effet empilé */}
                        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2, duration: 0.7 }}
                            className="relative hidden lg:block">
                            <div className="relative">
                                {/* Image principale */}
                                <ServiceImage
                                    src={service.images[0]}
                                    alt={service.title}
                                    className="w-full h-72 rounded-2xl"
                                />
                                {/* Image secondaire en overlay bas-droite */}
                                {service.images[1] && (
                                    <div className="absolute -bottom-6 -right-6 w-44 h-32 rounded-2xl overflow-hidden border-4 border-white/10 shadow-2xl">
                                        <ServiceImage src={service.images[1]} alt={service.title} className="w-full h-full" />
                                    </div>
                                )}
                                {/* Badge stat flottant */}
                                <div className="absolute -top-4 -left-4 px-4 py-2 rounded-xl text-white text-xs font-bold shadow-xl"
                                    style={{ background: `linear-gradient(135deg,${GOLD_DARK},${GOLD})` }}>
                                    {service.stat}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </header>

            {/* ══ CE QUE NOUS PROPOSONS ═════════════════════ */}
            <section className="py-16 sm:py-20 bg-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">

                        {/* Image gauche avec 2 photos */}
                        <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.7 }}
                            className="relative">
                            <ServiceImage src={service.images[1] || service.images[0]} alt={service.title} className="w-full h-80" />
                            {service.images[2] && (
                                <div className="absolute -bottom-5 -right-5 w-40 h-28 rounded-2xl overflow-hidden border-4 border-white shadow-xl">
                                    <ServiceImage src={service.images[2]} alt={service.title} className="w-full h-full" />
                                </div>
                            )}
                            {/* Décoration */}
                            <div className="absolute -top-3 -left-3 w-16 h-16 rounded-2xl opacity-20"
                                style={{ background: `linear-gradient(135deg,${service.color},transparent)` }} />
                        </motion.div>

                        {/* Features droite */}
                        <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.1 }}>
                            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: service.color }}>
                                Ce que nous proposons
                            </p>
                            <h2 className="text-gray-900 mb-4"
                                style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(1.8rem,3.5vw,2.8rem)', fontWeight: 700, lineHeight: 1.1 }}>
                                Nos Prestations
                            </h2>
                            <div className="h-0.5 w-12 rounded-full mb-6"
                                style={{ background: `linear-gradient(to right,${service.color},${GOLD})` }} />
                            <ul className="space-y-4">
                                {service.features.map((f, i) => (
                                    <motion.li key={i}
                                        initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                                        className="flex items-start gap-3 p-4 rounded-2xl border transition-all hover:shadow-sm"
                                        style={{ borderColor: `${service.color}15`, background: `${service.color}04` }}>
                                        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                            style={{ background: `${service.color}15` }}>
                                            <CheckCircle className="w-3.5 h-3.5" style={{ color: service.color }} />
                                        </div>
                                        <span className="text-gray-700 text-sm leading-relaxed">{f}</span>
                                    </motion.li>
                                ))}
                            </ul>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ══ NOTRE PROCESSUS ═══════════════════════════ */}
            <section className="relative py-16 sm:py-20 overflow-x-hidden"
                style={{ background: 'linear-gradient(135deg,#0D1117 0%,#0e1e30 60%,#0D1117 100%)' }}>
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/3 right-0 w-64 h-64 rounded-full blur-[100px] opacity-8"
                        style={{ background: GOLD }} />
                </div>
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl relative z-10">
                    <motion.div className="text-center mb-14"
                        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}>
                        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GOLD_LIGHT }}>
                            Méthodologie
                        </p>
                        <h2 className="text-white mb-3"
                            style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(1.8rem,3.5vw,2.8rem)', fontWeight: 700, lineHeight: 1.1 }}>
                            Notre Processus de Livraison
                        </h2>
                        <p className="text-white/50 text-sm max-w-xl mx-auto">
                            Une approche structurée et transparente pour garantir des résultats à la hauteur de vos attentes
                        </p>
                    </motion.div>

                    {/* Timeline des étapes */}
                    <div className="relative">
                        {/* Ligne de connexion desktop */}
                        <div className="hidden lg:block absolute top-10 left-0 right-0 h-px"
                            style={{ background: `linear-gradient(to right,transparent,${service.color}40,${GOLD}40,transparent)`, top: '2.5rem' }} />

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                            {service.process.map((step, i) => {
                                const StepIcon = step.icon;
                                return (
                                    <motion.div key={step.step}
                                        initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }}
                                        className="relative flex flex-col items-center text-center group">

                                        {/* Numéro + icône */}
                                        <div className="relative mb-5 z-10">
                                            {/* Cercle externe animé */}
                                            <div className="absolute -inset-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                                style={{ background: `${service.color}15` }} />
                                            <div className="relative w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all duration-300 group-hover:scale-110"
                                                style={{
                                                    background:   `linear-gradient(135deg,${service.color}20,${service.color}08)`,
                                                    borderColor:  `${service.color}50`,
                                                    boxShadow:    `0 0 20px ${service.color}20`,
                                                }}>
                                                <StepIcon className="w-5 h-5 transition-colors duration-200"
                                                    style={{ color: service.color }} />
                                            </div>
                                            {/* Numéro badge */}
                                            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                                style={{ background: `linear-gradient(135deg,${GOLD_DARK},${GOLD})`, fontSize: '0.6rem' }}>
                                                {step.step}
                                            </div>
                                        </div>

                                        <h3 className="font-bold text-white text-sm mb-2 leading-tight"
                                            style={{ fontFamily: "'Outfit',sans-serif" }}>
                                            {step.title}
                                        </h3>
                                        <p className="text-white/45 text-xs leading-relaxed mb-3 flex-1">
                                            {step.desc}
                                        </p>
                                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs"
                                            style={{ background: `${GOLD}12`, color: GOLD_LIGHT, border: `1px solid ${GOLD}20` }}>
                                            <Clock className="w-3 h-3" />
                                            {step.duration}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>

                    {/* CTA sous le processus */}
                    <motion.div className="text-center mt-14"
                        initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}>
                        <p className="text-white/50 text-sm mb-5">
                            Prêt à démarrer votre projet {service.title.toLowerCase()} ?
                        </p>
                        <button onClick={() => setShowQuote(true)}
                            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-white text-sm hover:scale-105 transition-all"
                            style={{ background: `linear-gradient(135deg,${GOLD_DARK},${GOLD})`, boxShadow: `0 8px 32px ${GOLD}40` }}>
                            <Send className="w-4 h-4" /> Demander un devis gratuit
                        </button>
                    </motion.div>
                </div>
            </section>

            {/* ══ GALERIE IMAGES ════════════════════════════ */}
            {service.images.length >= 3 && (
                <section className="py-16 bg-gray-50">
                    <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                        <motion.div className="mb-10"
                            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}>
                            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: service.color }}>
                                Aperçu
                            </p>
                            <h2 className="text-gray-900"
                                style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(1.6rem,3vw,2.4rem)', fontWeight: 700 }}>
                                Notre Univers
                            </h2>
                        </motion.div>

                        <div className="grid grid-cols-3 gap-4">
                            {service.images.map((img, i) => (
                                <motion.div key={i}
                                    initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }}
                                    viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                                    className={i === 0 ? 'col-span-2 row-span-1' : ''}>
                                    <ServiceImage
                                        src={img} alt={`${service.title} ${i + 1}`}
                                        className={i === 0 ? 'h-64' : 'h-64'}
                                    />
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ══ AUTRES SERVICES ═══════════════════════════ */}
            <section className="py-16 bg-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <motion.div className="mb-8"
                        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}>
                        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: GOLD }}>
                            Découvrir
                        </p>
                        <h2 className="text-gray-900"
                            style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(1.6rem,3vw,2.2rem)', fontWeight: 700 }}>
                            Nos autres services
                        </h2>
                    </motion.div>

                    <div className="grid sm:grid-cols-3 gap-5">
                        {otherServices.map((s, i) => {
                            const OtherIcon = s.icon;
                            return (
                                <motion.button key={s._id}
                                    initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                                    onClick={() => router.push(s.route)}
                                    className="group text-left rounded-3xl overflow-hidden border bg-white hover:shadow-xl transition-all duration-300"
                                    style={{ borderColor: `${s.color}15` }}>
                                    {/* Image miniature */}
                                    {s.images?.[0] && (
                                        <div className="relative h-36 overflow-hidden">
                                            <Image src={s.images[0]} alt={s.title}
                                                fill sizes="(max-width: 768px) 100vw, 25vw"
                                                className="object-cover group-hover:scale-105 transition-transform duration-500" />
                                        </div>
                                    )}
                                    <div className="p-5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                                style={{ backgroundColor: `${s.color}12` }}>
                                                <OtherIcon className="w-3.5 h-3.5" style={{ color: s.color }} />
                                            </div>
                                            <span className="text-xs font-bold uppercase tracking-wider"
                                                style={{ color: s.color }}>{s.stat}</span>
                                        </div>
                                        <p className="font-bold text-gray-800 text-sm mb-1 group-hover:text-[#C8872A] transition-colors"
                                            style={{ fontFamily: "'Outfit',sans-serif" }}>
                                            {s.title}
                                        </p>
                                        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-3">
                                            {s.shortDesc}
                                        </p>
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold group-hover:gap-2 transition-all"
                                            style={{ color: s.color }}>
                                            Voir ce service <ArrowRight className="w-3 h-3" />
                                        </span>
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ══ CTA FINAL ═════════════════════════════════ */}
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
                        <p className="text-white/60 mb-8 leading-relaxed">
                            Contactez-nous pour discuter de votre projet et obtenir un devis personnalisé sous 24h.
                        </p>
                        <div className="flex flex-wrap justify-center gap-3">
                            <motion.button onClick={() => setShowQuote(true)}
                                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-white text-sm"
                                style={{ background: `linear-gradient(135deg,${GOLD_DARK},${GOLD})`, boxShadow: `0 8px 32px ${GOLD}40` }}>
                                <Send className="w-4 h-4" /> Demander un devis
                            </motion.button>
                            <Link href="/altcom"
                                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-white/80 text-sm border border-white/15 hover:bg-white/10 transition-all">
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