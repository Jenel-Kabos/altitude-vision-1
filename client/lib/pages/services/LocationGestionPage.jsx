"use client";
import React, { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
    FaBuilding, FaHome, FaUsers, FaTools,
    FaFileInvoiceDollar, FaShieldAlt, FaHeadset, FaCheckCircle
} from 'react-icons/fa';
import { ArrowLeft, Sparkles, Calendar, Clock, TrendingUp } from 'lucide-react';

const IMAGES = {
    hero:    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1400&q=85',
    about:   'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&q=80',
    pricing: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80',
    gallery: [
        'https://images.unsplash.com/photo-1606744837616-56c9a5c08f38?w=800&q=80',
        'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&q=80',
        'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&q=80',
    ],
};

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

const LocationGestionPage = () => {
    const services = [
        { icon: FaUsers,           title: 'Recherche de Locataires', description: 'Sélection rigoureuse de locataires fiables avec vérification complète des dossiers' },
        { icon: FaFileInvoiceDollar, title: 'Gestion Financière',    description: 'Encaissement des loyers, suivi des charges et gestion comptable complète' },
        { icon: FaTools,           title: 'Maintenance & Entretien', description: 'Coordination des réparations et entretien régulier de votre propriété' },
        { icon: FaShieldAlt,       title: 'Protection Juridique',    description: 'Rédaction des baux, gestion des contentieux et protection de vos intérêts' },
        { icon: Calendar,          title: 'État des Lieux',          description: "Réalisation professionnelle des états des lieux d'entrée et de sortie" },
        { icon: FaHeadset,         title: 'Support 24/7',            description: 'Équipe disponible pour répondre aux urgences et aux demandes des locataires' },
    ];

    const benefits = [
        { icon: Clock,       title: 'Gain de Temps',     description: 'Déléguez toutes les tâches chronophages liées à la gestion locative' },
        { icon: TrendingUp,  title: 'Rentabilité Optimale', description: 'Maximisez vos revenus locatifs grâce à notre expertise du marché' },
        { icon: FaShieldAlt, title: 'Sérénité Totale',   description: 'Dormez tranquille, nous gérons tous les aspects de votre location' },
    ];

    const pricing = [
        {
            plan: 'Gestion Essentielle', price: '7%', description: 'du loyer mensuel HT',
            features: ['Recherche et sélection de locataires', 'Rédaction du bail', 'Encaissement des loyers', 'États des lieux', 'Rapport mensuel'],
        },
        {
            plan: 'Gestion Premium', price: '10%', description: 'du loyer mensuel HT', featured: true,
            features: ['Tous les services Essentielle', 'Gestion des travaux', 'Suivi des charges', 'Assurance loyers impayés', 'Support prioritaire 24/7', 'Optimisation fiscale'],
        },
        {
            plan: 'Gestion sur Mesure', price: 'Sur devis', description: 'selon vos besoins',
            features: ['Solution personnalisée', 'Gestion de portefeuille', 'Conseiller dédié', 'Services à la carte', 'Reporting avancé'],
        },
    ];

    const scrollToContact = (e) => {
        e.preventDefault();
        document.getElementById('contact-altimmo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>

            {/* ══ HERO ═════════════════════════════════════ */}
            <section className="relative min-h-[85vh] flex items-center overflow-hidden">
                <div className="absolute inset-0">
                    <Img src={IMAGES.hero} alt="Gestion immobilière" className="w-full h-full" />
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/90 via-emerald-800/75 to-transparent" />
                </div>

                <div className="container mx-auto px-4 sm:px-6 max-w-6xl relative z-10 py-24">
                    <Link href="/altimmo" className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-10 transition-colors group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Retour à Altimmo
                    </Link>

                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex mb-6 p-4 bg-white/15 backdrop-blur-md rounded-2xl border border-white/30">
                        <FaBuilding className="w-8 h-8 text-white" />
                    </motion.div>

                    <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1, duration: 0.7 }}
                        className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight max-w-2xl">
                        Location & Gestion Immobilière
                    </motion.h1>

                    <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.7 }}
                        className="text-lg sm:text-xl font-light text-white/85 max-w-xl leading-relaxed mb-10">
                        Confiez-nous la gestion de vos biens pour une tranquillité d'esprit et une rentabilité optimale. Nous nous occupons de tout, de A à Z.
                    </motion.p>

                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }} className="flex flex-wrap gap-4">
                        <Link href="/altimmo#contact-altimmo" onClick={scrollToContact}
                            className="inline-flex items-center gap-2 px-7 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-full transition-all hover:scale-105 shadow-xl">
                            <Sparkles className="w-4 h-4" /> Demander un devis
                        </Link>
                        <a href="#tarifs"
                            className="inline-flex items-center gap-2 px-7 py-3.5 bg-white/15 hover:bg-white/25 text-white font-semibold rounded-full border border-white/25 backdrop-blur-sm transition-all">
                            Voir les tarifs →
                        </a>
                    </motion.div>
                </div>

                {/* Stats */}
                <div className="absolute bottom-0 left-0 right-0 bg-white/10 backdrop-blur-md border-t border-white/10">
                    <div className="container mx-auto px-4 max-w-6xl grid grid-cols-3 divide-x divide-white/20">
                        {[['300+', 'Biens gérés'], ['99%', 'Taux d\'occupation'], ['24h', 'Temps de réponse']].map(([v, l]) => (
                            <div key={l} className="py-4 text-center text-white">
                                <p className="text-2xl font-bold">{v}</p>
                                <p className="text-xs text-white/60 mt-0.5">{l}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══ NOS SERVICES — grille avec image d'intro ═ */}
            <section className="py-20 bg-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="grid lg:grid-cols-2 gap-16 items-center mb-16">
                        <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.7 }}>
                            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-3">Nos prestations</p>
                            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 leading-tight">
                                Nos Services de Gestion
                            </h2>
                            <div className="h-1 w-12 bg-gradient-to-r from-emerald-600 to-green-400 rounded-full mb-6" />
                            <p className="text-gray-600 leading-relaxed">
                                Une gestion locative clé en main pour maximiser la rentabilité de votre patrimoine immobilier sans contraintes.
                            </p>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.7 }} className="relative">
                            <Img src={IMAGES.about} alt="Gestion locative" className="w-full h-64 rounded-3xl" />
                            <div className="absolute -bottom-4 -left-4 bg-emerald-600 text-white rounded-2xl px-5 py-3 shadow-lg">
                                <p className="font-bold text-lg">100%</p>
                                <p className="text-xs text-emerald-100">Gestion déléguée</p>
                            </div>
                        </motion.div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {services.map((s, i) => (
                            <motion.div key={i}
                                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.5, delay: i * 0.1 }}
                                className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-emerald-200 transition-all duration-300 group">
                                <div className="p-3 inline-flex rounded-2xl mb-4 bg-gradient-to-br from-emerald-600 to-green-500 text-white group-hover:scale-110 transition-transform">
                                    <s.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">{s.title}</h3>
                                <p className="text-gray-500 text-sm leading-relaxed">{s.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══ GALERIE ══════════════════════════════════ */}
            <section className="py-4 bg-gray-50 px-4 sm:px-6">
                <div className="container mx-auto max-w-6xl grid grid-cols-3 gap-4 h-56">
                    {IMAGES.gallery.map((src, i) => (
                        <motion.div key={i}
                            initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                            className={`rounded-2xl overflow-hidden ${i === 1 ? 'col-span-2' : ''}`}>
                            <Img src={src} alt={`Bien ${i + 1}`} className="w-full h-full" />
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ══ AVANTAGES ════════════════════════════════ */}
            <section className="py-20 bg-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="text-center mb-12">
                        <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-3">Vos Avantages</p>
                        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Pourquoi Déléguer la Gestion ?</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {benefits.map((b, i) => (
                            <motion.div key={i}
                                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }} transition={{ duration: 0.6, delay: i * 0.15 }}
                                className="text-center p-8 rounded-3xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100">
                                <div className="inline-flex p-5 rounded-full bg-emerald-600 text-white mb-5">
                                    <b.icon className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-3">{b.title}</h3>
                                <p className="text-gray-600 leading-relaxed text-sm">{b.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══ TARIFS ═══════════════════════════════════ */}
            <section id="tarifs" className="py-20 bg-gray-50">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="grid lg:grid-cols-5 gap-12 items-center">
                        {/* Image gauche */}
                        <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.7 }}
                            className="lg:col-span-2 hidden lg:block relative">
                            <Img src={IMAGES.pricing} alt="Nos tarifs" className="w-full h-[520px] rounded-3xl" />
                            <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-emerald-900/50 to-transparent" />
                            <div className="absolute bottom-6 left-6 right-6 bg-white/95 rounded-2xl p-5 shadow-xl">
                                <p className="font-bold text-gray-900 text-sm mb-1">Satisfaction garantie</p>
                                <p className="text-2xl font-bold text-emerald-600">98%</p>
                                <p className="text-xs text-gray-500">de propriétaires satisfaits</p>
                            </div>
                        </motion.div>

                        {/* Tarifs droite */}
                        <div className="lg:col-span-3">
                            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-3">Nos Tarifs</p>
                            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Une Offre Adaptée</h2>
                            <div className="h-1 w-12 bg-gradient-to-r from-emerald-600 to-green-400 rounded-full mb-8" />

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                                {pricing.map((plan, i) => (
                                    <motion.div key={i}
                                        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                                        className={`relative bg-white p-6 rounded-3xl border-2 transition-all hover:shadow-xl ${plan.featured ? 'border-emerald-500 shadow-lg scale-105' : 'border-gray-200 hover:border-emerald-300'}`}>
                                        {plan.featured && (
                                            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-4 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                                                Recommandé
                                            </div>
                                        )}
                                        <h3 className="font-bold text-gray-900 mb-2 text-sm">{plan.plan}</h3>
                                        <p className="text-3xl font-bold text-emerald-600 mb-0.5">{plan.price}</p>
                                        <p className="text-xs text-gray-500 mb-4">{plan.description}</p>
                                        <ul className="space-y-2 mb-6">
                                            {plan.features.map((f, j) => (
                                                <li key={j} className="flex items-start gap-2 text-xs text-gray-600">
                                                    <FaCheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                                    {f}
                                                </li>
                                            ))}
                                        </ul>
                                        <Link href="/altimmo#contact-altimmo" onClick={scrollToContact}
                                            className={`block w-full py-2.5 text-center font-semibold rounded-full text-sm transition-all ${plan.featured ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>
                                            Choisir
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ══ CTA ══════════════════════════════════════ */}
            <section className="py-20 relative overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-green-500 text-white">
                <div className="absolute inset-0">
                    <Img src={IMAGES.gallery[1]} alt="bg" className="w-full h-full opacity-10" />
                </div>
                <div className="container mx-auto px-4 sm:px-6 max-w-4xl text-center relative z-10">
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                        <FaBuilding className="w-14 h-14 mx-auto mb-6 text-white/90" />
                        <h2 className="text-3xl sm:text-5xl font-bold mb-4">Prêt à Confier Votre Bien ?</h2>
                        <p className="text-lg font-light mb-8 text-white/85 max-w-xl mx-auto">
                            Contactez-nous pour découvrir comment nous pouvons vous aider
                        </p>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                            <Link href="/altimmo#contact-altimmo" onClick={scrollToContact}
                                className="inline-flex items-center gap-3 px-8 py-4 bg-white text-emerald-600 font-semibold rounded-full shadow-2xl hover:shadow-white/30 transition-all">
                                <Sparkles className="w-5 h-5" /> Demander un Devis Gratuit
                            </Link>
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            <footer className="bg-gray-900 text-white py-8 border-t border-gray-800">
                <div className="container mx-auto px-4 text-center max-w-6xl">
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <FaHome className="w-5 h-5 text-emerald-400" />
                        <p className="text-2xl font-bold">Altimmo</p>
                    </div>
                    <p className="text-xs text-gray-400">
                        &copy; {new Date().getFullYear()} Tous droits réservés |{' '}
                        <Link href="/mentions-legales" className="hover:text-emerald-400 transition ml-1 underline underline-offset-2">Mentions Légales</Link>
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default LocationGestionPage;