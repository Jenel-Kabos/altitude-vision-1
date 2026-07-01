"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Building2, Calendar, Briefcase, MapPin, Phone, Mail } from 'lucide-react';

import HeroSlider    from '../components/HeroSlider';
import HomeSlider    from '../components/HomeSlider';
import CtaCommission from '../components/CtaCommission';
import Testimonials  from '../components/Testimonials';
import FacebookFeed  from '../components/FacebookFeed';
import StatsCounter  from '../components/StatsCounter';
import WhyChooseUs   from '../components/WhyChooseUs';

import { getLatestPropertiesByPoles } from '../services/propertyService';
import { getAllEvents }                from '../services/eventService';
import { getAllPortfolioItems }        from '../services/portfolioService';

const poles = [
  {
    id: 'Altimmo', name: 'Altimmo', num: '01',
    route: '/immobilier/annonces', pageroute: '/immobilier',
    icon: Building2, color: '#2E7BB5',
    colorLight: 'rgba(46,123,181,0.08)', colorBorder: 'rgba(46,123,181,0.16)',
    gradient: 'linear-gradient(135deg, #1A5A8A, #2E7BB5)',
    description: 'Trouvez le bien idéal parmi notre sélection exclusive de propriétés à Brazzaville.',
    tag: 'Immobilier',
  },
  {
    id: 'MilaEvents', name: 'Mila Events', num: '02',
    route: '/evenementiel/annonces', pageroute: '/evenementiel',
    icon: Calendar, color: '#D42B2B',
    colorLight: 'rgba(212,43,43,0.08)', colorBorder: 'rgba(212,43,43,0.16)',
    gradient: 'linear-gradient(135deg, #A01E1E, #D42B2B)',
    description: 'Mariages, galas, séminaires — nous concevons des expériences sur mesure.',
    tag: 'Événementiel',
  },
  {
    id: 'Altcom', name: 'Altcom', num: '03',
    route: '/communication/annonces', pageroute: '/communication',
    icon: Briefcase, color: '#C8960C',
    colorLight: 'rgba(200,135,42,0.08)', colorBorder: 'rgba(200,135,42,0.16)',
    gradient: 'linear-gradient(135deg, #A0671A, #C8960C)',
    description: 'Stratégie de communication, branding et visibilité digitale pour propulser votre image.',
    tag: 'Communication',
  },
];

/* ═══════════════════════════════════════════════════════════════
   CSS — Mobile-first strict, de 320px à 1440px+

   Règles plancher (320px = iPhone SE, valeur critique) :
   · --px : 16px  → jamais de contenu collé au bord
   · font-size corps  : 0.875rem (14px) minimum
   · font-size eyebrow: 0.60rem  (9.6px) minimum lisible
   · h2 : 1.6rem (25.6px) minimum — lisible et impactant
   · stats chiffres : 2rem (32px) minimum
   · padding sections : 40px minimum en vertical
   · overflow-x:hidden sur root → pas de scroll horizontal
   · word-break:break-word sur textes → pas de débordement

   Breakpoints :
   375px  iPhone standard    → --px monte à 20px
   480px  grand mobile       → tabs en ligne
   640px  petite tablette    → --px 32px
   768px  tablette portrait  → stats 4 cols, pôles 3 cols
   900px  tablette paysage   → about 2 cols
   1024px laptop             → --px 56px
   1200px desktop            → --px 64px
═══════════════════════════════════════════════════════════════ */
const GLOBAL_CSS = `

  /* ─── Variables ─── */
  :root {
    --px: 16px;
    --py: clamp(40px, 7.5vw, 88px);
    --gold: #C8960C;
    --blue: #2E7BB5;
    --red:  #D42B2B;
    --bg:   #F8F8F8;
    --text: #111827;
    --muted: #6B7280;
    --border: rgba(17,24,39,0.08);
  }
  @media (min-width: 375px)  { :root { --px: 20px; } }
  @media (min-width: 640px)  { :root { --px: 32px; } }
  @media (min-width: 768px)  { :root { --px: 40px; } }
  @media (min-width: 1024px) { :root { --px: 56px; } }
  @media (min-width: 1200px) { :root { --px: 64px; } }

  @media (prefers-reduced-motion: reduce) {
    .hp-ticker-inner { animation-duration: 0.01ms !important; }
  }

  *, *::before, *::after { box-sizing: border-box; }

  /* ─── Root ─── */
  .hp-root {
    min-height: 100vh;
    background: var(--bg);
    font-family: 'DM Sans', sans-serif;
    overflow-x: hidden;
  }

  /* ─── Section / container ─── */
  .hp-section { padding: var(--py) var(--px); width: 100%; }
  .hp-container { max-width: 1200px; margin: 0 auto; width: 100%; }

  /* ─── Eyebrow ─── */
  .hp-eyebrow {
    display: flex; align-items: center; gap: 10px;
    font-size: clamp(0.70rem, 1.6vw, 0.76rem);
    letter-spacing: 0.22em; text-transform: uppercase;
    color: var(--gold); font-weight: 600;
    margin-bottom: clamp(10px, 2vw, 16px);
  }
  .hp-eyebrow-line { width: 18px; height: 1px; background: var(--gold); flex-shrink: 0; }

  /* ─── H2 — plancher 1.6rem sur 320px ─── */
  .hp-h2 {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(1.6rem, 5.5vw, 3.4rem);
    font-weight: 400; line-height: 1.12;
    letter-spacing: -0.01em; color: var(--text);
    word-break: break-word;
  }

  /* ─── Ticker ─── */
  @keyframes hp-tick {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }
  .hp-ticker-track {
    overflow: hidden; width: 100%;
    background: var(--gold);
    padding: clamp(9px, 1.8vw, 13px) 0;
  }
  .hp-ticker-inner {
    display: flex; white-space: nowrap;
    animation: hp-tick 28s linear infinite;
  }
  .hp-ticker-item {
    font-family: 'DM Sans', sans-serif;
    font-size: clamp(0.68rem, 1.6vw, 0.74rem);
    letter-spacing: 0.18em; text-transform: uppercase;
    color: #0A0C0F; font-weight: 600;
    padding: 0 clamp(16px, 3.5vw, 36px);
    flex-shrink: 0; display: inline-flex; align-items: center; gap: 12px;
  }

  /* ─── Stats grid — 2×2 mobile → 1×4 desktop ─── */
  .hp-stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }
  @media (min-width: 768px) { .hp-stats-grid { grid-template-columns: repeat(4, 1fr); } }

  .hp-stat-item {
    padding: clamp(20px, 4.5vw, 52px) clamp(14px, 3vw, 44px);
    border-right: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }
  @media (max-width: 767px) {
    .hp-stat-item:nth-child(2n) { border-right: none; }
    .hp-stat-item:nth-last-child(-n+2) { border-bottom: none; }
  }
  @media (min-width: 768px) {
    .hp-stat-item { border-bottom: none; }
    .hp-stat-item:last-child { border-right: none; }
  }

  .hp-stat-num {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(2rem, 6.5vw, 3.8rem);
    font-weight: 300; line-height: 1; letter-spacing: -0.02em;
    margin-bottom: clamp(4px, 1vw, 8px);
  }
  .hp-stat-label {
    font-size: clamp(0.68rem, 1.4vw, 0.76rem);
    letter-spacing: 0.12em; text-transform: uppercase; color: #4B5563; font-weight: 500;
  }

  /* ─── Pôles grid — 1 col mobile → 3 cols ≥768px ─── */
  .hp-poles-grid {
    display: grid; grid-template-columns: 1fr;
    border: 1px solid var(--border); overflow: hidden;
  }
  @media (min-width: 768px) { .hp-poles-grid { grid-template-columns: repeat(3, 1fr); } }

  .hp-pole-card {
    padding: clamp(22px, 4.5vw, 52px) clamp(18px, 3.5vw, 44px);
    border-bottom: 1px solid var(--border);
    position: relative; overflow: hidden; transition: background 0.4s;
  }
  .hp-pole-card:last-child { border-bottom: none; }
  @media (min-width: 768px) {
    .hp-pole-card { border-bottom: none; border-right: 1px solid var(--border); }
    .hp-pole-card:last-child { border-right: none; }
  }
  .hp-pole-card:hover { background: var(--pole-bg, rgba(17,24,39,0.04)); }
  .hp-pole-card:hover .hp-pole-accent { opacity: 1 !important; }
  .hp-pole-card:hover .hp-pole-link   { opacity: 1 !important; transform: translateY(0) !important; }
  @media (hover: none) {
    .hp-pole-link   { opacity: 1 !important; transform: translateY(0) !important; }
    .hp-pole-accent { opacity: 1 !important; }
  }

  .hp-pole-num {
    display: block; font-family: 'Cormorant Garamond', serif;
    font-size: clamp(0.72rem, 1.5vw, 0.86rem); font-weight: 400;
    color: rgba(17,24,39,0.35); letter-spacing: 0.15em;
    margin-bottom: clamp(14px, 2.5vw, 32px);
  }
  .hp-pole-icon-wrap {
    width: clamp(36px, 5vw, 46px); height: clamp(36px, 5vw, 46px);
    border-radius: 10px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: clamp(12px, 2.5vw, 26px); transition: 0.3s;
  }
  .hp-pole-name {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(1.5rem, 3.8vw, 2rem); font-weight: 600;
    line-height: 1.08; color: var(--text); margin-bottom: 5px; word-break: break-word;
  }
  .hp-pole-tag {
    font-size: clamp(0.68rem, 1.3vw, 0.74rem); letter-spacing: 0.20em;
    text-transform: uppercase; font-weight: 500; margin-bottom: clamp(10px, 2vw, 16px);
  }
  .hp-pole-sep { height: 1px; background: var(--border); margin-bottom: clamp(10px, 2vw, 16px); }
  .hp-pole-desc {
    font-size: clamp(0.85rem, 1.8vw, 0.9rem); color: #4B5563;
    line-height: 1.72; font-weight: 400; margin-bottom: clamp(14px, 2.5vw, 26px);
    word-break: break-word;
  }
  .hp-pole-link {
    display: inline-flex; align-items: center; gap: 7px;
    font-size: clamp(0.72rem, 1.3vw, 0.78rem); letter-spacing: 0.14em;
    text-transform: uppercase; font-weight: 600;
    opacity: 0; transform: translateY(8px); transition: 0.3s;
  }

  /* ─── Séparateur ─── */
  .hp-divider {
    height: 1px; margin: 0 var(--px);
    background: linear-gradient(to right,
      transparent, rgba(200,135,42,0.26), rgba(46,123,181,0.14), transparent
    );
  }

  /* ─── About grid — 1 col mobile → 2 cols ≥900px ─── */
  .hp-about-grid {
    display: grid; grid-template-columns: 1fr;
    gap: clamp(32px, 6vw, 80px); align-items: start;
  }
  @media (min-width: 900px) { .hp-about-grid { grid-template-columns: 1fr 1fr; align-items: center; } }

  .hp-about-p {
    font-size: clamp(0.9rem, 1.9vw, 0.95rem); line-height: 1.82; font-weight: 400; word-break: break-word;
  }
  .hp-contact-row {
    display: flex; align-items: center; gap: 10px;
    font-size: clamp(0.82rem, 1.8vw, 0.88rem); color: #4B5563; font-weight: 400;
    /* email peut être long sur 320px */
    overflow-wrap: break-word; word-break: break-all;
  }

  .hp-mini-card {
    display: flex; align-items: center;
    gap: clamp(10px, 2vw, 20px);
    padding: clamp(14px, 2.5vw, 22px) clamp(12px, 2.5vw, 26px);
    border: 1px solid var(--border); position: relative; overflow: hidden; transition: 0.3s;
  }
  .hp-mini-icon {
    width: clamp(34px, 5vw, 38px); height: clamp(34px, 5vw, 38px);
    border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .hp-mini-name {
    font-size: clamp(0.86rem, 1.9vw, 0.92rem); font-weight: 500; color: var(--text); margin-bottom: 2px;
  }
  .hp-mini-sub {
    font-size: clamp(0.68rem, 1.3vw, 0.72rem); letter-spacing: 0.12em;
    text-transform: uppercase; color: #6B7280;
  }
  .hp-mini-cta {
    display: flex; align-items: center; gap: 4px;
    font-size: clamp(0.70rem, 1.3vw, 0.76rem); letter-spacing: 0.10em;
    text-transform: uppercase; font-weight: 500; flex-shrink: 0; white-space: nowrap;
  }

  /* ─── Bouton primaire ─── */
  .hp-btn-primary {
    display: inline-flex; align-items: center; gap: 7px;
    padding: clamp(11px, 2vw, 14px) clamp(20px, 3.5vw, 28px);
    border-radius: 40px; background: var(--gold); color: #0A0C0F;
    font-family: 'DM Sans', sans-serif;
    font-size: clamp(0.76rem, 1.6vw, 0.82rem); font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase;
    transition: 0.22s; text-decoration: none; white-space: nowrap;
    /* Cible tactile WCAG min 44px */
    min-height: 44px;
  }
  .hp-btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }

  /* ─── Tabs annonces ─── */
  .hp-tabs {
    display: flex; flex-wrap: wrap; gap: 8px;
    margin-bottom: clamp(22px, 4vw, 36px);
  }
  /* < 480px : boutons empilés pleine largeur */
  @media (max-width: 479px) {
    .hp-tabs { flex-direction: column; }
    .hp-tab-btn { width: 100%; justify-content: center; }
  }

  .hp-tab-btn {
    display: flex; align-items: center; gap: 6px;
    border-radius: 40px; cursor: pointer; transition: 0.25s;
    font-family: 'DM Sans', sans-serif;
    font-size: clamp(0.74rem, 1.8vw, 0.82rem); font-weight: 500;
    letter-spacing: 0.06em; text-transform: uppercase;
    padding: clamp(10px, 1.8vw, 12px) clamp(14px, 2.8vw, 22px);
    min-height: 44px; /* cible tactile */
  }

  .hp-annonces-head {
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 10px; margin-bottom: clamp(16px, 3vw, 24px);
  }
  .hp-annonces-head-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .hp-annonces-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(1.05rem, 2.8vw, 1.25rem); font-weight: 500; color: var(--text); word-break: break-word;
  }
  .hp-see-all {
    display: flex; align-items: center; gap: 4px;
    font-size: clamp(0.70rem, 1.5vw, 0.76rem); letter-spacing: 0.12em;
    text-transform: uppercase; font-weight: 500; transition: 0.2s; white-space: nowrap; flex-shrink: 0;
  }

  /* ─── Empty state ─── */
  .hp-empty {
    text-align: center; padding: clamp(32px, 7vw, 72px) clamp(16px, 4vw, 40px); border-radius: 16px;
  }
  .hp-empty-icon {
    width: clamp(44px, 6vw, 52px); height: clamp(44px, 6vw, 52px); border-radius: 12px;
    display: flex; align-items: center; justify-content: center; margin: 0 auto clamp(12px, 2vw, 16px);
  }
  .hp-empty-title {
    font-weight: 500; color: var(--text); font-size: clamp(0.92rem, 2vw, 1.05rem); margin-bottom: 6px;
  }
  .hp-empty-sub {
    font-size: clamp(0.82rem, 1.8vw, 0.88rem); color: #4B5563; font-weight: 400; word-break: break-word;
  }
`;


/* ─── Composants internes ─── */
const Eyebrow = ({ children }) => (
  <p className="hp-eyebrow">
    <span className="hp-eyebrow-line" />
    {children}
  </p>
);

const Ticker = () => {
  const items = [
    'Altimmo — Immobilier',
    'Mila Events — Événementiel',
    'Altcom — Communication',
    'Brazzaville, Congo',
    'Votre vision. Notre expertise.',
  ];
  return (
    <div className="hp-ticker-track">
      <div className="hp-ticker-inner">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="hp-ticker-item">
            {item}
            <span style={{ width:'4px', height:'4px', borderRadius:'50%', background:'rgba(10,12,15,0.32)', flexShrink:0 }} />
          </span>
        ))}
      </div>
    </div>
  );
};

const FadeIn = ({ children, delay = 0, x = 0, y = 20 }) => (
  <motion.div
    initial={{ opacity: 0, x, y }}
    whileInView={{ opacity: 1, x: 0, y: 0 }}
    viewport={{ once: true, amount: 0.1 }}
    transition={{ duration: 0.65, delay, ease: [0.25, 0.46, 0.45, 0.94] }}>
    {children}
  </motion.div>
);

/* ═══════════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════════ */
const HomePage = () => {
  const [latestProperties, setLatestProperties] = useState({});
  const [isLoading,  setIsLoading]  = useState(true);
  const [loadError,  setLoadError]  = useState(false);
  const [activePole, setActivePole] = useState(poles[0].id);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [propertiesResults, allEvents, allPortfolio] = await Promise.all([
          getLatestPropertiesByPoles(['Altimmo'], 5),
          getAllEvents(),
          getAllPortfolioItems(),
        ]);
        setLatestProperties({
          Altimmo:    propertiesResults.Altimmo || [],
          MilaEvents: allEvents.filter(e => e.status === 'Publié').slice(0, 5),
          Altcom:     allPortfolio
            .filter(i => i.isPublished)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5),
        });
      } catch { setLatestProperties({}); setLoadError(true); }
      finally  { setIsLoading(false); }
    };
    fetchData();
  }, []);

  const activePoleItems = latestProperties[activePole] || [];
  const activePoleData  = poles.find(p => p.id === activePole);

  return (
    <div className="hp-root">
      <style>{GLOBAL_CSS}</style>
      {/* ══ HERO ══ */}
      <header style={{ position:'relative', height:'100svh', minHeight:'620px', maxHeight:'860px', overflow:'hidden' }}>
        <HeroSlider />
      </header>

      {/* ══ TICKER ══ */}
      <Ticker />

      {/* ══ PÔLES ══ */}
      <section className="hp-section">
        <div className="hp-container">
          <FadeIn>
            <div style={{ marginBottom:'clamp(28px,5vw,64px)' }}>
              <Eyebrow>Notre Expertise</Eyebrow>
              <h2 className="hp-h2">
                Trois pôles,{' '}
                <em style={{ fontStyle:'italic', color:'#C8960C' }}>une seule vision</em>
              </h2>
            </div>
          </FadeIn>

          <div className="hp-poles-grid">
            {poles.map((pole, i) => {
              const Icon = pole.icon;
              return (
                <FadeIn key={pole.id} delay={i * 0.09} y={26}>
                  <div className="hp-pole-card" style={{ '--pole-bg': pole.colorLight }}>
                    <div className="hp-pole-accent" style={{
                      position:'absolute', top:0, left:0, right:0, height:'2px',
                      background:pole.color, opacity:0, transition:'0.3s',
                    }} />
                    <span className="hp-pole-num">{pole.num}</span>
                    <div className="hp-pole-icon-wrap" style={{
                      background:pole.colorLight, border:`1px solid ${pole.colorBorder}`,
                    }}>
                      <Icon size={17} style={{ color:pole.color }} />
                    </div>
                    <h3 className="hp-pole-name">{pole.name}</h3>
                    <p className="hp-pole-tag" style={{ color:pole.color }}>{pole.tag}</p>
                    <div className="hp-pole-sep" />
                    <p className="hp-pole-desc">{pole.description}</p>
                    <Link href={pole.pageroute} className="hp-pole-link" style={{ color:pole.color }}>
                      Découvrir <ArrowRight size={12} />
                    </Link>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      <div className="hp-divider" />

      {/* ══ À PROPOS ══ */}
      <section className="hp-section">
        <div className="hp-container">
          <div className="hp-about-grid">

            <FadeIn x={-20}>
              <Eyebrow>À propos</Eyebrow>
              <h2 className="hp-h2" style={{ marginBottom:'clamp(14px,2.5vw,20px)' }}>
                Qui sommes-<em style={{ fontStyle:'italic', color:'#C8960C' }}>nous ?</em>
              </h2>
              <p className="hp-about-p" style={{ color:'#6B7280', marginBottom:'12px' }}>
                <span style={{ color:'#111827', fontWeight:400 }}>Altitude-Vision</span>{' '}
                est la seule agence à Brazzaville qui réunit l'immobilier, l'événementiel et la communication sous un même toit.
              </p>
              <p className="hp-about-p" style={{ color:'#6B7280', marginBottom:'clamp(20px,4vw,32px)' }}>
                200+ familles logées, 80+ événements réussis, 80+ marques accompagnées — ce sont nos preuves. Confiez-nous un projet : nous livrons.
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'clamp(22px,4vw,34px)' }}>
                {[
                  { icon:MapPin, text:'Brazzaville, République du Congo' },
                  { icon:Phone,  text:'+242 06 800 21 51' },
                  { icon:Mail,   text:'contact@altitudevision.agency' },
                ].map(({ icon:Icon, text }, i) => (
                  <div key={i} className="hp-contact-row">
                    <Icon size={12} style={{ color:'#C8960C', flexShrink:0 }} />
                    {text}
                  </div>
                ))}
              </div>
              <Link href="/contact" className="hp-btn-primary">
                Nous contacter <ArrowRight size={12} />
              </Link>
            </FadeIn>

            <FadeIn x={20} delay={0.1}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'clamp(10px,2vw,16px)' }}>
                {[
                  { num:'200+', label:'Familles logées',        color:'#2E7BB5', icon: Building2 },
                  { num:'80+',  label:'Événements livrés',      color:'#D42B2B', icon: Calendar },
                  { num:'80+',  label:'Marques accompagnées',   color:'#C8960C', icon: Briefcase },
                  { num:'5+',   label:'Années à Brazzaville',   color:'#C8960C', icon: MapPin },
                ].map((item, i) => {
                  const ItemIcon = item.icon;
                  return (
                    <div key={i} style={{
                      padding:'clamp(16px,3vw,28px)',
                      borderRadius:'14px',
                      border:`1px solid ${item.color}22`,
                      background:`${item.color}08`,
                      display:'flex', flexDirection:'column', gap:'8px',
                    }}>
                      <div style={{
                        width:'32px', height:'32px', borderRadius:'9px',
                        background:`${item.color}18`,
                        border:`1px solid ${item.color}25`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        marginBottom:'2px',
                      }}>
                        <ItemIcon size={14} style={{ color: item.color }} />
                      </div>
                      <div style={{
                        fontFamily:"'Cormorant Garamond', serif",
                        fontSize:'clamp(1.8rem,4vw,2.8rem)',
                        fontWeight:300, color:item.color, lineHeight:1,
                      }}>
                        {item.num}
                      </div>
                      <div style={{
                        fontSize:'clamp(0.68rem,1.2vw,0.74rem)',
                        letterSpacing:'0.14em', textTransform:'uppercase',
                        color:'#4B5563', fontWeight:500,
                      }}>
                        {item.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </FadeIn>

          </div>
        </div>
      </section>

      <StatsCounter />

      {/* ══ ANNONCES ══ */}
      <section className="hp-section" style={{ background:'rgba(17,24,39,0.02)' }}>
        <div className="hp-container">
          <FadeIn>
            <div style={{ marginBottom:'clamp(22px,4vw,48px)' }}>
              <Eyebrow>Notre Sélection</Eyebrow>
              <h2 className="hp-h2">
                Nos Dernières{' '}
                <em style={{ fontStyle:'italic', color:'#C8960C' }}>Annonces</em>
              </h2>
            </div>
          </FadeIn>

          <div className="hp-tabs" role="tablist" aria-label="Pôles d'activité">
            {poles.map(pole => {
              const Icon     = pole.icon;
              const isActive = activePole === pole.id;
              return (
                <motion.button key={pole.id}
                  onClick={() => setActivePole(pole.id)}
                  whileTap={{ scale: 0.96 }}
                  className="hp-tab-btn"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`tabpanel-${pole.id}`}
                  id={`tab-${pole.id}`}
                  style={{
                    border:     isActive ? 'none' : `1px solid ${pole.colorBorder}`,
                    background: isActive ? pole.gradient : 'transparent',
                    color:      isActive ? '#fff' : pole.color,
                    boxShadow:  isActive ? `0 4px 20px ${pole.color}28` : 'none',
                  }}>
                  <Icon size={13} aria-hidden="true" /> {pole.name}
                </motion.button>
              );
            })}
          </div>

          {loadError && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '12px 16px', borderRadius: '10px', marginBottom: '16px',
              background: 'rgba(212,43,43,0.08)', border: '1px solid rgba(212,43,43,0.2)',
              fontSize: '0.82rem', color: '#6B7280',
            }}>
              ⚠️ Impossible de charger les annonces pour le moment. Réessayez plus tard.
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div key={activePole}
              role="tabpanel"
              id={`tabpanel-${activePole}`}
              aria-labelledby={`tab-${activePole}`}
              initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
              exit={{ opacity:0, y:-8 }} transition={{ duration:0.28 }}>

              <div className="hp-annonces-head">
                <div className="hp-annonces-head-left">
                  <div style={{ width:'2px', height:'20px', borderRadius:'1px', background:activePoleData?.color, flexShrink:0 }} />
                  <h3 className="hp-annonces-title">{activePoleData?.name}</h3>
                </div>
                <Link href={activePoleData?.route} className="hp-see-all" style={{ color:activePoleData?.color }}>
                  Voir tout <ArrowRight size={12} />
                </Link>
              </div>

              {isLoading || activePoleItems.length > 0 ? (
                <HomeSlider
                  properties={activePoleItems}
                  isEvent={activePole === 'MilaEvents'}
                  isPortfolio={activePole === 'Altcom'}
                  loading={isLoading}
                />
              ) : (
                <div className="hp-empty" style={{
                  border:`1px dashed ${activePoleData?.colorBorder}`,
                  background:activePoleData?.colorLight,
                }}>
                  <div className="hp-empty-icon" style={{ background:activePoleData?.gradient }}>
                    {activePoleData && <activePoleData.icon size={20} color="#fff" aria-hidden="true" />}
                  </div>
                  <p className="hp-empty-title">Aucune annonce disponible</p>
                  <p className="hp-empty-sub">
                    Les nouvelles annonces pour {activePoleData?.name} arrivent bientôt
                  </p>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      <WhyChooseUs />
      <FacebookFeed />
      <Testimonials />

      <section className="hp-section">
        <div className="hp-container">
          <CtaCommission />
        </div>
      </section>
    </div>
  );
};

export default HomePage;