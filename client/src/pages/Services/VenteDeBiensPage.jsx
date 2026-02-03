import React from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { 
    FaKey, 
    FaHome,
    FaChartLine,
    FaCamera,
    FaFileContract,
    FaHandshake,
    FaCheckCircle
} from 'react-icons/fa';
import { ArrowLeft, Sparkles, Users, Shield, TrendingUp } from 'lucide-react';

const VenteDeBiensPage = () => {
    const navigate = useNavigate();

    const advantages = [
        {
            icon: FaChartLine,
            title: 'Évaluation Précise',
            description: 'Analyse approfondie du marché pour déterminer le prix optimal de votre bien'
        },
        {
            icon: FaCamera,
            title: 'Mise en Valeur',
            description: 'Photos professionnelles et visites virtuelles pour attirer les acheteurs'
        },
        {
            icon: Users,
            title: 'Réseau Étendu',
            description: 'Accès à une large base d\'acheteurs qualifiés et motivés'
        },
        {
            icon: FaFileContract,
            title: 'Accompagnement Légal',
            description: 'Gestion complète des aspects administratifs et juridiques'
        },
        {
            icon: Shield,
            title: 'Sécurité Maximale',
            description: 'Vérification rigoureuse des acquéreurs et sécurisation des transactions'
        },
        {
            icon: TrendingUp,
            title: 'Vente Rapide',
            description: 'Stratégies éprouvées pour vendre dans les meilleurs délais'
        }
    ];

    const processSteps = [
        {
            number: '01',
            title: 'Estimation Gratuite',
            description: 'Nous évaluons votre bien gratuitement en tenant compte de tous les critères du marché'
        },
        {
            number: '02',
            title: 'Stratégie Marketing',
            description: 'Création d\'un plan de communication personnalisé pour maximiser la visibilité'
        },
        {
            number: '03',
            title: 'Visites & Négociation',
            description: 'Organisation des visites et négociation pour obtenir le meilleur prix'
        },
        {
            number: '04',
            title: 'Finalisation',
            description: 'Accompagnement jusqu\'à la signature chez le notaire et remise des clés'
        }
    ];

    // ✅ Fonction pour naviguer vers la page Altimmo et scroller vers le contact
    const handleContactClick = (e) => {
        e.preventDefault();
        
        // Naviguer vers la page Altimmo
        navigate('/altimmo');
        
        // Attendre que la page soit chargée puis scroller
        setTimeout(() => {
            const contactSection = document.getElementById('contact-altimmo');
            if (contactSection) {
                contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    };

    return (
        <div className="min-h-screen bg-white font-sans">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
                .font-sans { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
            `}</style>

            {/* Hero Section */}
            <section className="relative bg-gradient-to-br from-blue-600 via-blue-500 to-sky-500 text-white py-20 sm:py-24 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent"></div>
                
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl relative z-10">
                    <Link 
                        to="/altimmo" 
                        className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-8 transition-colors group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Retour à Altimmo
                    </Link>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6 }}
                        className="inline-flex items-center justify-center gap-2 mb-6"
                    >
                        <div className="p-4 bg-white/15 backdrop-blur-md rounded-2xl border border-white/30">
                            <FaKey className="w-8 h-8 text-white" />
                        </div>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1, duration: 0.7 }}
                        className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight"
                    >
                        Vente de Biens Immobiliers
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.7 }}
                        className="text-lg sm:text-xl font-light max-w-3xl text-white/90 leading-relaxed"
                    >
                        Nous vous accompagnons à chaque étape pour vendre votre propriété au meilleur prix et dans les meilleurs délais, avec une expertise reconnue et un service personnalisé.
                    </motion.p>
                </div>
            </section>

            {/* Avantages */}
            <section className="py-16 sm:py-20 bg-gradient-to-b from-white to-slate-50">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
                            Pourquoi Choisir Altimmo ?
                        </h2>
                        <div className="h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent w-32 mx-auto rounded-full"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {advantages.map((advantage, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.2 }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-blue-200 transition-all duration-300"
                            >
                                <div className="p-3 inline-flex rounded-2xl mb-4 bg-gradient-to-br from-blue-600 to-sky-500 text-white">
                                    <advantage.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">
                                    {advantage.title}
                                </h3>
                                <p className="text-gray-600 text-sm leading-relaxed">
                                    {advantage.description}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Processus */}
            <section className="py-16 sm:py-20 bg-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="text-center mb-12">
                        <p className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-2">Notre Méthode</p>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
                            Un Processus en 4 Étapes
                        </h2>
                        <p className="text-gray-500 text-lg font-light max-w-2xl mx-auto">
                            De l'évaluation à la signature, nous vous guidons pas à pas
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {processSteps.map((step, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, amount: 0.2 }}
                                transition={{ duration: 0.6, delay: index * 0.15 }}
                                className="relative bg-gradient-to-br from-slate-50 to-blue-50 p-8 rounded-3xl border border-blue-100"
                            >
                                <div className="absolute -top-4 -left-4 w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-500 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                                    {step.number}
                                </div>
                                <div className="ml-4">
                                    <h3 className="text-2xl font-bold text-gray-900 mb-3 mt-2">
                                        {step.title}
                                    </h3>
                                    <p className="text-gray-600 leading-relaxed">
                                        {step.description}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-16 sm:py-20 bg-gradient-to-br from-blue-600 via-blue-500 to-sky-500 text-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-5xl text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7 }}
                    >
                        <FaCheckCircle className="w-16 h-16 mx-auto mb-6 text-white/90" />
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                            Prêt à Vendre Votre Bien ?
                        </h2>
                        <p className="text-lg sm:text-xl font-light mb-8 max-w-2xl mx-auto text-white/90">
                            Contactez-nous dès aujourd'hui pour une estimation gratuite et sans engagement
                        </p>
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <a
                            href="#contact-altimmo"
                                onClick={handleContactClick}
                                className="inline-flex items-center gap-3 px-8 py-4 bg-white text-blue-600 font-semibold text-base rounded-full shadow-2xl hover:shadow-white/50 transition-all duration-300 cursor-pointer"
                            >
                                <Sparkles className="w-5 h-5" />
                                Demander une Estimation Gratuite
                            </a>
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
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

export default VenteDeBiensPage;