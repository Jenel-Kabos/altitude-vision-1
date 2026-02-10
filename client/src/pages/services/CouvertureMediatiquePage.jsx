import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
    FaCamera, 
    FaVideo,
    FaMicrophone,
    FaImage,
    FaUsers,
    FaClock,
    FaCheckCircle,
    FaBroadcastTower,
    FaPhotoVideo
} from 'react-icons/fa';
import { ArrowLeft, Sparkles, Radio, Package, Star, Calendar, Send, X } from 'lucide-react';

const CouvertureMediatiquePage = () => {
    const [showQuoteModal, setShowQuoteModal] = useState(false);

    const services = [
        {
            icon: FaCamera,
            title: 'Reportage Photo HD/4K',
            description: 'Captation professionnelle avec équipement haut de gamme et retouches incluses'
        },
        {
            icon: FaVideo,
            title: 'Vidéo Multi-caméras',
            description: 'Production vidéo cinématique avec montage professionnel et post-production'
        },
        {
            icon: FaMicrophone,
            title: 'Interviews & Témoignages',
            description: 'Captation audio/vidéo d\'interviews avec prise de son professionnelle'
        },
        {
            icon: FaBroadcastTower,
            title: 'Live Streaming',
            description: 'Diffusion en direct sur vos réseaux sociaux avec multi-plateforme'
        },
        {
            icon: FaImage,
            title: 'Post-Production Rapide',
            description: 'Montage, étalonnage et optimisation sous 24-72h selon formule'
        },
        {
            icon: FaPhotoVideo,
            title: 'Content Kit Social Media',
            description: 'Formats optimisés pour Instagram, Facebook, LinkedIn et YouTube'
        }
    ];

    const eventTypes = [
        {
            title: 'Conférences & Séminaires',
            icon: FaUsers,
            description: 'Couverture complète de vos événements professionnels et académiques',
            examples: ['Forums économiques', 'Conférences de presse', 'Séminaires d\'entreprise', 'Ateliers de formation']
        },
        {
            title: 'Lancements de Produits',
            icon: Package,
            description: 'Immortalisez le lancement de vos nouveaux produits et services',
            examples: ['Événements de lancement', 'Démonstrations produits', 'Soirées de présentation', 'Showcases']
        },
        {
            title: 'Festivals & Concerts',
            icon: Radio,
            description: 'Captation dynamique de vos événements culturels et artistiques',
            examples: ['Festivals de musique', 'Concerts live', 'Spectacles', 'Événements culturels']
        },
        {
            title: 'Cérémonies & Galas',
            icon: Star,
            description: 'Couverture élégante de vos événements prestigieux',
            examples: ['Galas de charité', 'Remises de prix', 'Inaugurations', 'Anniversaires d\'entreprise']
        }
    ];

    const pricingPlans = [
        {
            name: 'Événement Simple',
            price: '600K',
            duration: 'Demi-journée (4h)',
            icon: FaCamera,
            features: [
                '1 photographe professionnel',
                '50-100 photos HD retouchées',
                'Droits d\'utilisation inclus',
                'Livraison sous 72h',
                'Galerie en ligne privée',
                'Support technique'
            ],
            popular: false
        },
        {
            name: 'Couverture Complète',
            price: '1.5M',
            duration: 'Journée complète (8h)',
            icon: FaPhotoVideo,
            features: [
                '1 photographe + 1 vidéaste',
                '150-250 photos HD',
                'Vidéo highlight 3-5 min',
                'Interviews vidéo',
                'Live streaming (optionnel)',
                'Livraison sous 48h',
                'Content kit réseaux sociaux',
                'Support prioritaire'
            ],
            popular: true
        },
        {
            name: 'Production Premium',
            price: 'Sur devis',
            duration: 'Multi-jours',
            icon: FaVideo,
            features: [
                'Équipe complète (2-3 personnes)',
                'Photos illimitées 4K',
                'Multi-caméras 4K',
                'Drone (si autorisé)',
                'Post-production avancée',
                'Diffusion en direct multi-plateforme',
                'Montage cinématique',
                'Livraison express 24h',
                'Chef de projet dédié'
            ],
            popular: false
        }
    ];

    const processSteps = [
        {
            number: '01',
            title: 'Préparation & Brief',
            description: 'Discussion détaillée de vos attentes, repérage des lieux et planification technique complète'
        },
        {
            number: '02',
            title: 'Couverture sur Place',
            description: 'Équipe professionnelle avec matériel haut de gamme pour capturer chaque moment important'
        },
        {
            number: '03',
            title: 'Captation Multi-supports',
            description: 'Photos HD/4K, vidéos, interviews et live streaming selon votre formule'
        },
        {
            number: '04',
            title: 'Post-Production',
            description: 'Montage vidéo, retouches photos, étalonnage et optimisation pour tous formats'
        },
        {
            number: '05',
            title: 'Livraison & Diffusion',
            description: 'Package média complet avec formats optimisés pour web et réseaux sociaux'
        }
    ];

    const deliverables = [
        {
            icon: FaCamera,
            title: 'Photos HD/4K',
            description: 'Galerie complète de 100-300 photos retouchées en haute résolution',
            formats: 'JPG, PNG, RAW (option)'
        },
        {
            icon: FaVideo,
            title: 'Vidéo Highlight',
            description: 'Montage dynamique de 2-5 minutes résumant les meilleurs moments',
            formats: 'MP4 Full HD/4K'
        },
        {
            icon: FaMicrophone,
            title: 'Interviews',
            description: 'Témoignages et déclarations des intervenants clés',
            formats: 'Vidéo HD + Audio'
        },
        {
            icon: FaImage,
            title: 'Content Kit',
            description: 'Formats optimisés pour Instagram, Facebook, LinkedIn, YouTube',
            formats: 'Stories, Posts, Reels'
        }
    ];

    const caseStudies = [
        {
            client: 'Forum Économique 2024',
            result: '2 jours • 650 photos • 3 vidéos',
            description: 'Couverture complète avec live streaming sur 3 plateformes simultanées',
            stats: { photos: '650+', videos: '3', views: '50K+' }
        },
        {
            client: 'Lancement TechStartup',
            result: 'Viral sur les réseaux',
            description: 'Reportage photo/vidéo ayant généré +100K vues en 48h',
            stats: { photos: '200', videos: '2', engagement: '+280%' }
        }
    ];

    const scrollToContact = (e) => {
        e.preventDefault();
        const contactSection = document.getElementById('contact-section');
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
            <section className="relative bg-gradient-to-br from-orange-600 via-amber-500 to-yellow-500 text-white py-20 sm:py-24 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent"></div>
                
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl relative z-10">
                    <Link 
                        to="/altcom" 
                        className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-8 transition-colors group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Retour à Altcom
                    </Link>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6 }}
                        className="inline-flex items-center justify-center gap-2 mb-6"
                    >
                        <div className="p-4 bg-white/15 backdrop-blur-md rounded-2xl border border-white/30">
                            <Radio className="w-8 h-8 text-white" />
                        </div>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1, duration: 0.7 }}
                        className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight"
                    >
                        Couverture Médiatique Professionnelle
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.7 }}
                        className="text-lg sm:text-xl font-light max-w-3xl text-white/90 leading-relaxed"
                    >
                        Organisation et couverture complète de vos événements avec reportage photo/vidéo professionnel, live streaming et diffusion multicanal. Immortalisez vos moments importants avec une qualité exceptionnelle.
                    </motion.p>
                </div>
            </section>

            {/* Services */}
            <section className="py-16 sm:py-20 bg-gradient-to-b from-white to-slate-50">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
                            Notre Expertise Média
                        </h2>
                        <div className="h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent w-32 mx-auto rounded-full"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {services.map((service, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.2 }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-orange-200 transition-all duration-300"
                            >
                                <div className="p-3 inline-flex rounded-2xl mb-4 bg-gradient-to-br from-orange-600 to-amber-500 text-white">
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

            {/* Types d'Événements */}
            <section className="py-16 sm:py-20 bg-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="text-center mb-12">
                        <p className="text-sm font-bold text-orange-600 uppercase tracking-wider mb-2">Types d'Événements</p>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
                            Nous Couvrons Tous Vos Événements
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {eventTypes.map((type, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: index * 0.15 }}
                                className="bg-gradient-to-br from-slate-50 to-orange-50 p-8 rounded-3xl border border-orange-100 hover:shadow-xl transition-all duration-300"
                            >
                                <div className="p-4 inline-flex rounded-2xl mb-4 bg-gradient-to-br from-orange-600 to-amber-500 text-white shadow-lg">
                                    <type.icon className="w-8 h-8" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                                    {type.title}
                                </h3>
                                <p className="text-gray-600 mb-4 leading-relaxed">
                                    {type.description}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {type.examples.map((example, i) => (
                                        <span key={i} className="px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-700 border border-gray-200">
                                            {example}
                                        </span>
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Livrables */}
            <section className="py-16 sm:py-20 bg-gradient-to-b from-slate-50 to-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="text-center mb-12">
                        <p className="text-sm font-bold text-orange-600 uppercase tracking-wider mb-2">Ce Que Vous Recevrez</p>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
                            Package Média Complet
                        </h2>
                        <p className="text-gray-500 text-lg font-light max-w-2xl mx-auto">
                            Tous les formats dont vous avez besoin, prêts à diffuser
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {deliverables.map((item, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: index * 0.1 }}
                                className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-orange-200 transition-all duration-300"
                            >
                                <div className="p-3 inline-flex rounded-2xl mb-4 bg-gradient-to-br from-orange-100 to-amber-100">
                                    <item.icon className="w-6 h-6 text-orange-600" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">
                                    {item.title}
                                </h3>
                                <p className="text-gray-600 text-sm mb-3 leading-relaxed">
                                    {item.description}
                                </p>
                                <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                                    {item.formats}
                                </span>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Processus */}
            <section className="py-16 sm:py-20 bg-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="text-center mb-12">
                        <p className="text-sm font-bold text-orange-600 uppercase tracking-wider mb-2">Notre Méthode</p>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
                            Un Processus Éprouvé en 5 Étapes
                        </h2>
                        <p className="text-gray-500 text-lg font-light max-w-2xl mx-auto">
                            De la préparation à la livraison, nous gérons chaque détail
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
                                className="relative bg-gradient-to-br from-white to-orange-50 p-6 rounded-3xl shadow-sm border border-orange-100 hover:shadow-lg transition-all duration-300"
                            >
                                <div className="flex items-start gap-6">
                                    <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-orange-600 to-amber-500 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
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

            {/* Tarifs */}
            <section className="py-16 sm:py-20 bg-gradient-to-b from-slate-50 to-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="text-center mb-12">
                        <p className="text-sm font-bold text-orange-600 uppercase tracking-wider mb-2">Nos Formules</p>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
                            Des Solutions Adaptées à Vos Besoins
                        </h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                        {pricingPlans.map((plan, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                                className={`bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all border-2 ${
                                    plan.popular ? 'border-orange-500 scale-105' : 'border-gray-100'
                                }`}
                            >
                                {plan.popular && (
                                    <div className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-orange-600 to-amber-500 text-white text-xs font-bold rounded-full mb-4">
                                        <Star className="w-3 h-3" />
                                        POPULAIRE
                                    </div>
                                )}
                                
                                <plan.icon className="w-10 h-10 text-orange-600 mb-4" />
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                                
                                <p className="text-sm text-gray-500 mb-4 flex items-center gap-2">
                                    <FaClock className="w-4 h-4" />
                                    {plan.duration}
                                </p>
                                
                                <div className="mb-6">
                                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                                    {plan.price !== "Sur devis" && <span className="text-gray-500 ml-2">FCFA</span>}
                                </div>

                                <ul className="space-y-3 mb-8">
                                    {plan.features.map((feature, i) => (
                                        <li key={i} className="flex items-start gap-2 text-gray-600 text-sm">
                                            <FaCheckCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    onClick={() => setShowQuoteModal(true)}
                                    className={`w-full py-3 rounded-xl font-semibold transition-all ${
                                        plan.popular
                                            ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white hover:shadow-xl'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    Demander un Devis
                                </button>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Cas d'Études */}
            <section className="py-16 sm:py-20 bg-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
                            Nos Succès
                        </h2>
                        <p className="text-gray-600 text-lg">
                            Des résultats concrets pour nos clients
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        {caseStudies.map((study, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, scale: 0.95 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                                className="bg-gradient-to-br from-gray-50 to-orange-50 rounded-3xl p-8 shadow-lg border border-orange-100 hover:shadow-2xl transition-all"
                            >
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                                            {study.client}
                                        </h3>
                                        <p className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent">
                                            {study.result}
                                        </p>
                                    </div>
                                    <Sparkles className="w-8 h-8 text-orange-500" />
                                </div>

                                <p className="text-gray-600 mb-4">{study.description}</p>

                                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                                    {Object.entries(study.stats).map(([key, value], i) => (
                                        <div key={i} className="text-center">
                                            <p className="text-2xl font-bold text-gray-900">{value}</p>
                                            <p className="text-xs text-gray-500 capitalize">{key}</p>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section id="contact-section" className="py-16 sm:py-20 bg-gradient-to-br from-orange-600 via-amber-500 to-yellow-500 text-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-5xl text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7 }}
                    >
                        <Radio className="w-16 h-16 mx-auto mb-6 text-white/90" />
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                            Prêt à Immortaliser Votre Événement ?
                        </h2>
                        <p className="text-lg sm:text-xl font-light mb-8 max-w-2xl mx-auto text-white/90">
                            Discutons de votre projet et créons ensemble des souvenirs mémorables
                        </p>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <button
                                onClick={() => setShowQuoteModal(true)}
                                className="inline-flex items-center gap-3 px-8 py-4 bg-white text-orange-600 font-semibold text-base rounded-full shadow-2xl hover:bg-gray-50 transition-all duration-300"
                            >
                                <Calendar className="w-5 h-5" />
                                Réserver une Consultation Gratuite
                            </button>
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            {/* Modal de Devis */}
            <AnimatePresence>
                {showQuoteModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto"
                        >
                            <button
                                onClick={() => setShowQuoteModal(false)}
                                className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 hover:bg-red-100 hover:text-red-600 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-600 to-amber-500 shadow-lg">
                                    <Radio className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">Demander un Devis</h3>
                                    <p className="text-sm text-gray-500">Couverture Médiatique</p>
                                </div>
                            </div>

                            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg mb-6">
                                <p className="text-sm text-blue-800">
                                    <strong>Réponse sous 24h :</strong> Notre équipe vous contactera rapidement pour discuter de votre événement.
                                </p>
                            </div>

                            <form className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Nom Complet <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                                            placeholder="Jean Dupont"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Email <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            required
                                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                                            placeholder="jean@exemple.com"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Téléphone <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        required
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                                        placeholder="+242 06 123 45 67"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Type d'Événement <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        required
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                                    >
                                        <option value="">Sélectionnez un type</option>
                                        <option value="conference">Conférence & Séminaire</option>
                                        <option value="lancement">Lancement de Produit</option>
                                        <option value="festival">Festival & Concert</option>
                                        <option value="ceremonie">Cérémonie & Gala</option>
                                        <option value="autre">Autre</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Date de l'Événement <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Durée Estimée <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            required
                                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                                        >
                                            <option value="half-day">Demi-journée (4h)</option>
                                            <option value="full-day">Journée complète (8h)</option>
                                            <option value="multi-day">Plusieurs jours</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Budget Estimé
                                    </label>
                                    <select className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition">
                                        <option value="">Préférez ne pas préciser</option>
                                        <option value="<500K">Moins de 500K FCFA</option>
                                        <option value="500K-1M">500K - 1M FCFA</option>
                                        <option value="1M-2M">1M - 2M FCFA</option>
                                        <option value=">2M">Plus de 2M FCFA</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Détails de l'Événement <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        required
                                        rows="4"
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition resize-y"
                                        placeholder="Décrivez votre événement, le nombre de participants attendus, vos besoins spécifiques..."
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold shadow-lg bg-gradient-to-r from-orange-600 to-amber-500 text-white hover:shadow-xl transition-all hover:scale-[1.02]"
                                >
                                    <Send className="w-5 h-5" />
                                    Envoyer la Demande
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Footer */}
            <footer className="bg-gray-900 text-white py-8 border-t border-gray-800">
                <div className="container mx-auto px-4 sm:px-6 text-center max-w-6xl">
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <Radio className="w-5 h-5 text-orange-400" />
                        <p className="text-2xl font-bold text-white">Altcom</p>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-400">
                        &copy; {new Date().getFullYear()} Tous droits réservés | 
                        <Link to="/mentions-legales" className="text-gray-400 hover:text-orange-400 transition duration-200 ml-2 underline underline-offset-2">
                            Mentions Légales
                        </Link>
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default CouvertureMediatiquePage;