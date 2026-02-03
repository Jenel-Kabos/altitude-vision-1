import React, { useEffect, useState } from "react";
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
    Sparkles, 
    ArrowRight,
    Loader2 as IconSpinner,
    Building2,
    Calendar,
    Briefcase
} from 'lucide-react';
import HeroSlider from "../components/HeroSlider";
import HomeSlider from "../components/HomeSlider";
import CtaCommission from "../components/CtaCommission";
import { getLatestPropertiesByPoles } from "../services/propertyService";
import { getAllEvents } from "../services/eventService";
import { getAllPortfolioItems } from "../services/portfolioService";
import Slider from "react-slick";

const poles = [
    { 
        id: "Altimmo", 
        name: "Altimmo", 
        route: "/altimmo/annonces",
        icon: Building2,
        gradient: 'from-blue-600 to-sky-500',
        description: 'Immobilier de luxe'
    },
    { 
        id: "MilaEvents", 
        name: "Mila Events", 
        route: "/mila-events/annonces",
        icon: Calendar,
        gradient: 'from-emerald-600 to-green-500',
        description: 'Organisation d\'événements'
    },
    { 
        id: "Altcom", 
        name: "Altcom", 
        route: "/altcom/annonces",
        icon: Briefcase,
        gradient: 'from-indigo-600 to-violet-500',
        description: 'Communication digitale'
    }
];

const testimonials = [
    {
        name: "Jean K.",
        role: "Client Altimmo",
        message: "Grâce à Altitude-Vision, j'ai trouvé la maison de mes rêves à Brazzaville !",
        avatar: "/uploads/users/testimonial1.jpg",
    },
    {
        name: "Sophie M.",
        role: "Client MilaEvents",
        message: "Un service impeccable pour l'organisation de mon événement.",
        avatar: "/uploads/users/testimonial2.jpg",
    },
    {
        name: "Pierre L.",
        role: "Client Altcom",
        message: "L'équipe Altcom a boosté ma visibilité en ligne rapidement.",
        avatar: "/uploads/users/testimonial3.jpg",
    },
];

const HomePage = () => {
    const [latestProperties, setLatestProperties] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [activePole, setActivePole] = useState(poles[0].id);

    useEffect(() => {
        console.log("🚀 [HomePage] Composant monté - Début du chargement des données");

        const fetchData = async () => {
            try {
                console.log("📡 [HomePage] Appel API pour récupérer les données");

                const propertiesResults = await getLatestPropertiesByPoles(["Altimmo"], 5);
                const allEvents = await getAllEvents();
                const recentEvents = allEvents
                    .filter(event => event.status === 'Publié')
                    .slice(0, 5);

                const allPortfolio = await getAllPortfolioItems();
                const recentPortfolio = allPortfolio
                    .filter(item => item.isPublished)
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, 5);

                console.log("✅ [HomePage] Données récupérées:", {
                    properties: propertiesResults.Altimmo?.length || 0,
                    events: recentEvents.length,
                    portfolio: recentPortfolio.length
                });

                const combinedData = {
                    Altimmo: propertiesResults.Altimmo || [],
                    MilaEvents: recentEvents,
                    Altcom: recentPortfolio
                };

                console.log("📊 [HomePage] Données combinées:", {
                    Altimmo: combinedData.Altimmo.length,
                    MilaEvents: combinedData.MilaEvents.length,
                    Altcom: combinedData.Altcom.length
                });

                setLatestProperties(combinedData);
                setIsLoading(false);

            } catch (error) {
                console.error("❌ [HomePage] Erreur:", error);
                setLatestProperties({});
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    const testimonialSettings = {
        dots: true,
        infinite: true,
        speed: 700,
        slidesToShow: 1,
        slidesToScroll: 1,
        autoplay: true,
        autoplaySpeed: 4000,
        arrows: false,
        dotsClass: "slick-dots !bottom-6",
    };

    const activePoleItems = latestProperties[activePole] || [];
    const activePoleData = poles.find(p => p.id === activePole);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                <div className="text-center">
                    <IconSpinner className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-xl font-semibold text-gray-700">Chargement...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white font-sans">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
                .font-sans { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
                
                html { scroll-behavior: smooth; }
                
                @keyframes gradient-shift {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }
                
                .animate-gradient {
                    background-size: 200% 200%;
                    animation: gradient-shift 8s ease infinite;
                }

                .slick-dots li button:before {
                    color: white !important;
                    opacity: 0.5;
                }
                
                .slick-dots li.slick-active button:before {
                    color: white !important;
                    opacity: 1;
                }
            `}</style>

            {/* Header Hero Section */}
            <header className="relative text-white pt-32 pb-24 overflow-hidden h-[75vh] min-h-[600px]">
                <HeroSlider />
                
            </header>

            {/* Section Présentation */}
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
                                Qui sommes-nous ?
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
                        Altitude-Vision est une <span className="font-semibold text-gray-900">agence multidisciplinaire</span> basée à Brazzaville. Nos trois pôles d'expertise travaillent en <span className="font-semibold text-gray-900">synergie</span> pour vous offrir visibilité et résultats concrets dans l'immobilier, l'événementiel et la communication.
                    </motion.p>
                </div>
            </section>

            {/* Section Nos Pôles */}
            <section id="nos-poles" className="py-16 sm:py-20 bg-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="text-center mb-12 sm:mb-14">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                        >
                            <p className="text-xs sm:text-sm font-bold text-blue-600 uppercase tracking-wider mb-2">Notre Expertise</p>
                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
                                Nos Pôles d'Excellence
                            </h2>
                            <p className="text-gray-500 text-base sm:text-lg font-light max-w-2xl mx-auto">
                                Trois domaines d'expertise pour répondre à tous vos besoins
                            </p>
                        </motion.div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
                        {poles.map((pole, index) => (
                            <motion.div 
                                key={pole.id}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.2 }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                className="group bg-gradient-to-br from-white to-slate-50 p-6 sm:p-7 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-200 transition-all duration-500 hover:-translate-y-1"
                            >
                                <div className={`p-3 inline-flex rounded-2xl mb-4 bg-gradient-to-br ${pole.gradient} bg-opacity-10 group-hover:scale-110 transition-transform duration-300`}>
                                    <pole.icon className="w-7 h-7 text-white" />
                                </div>
                                
                                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                                    {pole.name}
                                </h3>
                                <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-4">
                                    {pole.description}
                                </p>
                                <Link 
                                    to={pole.route}
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

            {/* Section Annonces avec Onglets Modernes */}
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
                                Nos Dernières Annonces
                            </h2>
                            <div className="h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent w-24 mx-auto rounded-full"></div>
                        </motion.div>
                    </div>

                    {/* Onglets Modernes */}
                    <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-10">
                        {poles.map((pole) => (
                            <motion.button
                                key={pole.id}
                                onClick={() => setActivePole(pole.id)}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className={`
                                    flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-semibold rounded-full transition-all duration-300
                                    ${activePole === pole.id
                                        ? `bg-gradient-to-r ${pole.gradient} text-white shadow-lg`
                                        : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 hover:border-gray-300"
                                    }
                                `}
                            >
                                <pole.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                                {pole.name}
                            </motion.button>
                        ))}
                    </div>

                    {/* Contenu du pôle actif */}
                    <motion.div
                        key={activePole}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <div className="flex items-center justify-between mb-6 px-2">
                            <h3 className="text-xl sm:text-2xl font-bold text-gray-800">
                                {activePoleData?.name}
                            </h3>
                            
                            <Link
                                to={activePoleData?.route}
                                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold text-sm sm:text-base transition-colors group"
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
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-center py-16 bg-gradient-to-br from-slate-50 to-blue-50 rounded-3xl border border-dashed border-blue-200"
                            >
                                <div className="flex justify-center mb-4">
                                    <div className={`p-4 bg-gradient-to-br ${activePoleData?.gradient} bg-opacity-10 rounded-2xl shadow-md`}>
                                        <activePoleData.icon className="w-10 h-10 text-gray-600" />
                                    </div>
                                </div>
                                <p className="text-lg font-bold text-gray-700 mb-1">Aucune annonce disponible</p>
                                <p className="text-sm text-gray-500">Les nouvelles annonces pour {activePoleData?.name} seront bientôt disponibles</p>
                            </motion.div>
                        )}
                    </motion.div>
                </div>
            </section>

            {/* Section Témoignages */}
            <section className="py-16 sm:py-20 bg-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="text-center mb-12 sm:mb-14">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                        >
                            <p className="text-xs sm:text-sm font-bold text-blue-600 uppercase tracking-wider mb-2">Retours Clients</p>
                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
                                Ils Nous Font Confiance
                            </h2>
                            <div className="h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent w-24 mx-auto rounded-full"></div>
                        </motion.div>
                    </div>

                    <div className="max-w-3xl mx-auto">
                        <Slider {...testimonialSettings}>
                            {testimonials.map((t, index) => (
                                <div key={index} className="px-4 pb-12">
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        whileInView={{ opacity: 1, scale: 1 }}
                                        viewport={{ once: true }}
                                        className="bg-gradient-to-br from-white to-slate-50 p-8 sm:p-10 rounded-3xl shadow-lg border border-gray-100"
                                    >
                                        <div className="flex flex-col items-center text-center">
                                            <img
                                                src={t.avatar}
                                                alt={t.name}
                                                className="w-20 h-20 rounded-full mb-6 object-cover border-4 border-white shadow-xl"
                                            />
                                            <p className="text-gray-700 text-base sm:text-lg leading-relaxed mb-6 italic">
                                                "{t.message}"
                                            </p>
                                            <h4 className="text-xl font-bold text-gray-900">{t.name}</h4>
                                            <p className="text-sm text-gray-500 font-medium">{t.role}</p>
                                        </div>
                                    </motion.div>
                                </div>
                            ))}
                        </Slider>
                    </div>
                </div>
            </section>

            {/* Section CTA Commission */}
            <section className="py-14 px-4 sm:px-6 bg-gradient-to-b from-slate-50 to-white">
                <div className="container mx-auto max-w-6xl">
                    <CtaCommission />
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-900 text-white py-8 border-t border-gray-800">
                <div className="container mx-auto px-4 sm:px-6 text-center max-w-6xl">
                    <div className="flex items-center justify-center gap-2 mb-3">
                        
                        <p className="text-2xl font-bold text-white">Altitude-Vision</p>
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

export default HomePage;