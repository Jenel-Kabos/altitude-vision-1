import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
    FaBuilding, 
    FaHome,
    FaUsers,
    FaTools,
    FaFileInvoiceDollar,
    FaShieldAlt,
    FaHeadset,
    FaCheckCircle
} from 'react-icons/fa';
import { ArrowLeft, Sparkles, Calendar, Clock, TrendingUp } from 'lucide-react';

const LocationGestionPage = () => {
    const services = [
        {
            icon: FaUsers,
            title: 'Recherche de Locataires',
            description: 'Sélection rigoureuse de locataires fiables avec vérification complète des dossiers'
        },
        {
            icon: FaFileInvoiceDollar,
            title: 'Gestion Financière',
            description: 'Encaissement des loyers, suivi des charges et gestion comptable complète'
        },
        {
            icon: FaTools,
            title: 'Maintenance & Entretien',
            description: 'Coordination des réparations et entretien régulier de votre propriété'
        },
        {
            icon: FaShieldAlt,
            title: 'Protection Juridique',
            description: 'Rédaction des baux, gestion des contentieux et protection de vos intérêts'
        },
        {
            icon: Calendar,
            title: 'État des Lieux',
            description: 'Réalisation professionnelle des états des lieux d\'entrée et de sortie'
        },
        {
            icon: FaHeadset,
            title: 'Support 24/7',
            description: 'Équipe disponible pour répondre aux urgences et aux demandes des locataires'
        }
    ];

    const benefits = [
        {
            icon: Clock,
            title: 'Gain de Temps',
            description: 'Déléguez toutes les tâches chronophages liées à la gestion locative'
        },
        {
            icon: TrendingUp,
            title: 'Rentabilité Optimale',
            description: 'Maximisez vos revenus locatifs grâce à notre expertise du marché'
        },
        {
            icon: FaShieldAlt,
            title: 'Sérénité Totale',
            description: 'Dormez tranquille, nous gérons tous les aspects de votre location'
        }
    ];

    const pricing = [
        {
            plan: 'Gestion Essentielle',
            price: '7%',
            description: 'du loyer mensuel HT',
            features: [
                'Recherche et sélection de locataires',
                'Rédaction du bail',
                'Encaissement des loyers',
                'États des lieux',
                'Rapport mensuel'
            ]
        },
        {
            plan: 'Gestion Premium',
            price: '10%',
            description: 'du loyer mensuel HT',
            featured: true,
            features: [
                'Tous les services Essentielle',
                'Gestion des travaux',
                'Suivi des charges',
                'Assurance loyers impayés',
                'Support prioritaire 24/7',
                'Optimisation fiscale'
            ]
        },
        {
            plan: 'Gestion sur Mesure',
            price: 'Sur devis',
            description: 'selon vos besoins',
            features: [
                'Solution personnalisée',
                'Gestion de portefeuille',
                'Conseiller dédié',
                'Services à la carte',
                'Reporting avancé'
            ]
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
            <section className="relative bg-gradient-to-br from-emerald-600 via-green-500 to-emerald-500 text-white py-20 sm:py-24 overflow-hidden">
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
                            <FaBuilding className="w-8 h-8 text-white" />
                        </div>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1, duration: 0.7 }}
                        className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight"
                    >
                        Location & Gestion Immobilière
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.7 }}
                        className="text-lg sm:text-xl font-light max-w-3xl text-white/90 leading-relaxed"
                    >
                        Confiez-nous la location et la gestion de vos biens pour une tranquillité d'esprit et une rentabilité optimale. Nous nous occupons de tout, de A à Z.
                    </motion.p>
                </div>
            </section>

            {/* Services */}
            <section className="py-16 sm:py-20 bg-gradient-to-b from-white to-slate-50">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
                            Nos Services de Gestion
                        </h2>
                        <div className="h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent w-32 mx-auto rounded-full"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {services.map((service, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.2 }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-emerald-200 transition-all duration-300"
                            >
                                <div className="p-3 inline-flex rounded-2xl mb-4 bg-gradient-to-br from-emerald-600 to-green-500 text-white">
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

            {/* Avantages */}
            <section className="py-16 sm:py-20 bg-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="text-center mb-12">
                        <p className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-2">Vos Avantages</p>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
                            Pourquoi Déléguer la Gestion ?
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {benefits.map((benefit, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: index * 0.15 }}
                                className="text-center"
                            >
                                <div className="inline-flex p-6 rounded-full bg-gradient-to-br from-emerald-100 to-green-50 mb-6">
                                    <benefit.icon className="w-12 h-12 text-emerald-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                                    {benefit.title}
                                </h3>
                                <p className="text-gray-600 leading-relaxed">
                                    {benefit.description}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Tarifs */}
            <section className="py-16 sm:py-20 bg-gradient-to-b from-slate-50 to-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="text-center mb-12">
                        <p className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-2">Nos Tarifs</p>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
                            Une Offre Adaptée à Chaque Besoin
                        </h2>
                        <p className="text-gray-500 text-lg font-light max-w-2xl mx-auto">
                            Choisissez la formule qui correspond à vos attentes
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {pricing.map((plan, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                className={`relative bg-white p-8 rounded-3xl border-2 transition-all duration-300 hover:shadow-xl ${
                                    plan.featured 
                                        ? 'border-emerald-500 shadow-lg scale-105' 
                                        : 'border-gray-200 hover:border-emerald-300'
                                }`}
                            >
                                {plan.featured && (
                                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-emerald-600 to-green-500 text-white px-6 py-1 rounded-full text-sm font-semibold">
                                        Recommandé
                                    </div>
                                )}
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                                    {plan.plan}
                                </h3>
                                <div className="mb-4">
                                    <span className="text-4xl font-bold text-emerald-600">{plan.price}</span>
                                    <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                                </div>
                                <ul className="space-y-3 mb-8">
                                    {plan.features.map((feature, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                            <FaCheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                                <Link
                                    to="/altimmo#contact-altimmo"
                                    onClick={scrollToContact}
                                    className={`block w-full py-3 text-center font-semibold rounded-full transition-all ${
                                        plan.featured
                                            ? 'bg-gradient-to-r from-emerald-600 to-green-500 text-white hover:shadow-lg'
                                            : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                                    }`}
                                >
                                    Choisir cette formule
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-16 sm:py-20 bg-gradient-to-br from-emerald-600 via-green-500 to-emerald-500 text-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-5xl text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7 }}
                    >
                        <FaBuilding className="w-16 h-16 mx-auto mb-6 text-white/90" />
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                            Prêt à Confier Votre Bien ?
                        </h2>
                        <p className="text-lg sm:text-xl font-light mb-8 max-w-2xl mx-auto text-white/90">
                            Contactez-nous pour discuter de vos besoins et découvrir comment nous pouvons vous aider
                        </p>
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <Link
                                to="/altimmo#contact-altimmo"
                                onClick={scrollToContact}
                                className="inline-flex items-center gap-3 px-8 py-4 bg-white text-emerald-600 font-semibold text-base rounded-full shadow-2xl hover:shadow-white/50 transition-all duration-300"
                            >
                                <Sparkles className="w-5 h-5" />
                                Demander un Devis Gratuit
                            </Link>
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-900 text-white py-8 border-t border-gray-800">
                <div className="container mx-auto px-4 sm:px-6 text-center max-w-6xl">
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <FaHome className="w-5 h-5 text-emerald-400" />
                        <p className="text-2xl font-bold text-white">Altimmo</p>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-400">
                        &copy; {new Date().getFullYear()} Tous droits réservés | 
                        <Link to="/mentions-legales" className="text-gray-400 hover:text-emerald-400 transition duration-200 ml-2 underline underline-offset-2">
                            Mentions Légales
                        </Link>
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default LocationGestionPage;