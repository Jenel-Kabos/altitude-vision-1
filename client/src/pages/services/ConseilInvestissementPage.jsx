import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    FaHandshake, FaHome, FaChartLine,
    FaSearch, FaCalculator, FaMapMarkedAlt,
    FaLightbulb, FaCheckCircle, FaShieldAlt
} from 'react-icons/fa';
import { ArrowLeft, Sparkles, TrendingUp, Target, Award } from 'lucide-react';

const IMAGES = {
    hero:    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1400&q=85',
    about:   'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&q=80',
    process: 'https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=800&q=80',
    gallery: [
        'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&q=80',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
        'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80',
    ],
};

const Img = ({ src, alt, className = '' }) => {
    const [loaded, setLoaded] = useState(false);
    return (
        <div className={`relative overflow-hidden bg-gray-100 ${className}`}>
            {!loaded && <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />}
            <img src={src} alt={alt} loading="lazy" onLoad={() => setLoaded(true)}
                className={`w-full h-full object-cover transition-all duration-700 ${loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`} />
        </div>
    );
};

const ConseilInvestissementPage = () => {
    const services = [
        { icon: FaSearch,      title: 'Analyse du Marché',        description: 'Étude approfondie des tendances et opportunités du marché immobilier local' },
        { icon: FaMapMarkedAlt,title: 'Identification des Secteurs', description: 'Repérage des zones à fort potentiel de valorisation et de rendement' },
        { icon: FaCalculator,  title: 'Calcul de Rentabilité',    description: 'Simulation financière complète : ROI, cash-flow, fiscalité optimale' },
        { icon: FaLightbulb,   title: 'Stratégie Personnalisée',  description: "Plan d'investissement adapté à votre profil, budget et objectifs" },
        { icon: FaChartLine,   title: 'Suivi de Performance',     description: 'Monitoring continu de vos investissements et ajustements stratégiques' },
        { icon: FaShieldAlt,   title: 'Sécurisation Juridique',   description: 'Accompagnement légal et protection de vos intérêts lors de chaque transaction' },
    ];

    const investmentTypes = [
        {
            title: 'Investissement Locatif', icon: FaHome,
            description: 'Générez des revenus passifs réguliers avec un patrimoine durable',
            benefits: ['Revenus mensuels garantis', 'Avantages fiscaux (Pinel, LMNP)', "Constitution d'un patrimoine", "Protection contre l'inflation"],
        },
        {
            title: 'Valorisation Patrimoniale', icon: TrendingUp,
            description: 'Investissez dans des biens à fort potentiel de plus-value',
            benefits: ['Quartiers en développement', 'Rénovation et revente', 'Diversification du portefeuille', 'Optimisation fiscale'],
        },
        {
            title: 'Investissement Institutionnel', icon: Award,
            description: 'Solutions pour les investisseurs professionnels et fonds',
            benefits: ['Gestion de portefeuille', 'Volumes importants', 'Expertise technique', 'Reporting détaillé'],
        },
    ];

    const processSteps = [
        { number: '01', title: 'Analyse de Votre Profil',   description: "Compréhension de vos objectifs, budget, horizon d'investissement et appétence au risque" },
        { number: '02', title: 'Proposition de Stratégie',  description: "Présentation d'un plan d'investissement personnalisé avec simulations financières" },
        { number: '03', title: 'Sélection des Biens',       description: 'Identification et visite des opportunités correspondant à votre stratégie' },
        { number: '04', title: 'Accompagnement Achat',      description: "Négociation, montage financier et accompagnement jusqu'à la signature" },
        { number: '05', title: 'Suivi Long Terme',          description: 'Monitoring de la performance et conseils pour optimiser votre patrimoine' },
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
                    <Img src={IMAGES.hero} alt="Investissement immobilier" className="w-full h-full" />
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/92 via-violet-800/78 to-transparent" />
                </div>

                <div className="container mx-auto px-4 sm:px-6 max-w-6xl relative z-10 py-24">
                    <Link to="/altimmo" className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-10 transition-colors group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Retour à Altimmo
                    </Link>

                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex mb-6 p-4 bg-white/15 backdrop-blur-md rounded-2xl border border-white/30">
                        <FaHandshake className="w-8 h-8 text-white" />
                    </motion.div>

                    <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1, duration: 0.7 }}
                        className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight max-w-2xl">
                        Conseil en Investissement Immobilier
                    </motion.h1>

                    <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.7 }}
                        className="text-lg sm:text-xl font-light text-white/85 max-w-xl leading-relaxed mb-10">
                        Bénéficiez de notre expertise pour réaliser des investissements immobiliers judicieux et performants. Construisez votre patrimoine avec confiance.
                    </motion.p>

                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }} className="flex flex-wrap gap-4">
                        <Link to="/altimmo#contact-altimmo" onClick={scrollToContact}
                            className="inline-flex items-center gap-2 px-7 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-full transition-all hover:scale-105 shadow-xl">
                            <Sparkles className="w-4 h-4" /> Consultation gratuite
                        </Link>
                        <a href="#stratégies"
                            className="inline-flex items-center gap-2 px-7 py-3.5 bg-white/15 hover:bg-white/25 text-white font-semibold rounded-full border border-white/25 backdrop-blur-sm transition-all">
                            Nos stratégies →
                        </a>
                    </motion.div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 bg-white/10 backdrop-blur-md border-t border-white/10">
                    <div className="container mx-auto px-4 max-w-6xl grid grid-cols-3 divide-x divide-white/20">
                        {[['500+', 'Investissements réalisés'], ['15+', "Années d'expérience"], ['98%', 'Clients satisfaits']].map(([v, l]) => (
                            <div key={l} className="py-4 text-center text-white">
                                <p className="text-2xl font-bold">{v}</p>
                                <p className="text-xs text-white/60 mt-0.5">{l}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══ NOTRE EXPERTISE — image + texte ══════════ */}
            <section className="py-20 bg-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="grid lg:grid-cols-2 gap-16 items-center mb-16">
                        <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.7 }} className="relative">
                            <Img src={IMAGES.about} alt="Conseil investissement" className="w-full h-96 rounded-3xl" />
                            <div className="absolute -bottom-6 -right-6 bg-white rounded-2xl shadow-xl p-5 border border-gray-100">
                                <p className="text-3xl font-bold text-indigo-600">8%</p>
                                <p className="text-xs text-gray-500 mt-0.5">Rendement moyen obtenu</p>
                            </div>
                            <div className="absolute -top-4 -left-4 w-20 h-20 rounded-2xl bg-indigo-600/10 border border-indigo-200" />
                        </motion.div>

                        <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.1 }}>
                            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-3">Notre expertise</p>
                            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 leading-tight">
                                Notre Expertise à Votre Service
                            </h2>
                            <div className="h-1 w-12 bg-gradient-to-r from-indigo-600 to-violet-400 rounded-full mb-6" />
                            <p className="text-gray-600 leading-relaxed mb-8">
                                Notre équipe de consultants expérimentés analyse le marché pour vous guider vers les meilleures opportunités d'investissement, en accord avec vos objectifs patrimoniaux.
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                {services.map((s, i) => (
                                    <motion.div key={i}
                                        initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                                        className="flex items-start gap-3 p-4 rounded-2xl bg-indigo-50 border border-indigo-100 hover:border-indigo-300 transition-all">
                                        <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
                                            <s.icon className="w-4 h-4 text-white" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm">{s.title}</p>
                                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{s.description}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
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
                            className={`rounded-2xl overflow-hidden ${i === 0 ? 'col-span-2' : ''}`}>
                            <Img src={src} alt={`Investissement ${i + 1}`} className="w-full h-full" />
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ══ STRATÉGIES ═══════════════════════════════ */}
            <section id="stratégies" className="py-20 bg-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="text-center mb-12">
                        <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-3">Stratégies d'Investissement</p>
                        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Trouvez Votre Voie</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {investmentTypes.map((t, i) => (
                            <motion.div key={i}
                                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }} transition={{ duration: 0.6, delay: i * 0.15 }}
                                className="bg-gradient-to-br from-slate-50 to-indigo-50 p-8 rounded-3xl border border-indigo-100 hover:shadow-xl transition-all duration-300 group">
                                <div className="p-4 inline-flex rounded-2xl mb-4 bg-gradient-to-br from-indigo-600 to-violet-500 text-white shadow-lg group-hover:scale-110 transition-transform">
                                    <t.icon className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-3">{t.title}</h3>
                                <p className="text-gray-600 mb-6 leading-relaxed text-sm">{t.description}</p>
                                <ul className="space-y-2">
                                    {t.benefits.map((b, j) => (
                                        <li key={j} className="flex items-center gap-2 text-sm text-gray-700">
                                            <FaCheckCircle className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                                            {b}
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══ PROCESSUS — timeline + image ═════════════ */}
            <section className="py-20 bg-gray-50">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-3">Notre Méthode</p>
                            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 leading-tight">
                                Un Accompagnement en 5 Étapes
                            </h2>
                            <div className="h-1 w-12 bg-gradient-to-r from-indigo-600 to-violet-400 rounded-full mb-8" />
                            <div className="space-y-4">
                                {processSteps.map((step, i) => (
                                    <motion.div key={i}
                                        initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                                        className="flex items-start gap-5 p-5 rounded-2xl bg-white border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all">
                                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-violet-500 rounded-2xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md">
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
                            <Img src={IMAGES.process} alt="Processus investissement" className="w-full h-[520px] rounded-3xl" />
                            <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-indigo-900/50 to-transparent" />
                            <div className="absolute bottom-6 left-6 right-6 bg-white/95 rounded-2xl p-5 shadow-xl">
                                <p className="font-bold text-gray-900 text-sm mb-1">Première consultation</p>
                                <p className="text-2xl font-bold text-indigo-600">100% Gratuite</p>
                                <p className="text-xs text-gray-500 mt-1">Sans engagement, sans frais cachés</p>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ══ STATS ════════════════════════════════════ */}
            <section className="py-16 relative overflow-hidden bg-gradient-to-br from-indigo-700 via-violet-600 to-purple-500 text-white">
                <div className="absolute inset-0">
                    <Img src={IMAGES.gallery[2]} alt="bg" className="w-full h-full opacity-10" />
                </div>
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                        {[['15+', "Années d'Expérience"], ['500+', 'Investissements Réalisés'], ['98%', 'Clients Satisfaits']].map(([v, l], i) => (
                            <motion.div key={i}
                                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }} transition={{ duration: 0.6, delay: i * 0.1 }}>
                                <div className="text-5xl font-bold mb-2">{v}</div>
                                <div className="text-white/75">{l}</div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══ CTA ══════════════════════════════════════ */}
            <section className="py-20 bg-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-5xl text-center">
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                        <Target className="w-14 h-14 mx-auto mb-6 text-indigo-600" />
                        <h2 className="text-3xl sm:text-5xl font-bold text-gray-900 mb-4">Prêt à Investir Intelligemment ?</h2>
                        <p className="text-lg font-light text-gray-600 mb-8 max-w-xl mx-auto">
                            Rencontrons-nous pour discuter de vos projets et élaborer votre stratégie patrimoniale
                        </p>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Link to="/altimmo#contact-altimmo" onClick={scrollToContact}
                                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-violet-500 text-white font-semibold rounded-full shadow-2xl hover:shadow-indigo-500/40 transition-all">
                                <Sparkles className="w-5 h-5" /> Demander une Consultation Gratuite
                            </Link>
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            <footer className="bg-gray-900 text-white py-8 border-t border-gray-800">
                <div className="container mx-auto px-4 text-center max-w-6xl">
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <FaHome className="w-5 h-5 text-indigo-400" />
                        <p className="text-2xl font-bold">Altimmo</p>
                    </div>
                    <p className="text-xs text-gray-400">
                        &copy; {new Date().getFullYear()} Tous droits réservés |{' '}
                        <Link to="/mentions-legales" className="hover:text-indigo-400 transition ml-1 underline underline-offset-2">Mentions Légales</Link>
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default ConseilInvestissementPage;