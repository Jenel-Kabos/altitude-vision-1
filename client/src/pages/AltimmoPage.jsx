import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
    FaKey, 
    FaBuilding, 
    FaHandshake, 
    FaHome
} from 'react-icons/fa';
import { 
    Sparkles, 
    Loader2 as IconSpinner, 
    ArrowRight
} from 'lucide-react';

import HeroSlider from '../components/HeroSliderAlt'; 
import AltimmoContact from '../components/AltimmoContact'; 
import PropertyCard from '../components/PropertyCard';
import CtaCommission from '../components/CtaCommission';
import { getLatestPropertiesByPole } from '../services/propertyService';

const realEstateServices = [
    { 
        icon: FaKey, 
        title: 'Vente de Biens', 
        description: 'Nous vous accompagnons à chaque étape pour vendre votre propriété au meilleur prix et dans les meilleurs délais.',
        gradient: 'from-blue-600 to-sky-500', 
        iconColor: 'text-sky-500',
        slug: 'vente-de-biens' // ✅ Slug explicite
    },
    { 
        icon: FaBuilding, 
        title: 'Location & Gestion', 
        description: 'Confiez-nous la location et la gestion de vos biens pour une tranquillité d\'esprit et une rentabilité optimale.',
        gradient: 'from-emerald-600 to-green-500',
        iconColor: 'text-green-500',
        slug: 'location-gestion' // ✅ Slug explicite
    },
    { 
        icon: FaHandshake, 
        title: 'Conseil en Investissement', 
        description: 'Bénéficiez de notre expertise du marché local pour réaliser des investissements immobiliers judicieux et performants.',
        gradient: 'from-indigo-600 to-violet-500',
        iconColor: 'text-violet-500',
        slug: 'conseil-investissement' // ✅ Slug explicite
    },
];

const AltimmoPage = () => {
    const [properties, setProperties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const handleScrollToContact = (e) => {
        e.preventDefault();
        const contactSection = document.getElementById('contact-altimmo');
        if (contactSection) {
            contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    useEffect(() => {
        const fetchAltimmoProperties = async () => {
            try {
                setLoading(true);
                const result = await getLatestPropertiesByPole('Altimmo', 10);
                setProperties(result || []);
                setError(null);
            } catch (err) {
                console.error('Erreur lors de la récupération des propriétés Altimmo:', err);
                setError('Impossible de charger les annonces Altimmo. Veuillez réessayer plus tard.');
            } finally {
                setLoading(false);
            }
        };
        fetchAltimmoProperties();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                <div className="text-center">
                    <IconSpinner className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-xl font-semibold text-gray-700">Chargement des annonces...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white font-sans">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
                .font-sans { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
                
                /* Smooth scrolling */
                html { scroll-behavior: smooth; }
                
                /* Custom gradient animations */
                @keyframes gradient-shift {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }
                
                .animate-gradient {
                    background-size: 200% 200%;
                    animation: gradient-shift 8s ease infinite;
                }
            `}</style>

            {/* Header Hero Section - Design ultra-moderne */}
            <header className="relative text-white pt-32 pb-24 overflow-hidden h-[75vh] min-h-[600px]">
                <HeroSlider /> 
                
                {/* Overlay gradient subtil */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60 z-[1]"></div>
                
                <div className="container mx-auto px-4 sm:px-6 text-center relative z-10 max-w-6xl h-full flex flex-col justify-center">
                    
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6 }}
                        className="inline-flex items-center justify-center gap-2 mb-6 mx-auto"
                    >
                        <div className="p-3 bg-white/15 backdrop-blur-md rounded-2xl border border-white/30 shadow-xl">
                            <FaHome className="w-7 h-7 text-white" />
                        </div>
                    </motion.div>
                    
                    <motion.h1 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1, duration: 0.7 }}
                        className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight mb-5 leading-tight"
                    >
                        Immobilier de Luxe<br/>
                        <span className="bg-gradient-to-r from-blue-400 to-sky-300 bg-clip-text text-transparent">
                            & Conseil Expert
                        </span>
                    </motion.h1>
                    
                    <motion.p 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.7 }}
                        className="text-base sm:text-lg lg:text-xl font-light max-w-2xl mx-auto text-white/90 leading-relaxed"
                    >
                        Votre partenaire de confiance pour concrétiser vos ambitions immobilières avec élégance et sérénité
                    </motion.p>
                    
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.7 }}
                        className="mt-10 flex flex-wrap justify-center gap-3 sm:gap-4"
                    >
                        <Link
                            to="/altimmo/annonces"
                            className="group flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold text-sm sm:text-base rounded-full shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105"
                        >
                            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-12 transition-transform" />
                            Découvrir Nos Biens
                        </Link>
                        <a
                            href="#contact-altimmo"
                            onClick={handleScrollToContact}
                            className="flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 bg-white/15 backdrop-blur-md text-white font-semibold text-sm sm:text-base rounded-full border border-white/30 hover:bg-white/25 transition-all duration-300 hover:scale-105"
                        >
                            <FaHandshake className="w-4 h-4 sm:w-5 sm:h-5" />
                            Nous Contacter
                        </a>
                    </motion.div>
                </div>
            </header>
            
            {/* Section À Propos - Design minimaliste */}
            <section className="bg-gradient-to-b from-white to-slate-50 py-16 sm:py-20">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="text-center mb-10">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                        >
                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
                                L'Excellence au Service de Vos Projets
                            </h2>
                            <div className="h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent w-32 mx-auto rounded-full"></div>
                        </motion.div>
                    </div>
                    
                    <motion.p 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2, duration: 0.6 }}
                        className="max-w-3xl mx-auto text-gray-600 text-base sm:text-lg lg:text-xl leading-relaxed text-center"
                    >
                        Forts d'une connaissance approfondie du marché, nous offrons une approche personnalisée, alliant <span className="font-semibold text-gray-900">innovation</span>, <span className="font-semibold text-gray-900">expertise légale</span> et <span className="font-semibold text-gray-900">écoute attentive</span> pour garantir la réussite de chaque transaction immobilière.
                    </motion.p>
                </div>
            </section>

            {/* Section Services - Cards modernes */}
            <section className="py-16 sm:py-20 bg-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="text-center mb-12 sm:mb-14">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                        >
                            <p className="text-xs sm:text-sm font-bold text-blue-600 uppercase tracking-wider mb-2">Nos Engagements</p>
                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
                                Une Expertise Modélisée
                            </h2>
                            <p className="text-gray-500 text-base sm:text-lg font-light max-w-2xl mx-auto">
                                Chaque service est conçu pour maximiser votre rendement et simplifier votre expérience
                            </p>
                        </motion.div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
                        {realEstateServices.map((service, index) => (
                            <motion.div 
                                key={index}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.2 }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                className="group bg-gradient-to-br from-white to-slate-50 p-6 sm:p-7 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-200 transition-all duration-500 hover:-translate-y-1"
                            >
                                <div className={`p-3 inline-flex rounded-2xl mb-4 bg-gradient-to-br ${service.gradient} bg-opacity-10 group-hover:scale-110 transition-transform duration-300`}>
                                    <service.icon className="w-7 h-7 text-white" />
                                </div>
                                
                                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                                    {service.title}
                                </h3>
                                <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-4">
                                    {service.description}
                                </p>
                                <Link 
                                    to={`/altimmo/services/${service.slug}`}
                                    className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700 transition-all group-hover:gap-2"
                                >
                                    En savoir plus 
                                    <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Section Annonces - Grid moderne */}
            <section className="py-16 sm:py-20 bg-gradient-to-b from-slate-50 to-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="text-center mb-12 sm:mb-14">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                        >
                            <p className="text-xs sm:text-sm font-bold text-blue-600 uppercase tracking-wider mb-2">Notre Sélection</p>
                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                                Biens Immobiliers Récents
                            </h2>
                            <div className="h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent w-24 mx-auto rounded-full mb-5"></div>
                            <Link 
                                to="/altimmo/annonces" 
                                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold text-sm sm:text-base transition-colors group"
                            >
                                Voir toutes les annonces Altimmo
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </motion.div>
                    </div>
                    
                    {error && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-red-50 border-l-4 border-red-500 p-4 mb-8 rounded-xl max-w-2xl mx-auto"
                        >
                            <div className="flex items-center">
                                <span className="text-red-500 text-xl mr-3">⚠️</span>
                                <p className="text-red-700 font-medium text-sm">{error}</p>
                            </div>
                        </motion.div>
                    )}
                    
                    {properties.length === 0 && !error ? (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center py-16 bg-gradient-to-br from-slate-50 to-blue-50 rounded-3xl border border-dashed border-blue-200"
                        >
                            <div className="flex justify-center mb-4">
                                <div className="p-4 bg-blue-100 rounded-2xl shadow-md text-blue-600">
                                    <FaHome className="w-10 h-10" />
                                </div>
                            </div>
                            <p className="text-lg font-bold text-gray-700 mb-1">Aucune annonce disponible</p>
                            <p className="text-sm text-gray-500">Les nouvelles annonces seront bientôt disponibles</p>
                        </motion.div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                            {properties.map((property, index) => (
                                <motion.div 
                                    key={property._id}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, amount: 0.1 }}
                                    transition={{ duration: 0.4, delay: index * 0.05 }}
                                >
                                    <PropertyCard property={property} />
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* Section CTA Commission */}
            <section className="py-14 px-4 sm:px-6 bg-white">
                <div className="container mx-auto max-w-6xl">
                    <CtaCommission />
                </div>
            </section>
            
            {/* Composant de Contact */}
            <AltimmoContact />

            {/* Footer - Compact & élégant */}
            <footer className="bg-gray-900 text-white py-8 border-t border-gray-800">
                <div className="container mx-auto px-4 sm:px-6 text-center max-w-6xl">
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <FaHome className="w-5 h-5 text-blue-400" />
                        <p className="text-2xl font-bold text-white">Altimmo</p>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-400">
                        &copy; {new Date().getFullYear()} Tous droits réservés | 
                        <Link to="/mentions-legales" className="text-gray-400 hover:text-blue-400 transition duration-200 ml-2 underline underline-offset-2">
                            Mentions Légales
                        </Link>
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default AltimmoPage;