"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  Shield,
  Mail,
  Phone,
  MapPin,
  Lock,
  Eye,
  Database,
  Share2,
  Clock,
  UserCheck,
  Cookie,
  ChevronDown,
  Server,
} from 'lucide-react';

const sections = [
  {
    id: 'responsable',
    icon: Shield,
    title: 'Responsable du traitement',
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
            <a href="mailto:privacy@altitude-vision.com" className="hover:text-blue-600 transition">
              privacy@altitude-vision.com
            </a>
          </div>
          <div className="flex items-start gap-2">
            <Phone className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <span>+242 06 800 21 51</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'collecte',
    icon: Database,
    title: 'Données collectées',
    content: (
      <div className="space-y-4 text-gray-600">
        <p>Nous collectons uniquement les données nécessaires à la fourniture de nos services :</p>
        <div className="bg-slate-50 p-5 rounded-xl border border-gray-200 space-y-3">
          <div>
            <p className="font-medium text-gray-900">Données d'identification</p>
            <p className="text-sm mt-1">Nom, prénom, adresse email, numéro de téléphone</p>
          </div>
          <div>
            <p className="font-medium text-gray-900">Données de compte</p>
            <p className="text-sm mt-1">Identifiant, mot de passe chiffré (bcrypt), photo de profil</p>
          </div>
          <div>
            <p className="font-medium text-gray-900">Données de navigation</p>
            <p className="text-sm mt-1">Adresse IP, cookies analytiques (Google Analytics), pages visitées</p>
          </div>
          <div>
            <p className="font-medium text-gray-900">Données de service</p>
            <p className="text-sm mt-1">Annonces immobilières, demandes de visite, transactions, documents</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'finalites',
    icon: Eye,
    title: 'Finalités du traitement',
    content: (
      <div className="space-y-4 text-gray-600">
        <p>Vos données sont utilisées pour :</p>
        <ul className="space-y-3">
          {[
            'Créer et gérer votre compte utilisateur',
            'Traiter vos demandes de visite et transactions immobilières',
            'Vous envoyer des notifications relatives à vos dossiers',
            'Améliorer nos services via des statistiques anonymisées',
            'Respecter nos obligations légales et contractuelles',
            'Sécuriser notre plateforme contre les abus',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="text-blue-600 font-bold flex-shrink-0 mt-0.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: 'partage',
    icon: Share2,
    title: 'Partage des données',
    content: (
      <div className="space-y-4 text-gray-600">
        <p>Nous ne vendons jamais vos données. Elles peuvent être partagées avec :</p>
        <div className="space-y-3">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <p className="font-medium text-gray-900">Prestataires techniques</p>
            <p className="text-sm mt-1">Cloudinary (stockage images), Render (hébergement serveur), Netlify (hébergement site), MongoDB Atlas (base de données) — uniquement dans le cadre de la fourniture du service.</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <p className="font-medium text-gray-900">Autorités compétentes</p>
            <p className="text-sm mt-1">Sur réquisition judiciaire ou pour respecter une obligation légale.</p>
          </div>
        </div>
        <p className="text-sm font-medium">Aucun transfert à des tiers à des fins commerciales sans votre consentement explicite.</p>
      </div>
    ),
  },
  {
    id: 'conservation',
    icon: Clock,
    title: 'Durée de conservation',
    content: (
      <div className="space-y-4 text-gray-600">
        <div className="bg-slate-50 p-5 rounded-xl border border-gray-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-900">Données de compte</span>
            <span className="text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Durée du compte</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-900">Transactions</span>
            <span className="text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">5 ans (légal)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-900">Notifications lues</span>
            <span className="text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">90 jours</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-900">Logs de connexion</span>
            <span className="text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">12 mois</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-900">Cookies analytiques</span>
            <span className="text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">24 mois</span>
          </div>
        </div>
        <p>Après suppression de votre compte, vos données sont anonymisées ou effacées dans un délai de 30 jours, sauf obligation légale de conservation.</p>
      </div>
    ),
  },
  {
    id: 'droits',
    icon: UserCheck,
    title: 'Vos droits',
    content: (
      <div className="space-y-4 text-gray-600">
        <p>Conformément à la réglementation applicable, vous disposez des droits suivants :</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'Droit d\'accès', desc: 'Obtenir une copie de vos données' },
            { label: 'Droit de rectification', desc: 'Corriger des données inexactes' },
            { label: 'Droit à l\'effacement', desc: 'Demander la suppression de vos données' },
            { label: 'Droit d\'opposition', desc: 'Vous opposer à certains traitements' },
            { label: 'Droit à la portabilité', desc: 'Récupérer vos données dans un format lisible' },
            { label: 'Droit à la limitation', desc: 'Restreindre le traitement de vos données' },
          ].map((right) => (
            <div key={right.label} className="bg-slate-50 p-4 rounded-xl border border-gray-200">
              <p className="font-medium text-gray-900 text-sm">{right.label}</p>
              <p className="text-sm text-gray-500 mt-1">{right.desc}</p>
            </div>
          ))}
        </div>
        <p className="font-medium">
          Pour exercer vos droits :{' '}
          <a href="mailto:privacy@altitude-vision.com" className="text-blue-600 hover:underline">
            privacy@altitude-vision.com
          </a>
        </p>
      </div>
    ),
  },
  {
    id: 'securite',
    icon: Lock,
    title: 'Sécurité',
    content: (
      <div className="space-y-4 text-gray-600">
        <p>Nous mettons en œuvre des mesures techniques et organisationnelles pour protéger vos données :</p>
        <ul className="space-y-2">
          {[
            'Chiffrement des mots de passe (bcrypt)',
            'Authentification par jeton JWT à durée limitée',
            'Communications chiffrées HTTPS/TLS',
            'Accès aux données restreint aux personnels habilités',
            'Sauvegardes régulières et surveillance des accès',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="text-green-500 font-bold flex-shrink-0">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: 'cookies',
    icon: Cookie,
    title: 'Cookies',
    content: (
      <div className="space-y-4 text-gray-600" id="cookies">
        <p>Notre site utilise des cookies. Voici les types de cookies présents :</p>
        <div className="space-y-3">
          <div className="bg-slate-50 p-4 rounded-xl border border-gray-200">
            <p className="font-medium text-gray-900">Cookies essentiels</p>
            <p className="text-sm mt-1">Nécessaires au fonctionnement du site (session, sécurité). Ils ne peuvent pas être désactivés.</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-gray-200">
            <p className="font-medium text-gray-900">Cookies analytiques (Google Analytics)</p>
            <p className="text-sm mt-1">Nous permettent de mesurer l'audience et d'améliorer le site. Chargés uniquement avec votre consentement.</p>
          </div>
        </div>
        <p>Vous pouvez gérer vos préférences via la bannière de cookies affichée à votre première visite, ou dans les paramètres de votre navigateur.</p>
      </div>
    ),
  },
  {
    id: 'hebergement',
    icon: Server,
    title: 'Hébergement & sous-traitants',
    content: (
      <div className="space-y-3 text-gray-600">
        <div className="bg-slate-50 p-5 rounded-xl border border-gray-200 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-900">Netlify (frontend)</span>
            <span className="text-gray-500">netlify.com</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-900">Render (backend)</span>
            <span className="text-gray-500">render.com</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-900">MongoDB Atlas (BDD)</span>
            <span className="text-gray-500">mongodb.com</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-900">Cloudinary (médias)</span>
            <span className="text-gray-500">cloudinary.com</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-900">Google Analytics</span>
            <span className="text-gray-500">analytics.google.com</span>
          </div>
        </div>
        <p className="text-sm">Tous nos sous-traitants sont soumis à des engagements contractuels de confidentialité.</p>
      </div>
    ),
  },
  {
    id: 'modifications',
    icon: Eye,
    title: 'Modifications de la politique',
    content: (
      <div className="space-y-3 text-gray-600">
        <p>
          Nous pouvons mettre à jour cette politique de confidentialité à tout moment. En cas de modification
          substantielle, vous serez informé par email ou via une notification dans l'application.
        </p>
        <p>
          La date de dernière mise à jour est indiquée en haut de cette page. Nous vous encourageons à la
          consulter régulièrement.
        </p>
      </div>
    ),
  },
  {
    id: 'contact',
    icon: Mail,
    title: 'Contact & réclamations',
    content: (
      <div className="space-y-4 text-gray-600">
        <p>Pour toute question ou réclamation relative à la protection de vos données personnelles :</p>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <a href="mailto:privacy@altitude-vision.com" className="hover:text-blue-600 transition">
              privacy@altitude-vision.com
            </a>
          </div>
          <div className="flex items-start gap-2">
            <Phone className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <span>+242 06 800 21 51</span>
          </div>
        </div>
        <p className="text-sm">Nous répondons à toute demande dans un délai maximum de 30 jours.</p>
      </div>
    ),
  },
];

const AccordionSection = ({ section, index }) => {
  const [open, setOpen] = useState(false);
  const Icon = section.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
      className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
      id={section.id}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 p-6 sm:p-8 text-left"
      >
        <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl flex-shrink-0">
          <Icon className="w-6 h-6 text-blue-600" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex-1">{section.title}</h2>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-6 sm:px-8 pb-6 sm:pb-8 sm:pl-24">{section.content}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const PolitiqueConfidentialite = () => (
  <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
    {/* Hero */}
    <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white py-20">
      <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
        <Link
          href="/"
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
            Politique de confidentialité
          </h1>
          <p className="text-lg sm:text-xl text-white/90 max-w-2xl">
            Comment Altitude-Vision collecte, utilise et protège vos données personnelles
          </p>
        </motion.div>
      </div>
    </div>

    {/* Dernière mise à jour */}
    <div className="bg-white border-b">
      <div className="container mx-auto px-4 sm:px-6 max-w-4xl py-4">
        <p className="text-sm text-gray-500">
          Dernière mise à jour :{' '}
          {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>
    </div>

    {/* Contenu */}
    <div className="container mx-auto px-4 sm:px-6 max-w-4xl py-12 sm:py-16">
      <div className="space-y-4">
        {sections.map((section, index) => (
          <AccordionSection key={section.id} section={section} index={index} />
        ))}
      </div>

      {/* CTA contact */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mt-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-200"
      >
        <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Mail className="w-6 h-6 text-blue-600" />
          Une question sur vos données ?
        </h3>
        <p className="text-gray-600 mb-4">
          Notre équipe répond à toutes vos questions relatives à la protection de vos données personnelles
          dans un délai de 30 jours.
        </p>
        <a
          href="mailto:privacy@altitude-vision.com"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
        >
          <Mail className="w-5 h-5" />
          privacy@altitude-vision.com
        </a>
      </motion.div>
    </div>

    {/* Footer */}
    <footer className="bg-gray-900 text-white py-8 mt-16">
      <div className="container mx-auto px-4 sm:px-6 text-center max-w-4xl">
        <p className="text-2xl font-bold mb-2">Altitude-Vision</p>
        <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} Tous droits réservés</p>
      </div>
    </footer>
  </div>
);

export default PolitiqueConfidentialite;
