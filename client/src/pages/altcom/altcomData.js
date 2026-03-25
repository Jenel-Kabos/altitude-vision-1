// src/pages/altcom/altcomData.js
import {
    MessageSquare, Layout, TrendingUp, Camera,
    Target, Sparkles,
} from 'lucide-react';

export const GOLD       = '#C8872A';
export const GOLD_DARK  = '#A06820';
export const GOLD_LIGHT = '#E5A84B';
export const BLUE       = '#2E7BB5';

export const SERVICES = [
    {
        _id:         '1',
        icon:        MessageSquare,
        title:       'Communication Digitale',
        stat:        'Web & Social',
        color:       GOLD,
        route:       '/altcom/communication-digitale',
        shortDesc:   'Création de contenus et campagnes sur mesure pour le web et les réseaux sociaux.',
        fullDesc:    "Nous concevons des stratégies de communication digitale adaptées à votre marque : gestion des réseaux sociaux, création de contenus engageants, campagnes email et bien plus. Notre équipe vous accompagne de la conception à l'exécution pour maximiser votre présence en ligne.",
        features:    [
            'Gestion des réseaux sociaux (Facebook, Instagram, LinkedIn…)',
            'Création de contenus visuels et rédactionnels',
            'Campagnes publicitaires digitales (Meta Ads, Google Ads)',
            'Analyse de performance et reporting mensuel',
        ],
    },
    {
        _id:         '2',
        icon:        Layout,
        title:       'Branding & Design',
        stat:        'Identité visuelle',
        color:       BLUE,
        route:       '/altcom/branding-design',
        shortDesc:   "Définition d'identité visuelle et supports graphiques professionnels.",
        fullDesc:    "Nous créons des identités visuelles fortes et cohérentes qui reflètent vos valeurs. Du logo à la charte graphique complète, en passant par les supports print et digitaux, nous donnons à votre marque une image professionnelle et mémorable.",
        features:    [
            'Création de logo et charte graphique',
            'Supports print : flyers, affiches, brochures',
            'Supports digitaux : bannières, visuels réseaux sociaux',
            'Design UI pour sites web et applications',
        ],
    },
    {
        _id:         '3',
        icon:        TrendingUp,
        title:       'Conseil & Stratégie',
        stat:        'Stratégie 360°',
        color:       GOLD,
        route:       '/altcom/conseil-strategie',
        shortDesc:   'Accompagnement stratégique pour optimiser votre communication.',
        fullDesc:    "Notre équipe de consultants vous accompagne dans la définition et l'exécution de votre stratégie de communication globale. Audit de l'existant, positionnement, plan de communication et suivi des résultats : nous vous guidons à chaque étape.",
        features:    [
            'Audit de communication et diagnostic',
            'Définition du positionnement et des messages clés',
            'Plan de communication annuel',
            'Formation et coaching des équipes internes',
        ],
    },
    {
        _id:         '4',
        icon:        Camera,
        title:       'Couverture Médiatique',
        stat:        'Photo & Vidéo',
        color:       BLUE,
        route:       '/altcom/couverture-mediatique',
        shortDesc:   'Organisation et couverture complète de vos événements avec reportage photo/vidéo.',
        fullDesc:    "Nous assurons une couverture médiatique complète de vos événements : conférences, inaugurations, soirées corporate, lancements produits. Notre équipe photo/vidéo capture les moments clés et produit des contenus de qualité professionnelle.",
        features:    [
            'Reportage photo professionnel HD',
            'Captation et montage vidéo',
            'Live streaming et couverture temps réel',
            'Post-production et livraison rapide',
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