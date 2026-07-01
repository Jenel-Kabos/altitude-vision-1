"use client";

import HeroSliderPole from './HeroSliderPole';

const slides = [
  {
    url:     'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1415&auto=format&fit=crop',
    alt:     'Stratégie de communication digitale — Altcom Brazzaville',
    eyebrow: 'Altcom · Stratégie Digitale',
    headline: 'Votre marque mérite\nd\'être entendue.',
    body:    'Nous bâtissons des stratégies de communication sur-mesure qui amplifient votre voix et propulsent votre visibilité au Congo et au-delà.',
    quote:   '"Altcom a transformé notre présence digitale en véritable atout commercial."',
    cta:     { label: 'Démarrer un projet', to: '/communication', action: 'openProject' },
    stat:    { value: '80+', label: 'projets réalisés' },
    accent:      '#C8960C', accentLight: '#E8B86D',
    grad1: 'linear-gradient(108deg, rgba(30,18,2,0.92) 0%, rgba(12,8,0,0.6) 55%, rgba(12,8,0,0.12) 100%)',
    grad2: 'linear-gradient(to top, rgba(10,6,0,0.88) 0%, transparent 50%)',
  },
  {
    url:     'https://images.unsplash.com/photo-1561070791-2526d30994b5?q=80&w=1528&auto=format&fit=crop',
    alt:     'Branding et identité visuelle — Altcom',
    eyebrow: 'Altcom · Branding & Design',
    headline: 'Une identité visuelle\nqui marque les esprits.',
    body:    "Logo, charte graphique, supports de communication — nous créons des identités visuelles cohérentes qui distinguent votre marque de la concurrence.",
    quote:   '"Notre nouveau logo est reconnu partout. Altcom a capturé l\'essence de notre marque."',
    cta:     { label: 'Voir nos créations', to: '/communication/annonces' },
    stat:    { value: '100%', label: 'sur mesure' },
    accent:      '#B87520', accentLight: '#DFA050',
    grad1: 'linear-gradient(108deg, rgba(25,14,0,0.94) 0%, rgba(12,6,0,0.58) 55%, rgba(12,6,0,0.1) 100%)',
    grad2: 'linear-gradient(to top, rgba(10,6,0,0.9) 0%, transparent 50%)',
  },
  {
    url:     'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?q=80&w=1470&auto=format&fit=crop',
    alt:     'Production photo et vidéo professionnelle — Altcom',
    eyebrow: 'Altcom · Production Média',
    headline: 'Chaque moment\ncapturé avec précision.',
    body:    "Photographie corporate, films institutionnels, couverture événementielle — nos équipes créatives immortalisent vos instants clés avec un niveau de qualité premium.",
    quote:   '"Les photos de notre événement ont été partagées des centaines de fois."',
    cta:     { label: "Contacter l'équipe", to: '/communication' },
    stat:    { value: '5 ans', label: "d'expertise locale" },
    accent:      '#D4972E', accentLight: '#F0BC60',
    grad1: 'linear-gradient(108deg, rgba(20,12,0,0.92) 0%, rgba(10,6,0,0.55) 55%, rgba(10,6,0,0.1) 100%)',
    grad2: 'linear-gradient(to top, rgba(10,6,0,0.88) 0%, transparent 50%)',
  },
];

const HeroSliderAltcom = ({ onStartProject }) => (
  <HeroSliderPole slides={slides} ariaLabel="Diaporama Altcom" onStartProject={onStartProject} />
);

export default HeroSliderAltcom;
