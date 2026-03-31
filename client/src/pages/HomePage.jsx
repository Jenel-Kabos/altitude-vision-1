import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Calendar, Briefcase, MapPin, Phone, Mail } from 'lucide-react';

import HeroSlider    from '../components/HeroSlider';
import HomeSlider    from '../components/HomeSlider';
import CtaCommission from '../components/CtaCommission';
import Testimonials  from '../components/Testimonials';
import FacebookFeed  from '../components/FacebookFeed';
import StatsCounter  from '../components/StatsCounter';
import WhyChooseUs   from '../components/WhyChooseUs';
import SEOHead       from '../components/SEOHead';

import { getLatestPropertiesByPoles } from '../services/propertyService';
import { getAllEvents }                from '../services/eventService';
import { getAllPortfolioItems }        from '../services/portfolioService';

const poles = [
  {
    id: 'Altimmo', name: 'Altimmo', num: '01',
    route: '/altimmo/annonces', pageroute: '/altimmo',
    icon: Building2, color: '#2E7BB5',
    colorLight: 'rgba(46,123,181,0.08)', colorBorder: 'rgba(46,123,181,0.16)',
    gradient: 'linear-gradient(135deg, #1A5A8A, #2E7BB5)',
    description: 'Trouvez le bien idéal parmi notre sélection exclusive de propriétés à Brazzaville. Vente, location et conseil expert.',
    tag: 'Immobilier',
  },
  {
    id: 'MilaEvents', name: 'Mila Events', num: '02',
    route: '/mila-events/annonces', pageroute: '/mila-events',
    icon: Calendar, color: '#D42B2B',
    colorLight: 'rgba(212,43,43,0.08)', colorBorder: 'rgba(212,43,43,0.16)',
    gradient: 'linear-gradient(135deg, #A01E1E, #D42B2B)',
    description: 'Mariages, galas, séminaires — nous concevons des expériences sur mesure qui marquent les esprits.',
    tag: 'Événementiel',
  },
  {
    id: 'Altcom', name: 'Altcom', num: '03',
    route: '/altcom/annonces', pageroute: '/altcom',
    icon: Briefcase, color: '#C8872A',
    colorLight: 'rgba(200,135,42,0.08)', colorBorder: 'rgba(200,135,42,0.16)',
    gradient: 'linear-gradient(135deg, #A0671A, #C8872A)',
    description: 'Stratégie de communication, branding et visibilité digitale pour propulser votre image.',
    tag: 'Communication',
  },
];

/* ─── Tout le responsive CSS centralisé ─── */
const GLOBAL_CSS = `

  /* ══════════════════════════
     VARIABLES & RESET
  ══════════════════════════ */
  :root {
    --px-mobile: 20px;
    --px-tablet: 40px;
    --px-desktop: 64px;
    --py-section: clamp(56px, 10vw, 96px);
    --color-gold: #C8872A;
    --color-blue: #2E7BB5;
    --color-red:  #D42B2B;
    --color-bg:   #0A0C0F;
    --color-text: #E8E4DC;
    --color-muted: rgba(232,228,220,0.38);
  }

  /* ══════════════════════════
     TICKER
  ══════════════════════════ */
  @keyframes avTicker {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }
  .av-ticker-inner {
    display: flex;
    animation: avTicker 28s linear infinite;
    white-space: nowrap;
  }

  /* ══════════════════════════
     SECTION WRAPPER
  ══════════════════════════ */
  .av-section {
    padding: var(--py-section) var(--px-mobile);
  }
  @media (min-width: 640px) {
    .av-section { padding: var(--py-section) var(--px-tablet); }
  }
  @media (min-width: 1024px) {
    .av-section { padding: var(--py-section) var(--px-desktop); }
  }

  .av-container {
    max-width: 1200px;
    margin: 0 auto;
  }

  /* ══════════════════════════
     EYEBROW
  ══════════════════════════ */
  .av-eyebrow {
    font-size: 0.72rem;          /* ↑ mobile : plus lisible */
    letter-spacing: 0.26em;
    text-transform: uppercase;
    color: var(--color-gold);
    display: flex; align-items: center;
    gap: 12px; margin-bottom: 16px; font-weight: 400;
  }
  @media (min-width: 768px) {
    .av-eyebrow { font-size: 0.68rem; }
  }

  /* ══════════════════════════
     TITRES H2
  ══════════════════════════ */
  .av-h2 {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(2.2rem, 6vw, 3.5rem);   /* ↑ mobile : 2.2rem au lieu de 1.9rem */
    font-weight: 300; line-height: 1.1;
    letter-spacing: -0.01em;
    color: var(--color-text);
  }

  /* ══════════════════════════
     STATS GRID
  ══════════════════════════ */
  .av-stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);   /* ← mobile : 2 colonnes */
    border-top: 1px solid rgba(232,228,220,0.06);
    border-bottom: 1px solid rgba(232,228,220,0.06);
  }
  @media (min-width: 768px) {
    .av-stats-grid { grid-template-columns: repeat(4, 1fr); }
  }

  .av-stat-item {
    padding: clamp(28px, 5vw, 52px) clamp(16px, 3vw, 44px);
    border-right: 1px solid rgba(232,228,220,0.06);
    border-bottom: 1px solid rgba(232,228,220,0.06);
  }
  /* Sur mobile 2 colonnes : supprimer bordure droite sur col 2 */
  @media (max-width: 767px) {
    .av-stat-item:nth-child(2n) { border-right: none; }
    /* Dernière ligne : pas de bordure bas */
    .av-stat-item:nth-last-child(-n+2) { border-bottom: none; }
  }
  @media (min-width: 768px) {
    .av-stat-item { border-bottom: none; }
    .av-stat-item:last-child { border-right: none; }
  }

  .av-stat-num {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(2.4rem, 7vw, 4rem);     /* ↑ mobile : impactant */
    font-weight: 300; line-height: 1;
    letter-spacing: -0.02em; margin-bottom: 8px;
  }
  .av-stat-label {
    font-size: clamp(0.68rem, 1.6vw, 0.72rem);  /* ↑ mobile : lisible */
    letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--color-muted); font-weight: 400;
  }

  /* ══════════════════════════
     PÔLES GRID
  ══════════════════════════ */
  .av-poles-grid {
    display: grid;
    grid-template-columns: 1fr;              /* mobile : 1 colonne */
    border: 1px solid rgba(232,228,220,0.06);
  }
  @media (min-width: 768px) {
    .av-poles-grid { grid-template-columns: repeat(3, 1fr); }
  }

  .av-pole-card {
    padding: clamp(28px, 5vw, 52px) clamp(20px, 4vw, 44px);
    border-bottom: 1px solid rgba(232,228,220,0.06);
    position: relative; overflow: hidden; transition: background 0.4s;
  }
  .av-pole-card:last-child { border-bottom: none; }
  @media (min-width: 768px) {
    .av-pole-card {
      border-bottom: none;
      border-right: 1px solid rgba(232,228,220,0.06);
    }
    .av-pole-card:last-child { border-right: none; }
  }
  .av-pole-card:hover { background: var(--pole-color-light, rgba(232,228,220,0.04)); }
  .av-pole-card:hover .av-pole-top-accent { opacity: 1 !important; }
  .av-pole-card:hover .av-pole-link { opacity: 1 !important; transform: translateY(0) !important; }

  /* Titre pôle */
  .av-pole-name {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(1.8rem, 4vw, 2rem);     /* ↑ mobile */
    font-weight: 600; line-height: 1.1; color: var(--color-text); margin-bottom: 6px;
  }
  .av-pole-tag {
    font-size: 0.68rem; letter-spacing: 0.22em;
    text-transform: uppercase; margin-bottom: 16px; font-weight: 400;
  }
  .av-pole-desc {
    font-size: clamp(0.88rem, 2vw, 0.85rem);  /* ↑ mobile */
    color: rgba(232,228,220,0.45);
    line-height: 1.75; margin-bottom: clamp(16px,3vw,28px); font-weight: 300;
  }
  .av-pole-link {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 0.72rem; letter-spacing: 0.14em;
    text-transform: uppercase; font-weight: 500;
    opacity: 0; transform: translateY(8px); transition: 0.3s;
  }
  /* Sur mobile, toujours visible (pas de hover) */
  @media (hover: none) {
    .av-pole-link { opacity: 1 !important; transform: translateY(0) !important; }
    .av-pole-top-accent { opacity: 1 !important; }
  }

  /* ══════════════════════════
     ABOUT GRID
  ══════════════════════════ */
  .av-about-grid {
    display: grid;
    grid-template-columns: 1fr;             /* mobile : 1 colonne */
    gap: clamp(40px, 8vw, 100px);
    align-items: center;
  }
  @media (min-width: 900px) {
    .av-about-grid { grid-template-columns: 1fr 1fr; }
  }

  /* Texte about */
  .av-about-p1 {
    font-size: clamp(0.92rem, 2vw, 0.92rem);  /* ↑ mobile */
    color: rgba(232,228,220,0.5);
    line-height: 1.85; margin-bottom: 14px; font-weight: 300;
  }
  .av-about-p2 {
    font-size: clamp(0.88rem, 2vw, 0.88rem);  /* ↑ mobile */
    color: rgba(232,228,220,0.36);
    line-height: 1.85; margin-bottom: 32px; font-weight: 300;
  }
  .av-about-contact-row {
    display: flex; align-items: center; gap: 12px;
    font-size: clamp(0.82rem, 2vw, 0.82rem);  /* ↑ mobile */
    color: rgba(232,228,220,0.4); font-weight: 300;
  }

  /* Mini-cards pôles côté about */
  .av-about-pole-card {
    display: flex; align-items: center;
    gap: clamp(12px, 2vw, 20px);
    padding: clamp(16px, 3vw, 24px) clamp(14px, 3vw, 28px);
    border: 1px solid rgba(232,228,220,0.06);
    position: relative; overflow: hidden; transition: 0.3s; cursor: pointer;
  }
  .av-about-pole-label {
    font-size: clamp(0.9rem, 2vw, 0.88rem);   /* ↑ mobile */
    font-weight: 400; color: var(--color-text); margin-bottom: 2px;
  }
  .av-about-pole-sub {
    font-size: clamp(0.68rem, 1.5vw, 0.65rem); /* ↑ mobile */
    letter-spacing: 0.12em; text-transform: uppercase;
    color: rgba(232,228,220,0.32);
  }
  .av-about-pole-cta {
    display: flex; align-items: center; gap: 5px;
    font-size: clamp(0.72rem, 1.5vw, 0.68rem); /* ↑ mobile */
    letter-spacing: 0.1em; text-transform: uppercase;
    font-weight: 400; flex-shrink: 0;
  }

  /* ══════════════════════════
     ANNONCES TABS
  ══════════════════════════ */
  .av-tabs {
    display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 36px;
  }
  .av-tab-btn {
    display: flex; align-items: center; gap: 7px;
    border-radius: 40px;
    font-family: 'DM Sans', sans-serif;
    font-size: clamp(0.76rem, 2vw, 0.78rem);   /* ↑ mobile */
    font-weight: 400; letter-spacing: 0.06em;
    text-transform: uppercase; cursor: pointer; transition: 0.3s;
    /* Padding tactile généreux */
    padding: 12px clamp(16px, 3vw, 22px);
  }
  /* Sur mobile, les tabs prennent toute la largeur */
  @media (max-width: 480px) {
    .av-tab-btn { flex: 1; justify-content: center; }
  }

  .av-section-head-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(1.1rem, 3vw, 1.2rem);     /* ↑ mobile */
    font-weight: 400; color: var(--color-text);
  }
  .av-see-all {
    display: flex; align-items: center; gap: 5px;
    font-size: clamp(0.74rem, 2vw, 0.70rem);   /* ↑ mobile */
    letter-spacing: 0.12em; text-transform: uppercase; font-weight: 400; transition: 0.2s;
  }

  /* ══════════════════════════
     CTA BOUTON GÉNÉRIQUE
  ══════════════════════════ */
  .av-btn-primary {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 14px 28px; border-radius: 40px;
    background: var(--color-gold); color: #0A0C0F;
    font-family: 'DM Sans', sans-serif;
    font-size: clamp(0.78rem, 2vw, 0.75rem);
    font-weight: 600; letter-spacing: 0.08em;
    text-transform: uppercase; transition: 0.25s;
  }

  /* ══════════════════════════
     SÉPARATEUR DÉGRADÉ
  ══════════════════════════ */
  .av-divider {
    height: 1px; margin: 0 var(--px-mobile);
    background: linear-gradient(to right,transparent,rgba(200,135,42,0.28),rgba(46,123,181,0.16),transparent);
  }
  @media (min-width: 640px) { .av-divider { margin: 0 var(--px-tablet); } }
  @media (min-width: 1024px) { .av-divider { margin: 0 var(--px-desktop); } }

  /* ══════════════════════════
     TICKER GLOBAL
  ══════════════════════════ */
  .av-ticker-item {
    font-family: 'DM Sans', sans-serif;
    font-size: clamp(0.68rem, 2vw, 0.70rem);   /* ↑ mobile */
    letter-spacing: 0.20em; text-transform: uppercase;
    color: #0A0C0F; font-weight: 500;
    padding: 0 clamp(20px, 4vw, 40px); flex-shrink: 0;
    display: inline-flex; align-items: center; gap: 16px;
  }

  /* ══════════════════════════
     ANIMATIONS SKELETON
  ══════════════════════════ */
  @keyframes avSkeleton {
    0%,100% { opacity: 1; }
    50%      { opacity: 0.5; }
  }
`;

const Eyebrow = ({ children }) => (
  <p className="av-eyebrow">
    <span style={{ width:'20px', height:'1px', background:'#C8872A', flexShrink:0 }} />
    {children}
  </p>
);

const PageSkeleton = () => (
  <div style={{ minHeight:'100vh', background:'#0A0C0F' }}>
    <div style={{ height:'100vh', background:'linear-gradient(160deg,#0D1520,#080B0E)' }} />
  </div>
);

const Ticker = () => {
  const items = ['Altimmo — Immobilier', 'Mila Events — Événementiel', 'Altcom — Communication', 'Brazzaville, Congo', 'Votre vision. Notre expertise.'];
  return (
    <div style={{ background:'#C8872A', padding:'clamp(11px,2vw,14px) 0', overflow:'hidden' }}>
      <div className="av-ticker-inner">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="av-ticker-item">
            {item}
            <span style={{ width:'4px', height:'4px', borderRadius:'50%', background:'rgba(10,12,15,0.35)', flexShrink:0 }} />
          </span>
        ))}
      </div>
    </div>
  );
};

/* ─── Fade-in au scroll ─── */
const FadeIn = ({ children, delay = 0, x = 0, y = 24 }) => (
  <motion.div
    initial={{ opacity: 0, x, y }}
    whileInView={{ opacity: 1, x: 0, y: 0 }}
    viewport={{ once: true, amount: 0.12 }}
    transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}>
    {children}
  </motion.div>
);

const HomePage = () => {
  const [latestProperties, setLatestProperties] = useState({});
  const [isLoading, setIsLoading]               = useState(true);
  const [activePole, setActivePole]             = useState(poles[0].id);

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
          Altcom:     allPortfolio.filter(i => i.isPublished).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5),
        });
      } catch { setLatestProperties({}); }
      finally  { setIsLoading(false); }
    };
    fetchData();
  }, []);

  const activePoleItems = latestProperties[activePole] || [];
  const activePoleData  = poles.find(p => p.id === activePole);

  if (isLoading) return <PageSkeleton />;

  return (
    <div style={{ minHeight:'100vh', background:'#0A0C0F', fontFamily:"'DM Sans',sans-serif" }}>
      <style>{GLOBAL_CSS}</style>
      <SEOHead
        title="Immobilier, Événements & Communication à Brazzaville"
        description="Altitude-Vision — Trouvez votre bien immobilier, organisez vos événements et boostez votre communication à Brazzaville, Congo."
        url="/"
      />

      {/* ══ HERO ══ */}
      <header style={{ position:'relative', height:'100vh', minHeight:'600px', overflow:'hidden' }}>
        <HeroSlider />
      </header>

      <Ticker />

      {/* ══ STATS ══ */}
      <div className="av-stats-grid">
        {[
          { num: '3',    label: "Pôles d'expertise",    color: '#C8872A' },
          { num: '150+', label: 'Biens immobiliers',     color: '#2E7BB5' },
          { num: '80+',  label: 'Événements organisés',  color: '#D42B2B' },
          { num: '∞',    label: 'Possibilités offertes', color: '#C8872A' },
        ].map((stat, i) => (
          <FadeIn key={i} delay={i * 0.08} y={16}>
            <div className="av-stat-item">
              <div className="av-stat-num" style={{ color: stat.color }}>{stat.num}</div>
              <div className="av-stat-label">{stat.label}</div>
            </div>
          </FadeIn>
        ))}
      </div>

      {/* ══ PÔLES ══ */}
      <section className="av-section">
        <div className="av-container">
          <FadeIn>
            <div style={{ marginBottom:'clamp(36px,6vw,72px)' }}>
              <Eyebrow>Notre Expertise</Eyebrow>
              <h2 className="av-h2">
                Trois pôles,{' '}
                <em style={{ fontStyle:'italic', color:'#C8872A' }}>une seule vision</em>
              </h2>
            </div>
          </FadeIn>

          <div className="av-poles-grid">
            {poles.map((pole, i) => {
              const Icon = pole.icon;
              return (
                <FadeIn key={pole.id} delay={i * 0.1} y={32}>
                  <div
                    className="av-pole-card"
                    style={{ '--pole-color-light': pole.colorLight }}>
                    <div className="av-pole-top-accent" style={{
                      position:'absolute', top:0, left:0, right:0,
                      height:'2px', background:pole.color, opacity:0, transition:'0.3s',
                    }} />
                    <span style={{
                      display:'block', fontFamily:"'Cormorant Garamond',serif",
                      fontSize:'0.85rem', fontWeight:300,
                      color:'rgba(232,228,220,0.2)',
                      letterSpacing:'0.15em', marginBottom:'clamp(18px,3vw,36px)',
                    }}>
                      {pole.num}
                    </span>
                    <div style={{
                      width:'46px', height:'46px', borderRadius:'12px',
                      background:pole.colorLight, border:`1px solid ${pole.colorBorder}`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      marginBottom:'clamp(14px,3vw,28px)', transition:'0.3s',
                    }}>
                      <Icon size={19} style={{ color:pole.color }} />
                    </div>
                    <h3 className="av-pole-name">{pole.name}</h3>
                    <p className="av-pole-tag" style={{ color:pole.color }}>{pole.tag}</p>
                    <div style={{ height:'1px', background:'rgba(232,228,220,0.06)', marginBottom:'16px' }} />
                    <p className="av-pole-desc">{pole.description}</p>
                    <Link to={pole.pageroute} className="av-pole-link" style={{ color:pole.color }}>
                      Découvrir <ArrowRight size={13} />
                    </Link>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      <div className="av-divider" />

      {/* ══ QUI SOMMES-NOUS ══ */}
      <section className="av-section">
        <div className="av-container">
          <div className="av-about-grid">

            {/* Colonne gauche : texte */}
            <FadeIn x={-28}>
              <Eyebrow>À propos</Eyebrow>
              <h2 className="av-h2" style={{ marginBottom:'22px' }}>
                Qui sommes-<em style={{ fontStyle:'italic', color:'#C8872A' }}>nous ?</em>
              </h2>
              <p className="av-about-p1">
                <span style={{ color:'#E8E4DC', fontWeight:400 }}>Altitude-Vision</span>{' '}
                est une agence multidisciplinaire basée à Brazzaville. Nos trois pôles d'expertise travaillent en synergie pour vous offrir visibilité et résultats concrets.
              </p>
              <p className="av-about-p2">
                Immobilier de prestige, événementiel haut de gamme ou stratégie de communication — une seule agence suffit pour tous vos projets.
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'36px' }}>
                {[
                  { icon: MapPin, text: 'Brazzaville, République du Congo' },
                  { icon: Phone,  text: '+242 06 800 21 51' },
                  { icon: Mail,   text: 'contact@altitudevision.agency' },
                ].map(({ icon: Icon, text }, i) => (
                  <div key={i} className="av-about-contact-row">
                    <Icon size={13} style={{ color:'#C8872A', flexShrink:0 }} />
                    {text}
                  </div>
                ))}
              </div>
              <Link to="/contact" className="av-btn-primary">
                Nous contacter <ArrowRight size={13} />
              </Link>
            </FadeIn>

            {/* Colonne droite : mini-cards */}
            <FadeIn x={28} delay={0.1}>
              <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
                {poles.map((pole, i) => {
                  const Icon = pole.icon;
                  return (
                    <FadeIn key={pole.id} delay={0.2 + i * 0.1} x={16}>
                      <div className="av-about-pole-card"
                        onMouseEnter={e => {
                          e.currentTarget.style.background = pole.colorLight;
                          e.currentTarget.querySelector('.mini-acc').style.opacity = '1';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.querySelector('.mini-acc').style.opacity = '0';
                        }}>
                        <div className="mini-acc" style={{
                          position:'absolute', left:0, top:0, bottom:0,
                          width:'2px', background:pole.color, opacity:0, transition:'0.3s',
                        }} />
                        <div style={{
                          width:'38px', height:'38px', borderRadius:'10px',
                          background:pole.colorLight, border:`1px solid ${pole.colorBorder}`,
                          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                        }}>
                          <Icon size={16} style={{ color:pole.color }} />
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p className="av-about-pole-label">{pole.name}</p>
                          <p className="av-about-pole-sub">{pole.tag}</p>
                        </div>
                        <Link to={pole.pageroute} className="av-about-pole-cta" style={{ color:pole.color }}>
                          Voir <ArrowRight size={12} />
                        </Link>
                      </div>
                    </FadeIn>
                  );
                })}
              </div>
            </FadeIn>

          </div>
        </div>
      </section>

      <StatsCounter />

      {/* ══ ANNONCES ══ */}
      <section className="av-section" style={{ background:'linear-gradient(to bottom,rgba(17,20,24,0.5),transparent)' }}>
        <div className="av-container">
          <FadeIn>
            <div style={{ marginBottom:'clamp(28px,5vw,56px)' }}>
              <Eyebrow>Notre Sélection</Eyebrow>
              <h2 className="av-h2">
                Nos Dernières{' '}
                <em style={{ fontStyle:'italic', color:'#C8872A' }}>Annonces</em>
              </h2>
            </div>
          </FadeIn>

          {/* Tabs */}
          <div className="av-tabs">
            {poles.map(pole => {
              const Icon = pole.icon;
              const isActive = activePole === pole.id;
              return (
                <motion.button key={pole.id}
                  onClick={() => setActivePole(pole.id)}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  className="av-tab-btn"
                  style={{
                    border: isActive ? 'none' : `1px solid ${pole.colorBorder}`,
                    background: isActive ? pole.gradient : 'transparent',
                    color: isActive ? '#fff' : pole.color,
                    boxShadow: isActive ? `0 4px 24px ${pole.color}30` : 'none',
                  }}
                  aria-pressed={isActive}>
                  <Icon size={14} /> {pole.name}
                </motion.button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={activePole}
              initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }}
              exit={{ opacity:0, y:-8 }} transition={{ duration:0.3 }}>
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                marginBottom:'24px', flexWrap:'wrap', gap:'12px',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ width:'2px', height:'22px', borderRadius:'1px', background:activePoleData?.color }} />
                  <h3 className="av-section-head-title">{activePoleData?.name}</h3>
                </div>
                <Link to={activePoleData?.route} className="av-see-all" style={{ color:activePoleData?.color }}>
                  Voir tout <ArrowRight size={13} />
                </Link>
              </div>

              {activePoleItems.length > 0 ? (
                <HomeSlider
                  properties={activePoleItems}
                  isEvent={activePole === 'MilaEvents'}
                  isPortfolio={activePole === 'Altcom'}
                />
              ) : (
                <div style={{
                  textAlign:'center',
                  padding:'clamp(40px,8vw,80px) clamp(20px,4vw,40px)',
                  border:`1px dashed ${activePoleData?.colorBorder}`,
                  borderRadius:'20px', background:activePoleData?.colorLight,
                }}>
                  <div style={{
                    width:'52px', height:'52px', borderRadius:'14px',
                    background:activePoleData?.gradient,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    margin:'0 auto 16px',
                  }}>
                    {activePoleData && <activePoleData.icon size={22} color="#fff" />}
                  </div>
                  <p style={{ fontWeight:400, color:'#E8E4DC', marginBottom:'6px', fontSize:'clamp(0.92rem,2vw,1rem)' }}>
                    Aucune annonce disponible
                  </p>
                  <p style={{ fontSize:'clamp(0.84rem,2vw,0.82rem)', color:'rgba(232,228,220,0.38)', fontWeight:300 }}>
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

      <section className="av-section">
        <div className="av-container">
          <CtaCommission />
        </div>
      </section>
    </div>
  );
};

export default HomePage;