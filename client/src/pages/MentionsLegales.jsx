// src/pages/MentionsLegales.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
    ArrowLeft, 
    Building2, 
    Mail, 
    Phone, 
    MapPin,
    Shield,
    Scale,
    FileText,
    Eye,
    Lock,
    Server
} from 'lucide-react';

const MentionsLegales = () => {
    const sections = [
        {
            id: 'editeur',
            icon: Building2,
            title: 'Éditeur du site',
            content: (
                <div className="space-y-3 text-gray-600">
                    <p className="font-semibold text-gray-900">Altitude-Vision</p>
                    <p>Société d'expertise multidisciplinaire</p>
                    <div className="space-y-2 pt-2">
                        <div className="flex items-start gap-2">
                            <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <span>Brazzaville, République du Congo</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <a href="mailto:contact@altitude-vision.com" className="hover:text-blue-600 transition">
                                contact@altitude-vision.com
                            </a>
                        </div>
                        <div className="flex items-start gap-2">
                            <Phone className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <span>+242 06 800 21 51</span>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'directeur',
            icon: Shield,
            title: 'Directeur de la publication',
            content: (
                <div className="space-y-2 text-gray-600">
                    <p>Le directeur de la publication est le représentant légal de la société Altitude-Vision.</p>
                </div>
            )
        },
        {
            id: 'hebergement',
            icon: Server,
            title: 'Hébergement',
            content: (
                <div className="space-y-3 text-gray-600">
                    <p className="font-semibold text-gray-900">Informations sur l'hébergeur</p>
                    <p>Ce site est hébergé par :</p>
                    <div className="bg-slate-50 p-4 rounded-xl border border-gray-200">
                        <p className="font-medium text-gray-900">[Nom de l'hébergeur]</p>
                        <p className="text-sm">Adresse : [Adresse complète]</p>
                        <p className="text-sm">Contact : [Email ou téléphone]</p>
                    </div>
                </div>
            )
        },
        {
            id: 'propriete',
            icon: FileText,
            title: 'Propriété intellectuelle',
            content: (
                <div className="space-y-4 text-gray-600">
                    <p>
                        L'ensemble du contenu de ce site (textes, images, vidéos, logos, graphismes, icônes) 
                        est la propriété exclusive d'Altitude-Vision, sauf mention contraire.
                    </p>
                    <p>
                        Toute reproduction, représentation, modification, publication ou adaptation de tout 
                        ou partie des éléments du site, quel que soit le moyen ou le procédé utilisé, est 
                        interdite sans autorisation écrite préalable d'Altitude-Vision.
                    </p>
                    <p className="font-medium text-gray-900">
                        Toute exploitation non autorisée du site ou de l'un des éléments qu'il contient sera 
                        considérée comme constitutive d'une contrefaçon et poursuivie conformément aux 
                        dispositions légales en vigueur.
                    </p>
                </div>
            )
        },
        {
            id: 'donnees',
            icon: Lock,
            title: 'Protection des données personnelles',
            content: (
                <div className="space-y-4 text-gray-600">
                    <p>
                        Conformément à la réglementation en vigueur sur la protection des données personnelles, 
                        vous disposez d'un droit d'accès, de rectification, de suppression et d'opposition aux 
                        données vous concernant.
                    </p>
                    <div className="bg-blue-50 p-5 rounded-xl border border-blue-200">
                        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Eye className="w-5 h-5 text-blue-600" />
                            Données collectées
                        </h4>
                        <ul className="space-y-2 text-sm">
                            <li className="flex items-start gap-2">
                                <span className="text-blue-600 font-bold">•</span>
                                <span>Nom, prénom, adresse email (formulaires de contact)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-600 font-bold">•</span>
                                <span>Données de navigation (cookies, adresse IP)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-600 font-bold">•</span>
                                <span>Informations relatives aux demandes de services</span>
                            </li>
                        </ul>
                    </div>
                    <p>
                        Ces données sont utilisées uniquement dans le cadre de nos services et ne sont jamais 
                        transmises à des tiers sans votre consentement explicite.
                    </p>
                    <p className="font-medium">
                        Pour exercer vos droits, contactez-nous à : 
                        <a href="mailto:privacy@altitude-vision.com" className="text-blue-600 hover:underline ml-1">
                            privacy@altitude-vision.com
                        </a>
                    </p>
                </div>
            )
        },
        {
            id: 'cookies',
            icon: Eye,
            title: 'Cookies',
            content: (
                <div className="space-y-4 text-gray-600">
                    <p>
                        Ce site utilise des cookies pour améliorer votre expérience de navigation et analyser 
                        l'utilisation du site.
                    </p>
                    <div className="bg-slate-50 p-5 rounded-xl border border-gray-200">
                        <h4 className="font-semibold text-gray-900 mb-3">Types de cookies utilisés :</h4>
                        <ul className="space-y-3">
                            <li>
                                <span className="font-medium text-gray-900">Cookies essentiels :</span> 
                                <span className="text-sm ml-2">Nécessaires au fonctionnement du site</span>
                            </li>
                            <li>
                                <span className="font-medium text-gray-900">Cookies analytiques :</span> 
                                <span className="text-sm ml-2">Pour mesurer l'audience et améliorer les performances</span>
                            </li>
                            <li>
                                <span className="font-medium text-gray-900">Cookies de préférences :</span> 
                                <span className="text-sm ml-2">Pour mémoriser vos choix et personnaliser votre expérience</span>
                            </li>
                        </ul>
                    </div>
                    <p>
                        Vous pouvez à tout moment désactiver les cookies dans les paramètres de votre navigateur. 
                        Notez que cela peut affecter certaines fonctionnalités du site.
                    </p>
                </div>
            )
        },
        {
            id: 'responsabilite',
            icon: Scale,
            title: 'Limitation de responsabilité',
            content: (
                <div className="space-y-4 text-gray-600">
                    <p>
                        Altitude-Vision met tout en œuvre pour offrir aux utilisateurs des informations fiables 
                        et actualisées. Toutefois, des erreurs ou omissions peuvent survenir.
                    </p>
                    <p>
                        L'utilisateur reconnaît utiliser ces informations sous sa responsabilité exclusive. 
                        Altitude-Vision ne saurait être tenue responsable de tout dommage direct ou indirect 
                        résultant de l'utilisation du site.
                    </p>
                    <div className="bg-amber-50 p-5 rounded-xl border border-amber-200">
                        <p className="font-medium text-gray-900 mb-2">⚠️ Exclusions de responsabilité :</p>
                        <ul className="space-y-2 text-sm">
                            <li>• Interruptions ou dysfonctionnements techniques</li>
                            <li>• Virus ou programmes malveillants</li>
                            <li>• Erreurs ou inexactitudes dans les contenus</li>
                            <li>• Dommages résultant de l'utilisation ou de l'impossibilité d'utiliser le site</li>
                        </ul>
                    </div>
                </div>
            )
        },
        {
            id: 'liens',
            icon: FileText,
            title: 'Liens hypertextes',
            content: (
                <div className="space-y-4 text-gray-600">
                    <p>
                        Le site peut contenir des liens vers des sites externes. Altitude-Vision n'exerce aucun 
                        contrôle sur ces sites et décline toute responsabilité quant à leur contenu.
                    </p>
                    <p>
                        La création de liens hypertextes vers le site d'Altitude-Vision nécessite une autorisation 
                        préalable écrite. Pour toute demande, contactez-nous.
                    </p>
                </div>
            )
        },
        {
            id: 'droit',
            icon: Scale,
            title: 'Droit applicable',
            content: (
                <div className="space-y-3 text-gray-600">
                    <p>
                        Les présentes mentions légales sont régies par le droit congolais. En cas de litige, 
                        et après tentative de recherche d'une solution amiable, les tribunaux de Brazzaville 
                        seront seuls compétents.
                    </p>
                </div>
            )
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            {/* Hero Header */}
            <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white py-20">
                <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
                    <Link 
                        to="/"
                        className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-8 transition group"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        Retour à l'accueil
                    </Link>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4">
                            Mentions Légales
                        </h1>
                        <p className="text-lg sm:text-xl text-white/90 max-w-2xl">
                            Informations légales et conditions d'utilisation du site Altitude-Vision
                        </p>
                    </motion.div>
                </div>
            </div>

            {/* Dernière mise à jour */}
            <div className="bg-white border-b">
                <div className="container mx-auto px-4 sm:px-6 max-w-4xl py-4">
                    <p className="text-sm text-gray-500">
                        Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                        })}
                    </p>
                </div>
            </div>

            {/* Contenu principal */}
            <div className="container mx-auto px-4 sm:px-6 max-w-4xl py-12 sm:py-16">
                <div className="space-y-8">
                    {sections.map((section, index) => (
                        <motion.section
                            key={section.id}
                            id={section.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.1 }}
                            transition={{ duration: 0.5, delay: index * 0.05 }}
                            className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8 hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-start gap-4 mb-4">
                                <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
                                    <section.icon className="w-6 h-6 text-blue-600" />
                                </div>
                                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 flex-1">
                                    {section.title}
                                </h2>
                            </div>
                            <div className="pl-0 sm:pl-16">
                                {section.content}
                            </div>
                        </motion.section>
                    ))}
                </div>

                {/* Section Contact */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="mt-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-200"
                >
                    <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Mail className="w-6 h-6 text-blue-600" />
                        Besoin d'informations complémentaires ?
                    </h3>
                    <p className="text-gray-600 mb-4">
                        Pour toute question concernant ces mentions légales ou l'utilisation de vos données personnelles, 
                        n'hésitez pas à nous contacter.
                    </p>
                    <a 
                        href="mailto:contact@altitude-vision.com"
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
                    >
                        <Mail className="w-5 h-5" />
                        Nous contacter
                    </a>
                </motion.div>
            </div>

            {/* Footer simplifié */}
            <footer className="bg-gray-900 text-white py-8 mt-16">
                <div className="container mx-auto px-4 sm:px-6 text-center max-w-4xl">
                    <p className="text-2xl font-bold mb-2">Altitude-Vision</p>
                    <p className="text-sm text-gray-400">
                        &copy; {new Date().getFullYear()} Tous droits réservés
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default MentionsLegales;