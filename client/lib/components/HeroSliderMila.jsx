"use client";

import HeroSliderPole from './HeroSliderPole';

const slides = [
  {
    url:     'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1470&auto=format&fit=crop',
    alt:     'Mariage élégant organisé par Mila Events à Brazzaville',
    eyebrow: 'Mila Events · Mariage',
    headline: 'Le plus beau jour\nde votre vie, sublimé.',
    body:    'Chaque détail orchestré avec une attention absolue — décors, traiteur, musique, coordination — pour que vous viviez pleinement chaque instant.',
    quote:   '"Mila Events a transformé notre mariage en un conte de fées inoubliable."',
    cta:     { label: 'Demander un devis', to: '/evenementiel' },
    stat:    { value: '30+', label: 'mariages organisés' },
    accent:      '#D42B2B', accentLight: '#F08080',
    grad1: 'linear-gradient(108deg, rgba(80,10,20,0.92) 0%, rgba(10,5,8,0.6) 52%, rgba(10,5,8,0.1) 100%)',
    grad2: 'linear-gradient(to top, rgba(10,5,8,0.88) 0%, transparent 50%)',
  },
  {
    url:     'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=1470&auto=format&fit=crop',
    alt:     'Événement corporate professionnel organisé par Mila Events',
    eyebrow: 'Mila Events · Corporate',
    headline: 'Des événements\nqui marquent les esprits.',
    body:    "Conférences, galas, lancements de produits — nous concevons des expériences professionnelles qui reflètent l'excellence de votre marque.",
    quote:   '"Un niveau d\'organisation et de rigueur qui dépasse toutes nos attentes."',
    cta:     { label: 'Nos réalisations', to: '/evenementiel/annonces' },
    stat:    { value: '20+', label: 'événements corporate' },
    accent:      '#A01E1E', accentLight: '#D88080',
    grad1: 'linear-gradient(108deg, rgba(20,5,5,0.94) 0%, rgba(10,5,8,0.6) 52%, rgba(10,5,8,0.08) 100%)',
    grad2: 'linear-gradient(to top, rgba(10,5,8,0.9) 0%, transparent 50%)',
  },
  {
    url:     'https://images.unsplash.com/photo-1478146896981-b80fe463b330?q=80&w=1374&auto=format&fit=crop',
    alt:     'Décoration et scénographie luxueuse par Mila Events',
    eyebrow: 'Mila Events · Scénographie',
    headline: 'Chaque espace,\nune signature unique.',
    body:    'Nos créateurs transforment vos lieux en décors sur-mesure — fleurs, lumières, structures — pour créer des ambiances qui vous ressemblent.',
    quote:   '"La salle était d\'une beauté à couper le souffle, exactement notre vision."',
    cta:     { label: 'Voir nos créations', to: '/evenementiel/annonces' },
    stat:    { value: '100%', label: 'sur mesure' },
    accent:      '#C8960C', accentLight: '#E8B86D',
    grad1: 'linear-gradient(108deg, rgba(30,15,0,0.92) 0%, rgba(10,5,0,0.6) 52%, rgba(10,5,0,0.08) 100%)',
    grad2: 'linear-gradient(to top, rgba(10,5,0,0.88) 0%, transparent 50%)',
  },
];

const HeroSliderMila = () => (
  <HeroSliderPole slides={slides} ariaLabel="Diaporama Mila Events" />
);

export default HeroSliderMila;
