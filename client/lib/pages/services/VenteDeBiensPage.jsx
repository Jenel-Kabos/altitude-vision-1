"use client";
import React, { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
    FaKey, FaHome, FaChartLine, FaCamera,
    FaFileContract, FaHandshake, FaCheckCircle
} from 'react-icons/fa';
import { ArrowLeft, Sparkles, Users, Shield, TrendingUp } from 'lucide-react';

// ── Images Unsplash thématiques vente immobilière ─────────────
const IMAGES = {
    hero:      'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1400&q=85',
    about:     'https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=800&q=80',
    process:   'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800&q=80',
    gallery: [
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
    ],
};

// ── Lazy image ────────────────────────────────────────────────
const Img = ({ src, alt, className = '' }) => {
    const [loaded, setLoaded] = useState(false);
    return (
        <div className={`relative overflow-hidden bg-gray-100 ${className}`}>
            {!loaded && <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />}
            <Image src={src} alt={alt} fill
                sizes="(max-width: 768px) 100vw, 50vw"
                onLoad={() => setLoaded(true)}
                className={`object-cover transition-all duration-700 ${loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`} />
        </div>
    );
};

const VenteDeBiensPage = () => {
    const advantages = [
        { icon: FaChartLine, title: 'Évaluation Précise',    description: 'Analyse approfondie du marché pour déterminer le prix optimal de votre bien' },
        { icon: FaCamera,    title: 'Mise en Valeur',         description: 'Photos professionnelles et visites virtuelles pour attirer les acheteurs' },
        { icon: Users,       title: 'Réseau Étendu',          description: "Accès à une large base d'acheteurs qualifiés et motivés" },
        { icon: FaFileContract, title: 'Accompagnement Légal', description: 'Gestion complète des aspects administratifs et juridiques' },
        { icon: Shield,      title: 'Sécurité Maximale',      description: 'Vérification rigoureuse des acquéreurs et sécurisation des transactions' },
        { icon: TrendingUp,  title: 'Vente Rapide',           description: 'Stratégies éprouvées pour vendre dans les meilleurs délais' },
    ];

    const processSteps = [
        { number: '01', title: 'Estimation Gratuite',   description: 'Nous évaluons votre bien gratuitement en tenant compte de tous les critères du marché' },
        { number: '02', title: 'Stratégie Marketing',   description: "Création d'un plan de communication personnalisé pour maximiser la visibilité" },
        { number: '03', title: 'Visites & Négociation', description: 'Organisation des visites et négociation pour obtenir le meilleur prix' },
        { number: '04', title: 'Finalisation',          description: "Accompagnement jusqu'à la signature chez le notaire et remise des clés" },
    ];

    return (
        <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>

            {/* ══ HERO avec image plein écran ══════════════ */}
            <section className="relative min-h-[85vh] flex items-center overflow-hidden">
                {/* Image fond */}
                <div className="absolute inset-0">
                    <Img src={IMAGES.hero} alt="Vente immobilière" className="w-full h-full" />
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 via-blue-800/75 to-transparent" />
                </div>

                <div className="container mx-auto px-4 sm:px-6 max-w-6xl relative z-10 py-24">
                    <Link href="/immobilier" className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-10 transition-colors group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Retour à Altimmo
                    </Link>

                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex mb-6 p-4 bg-white/15 backdrop-blur-md rounded-2xl border border-white/30">
                        <FaKey className="w-8 h-8 text-white" />
                    </motion.div>

                    <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1, duration: 0.7 }}
                        className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight max-w-2xl">
                        Vente de Biens
                    </motion.h1>

                    <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.7 }}
                        className="text-lg sm:text-xl font-light text-white/85 max-w-xl leading-relaxed mb-10">
                        Nous vous accompagnons à chaque étape pour vendre votre propriété au meilleur prix.
                    </motion.p>

                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="flex flex-wrap gap-4">
                        <Link href="/altimmo/estimation"
                            className="inline-flex items-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-full transition-all hover:scale-105 shadow-xl">
                            <Sparkles className="w-4 h-4" /> Estimation gratuite
                        </Link>
                        <a href="#processus"
                            className="inline-flex items-center gap-2 px-7 py-3.5 bg-white/15 hover:bg-white/25 text-white font-semibold rounded-full border border-white/25 backdrop-blur-sm transition-all">
                            Notre processus →
                        </a>
                    </motion.div>
                </div>

                {/* Stats flottantes */}
                <div className="absolute bottom-0 left-0 right-0 bg-white/10 backdrop-blur-md border-t border-white/10">
                    <div className="container mx-auto px-4 max-w-6xl py-4 text-center text-white">
                        <p className="text-2xl font-bold">+120 ventes</p>
                        <p className="text-xs text-white/70 mt-0.5">Un accompagnement à chaque étape de votre projet</p>
                    </div>
                </div>
            </section>

            {/* ══ POURQUOI NOUS — layout image + texte ════ */}
            <section className="py-20 bg-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        {/* Image gauche avec carte flottante */}
                        <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.7 }}
                            className="relative">
                            <Img src={IMAGES.about} alt="Expertise vente" className="w-full h-96 rounded-3xl" />
                            {/* Badge flottant */}
                            <div className="absolute -bottom-6 -right-6 bg-white rounded-2xl shadow-xl p-5 border border-gray-100">
                                <p className="text-lg font-bold text-blue-600">Expertise locale</p>
                                <p className="text-xs text-gray-500 mt-0.5">Un interlocuteur dédié</p>
                            </div>
                            <div className="absolute -top-4 -left-4 w-20 h-20 rounded-2xl bg-blue-600/10 border border-blue-200" />
                        </motion.div>

                        {/* Texte droite */}
                        <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.1 }}>
                            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">Notre expertise</p>
                            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 leading-tight">
                                Pourquoi Choisir Altimmo ?
                            </h2>
                            <div className="h-1 w-12 bg-gradient-to-r from-blue-600 to-sky-400 rounded-full mb-6" />
                            <p className="text-gray-600 leading-relaxed mb-8">
                                Fort de plus de 15 ans d'expérience sur le marché immobilier local, Altimmo vous offre un accompagnement complet et personnalisé pour vendre votre bien dans les meilleures conditions.
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                {advantages.map((a, i) => (
                                    <motion.div key={i}
                                        initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                                        className="flex items-start gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-100">
                                        <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                                            <a.icon className="w-4 h-4 text-white" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm">{a.title}</p>
                                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{a.description}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ══ GALERIE ══════════════════════════════════ */}
            <section className="py-8 bg-gray-50">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="grid grid-cols-3 gap-4 h-64">
                        {IMAGES.gallery.map((src, i) => (
                            <motion.div key={i}
                                initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                                className={`rounded-2xl overflow-hidden ${i === 0 ? 'col-span-2' : ''}`}>
                                <Img src={src} alt={`Bien ${i + 1}`} className="w-full h-full" />
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══ PROCESSUS ════════════════════════════════ */}
            <section id="processus" className="py-20 bg-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">Notre Méthode</p>
                            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 leading-tight">
                                Un Processus en 4 Étapes
                            </h2>
                            <div className="h-1 w-12 bg-gradient-to-r from-blue-600 to-sky-400 rounded-full mb-8" />
                            <div className="space-y-4">
                                {processSteps.map((step, i) => (
                                    <motion.div key={i}
                                        initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                                        className="flex items-start gap-5 p-5 rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all bg-white">
                                        <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-sky-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                                            {step.number}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 mb-1">{step.title}</h3>
                                            <p className="text-gray-500 text-sm leading-relaxed">{step.description}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                        <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.7 }}
                            className="relative hidden lg:block">
                            <Img src={IMAGES.process} alt="Notre processus" className="w-full h-[480px] rounded-3xl" />
                            <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-blue-900/40 to-transparent" />
                            <div className="absolute bottom-6 left-6 right-6 bg-white/95 backdrop-blur-sm rounded-2xl p-5 shadow-xl">
                                <p className="font-bold text-gray-900 mb-1">Suivi personnalisé</p>
                                <p className="text-sm text-gray-500">De l'estimation à la signature définitive</p>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ══ CTA ══════════════════════════════════════ */}
            <section className="py-20 relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 text-white">
                <div className="absolute inset-0">
                    <Img src={IMAGES.gallery[2]} alt="bg" className="w-full h-full opacity-15" />
                </div>
                <div className="container mx-auto px-4 sm:px-6 max-w-4xl text-center relative z-10">
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                        <FaCheckCircle className="w-14 h-14 mx-auto mb-6 text-white/90" />
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">Prêt à Vendre Votre Bien ?</h2>
                        <p className="text-lg font-light mb-8 max-w-xl mx-auto text-white/85">
                            Contactez-nous dès aujourd'hui pour une estimation gratuite et sans engagement
                        </p>
                        <Link href="/altimmo/estimation"
                            className="inline-flex items-center gap-3 px-8 py-4 bg-white text-blue-600 font-semibold rounded-full shadow-2xl hover:shadow-white/30 hover:scale-105 active:scale-95 transition-all">
                            <Sparkles className="w-5 h-5" /> Demander une Estimation Gratuite
                        </Link>
                    </motion.div>
                </div>
            </section>

            <footer className="bg-gray-900 text-white py-8 border-t border-gray-800">
                <div className="container mx-auto px-4 text-center max-w-6xl">
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <FaHome className="w-5 h-5 text-blue-400" />
                        <p className="text-2xl font-bold">Altimmo</p>
                    </div>
                    <p className="text-xs text-gray-400">
                        &copy; {new Date().getFullYear()} Tous droits réservés |{' '}
                        <Link href="/mentions-legales" className="hover:text-blue-400 transition ml-1 underline underline-offset-2">Mentions Légales</Link>
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default VenteDeBiensPage;
