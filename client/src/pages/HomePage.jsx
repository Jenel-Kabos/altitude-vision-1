import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    Building2,
    Calendar,
    Briefcase,
    MapPin,
    Phone,
    Mail,
} from 'lucide-react';

import HeroSlider      from "../components/HeroSlider";
import HomeSlider      from "../components/HomeSlider";
import CtaCommission   from "../components/CtaCommission";
import Testimonials    from "../components/Testimonials";
import FacebookFeed    from "../components/FacebookFeed";
import StatsCounter    from "../components/StatsCounter";
import WhyChooseUs     from "../components/WhyChooseUs";

import { getLatestPropertiesByPoles } from "../services/propertyService";
import { getAllEvents }                from "../services/eventService";
import { getAllPortfolioItems }        from "../services/portfolioService";

// ─────────────────────────────────────────────────────────────
// Données des pôles — palette Altitude-Vision
// ─────────────────────────────────────────────────────────────
const poles = [
    {
        id:          "Altimmo",
        name:        "Altimmo",
        route:       "/altimmo/annonces",
        pageroute:   "/altimmo",
        icon:        Building2,
        color:       "#2E7BB5",
        colorLight:  "rgba(46,123,181,0.12)",
        colorBorder: "rgba(46,123,181,0.25)",
        gradient:    "linear-gradient(135deg, #1A5A8A, #2E7BB5)",
        description: "Trouvez le bien idéal parmi notre sélection exclusive de propriétés à Brazzaville et sa région.",
        tag:         "Immobilier",
    },
    {
        id:          "MilaEvents",
        name:        "Mila Events",
        route:       "/mila-events/annonces",
        pageroute:   "/mila-events",
        icon:        Calendar,
        color:       "#D42B2B",
        colorLight:  "rgba(212,43,43,0.12)",
        colorBorder: "rgba(212,43,43,0.25)",
        gradient:    "linear-gradient(135deg, #A01E1E, #D42B2B)",
        description: "Mariages, galas, séminaires — nous concevons des expériences sur mesure qui marquent les esprits.",
        tag:         "Événementiel",
    },
    {
        id:          "Altcom",
        name:        "Altcom",
        route:       "/altcom/annonces",
        pageroute:   "/altcom",
        icon:        Briefcase,
        color:       "#C8872A",
        colorLight:  "rgba(200,135,42,0.12)",
        colorBorder: "rgba(200,135,42,0.25)",
        gradient:    "linear-gradient(135deg, #A0671A, #C8872A)",
        description: "Stratégie de communication, branding et visibilité digitale pour propulser votre image.",
        tag:         "Communication",
    },
];

// ─────────────────────────────────────────────────────────────
// Skeleton Loader — remplace le spinner plein écran
// ─────────────────────────────────────────────────────────────
const PageSkeleton = () => (
    <div className="min-h-screen bg-white animate-pulse">
        {/* Hero skeleton */}
        <div className="h-[75vh] min-h-[600px] bg-gray-200" />
        {/* Content skeleton */}
        <div className="container mx-auto px-6 py-20 max-w-6xl space-y-6">
            <div className="h-8 bg-gray-100 rounded-full w-1/3 mx-auto" />
            <div className="h-4 bg-gray-100 rounded-full w-2/3 mx-auto" />
            <div className="h-4 bg-gray-100 rounded-full w-1/2 mx-auto" />
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────
const HomePage = () => {
    const [latestProperties, setLatestProperties] = useState({});
    const [isLoading, setIsLoading]               = useState(true);
    const [activePole, setActivePole]             = useState(poles[0].id);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [propertiesResults, allEvents, allPortfolio] = await Promise.all([
                    getLatestPropertiesByPoles(["Altimmo"], 5),
                    getAllEvents(),
                    getAllPortfolioItems(),
                ]);

                const recentEvents = allEvents
                    .filter(e => e.status === 'Publié')
                    .slice(0, 5);

                const recentPortfolio = allPortfolio
                    .filter(item => item.isPublished)
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, 5);

                setLatestProperties({
                    Altimmo:    propertiesResults.Altimmo || [],
                    MilaEvents: recentEvents,
                    Altcom:     recentPortfolio,
                });
            } catch {
                setLatestProperties({});
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const activePoleItems = latestProperties[activePole] || [];
    const activePoleData  = poles.find(p => p.id === activePole);

    if (isLoading) return <PageSkeleton />;

    return (
        <div className="min-h-screen bg-white" style={{ fontFamily: "'Outfit', sans-serif" }}>

            {/* ══════════════════════════════════════════
                HERO
            ══════════════════════════════════════════ */}
            <header className="relative text-white pt-32 pb-24 overflow-hidden h-[75vh] min-h-[600px]">
                <HeroSlider />
            </header>

            {/* ══════════════════════════════════════════
                QUI SOMMES-NOUS — Layout asymétrique
            ══════════════════════════════════════════ */}
            <section className="py-20 sm:py-24 bg-white overflow-hidden">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">

                        {/* Colonne gauche — texte */}
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7 }}
                            className="mb-12 lg:mb-0"
                        >
                            <p className="text-xs font-bold uppercase tracking-widest mb-4"
                                style={{ color: '#C8872A' }}>
                                À propos
                            </p>
                            <h2 className="text-gray-900 mb-5"
                                style={{
                                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                                    fontSize:   'clamp(2rem, 4vw, 3.5rem)',
                                    fontWeight: 700,
                                    lineHeight: 1.1,
                                }}>
                                Qui sommes-nous ?
                            </h2>
                            <div className="h-0.5 w-16 rounded-full mb-6"
                                style={{ background: 'linear-gradient(to right, #C8872A, #2E7BB5)' }} />

                            <p className="text-gray-600 leading-relaxed mb-4 text-base sm:text-lg">
                                <span className="font-semibold text-gray-900">Altitude-Vision</span> est une agence multidisciplinaire basée à Brazzaville. Nos trois pôles d'expertise travaillent en{' '}
                                <span className="font-semibold text-gray-900">synergie</span> pour vous offrir visibilité et résultats concrets.
                            </p>
                            <p className="text-gray-500 leading-relaxed mb-8 text-sm sm:text-base">
                                Immobilier de prestige, événementiel haut de gamme ou stratégie de communication — une seule agence suffit pour tous vos projets.
                            </p>

                            {/* Infos contact rapide */}
                            <div className="space-y-2 mb-8">
                                {[
                                    { icon: MapPin, text: 'Brazzaville, République du Congo' },
                                    { icon: Phone,  text: '+242 06 800 21 51' },
                                    { icon: Mail,   text: 'contact@altitudevision.agency' },
                                ].map(({ icon: Icon, text }, i) => (
                                    <div key={i} className="flex items-center gap-3 text-sm text-gray-500">
                                        <Icon className="w-4 h-4 flex-shrink-0" style={{ color: '#C8872A' }} />
                                        {text}
                                    </div>
                                ))}
                            </div>

                            <Link
                                to="/contact"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white text-sm transition-all duration-300 hover:scale-105 hover:shadow-xl group"
                                style={{
                                    background: 'linear-gradient(135deg, #C8872A, #E5A84B)',
                                    boxShadow:  '0 4px 20px rgba(200,135,42,0.3)',
                                }}
                            >
                                Nous contacter
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </motion.div>

                        {/* Colonne droite — cards visuelles des 3 pôles */}
                        <motion.div
                            initial={{ opacity: 0, x: 30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7, delay: 0.1 }}
                            className="grid grid-cols-1 gap-4"
                        >
                            {poles.map((pole, i) => {
                                const Icon = pole.icon;
                                return (
                                    <motion.div
                                        key={pole.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
                                        className="flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 hover:shadow-md group"
                                        style={{
                                            backgroundColor: pole.colorLight,
                                            borderColor:     pole.colorBorder,
                                        }}
                                    >
                                        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                                            style={{ background: pole.gradient }}>
                                            <Icon className="w-6 h-6 text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-gray-900 text-sm">{pole.name}</p>
                                            <p className="text-xs text-gray-500 truncate">{pole.tag}</p>
                                        </div>
                                        <Link
                                            to={pole.pageroute}
                                            className="flex-shrink-0 text-xs font-semibold flex items-center gap-1 group-hover:gap-2 transition-all"
                                            style={{ color: pole.color }}
                                        >
                                            Voir <ArrowRight className="w-3 h-3" />
                                        </Link>
                                    </motion.div>
                                );
                            })}
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════
                CHIFFRES CLÉS
            ══════════════════════════════════════════ */}
            <StatsCounter />

            {/* ══════════════════════════════════════════
                NOS PÔLES D'EXCELLENCE
            ══════════════════════════════════════════ */}
            <section id="nos-poles" className="py-16 sm:py-20 bg-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">

                    {/* En-tête */}
                    <motion.div
                        className="text-center mb-12"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <p className="text-xs font-bold uppercase tracking-widest mb-3"
                            style={{ color: '#C8872A' }}>
                            Notre Expertise
                        </p>
                        <h2 className="text-gray-900 mb-3"
                            style={{
                                fontFamily: "'Cormorant Garamond', Georgia, serif",
                                fontSize:   'clamp(2rem, 4vw, 3.2rem)',
                                fontWeight: 700,
                                lineHeight: 1.1,
                            }}>
                            Nos Pôles d'Excellence
                        </h2>
                        <p className="text-gray-500 text-base max-w-xl mx-auto">
                            Trois domaines d'expertise pour répondre à tous vos besoins
                        </p>
                    </motion.div>

                    {/* Cards immersives */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {poles.map((pole, index) => {
                            const Icon = pole.icon;
                            return (
                                <motion.div
                                    key={pole.id}
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, amount: 0.2 }}
                                    transition={{ duration: 0.5, delay: index * 0.1 }}
                                    whileHover={{ y: -6 }}
                                    className="group relative rounded-3xl overflow-hidden border transition-all duration-500 hover:shadow-2xl"
                                    style={{ borderColor: pole.colorBorder }}
                                >
                                    {/* Fond coloré dégradé */}
                                    <div
                                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                        style={{ background: `${pole.colorLight}` }}
                                    />

                                    <div className="relative p-7">
                                        {/* Tag */}
                                        <span
                                            className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4"
                                            style={{
                                                backgroundColor: pole.colorLight,
                                                color:           pole.color,
                                                border:          `1px solid ${pole.colorBorder}`,
                                            }}
                                        >
                                            {pole.tag}
                                        </span>

                                        {/* Icône */}
                                        <div
                                            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110 shadow-lg"
                                            style={{ background: pole.gradient }}
                                        >
                                            <Icon className="w-7 h-7 text-white" />
                                        </div>

                                        {/* Titre */}
                                        <h3
                                            className="text-gray-900 font-bold mb-3 text-xl transition-colors duration-300"
                                            style={{ fontFamily: "'Outfit', sans-serif" }}
                                        >
                                            {pole.name}
                                        </h3>

                                        {/* Description */}
                                        <p className="text-gray-500 text-sm leading-relaxed mb-6">
                                            {pole.description}
                                        </p>

                                        {/* Ligne décorative */}
                                        <div
                                            className="h-px mb-5 rounded-full"
                                            style={{ backgroundColor: pole.colorBorder }}
                                        />

                                        {/* CTA */}
                                        <Link
                                            to={pole.pageroute}
                                            className="inline-flex items-center gap-2 text-sm font-semibold transition-all duration-300 group-hover:gap-3"
                                            style={{ color: pole.color }}
                                        >
                                            Découvrir
                                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </Link>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════
                NOS DERNIÈRES ANNONCES
            ══════════════════════════════════════════ */}
            <section className="py-16 sm:py-20 bg-gradient-to-b from-slate-50 to-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">

                    {/* En-tête */}
                    <motion.div
                        className="text-center mb-12"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <p className="text-xs font-bold uppercase tracking-widest mb-3"
                            style={{ color: '#C8872A' }}>
                            Notre Sélection
                        </p>
                        <h2 className="text-gray-900 mb-3"
                            style={{
                                fontFamily: "'Cormorant Garamond', Georgia, serif",
                                fontSize:   'clamp(2rem, 4vw, 3.2rem)',
                                fontWeight: 700,
                                lineHeight: 1.1,
                            }}>
                            Nos Dernières Annonces
                        </h2>
                        <div className="h-0.5 w-16 mx-auto rounded-full"
                            style={{ background: 'linear-gradient(to right, #C8872A, #2E7BB5)' }} />
                    </motion.div>

                    {/* Onglets — couleurs du logo */}
                    <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-10">
                        {poles.map((pole) => {
                            const Icon    = pole.icon;
                            const isActive = activePole === pole.id;
                            return (
                                <motion.button
                                    key={pole.id}
                                    onClick={() => setActivePole(pole.id)}
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full transition-all duration-300 border"
                                    style={{
                                        background:   isActive ? pole.gradient : 'white',
                                        color:        isActive ? 'white' : pole.color,
                                        borderColor:  isActive ? 'transparent' : pole.colorBorder,
                                        boxShadow:    isActive ? `0 4px 20px ${pole.color}40` : 'none',
                                    }}
                                    aria-pressed={isActive}
                                >
                                    <Icon className="w-4 h-4" />
                                    {pole.name}
                                </motion.button>
                            );
                        })}
                    </div>

                    {/* Contenu onglet actif */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activePole}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.35 }}
                        >
                            {/* Header section */}
                            <div className="flex items-center justify-between mb-6 px-1">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-1 h-6 rounded-full"
                                        style={{ backgroundColor: activePoleData?.color }}
                                    />
                                    <h3 className="text-xl font-bold text-gray-800">
                                        {activePoleData?.name}
                                    </h3>
                                </div>
                                <Link
                                    to={activePoleData?.route}
                                    className="inline-flex items-center gap-2 text-sm font-semibold transition-all group"
                                    style={{ color: activePoleData?.color }}
                                >
                                    Voir tout
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </Link>
                            </div>

                            {activePoleItems.length > 0 ? (
                                <HomeSlider
                                    properties={activePoleItems}
                                    isEvent={activePole === "MilaEvents"}
                                    isPortfolio={activePole === "Altcom"}
                                />
                            ) : (
                                <div
                                    className="text-center py-16 rounded-3xl border border-dashed"
                                    style={{ borderColor: activePoleData?.colorBorder, backgroundColor: activePoleData?.colorLight }}
                                >
                                    <div
                                        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md"
                                        style={{ background: activePoleData?.gradient }}
                                    >
                                        {activePoleData && <activePoleData.icon className="w-8 h-8 text-white" />}
                                    </div>
                                    <p className="font-bold text-gray-700 mb-1">Aucune annonce disponible</p>
                                    <p className="text-sm text-gray-500">
                                        Les nouvelles annonces pour {activePoleData?.name} arrivent bientôt
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </section>

            {/* ══════════════════════════════════════════
                POURQUOI NOUS CHOISIR
            ══════════════════════════════════════════ */}
            <WhyChooseUs />

            {/* ══════════════════════════════════════════
                FIL FACEBOOK
            ══════════════════════════════════════════ */}
            <FacebookFeed />

            {/* ══════════════════════════════════════════
                TÉMOIGNAGES
            ══════════════════════════════════════════ */}
            <Testimonials />

            {/* ══════════════════════════════════════════
                CTA COMMISSION
            ══════════════════════════════════════════ */}
            <section className="py-14 px-4 sm:px-6 bg-gradient-to-b from-slate-50 to-white">
                <div className="container mx-auto max-w-6xl">
                    <CtaCommission />
                </div>
            </section>
        </div>
    );
};

export default HomePage;