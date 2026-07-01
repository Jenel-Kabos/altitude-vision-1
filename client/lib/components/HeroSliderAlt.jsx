"use client";

import HeroSliderPole from './HeroSliderPole';

const slides = [
  {
    url:    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=1175&auto=format&fit=crop',
    alt:    'Maison familiale à Brazzaville — Altimmo',
    eyebrow: 'Altimmo · Vente',
    headline: 'Chaque famille mérite\nsa maison de rêve.',
    body:    'De la recherche à la remise des clés, nous vous accompagnons à chaque étape.',
    quote:   '"Grâce à Altimmo, nous avons trouvé notre chez-nous en 3 semaines."',
    cta:     { label: 'Nos annonces', to: '/immobilier/annonces' },
    stat:    { value: '200+', label: 'familles accompagnées' },
    accent:      '#2E7BB5', accentLight: '#7BB8E0',
    grad1: 'linear-gradient(108deg, rgba(5,12,22,0.93) 0%, rgba(5,10,18,0.60) 50%, rgba(5,10,18,0.08) 100%)',
    grad2: 'linear-gradient(to top, rgba(5,10,18,0.90) 0%, rgba(5,10,18,0.30) 40%, transparent 65%)',
  },
  {
    url:    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=1460&auto=format&fit=crop',
    alt:    'Investissement immobilier sécurisé au Congo',
    eyebrow: 'Altimmo · Conseil',
    headline: 'Investir à Brazzaville\nen toute sérénité.',
    body:    "Notre équipe analyse le marché local pour vous offrir les meilleures opportunités.",
    quote:   '"Un partenaire qui connaît vraiment le marché congolais."',
    cta:     { label: 'Conseil gratuit', to: '/immobilier' },
    stat:    { value: '98%', label: 'clients satisfaits' },
    accent:      '#1A5A8A', accentLight: '#5A9AC0',
    grad1: 'linear-gradient(108deg, rgba(3,10,20,0.94) 0%, rgba(3,8,16,0.62) 50%, rgba(3,8,16,0.08) 100%)',
    grad2: 'linear-gradient(to top, rgba(3,8,16,0.92) 0%, rgba(3,8,16,0.30) 40%, transparent 65%)',
  },
  {
    url:    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1470&auto=format&fit=crop',
    alt:    'Villa de luxe Brazzaville — Altimmo prestige',
    eyebrow: 'Altimmo · Prestige',
    headline: "L'élégance,\nà votre portée.",
    body:    "Villas d'exception et appartements exclusifs, sélectionnés pour une clientèle exigeante.",
    quote:   '"Une sélection impeccable, un service d\'une rare qualité."',
    cta:     { label: "Voir l'exclusif", to: '/immobilier/annonces' },
    stat:    { value: '5 ans', label: "d'expertise locale" },
    accent:      '#C8960C', accentLight: '#E8B86D',
    grad1: 'linear-gradient(108deg, rgba(18,10,2,0.93) 0%, rgba(12,6,0,0.60) 50%, rgba(12,6,0,0.08) 100%)',
    grad2: 'linear-gradient(to top, rgba(12,6,0,0.90) 0%, rgba(12,6,0,0.30) 40%, transparent 65%)',
  },
];

const HeroSliderAlt = () => (
  <HeroSliderPole slides={slides} ariaLabel="Diaporama Altimmo" />
);

export default HeroSliderAlt;
