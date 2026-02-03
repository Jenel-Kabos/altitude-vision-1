import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
    FaHandshake, 
    FaHome,
    FaChartLine,
    FaSearch,
    FaCalculator,
    FaMapMarkedAlt,
    FaLightbulb,
    FaCheckCircle,
    FaShieldAlt
} from 'react-icons/fa';
import { ArrowLeft, Sparkles, TrendingUp, Target, Award } from 'lucide-react';

const ConseilInvestissementPage = () => {
    const services = [
        {
            icon: FaSearch,
            title: 'Analyse du Marché',
            description: 'Étude approfondie des tendances et opportunités du marché immobilier local'
        },
        {
            icon: FaMapMarkedAlt,
            title: 'Identification des Secteurs',
            description: 'Repérage des zones à fort potentiel de valorisation et de rendement'
        },
        {
            icon: FaCalculator,
            title: 'Calcul de Rentabilité',
            description: 'Simulation financière complète : ROI, cash-flow, fiscalité optimale'
        },
        {
            icon: FaLightbulb,
            title: 'Stratégie Personnalisée',
            description: 'Plan d\'investissement adapté à votre profil, budget et objectifs'
        },
        {
            icon: FaChartLine,
            title: 'Suivi de Performance',
            description: 'Monitoring continu de vos investissements et ajustements stratégiques'
        },
        {
            icon: FaShieldAlt,
            title: 'Sécurisation Juridique',
            description: 'Accompagnement légal et protection de vos intérêts lors de chaque transaction'
        }
    ];

    const investmentTypes = [
        {
            title: 'Investissement Locatif',
            icon: FaHome,
            description: 'Générez des revenus passifs réguliers avec un patrimoine durable',
            benefits: [
                'Revenus mensuels garantis',
                'Avantages fiscaux (Pinel, LMNP)',
                'Constitution d\'un patrimoine',
                'Protection contre l\'inflation'
            ]
        },
        {
            title: 'Valorisation Patrimoniale',
            icon: TrendingUp,
            description: 'Investissez dans des biens à fort potentiel de plus-value',
            benefits: [
                'Quartiers en développement',
                'Rénovation et revente',
                'Diversification du portefeuille',
                'Optimisation fiscale'
            ]
        },
        {
            title: 'Investissement Institutionnel',
            icon: Award,
            description: 'Solutions pour les investisseurs professionnels et fonds',
            benefits: [
                'Gestion de portefeuille',
                'Volumes importants',
                'Expertise technique',
                'Reporting détaillé'
            ]
        }
    ];

    const processSteps = [
        {
            number: '01',
            title: 'Analyse de Votre Profil',
            description: 'Compréhension de vos objectifs, budget, horizon d\'investissement et appétence au risque'
        },
        {
            number: '02',
            title: 'Proposition de Stratégie',
            description: 'Présentation d\'un plan d\'investissement personnalisé avec simulations financières'
        },
        {
            number: '03',
            title: 'Sélection des Biens',
            description: 'Identification et visite des opportunités correspondant à votre stratégie'
        },
        {
            number: '04',
            title: 'Accompagnement Achat',
            description: 'Négociation, montage financier et accompagnement jusqu\'à la signature'
        },
        {
            number: '05',
            title: 'Suivi Long Terme',
            description: 'Monitoring de la performance et conseils pour optimiser votre patrimoine'
        }
    ];

    const scrollToContact = (e) => {
        e.preventDefault();
        const contactSection = document.getElementById('contact-altimmo');
        if (contactSection) {
            contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div className="min-h-screen bg-white font-sans">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
                .font-sans { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
            `}</style>

            {/* Hero Section */}
            <section className="relative bg-gradient-to-br from-indigo-600 via-violet-500 to-purple-500 text-white py-20 sm:py-24 overflow-hidden">
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
                            <FaHandshake className="w-8 h-8 text-white" />
                        </div>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1, duration: 0.7 }}
                        className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight"
                    >
                        Conseil en Investissement Immobilier
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.7 }}
                        className="text-lg sm:text-xl font-light max-w-3xl text-white/90 leading-relaxed"
                    >
                        Bénéficiez de notre expertise du marché local pour réaliser des investissements immobiliers judicieux et performants. Construisez votre patrimoine avec confiance.
                    </motion.p>
                </div>
            </section>

            {/* Services */}
            <section className="py-16 sm:py-20 bg-gradient-to-b from-white to-slate-50">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
                            Notre Expertise à Votre Service
                        </h2>
                        <div className="h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent w-32 mx-auto rounded-full"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {services.map((service, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.2 }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-indigo-200 transition-all duration-300"
                            >
                                <div className="p-3 inline-flex rounded-2xl mb-4 bg-gradient-to-br from-indigo-600 to-violet-500 text-white">
                                    <service.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">
                                    {service.title}
                                </h3>
                                <p className="text-gray-600 text-sm leading-relaxed">
                                    {service.description}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Types d'Investissement */}
            <section className="py-16 sm:py-20 bg-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="text-center mb-12">
                        <p className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-2">Stratégies d'Investissement</p>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
                            Trouvez Votre Voie vers la Réussite
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {investmentTypes.map((type, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: index * 0.15 }}
                                className="bg-gradient-to-br from-slate-50 to-indigo-50 p-8 rounded-3xl border border-indigo-100 hover:shadow-xl transition-all duration-300"
                            >
                                <div className="p-4 inline-flex rounded-2xl mb-4 bg-gradient-to-br from-indigo-600 to-violet-500 text-white shadow-lg">
                                    <type.icon className="w-8 h-8" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                                    {type.title}
                                </h3>
                                <p className="text-gray-600 mb-6 leading-relaxed">
                                    {type.description}
                                </p>
                                <ul className="space-y-2">
                                    {type.benefits.map((benefit, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                                            <FaCheckCircle className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                                            {benefit}
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Processus */}
            <section className="py-16 sm:py-20 bg-gradient-to-b from-slate-50 to-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="text-center mb-12">
                        <p className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-2">Notre Méthode</p>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
                            Un Accompagnement en 5 Étapes
                        </h2>
                        <p className="text-gray-500 text-lg font-light max-w-2xl mx-auto">
                            De l'analyse à la concrétisation, nous vous guidons vers le succès
                        </p>
                    </div>

                    <div className="max-w-4xl mx-auto space-y-6">
                        {processSteps.map((step, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, amount: 0.2 }}
                                transition={{ duration: 0.6, delay: index * 0.1 }}
                                className="relative bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-indigo-200 transition-all duration-300"
                            >
                                <div className="flex items-start gap-6">
                                    <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-indigo-600 to-violet-500 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                                        {step.number}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                                            {step.title}
                                        </h3>
                                        <p className="text-gray-600 leading-relaxed">
                                            {step.description}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="py-16 sm:py-20 bg-gradient-to-br from-indigo-600 via-violet-500 to-purple-500 text-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                        >
                            <div className="text-5xl font-bold mb-2">15+</div>
                            <div className="text-lg text-white/80">Années d'Expérience</div>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                        >
                            <div className="text-5xl font-bold mb-2">500+</div>
                            <div className="text-lg text-white/80">Investissements Réalisés</div>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                        >
                            <div className="text-5xl font-bold mb-2">98%</div>
                            <div className="text-lg text-white/80">Clients Satisfaits</div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-16 sm:py-20 bg-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-5xl text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7 }}
                    >
                        <Target className="w-16 h-16 mx-auto mb-6 text-indigo-600" />
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                            Prêt à Investir Intelligemment ?
                        </h2>
                        <p className="text-lg sm:text-xl font-light text-gray-600 mb-8 max-w-2xl mx-auto">
                            Rencontrons-nous pour discuter de vos projets et élaborer votre stratégie patrimoniale
                        </p>
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <Link
                                to="/altimmo#contact-altimmo"
                                onClick={scrollToContact}
                                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-violet-500 text-white font-semibold text-base rounded-full shadow-2xl hover:shadow-indigo-500/50 transition-all duration-300"
                            >
                                <Sparkles className="w-5 h-5" />
                                Demander une Consultation Gratuite
                            </Link>
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-900 text-white py-8 border-t border-gray-800">
                <div className="container mx-auto px-4 sm:px-6 text-center max-w-6xl">
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <FaHome className="w-5 h-5 text-indigo-400" />
                        <p className="text-2xl font-bold text-white">Altimmo</p>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-400">
                        &copy; {new Date().getFullYear()} Tous droits réservés | 
                        <Link to="/mentions-legales" className="text-gray-400 hover:text-indigo-400 transition duration-200 ml-2 underline underline-offset-2">
                            Mentions Légales
                        </Link>
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default ConseilInvestissementPage;