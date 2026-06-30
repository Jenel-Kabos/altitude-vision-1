import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Helmet }         from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { Link }           from 'react-router-dom';
import { ArrowRight, Building2, Calendar, Briefcase, MapPin, Phone, Mail } from 'lucide-react';

import HeroSlider        from '../components/HeroSlider';
import HomeSlider        from '../components/HomeSlider';
import CtaCommission     from '../components/CtaCommission';
import Testimonials      from '../components/Testimonials';
import FacebookFeed      from '../components/FacebookFeed';
import StatsCounter      from '../components/StatsCounter';
import WhyChooseUs       from '../components/WhyChooseUs';

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

/* ─── SEO : données structurées LocalBusiness (Schema.org) ─── */
const LOCAL_BUSINESS_SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Altitude Vision',
  url: 'https://altitudevision.agency',
  logo: 'https://altitudevision.agency/images/Logo_Altitude1.png',
  telephone: '+242068002151',
  email: 'contact@altitudevision.agency',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Brazzaville',
    addressLocality: 'Brazzaville',
    addressCountry: 'CG',
  },
  description:
    'Agence multidisciplinaire à Brazzaville — Immobilier (Altimmo), Événementiel (Mila Events) et Communication (Altcom).',
  sameAs: [],
});

/* ═══════════════════════════════════════════════════════════════
   CSS — Mobile-first strict, de 320px à 1440px+
═══════════════════════════════════════════════════════════════ */
const GLOBAL_CSS = `
  :root {
    --px: 16px;
    --py: clamp(40px, 7.5vw, 140px);
    --gold: #C8960C;
    --blue: #2E7BB5;
    --red:  #D42B2B;
    --bg:   #0A0C0F;
    --text: #E8E4DC;
    --muted: rgba(232,228,220,0.38);
    --border: rgba(232,228,220,0.06);
  }
  @media (min-width: 375px)  { :root { --px: 20px; } }
  @media (min-width: 640px)  { :root { --px: 32px; } }
  @media (min-width: 768px)  { :root { --px: 40px; } }
  @media (min-width: 1024px) { :root { --px: 56px; } }
  @media (min-width: 1200px) { :root { --px: 64px; } }
  @media (min-width: 1440px) { :root { --px: 80px; --py: 140px; } }
  @media (min-width: 1920px) { :root { --px: 120px; --py: 160px; } }

  *, *::before, *::after { box-sizing: border-box; }

  .hp-root {
    min-height: 100vh;
    background: var(--bg);
    font-family: 'DM Sans', sans-serif;
    overflow-x: hidden;
  }

  .hp-section    { padding: var(--py) var(--px); width: 100%; }
  .hp-container  { max-width: 1400px; margin: 0 auto; width: 100%; }

  .hp-eyebrow {
    display: flex; align-items: center; gap: 10px;
    font-size: clamp(0.60rem, 1.6vw, 0.68rem);
    letter-spacing: 0.24em; text-transform: uppercase;
    color: var(--gold); font-weight: 500;
    margin-bottom: clamp(10px, 2vw, 16px);
  }
  .hp-eyebrow-line { width: 18px; height: 1px; background: var(--gold); flex-shrink: 0; }

  .hp-h2 {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(1.6rem, 5.5vw, 4.5rem);
    font-weight: 300; line-height: 1.12;
    letter-spacing: -0.01em; color: var(--text);
    word-break: break-word;
  }

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
    font-size: clamp(0.60rem, 1.6vw, 0.70rem);
    letter-spacing: 0.18em; text-transform: uppercase;
    color: #0A0C0F; font-weight: 500;
    padding: 0 clamp(16px, 3.5vw, 36px);
    flex-shrink: 0; display: inline-flex; align-items: center; gap: 12px;
  }

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
    .hp-stat-item:nth-child(2n)        { border-right: none; }
    .hp-stat-item:nth-last-child(-n+2) { border-bottom: none; }
  }
  @media (min-width: 768px) {
    .hp-stat-item               { border-bottom: none; }
    .hp-stat-item:last-child    { border-right: none; }
  }

  .hp-stat-num {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(2rem, 6.5vw, 5rem);
    font-weight: 300; line-height: 1; letter-spacing: -0.02em;
    margin-bottom: clamp(4px, 1vw, 8px);
  }
  .hp-stat-label {
    font-size: clamp(0.60rem, 1.4vw, 0.72rem);
    letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); font-weight: 400;
  }

  .hp-poles-grid {
    display: grid; grid-template-columns: 1fr;
    border: 1px solid var(--border); overflow: hidden;
  }
  @media (min-width: 768px) { .hp-poles-grid { grid-template-columns: repeat(3, 1fr); } }

  .hp-pole-card {
    padding: clamp(22px, 4.5vw, 80px) clamp(18px, 3.5vw, 64px);
    border-bottom: 1px solid var(--border);
    position: relative; overflow: hidden; transition: background 0.4s;
  }
  .hp-pole-card:last-child { border-bottom: none; }
  @media (min-width: 768px) {
    .hp-pole-card              { border-bottom: none; border-right: 1px solid var(--border); }
    .hp-pole-card:last-child   { border-right: none; }
  }
  .hp-pole-card:hover { background: var(--pole-bg, rgba(232,228,220,0.04)); }
  .hp-pole-card:hover .hp-pole-accent { opacity: 1 !important; }
  .hp-pole-card:hover .hp-pole-link   { opacity: 1 !important; transform: translateY(0) !important; }
  @media (hover: none) {
    .hp-pole-link   { opacity: 1 !important; transform: translateY(0) !important; }
    .hp-pole-accent { opacity: 1 !important; }
  }

  .hp-pole-num {
    display: block; font-family: 'Cormorant Garamond', serif;
    font-size: clamp(0.70rem, 1.5vw, 0.85rem); font-weight: 300;
    color: rgba(232,228,220,0.18); letter-spacing: 0.15em;
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
    font-size: clamp(0.60rem, 1.3vw, 0.68rem); letter-spacing: 0.22em;
    text-transform: uppercase; font-weight: 400; margin-bottom: clamp(10px, 2vw, 16px);
  }
  .hp-pole-sep   { height: 1px; background: var(--border); margin-bottom: clamp(10px, 2vw, 16px); }
  .hp-pole-desc  {
    font-size: clamp(0.82rem, 1.8vw, 0.86rem); color: rgba(232,228,220,0.42);
    line-height: 1.72; font-weight: 300; margin-bottom: clamp(14px, 2.5vw, 26px);
    word-break: break-word;
  }
  .hp-pole-link {
    display: inline-flex; align-items: center; gap: 7px;
    font-size: clamp(0.62rem, 1.3vw, 0.72rem); letter-spacing: 0.14em;
    text-transform: uppercase; font-weight: 500;
    opacity: 0; transform: translateY(8px); transition: 0.3s;
  }

  .hp-divider {
    height: 1px; margin: 0 var(--px);
    background: linear-gradient(to right,
      transparent, rgba(200,135,42,0.26), rgba(46,123,181,0.14), transparent
    );
  }

  .hp-about-grid {
    display: grid; grid-template-columns: 1fr;
    gap: clamp(32px, 6vw, 80px); align-items: start;
  }
  @media (min-width: 900px) { .hp-about-grid { grid-template-columns: 1fr 1fr; align-items: center; } }

  .hp-about-p {
    font-size: clamp(0.875rem, 1.9vw, 0.92rem); line-height: 1.82; font-weight: 300; word-break: break-word;
  }
  .hp-contact-row {
    display: flex; align-items: center; gap: 10px;
    font-size: clamp(0.78rem, 1.8vw, 0.82rem); color: rgba(232,228,220,0.4); font-weight: 300;
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
    font-size: clamp(0.84rem, 1.9vw, 0.88rem); font-weight: 400; color: var(--text); margin-bottom: 2px;
  }
  .hp-mini-sub {
    font-size: clamp(0.60rem, 1.3vw, 0.65rem); letter-spacing: 0.12em;
    text-transform: uppercase; color: rgba(232,228,220,0.30);
  }
  .hp-mini-cta {
    display: flex; align-items: center; gap: 4px;
    font-size: clamp(0.62rem, 1.3vw, 0.68rem); letter-spacing: 0.10em;
    text-transform: uppercase; font-weight: 400; flex-shrink: 0; white-space: nowrap;
  }

  .hp-btn-primary {
    display: inline-flex; align-items: center; gap: 7px;
    padding: clamp(11px, 2vw, 14px) clamp(20px, 3.5vw, 28px);
    border-radius: 40px; background: var(--gold); color: #0A0C0F;
    font-family: 'DM Sans', sans-serif;
    font-size: clamp(0.70rem, 1.6vw, 0.75rem); font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase;
    transition: 0.22s; text-decoration: none; white-space: nowrap;
    min-height: 44px;
  }
  .hp-btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }

  .hp-tabs {
    display: flex; flex-wrap: wrap; gap: 8px;
    margin-bottom: clamp(22px, 4vw, 36px);
  }
  @media (max-width: 479px) {
    .hp-tabs    { flex-direction: column; }
    .hp-tab-btn { width: 100%; justify-content: center; }
  }

  .hp-tab-btn {
    display: flex; align-items: center; gap: 6px;
    border-radius: 40px; cursor: pointer; transition: 0.25s;
    font-family: 'DM Sans', sans-serif;
    font-size: clamp(0.70rem, 1.8vw, 0.78rem); font-weight: 400;
    letter-spacing: 0.06em; text-transform: uppercase;
    padding: clamp(10px, 1.8vw, 12px) clamp(14px, 2.8vw, 22px);
    min-height: 44px;
  }

  .hp-annonces-head {
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 10px; margin-bottom: clamp(16px, 3vw, 24px);
  }
  .hp-annonces-head-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .hp-annonces-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(1rem, 2.8vw, 1.2rem); font-weight: 400; color: var(--text); word-break: break-word;
  }
  .hp-see-all {
    display: flex; align-items: center; gap: 4px;
    font-size: clamp(0.62rem, 1.5vw, 0.70rem); letter-spacing: 0.12em;
    text-transform: uppercase; font-weight: 400; transition: 0.2s; white-space: nowrap; flex-shrink: 0;
  }

  .hp-empty {
    text-align: center; padding: clamp(32px, 7vw, 72px) clamp(16px, 4vw, 40px); border-radius: 16px;
  }
  .hp-empty-icon {
    width: clamp(44px, 6vw, 52px); height: clamp(44px, 6vw, 52px); border-radius: 12px;
    display: flex; align-items: center; justify-content: center; margin: 0 auto clamp(12px, 2vw, 16px);
  }
  .hp-empty-title {
    font-weight: 400; color: var(--text); font-size: clamp(0.88rem, 2vw, 1rem); margin-bottom: 6px;
  }
  .hp-empty-sub {
    font-size: clamp(0.78rem, 1.8vw, 0.84rem); color: rgba(232,228,220,0.36); font-weight: 300; word-break: break-word;
  }
`;

let _hpInjected = false;
const injectHpStyles = () => {
  if (_hpInjected || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.textContent = GLOBAL_CSS;
  document.head.appendChild(s);
  _hpInjected = true;
};

/* ─── Composants internes ─── */
const Eyebrow = ({ children }) => (
  <p className="hp-eyebrow">
    <span className="hp-eyebrow-line" />
    {children}
  </p>
);

const PageSkeleton = () => (
  <div style={{ minHeight: '100vh', background: '#0A0C0F' }}>
    <div style={{ height: '100vh', background: 'linear-gradient(160deg,#0D1520,#080B0E)' }} />
  </div>
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
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(10,12,15,0.32)', flexShrink: 0 }} />
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
  injectHpStyles();

  const [latestProperties, setLatestProperties] = useState({});
  const [isLoading,  setIsLoading]  = useState(true);
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
      } catch { setLatestProperties({}); }
      finally  { setIsLoading(false); }
    };
    fetchData();
  }, []);

  const activePoleItems = latestProperties[activePole] || [];
  const activePoleData  = poles.find(p => p.id === activePole);

  if (isLoading) return <PageSkeleton />;

  return (
    <>
      {/* ══ SEO ══ */}
      <Helmet>
        <title>Altitude Vision — Immobilier, Événements & Communication à Brazzaville</title>
        <meta
          name="description"
          content="Agence multidisciplinaire à Brazzaville. Trouvez votre bien immobilier avec Altimmo, organisez vos événements avec Mila Events, et boostez votre communication avec Altcom."
        />
        <meta name="robots"        content="index, follow" />
        <link rel="canonical"      href="https://altitudevision.agency/" />

        {/* Open Graph */}
        <meta property="og:type"        content="website" />
        <meta property="og:url"         content="https://altitudevision.agency/" />
        <meta property="og:title"       content="Altitude Vision — Immobilier, Événements & Communication à Brazzaville" />
        <meta property="og:description" content="Agence multidisciplinaire à Brazzaville. Immobilier, événementiel haut de gamme et stratégie de communication." />
        <meta property="og:image"       content="https://altitudevision.agency/og-default.jpg" />
        <meta property="og:locale"      content="fr_CG" />
        <meta property="og:site_name"   content="Altitude Vision" />

        {/* Twitter Card */}
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content="Altitude Vision — Brazzaville" />
        <meta name="twitter:description" content="Immobilier, événementiel et communication à Brazzaville." />
        <meta name="twitter:image"       content="https://altitudevision.agency/og-default.jpg" />

        {/* Schema.org LocalBusiness */}
        <script type="application/ld+json">{LOCAL_BUSINESS_SCHEMA}</script>
      </Helmet>

      <div className="hp-root">

        {/* ══ HERO ══ */}
        <header style={{ position: 'relative', height: '100svh', minHeight: '560px', overflow: 'hidden' }}>
          <HeroSlider />
        </header>

        {/* ══ TICKER ══ */}
        <Ticker />

        {/* ══ STATS ══ */}
        <div className="hp-stats-grid">
          {[
            { num: '3',    label: "Pôles d'expertise",    color: '#C8960C' },
            { num: '150+', label: 'Biens immobiliers',    color: '#2E7BB5' },
            { num: '80+',  label: 'Événements organisés', color: '#D42B2B' },
            { num: '5+',   label: 'Années d\'expérience', color: '#C8960C' },
          ].map((stat, i) => (
            <FadeIn key={i} delay={i * 0.07} y={14}>
              <div className="hp-stat-item">
                <div className="hp-stat-num" style={{ color: stat.color }}>{stat.num}</div>
                <div className="hp-stat-label">{stat.label}</div>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* ══ PÔLES ══ */}
        <section className="hp-section" aria-labelledby="poles-heading">
          <div className="hp-container">
            <FadeIn>
              <div style={{ marginBottom: 'clamp(28px,5vw,64px)' }}>
                <Eyebrow>Notre Expertise</Eyebrow>
                <h2 id="poles-heading" className="hp-h2">
                  Trois pôles,{' '}
                  <em style={{ fontStyle: 'italic', color: '#C8960C' }}>une seule vision</em>
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
                        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                        background: pole.color, opacity: 0, transition: '0.3s',
                      }} />
                      <span className="hp-pole-num">{pole.num}</span>
                      <div className="hp-pole-icon-wrap" style={{
                        background: pole.colorLight, border: `1px solid ${pole.colorBorder}`,
                      }}>
                        <Icon size={17} style={{ color: pole.color }} aria-hidden="true" />
                      </div>
                      <h3 className="hp-pole-name">{pole.name}</h3>
                      <p className="hp-pole-tag" style={{ color: pole.color }}>{pole.tag}</p>
                      <div className="hp-pole-sep" />
                      <p className="hp-pole-desc">{pole.description}</p>
                      <Link href={pole.pageroute} className="hp-pole-link" style={{ color: pole.color }}>
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
        <section className="hp-section" aria-labelledby="about-heading">
          <div className="hp-container">
            <div className="hp-about-grid">

              <FadeIn x={-20}>
                <Eyebrow>À propos</Eyebrow>
                <h2 id="about-heading" className="hp-h2" style={{ marginBottom: 'clamp(14px,2.5vw,20px)' }}>
                  Qui sommes-<em style={{ fontStyle: 'italic', color: '#C8960C' }}>nous ?</em>
                </h2>
                <p className="hp-about-p" style={{ color: 'rgba(232,228,220,0.5)', marginBottom: '12px' }}>
                  <span style={{ color: '#E8E4DC', fontWeight: 400 }}>Altitude-Vision</span>{' '}
                  est une agence multidisciplinaire basée à Brazzaville. Nos trois pôles travaillent en synergie pour vous offrir visibilité et résultats concrets.
                </p>
                <p className="hp-about-p" style={{ color: 'rgba(232,228,220,0.34)', marginBottom: 'clamp(20px,4vw,32px)' }}>
                  Immobilier de prestige, événementiel haut de gamme ou stratégie de communication — une seule agence suffit.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: 'clamp(22px,4vw,34px)' }}>
                  {[
                    { icon: MapPin, text: 'Brazzaville, République du Congo' },
                    { icon: Phone,  text: '+242 06 800 21 51', href: 'tel:+242068002151' },
                    { icon: Mail,   text: 'contact@altitudevision.agency', href: 'mailto:contact@altitudevision.agency' },
                  ].map(({ icon: Icon, text, href }, i) => (
                    <div key={i} className="hp-contact-row">
                      <Icon size={12} style={{ color: '#C8960C', flexShrink: 0 }} aria-hidden="true" />
                      {href
                        ? <a href={href} style={{ color: 'inherit', textDecoration: 'none' }}>{text}</a>
                        : text
                      }
                    </div>
                  ))}
                </div>
                <Link to="/contact" className="hp-btn-primary">
                  Nous contacter <ArrowRight size={12} />
                </Link>
              </FadeIn>

              <FadeIn x={20} delay={0.1}>
                <div style={{ position: 'relative', borderRadius: '20px', overflow: 'hidden', height: 'clamp(280px,35vw,420px)' }}>
                  {/*
                    ⚠️  REMPLACER cette image Unsplash par une vraie photo de votre équipe.
                    Cela renforcera la confiance et l'authenticité pour vos prospects.
                  */}
                  <Image
                    src="https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop"
                    alt="L'équipe Altitude Vision en réunion à Brazzaville"
                    fill sizes="(max-width: 768px) 100vw, 600px"
                    className="object-cover"
                  />
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to top, rgba(10,12,15,0.65) 0%, transparent 55%)',
                    borderRadius: '20px',
                  }} />
                  <div style={{
                    position: 'absolute', bottom: '20px', left: '20px', right: '20px',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    background: 'rgba(10,12,15,0.72)', backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(200,135,42,0.25)',
                    borderRadius: '14px', padding: '12px 16px',
                  }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                      background: 'linear-gradient(135deg, #A0671A, #C8960C)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Briefcase size={16} style={{ color: '#fff' }} aria-hidden="true" />
                    </div>
                    <div>
                      <p style={{ color: '#E8E4DC', fontWeight: 500, fontSize: '0.85rem', lineHeight: 1.2 }}>
                        Agence multidisciplinaire
                      </p>
                      <p style={{ color: 'rgba(232,228,220,0.45)', fontSize: '0.72rem' }}>
                        Immobilier · Événementiel · Communication
                      </p>
                    </div>
                  </div>
                </div>
              </FadeIn>

            </div>
          </div>
        </section>

        <StatsCounter />

        {/* ══ ANNONCES ══ */}
        <section
          className="hp-section"
          aria-labelledby="annonces-heading"
          style={{ background: 'linear-gradient(to bottom,rgba(17,20,24,0.5),transparent)' }}
        >
          <div className="hp-container">
            <FadeIn>
              <div style={{ marginBottom: 'clamp(22px,4vw,48px)' }}>
                <Eyebrow>Notre Sélection</Eyebrow>
                <h2 id="annonces-heading" className="hp-h2">
                  Nos Dernières{' '}
                  <em style={{ fontStyle: 'italic', color: '#C8960C' }}>Annonces</em>
                </h2>
              </div>
            </FadeIn>

            <div className="hp-tabs" role="tablist" aria-label="Filtrer les annonces par pôle">
              {poles.map(pole => {
                const Icon     = pole.icon;
                const isActive = activePole === pole.id;
                return (
                  <motion.button
                    key={pole.id}
                    onClick={() => setActivePole(pole.id)}
                    whileTap={{ scale: 0.96 }}
                    className="hp-tab-btn"
                    role="tab"
                    aria-selected={isActive}
                    style={{
                      border:     isActive ? 'none' : `1px solid ${pole.colorBorder}`,
                      background: isActive ? pole.gradient : 'transparent',
                      color:      isActive ? '#fff' : pole.color,
                      boxShadow:  isActive ? `0 4px 20px ${pole.color}28` : 'none',
                    }}
                  >
                    <Icon size={13} aria-hidden="true" /> {pole.name}
                  </motion.button>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activePole}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28 }}
                role="tabpanel"
              >
                <div className="hp-annonces-head">
                  <div className="hp-annonces-head-left">
                    <div style={{ width: '2px', height: '20px', borderRadius: '1px', background: activePoleData?.color, flexShrink: 0 }} />
                    <h3 className="hp-annonces-title">{activePoleData?.name}</h3>
                  </div>
                  <Link to={activePoleData?.route} className="hp-see-all" style={{ color: activePoleData?.color }}>
                    Voir tout <ArrowRight size={12} />
                  </Link>
                </div>

                {activePoleItems.length > 0 ? (
                  <HomeSlider
                    properties={activePoleItems}
                    isEvent={activePole === 'MilaEvents'}
                    isPortfolio={activePole === 'Altcom'}
                  />
                ) : (
                  <div className="hp-empty" style={{
                    border: `1px dashed ${activePoleData?.colorBorder}`,
                    background: activePoleData?.colorLight,
                  }}>
                    <div className="hp-empty-icon" style={{ background: activePoleData?.gradient }}>
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
    </>
  );
};

export default HomePage;