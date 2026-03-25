// src/pages/altcom/altcomData.js
import {
    MessageSquare, Layout, TrendingUp, Camera,
    Target, Sparkles,
    Search, Lightbulb, PenTool, Rocket, BarChart2,
    Palette, FileText, Monitor, Printer,
    Compass, ClipboardList, Users, TrendingDown,
    CalendarCheck, Video, ImageIcon, Share2,
} from 'lucide-react';

export const GOLD       = '#C8872A';
export const GOLD_DARK  = '#A06820';
export const GOLD_LIGHT = '#E5A84B';
export const BLUE       = '#2E7BB5';

export const SERVICES = [
    {
        _id:        '1',
        icon:       MessageSquare,
        title:      'Communication Digitale',
        stat:       'Web & Social',
        color:      GOLD,
        route:      '/altcom/communication-digitale',
        shortDesc:  'Création de contenus et campagnes sur mesure pour le web et les réseaux sociaux.',
        fullDesc:   "Nous concevons des stratégies de communication digitale adaptées à votre marque : gestion des réseaux sociaux, création de contenus engageants, campagnes email et bien plus. Notre équipe vous accompagne de la conception à l'exécution pour maximiser votre présence en ligne.",
        features:   [
            'Gestion des réseaux sociaux (Facebook, Instagram, LinkedIn…)',
            'Création de contenus visuels et rédactionnels',
            'Campagnes publicitaires digitales (Meta Ads, Google Ads)',
            'Analyse de performance et reporting mensuel',
        ],
        // Images Unsplash thématiques
        images: [
            'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&q=80', // social media
            'https://images.unsplash.com/photo-1586880244406-556ebe35f282?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // content creation
            'https://images.unsplash.com/photo-1611926653458-09294b3142bf?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // analytics
        ],
        // Processus de livraison
        process: [
            {
                step: 1,
                icon: Search,
                title: 'Audit & Diagnostic',
                desc: 'Analyse complète de votre présence digitale actuelle, de votre audience et de vos concurrents pour identifier les opportunités.',
                duration: '3–5 jours',
            },
            {
                step: 2,
                icon: Lightbulb,
                title: 'Stratégie de Contenu',
                desc: 'Définition de la ligne éditoriale, du calendrier de publication et des axes de communication adaptés à votre cible.',
                duration: '5–7 jours',
            },
            {
                step: 3,
                icon: PenTool,
                title: 'Création & Production',
                desc: 'Production des visuels, rédaction des textes et conception des campagnes selon la charte validée.',
                duration: 'En continu',
            },
            {
                step: 4,
                icon: Rocket,
                title: 'Publication & Diffusion',
                desc: 'Mise en ligne aux meilleurs créneaux horaires, gestion des interactions et suivi en temps réel.',
                duration: 'Hebdomadaire',
            },
            {
                step: 5,
                icon: BarChart2,
                title: 'Analyse & Optimisation',
                desc: 'Rapport mensuel détaillé avec KPIs, recommandations et ajustements de la stratégie selon les performances.',
                duration: 'Mensuel',
            },
        ],
    },
    {
        _id:        '2',
        icon:       Layout,
        title:      'Branding & Design',
        stat:       'Identité visuelle',
        color:      BLUE,
        route:      '/altcom/branding-design',
        shortDesc:  "Définition d'identité visuelle et supports graphiques professionnels.",
        fullDesc:   "Nous créons des identités visuelles fortes et cohérentes qui reflètent vos valeurs. Du logo à la charte graphique complète, en passant par les supports print et digitaux, nous donnons à votre marque une image professionnelle et mémorable.",
        features:   [
            'Création de logo et charte graphique',
            'Supports print : flyers, affiches, brochures',
            'Supports digitaux : bannières, visuels réseaux sociaux',
            'Design UI pour sites web et applications',
        ],
        images: [
            'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=800&q=80', // branding
            'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&q=80', // design tools
            'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800&q=80', // logo design
        ],
        process: [
            {
                step: 1,
                icon: Compass,
                title: 'Découverte & Brief',
                desc: "Session de travail approfondie pour cerner vos valeurs, votre cible, votre positionnement et vos inspirations.",
                duration: '1–2 jours',
            },
            {
                step: 2,
                icon: Search,
                title: 'Recherche & Moodboard',
                desc: "Exploration créative, benchmark concurrentiel et présentation de planches d'inspiration pour valider la direction artistique.",
                duration: '3–4 jours',
            },
            {
                step: 3,
                icon: Palette,
                title: 'Conception Graphique',
                desc: 'Création des premières propositions de logo, palette de couleurs, typographies et éléments graphiques distinctifs.',
                duration: '5–7 jours',
            },
            {
                step: 4,
                icon: FileText,
                title: 'Charte Graphique',
                desc: "Formalisation de l'identité dans un guide complet : règles d'utilisation, déclinaisons, interdits et exemples d'application.",
                duration: '3–5 jours',
            },
            {
                step: 5,
                icon: Printer,
                title: 'Déclinaison & Livraison',
                desc: 'Production de tous les supports demandés et livraison des fichiers dans tous les formats (print, web, vidéo).',
                duration: '5–10 jours',
            },
        ],
    },
    {
        _id:        '3',
        icon:       TrendingUp,
        title:      'Conseil & Stratégie',
        stat:       'Stratégie 360°',
        color:      GOLD,
        route:      '/altcom/conseil-strategie',
        shortDesc:  'Accompagnement stratégique pour optimiser votre communication.',
        fullDesc:   "Notre équipe de consultants vous accompagne dans la définition et l'exécution de votre stratégie de communication globale. Audit de l'existant, positionnement, plan de communication et suivi des résultats : nous vous guidons à chaque étape.",
        features:   [
            'Audit de communication et diagnostic',
            'Définition du positionnement et des messages clés',
            'Plan de communication annuel',
            'Formation et coaching des équipes internes',
        ],
        images: [
            'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80', // strategy meeting
            'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&q=80', // consulting
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80', // business
        ],
        process: [
            {
                step: 1,
                icon: ClipboardList,
                title: 'Audit 360°',
                desc: "État des lieux complet de votre communication actuelle : messages, canaux, audience, positionnement et résultats obtenus.",
                duration: '1 semaine',
            },
            {
                step: 2,
                icon: Target,
                title: 'Définition des Objectifs',
                desc: 'Co-construction d\'objectifs SMART et identification des indicateurs de performance clés pour mesurer le succès.',
                duration: '2–3 jours',
            },
            {
                step: 3,
                icon: Lightbulb,
                title: 'Plan Stratégique',
                desc: "Élaboration d'un plan d'action priorisé avec budgets, ressources, calendrier et responsabilités clairement définis.",
                duration: '1 semaine',
            },
            {
                step: 4,
                icon: Users,
                title: 'Formation des Équipes',
                desc: "Ateliers pratiques pour transférer les compétences et outiller vos équipes à l'exécution autonome de la stratégie.",
                duration: '2–5 jours',
            },
            {
                step: 5,
                icon: BarChart2,
                title: 'Suivi & Ajustements',
                desc: "Accompagnement continu avec points réguliers, mesure des KPIs et recalibrage de la stratégie selon les résultats.",
                duration: 'Mensuel',
            },
        ],
    },
    {
        _id:        '4',
        icon:       Camera,
        title:      'Couverture Médiatique',
        stat:       'Photo & Vidéo',
        color:      BLUE,
        route:      '/altcom/couverture-mediatique',
        shortDesc:  'Organisation et couverture complète de vos événements avec reportage photo/vidéo.',
        fullDesc:   "Nous assurons une couverture médiatique complète de vos événements : conférences, inaugurations, soirées corporate, lancements produits. Notre équipe photo/vidéo capture les moments clés et produit des contenus de qualité professionnelle.",
        features:   [
            'Reportage photo professionnel HD',
            'Captation et montage vidéo',
            'Live streaming et couverture temps réel',
            'Post-production et livraison rapide',
        ],
        images: [
            'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&q=80', // photography event
            'https://images.unsplash.com/photo-1598387993441-a364f854cfbd?w=800&q=80', // video production
            'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80', // event coverage
        ],
        process: [
            {
                step: 1,
                icon: CalendarCheck,
                title: 'Brief & Planification',
                desc: "Réunion de cadrage pour comprendre vos attentes, définir les moments clés à capturer et planifier la logistique.",
                duration: '1–2 jours avant',
            },
            {
                step: 2,
                icon: ImageIcon,
                title: 'Repérage & Préparation',
                desc: "Visite du lieu, test des équipements, coordination avec vos équipes et établissement du plan de tournage détaillé.",
                duration: 'Veille de l\'événement',
            },
            {
                step: 3,
                icon: Camera,
                title: 'Captation en Direct',
                desc: "Couverture complète de l'événement par notre équipe : photos, vidéos, interviews et contenu live pour les réseaux sociaux.",
                duration: 'Jour J',
            },
            {
                step: 4,
                icon: Video,
                title: 'Post-Production',
                desc: "Sélection, retouche et montage professionnel de l'ensemble des contenus capturés avec livraison express sous 48h.",
                duration: '24–72h après',
            },
            {
                step: 5,
                icon: Share2,
                title: 'Diffusion & Archivage',
                desc: "Livraison des fichiers haute résolution, optimisation pour les différents canaux de diffusion et archivage sécurisé.",
                duration: 'J+3 maximum',
            },
        ],
    },
];

export const ATOUTS = [
    { icon: Target,     label: 'Stratégie ciblée',     color: GOLD },
    { icon: Sparkles,   label: 'Créativité sur mesure', color: GOLD },
    { icon: Camera,     label: 'Production visuelle',   color: BLUE },
    { icon: TrendingUp, label: 'Résultats mesurables',  color: GOLD },
];

export const PROJECT_TYPES = [
    'Communication Digitale', 'Branding & Design', 'Stratégie de Contenu',
    'Campagne Publicitaire', 'Refonte Site Web', 'Couverture Médiatique', 'Autre',
];

export const BUDGETS = [
    { v: '',             l: 'Non précisé' },
    { v: 'Moins de 1M',  l: 'Moins de 1 000 000 FCFA' },
    { v: '1M-5M',        l: '1M – 5M FCFA' },
    { v: '5M-10M',       l: '5M – 10M FCFA' },
    { v: 'Plus de 10M',  l: 'Plus de 10M FCFA' },
];

export const PORTFOLIO_PER_PAGE = 6;