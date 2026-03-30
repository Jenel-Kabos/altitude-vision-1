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
    colorLight: 'rgba(46,123,181,0.07)', colorBorder: 'rgba(46,123,181,0.14)',
    gradient: 'linear-gradient(135deg, #1A5A8A, #2E7BB5)',
    description: 'Trouvez le bien idéal parmi notre sélection exclusive de propriétés à Brazzaville. Vente, location et conseil expert.',
    tag: 'Immobilier',
  },
  {
    id: 'MilaEvents', name: 'Mila Events', num: '02',
    route: '/mila-events/annonces', pageroute: '/mila-events',
    icon: Calendar, color: '#D42B2B',
    colorLight: 'rgba(212,43,43,0.07)', colorBorder: 'rgba(212,43,43,0.14)',
    gradient: 'linear-gradient(135deg, #A01E1E, #D42B2B)',
    description: 'Mariages, galas, séminaires — nous concevons des expériences sur mesure qui marquent les esprits.',
    tag: 'Événementiel',
  },
  {
    id: 'Altcom', name: 'Altcom', num: '03',
    route: '/altcom/annonces', pageroute: '/altcom',
    icon: Briefcase, color: '#C8872A',
    colorLight: 'rgba(200,135,42,0.07)', colorBorder: 'rgba(200,135,42,0.14)',
    gradient: 'linear-gradient(135deg, #A0671A, #C8872A)',
    description: 'Stratégie de communication, branding et visibilité digitale pour propulser votre image.',
    tag: 'Communication',
  },
];

const RESPONSIVE_CSS = `
  .av-stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border-top: 1px solid rgba(232,228,220,0.06);
    border-bottom: 1px solid rgba(232,228,220,0.06);
  }
  @media (max-width: 767px) {
    .av-stats-grid { grid-template-columns: repeat(2, 1fr); }
    .av-stats-grid .av-stat-item:nth-child(2) { border-right: none; }
    .av-stats-grid .av-stat-item:nth-child(3) { border-top: 1px solid rgba(232,228,220,0.06); border-right: 1px solid rgba(232,228,220,0.06); }
    .av-stats-grid .av-stat-item:nth-child(4) { border-top: 1px solid rgba(232,228,220,0.06); }
  }
  .av-stat-item {
    padding: clamp(28px, 5vw, 52px) clamp(20px, 4vw, 44px);
    border-right: 1px solid rgba(232,228,220,0.06);
  }
  .av-stat-item:last-child { border-right: none; }

  .av-poles-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border: 1px solid rgba(232,228,220,0.06);
  }
  @media (max-width: 900px) {
    .av-poles-grid { grid-template-columns: 1fr; }
    .av-pole-card { border-right: none !important; border-bottom: 1px solid rgba(232,228,220,0.06); }
    .av-pole-card:last-child { border-bottom: none; }
  }
  .av-pole-card {
    padding: clamp(32px, 5vw, 52px) clamp(24px, 4vw, 44px);
    border-right: 1px solid rgba(232,228,220,0.06);
    cursor: pointer; position: relative; overflow: hidden;
    transition: background 0.4s;
  }
  .av-pole-card:last-child { border-right: none; }
  .av-pole-card:hover { background: var(--pole-color-light, rgba(232,228,220,0.04)); }
  .av-pole-card:hover .av-pole-top-accent { opacity: 1 !important; }
  .av-pole-card:hover .av-pole-link { opacity: 1 !important; transform: translateY(0) !important; }

  .av-about-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: clamp(40px, 8vw, 100px);
    align-items: center;
  }
  @media (max-width: 767px) {
    .av-about-grid { grid-template-columns: 1fr; gap: 48px; }
  }

  .av-ticker-inner {
    display: flex;
    animation: avTicker 28s linear infinite;
    white-space: nowrap;
  }

  .av-tabs { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 40px; }
  .av-section-inner { padding: var(--py) var(--px); }
  .av-container { max-width: 1200px; margin: 0 auto; }
`;

// Taille de titre unifiée pour toutes les sections h2
// Identique à "Qui sommes-nous ?" : clamp(1.9rem,4vw,3.5rem)
const H2_SIZE = 'clamp(1.9rem,4vw,3.5rem)';

const Eyebrow = ({ children }) => (
  <p style={{
    fontSize: 'clamp(0.6rem, 1.5vw, 0.68rem)',
    letterSpacing: '0.28em', textTransform: 'uppercase',
    color: '#C8872A', display: 'flex', alignItems: 'center',
    gap: '12px', marginBottom: '20px', fontWeight: 400,
  }}>
    <span style={{ width: '20px', height: '1px', background: '#C8872A', flexShrink: 0 }} />
    {children}
  </p>
);

const PageSkeleton = () => (
  <div style={{ minHeight: '100vh', background: '#0A0C0F' }}>
    <div style={{ height: '100vh', background: 'linear-gradient(160deg,#0D1520,#080B0E)' }} />
  </div>
);

const Ticker = () => {
  const items = ['Altimmo — Immobilier', 'Mila Events — Événementiel', 'Altcom — Communication', 'Brazzaville, Congo', 'Votre vision. Notre expertise.'];
  return (
    <div style={{ background: '#C8872A', padding: 'clamp(10px,2vw,13px) 0', overflow: 'hidden' }}>
      <div className="av-ticker-inner">
        {[...items, ...items].map((item, i) => (
          <span key={i} style={{
            fontFamily: "'DM Sans',sans-serif",
            fontSize: 'clamp(0.62rem,1.5vw,0.7rem)',
            letterSpacing: '0.22em', textTransform: 'uppercase',
            color: '#0A0C0F', fontWeight: 500,
            padding: '0 clamp(24px,4vw,40px)', flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', gap: '16px',
          }}>
            {item}
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(10,12,15,0.35)', flexShrink: 0 }} />
          </span>
        ))}
      </div>
    </div>
  );
};

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
    <div style={{ minHeight: '100vh', background: '#0A0C0F', fontFamily: "'DM Sans',sans-serif" }}>
      <style>{RESPONSIVE_CSS}</style>
      <SEOHead
        title="Immobilier, Événements & Communication à Brazzaville"
        description="Altitude-Vision — Trouvez votre bien immobilier, organisez vos événements et boostez votre communication à Brazzaville, Congo."
        url="/"
      />

      {/* ══ HERO ══ */}
      <header style={{ position: 'relative', height: '100vh', minHeight: '580px', overflow: 'hidden' }}>
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
          <motion.div key={i} className="av-stat-item"
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6, delay: i * 0.1 }}>
            <div style={{
              fontFamily: "'Cormorant Garamond',serif",
              fontSize: 'clamp(2rem,5vw,4rem)',
              fontWeight: 300, lineHeight: 1, letterSpacing: '-0.02em',
              color: stat.color, marginBottom: '8px',
            }}>
              {stat.num}
            </div>
            <div style={{
              fontSize: 'clamp(0.62rem,1.4vw,0.72rem)',
              letterSpacing: '0.16em', textTransform: 'uppercase',
              color: 'rgba(232,228,220,0.38)', fontWeight: 400,
            }}>
              {stat.label}
            </div>
          </motion.div>
        ))}
      </div>

      {/* ══ PÔLES ══ */}
      <section className="av-section-inner">
        <div className="av-container">
          <motion.div style={{ marginBottom: 'clamp(40px,6vw,72px)' }}
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.7 }}>
            <Eyebrow>Notre Expertise</Eyebrow>
            {/* ✅ Même taille que "Qui sommes-nous ?" + nowrap pour tenir sur une ligne */}
            <h2 style={{
              fontFamily: "'Cormorant Garamond',serif",
              fontSize: H2_SIZE,
              fontWeight: 300, lineHeight: 1.1,
              letterSpacing: '-0.01em', color: '#E8E4DC',
              whiteSpace: 'nowrap',
            }}>
              Trois pôles,{' '}
              <em style={{ fontStyle: 'italic', color: '#C8872A' }}>une seule vision</em>
            </h2>
          </motion.div>

          <div className="av-poles-grid">
            {poles.map((pole, i) => {
              const Icon = pole.icon;
              return (
                <motion.div key={pole.id}
                  className="av-pole-card"
                  style={{ '--pole-color-light': pole.colorLight }}
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.6, delay: i * 0.1 }}>
                  <div className="av-pole-top-accent" style={{
                    position: 'absolute', top: 0, left: 0, right: 0,
                    height: '1px', background: pole.color, opacity: 0, transition: '0.3s',
                  }} />
                  <span style={{
                    display: 'block', fontFamily: "'Cormorant Garamond',serif",
                    fontSize: '0.85rem', fontWeight: 300,
                    color: 'rgba(232,228,220,0.2)',
                    letterSpacing: '0.15em', marginBottom: 'clamp(20px,3vw,36px)',
                  }}>
                    {pole.num}
                  </span>
                  <div style={{
                    width: '46px', height: '46px', borderRadius: '12px',
                    background: pole.colorLight, border: `1px solid ${pole.colorBorder}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 'clamp(16px,3vw,28px)', transition: '0.3s',
                  }}>
                    <Icon size={19} style={{ color: pole.color }} />
                  </div>
                  <h3 style={{
                    fontFamily: "'Cormorant Garamond',serif",
                    fontSize: 'clamp(1.5rem,3vw,2rem)',
                    fontWeight: 600, lineHeight: 1.1,
                    color: '#E8E4DC', marginBottom: '6px',
                  }}>
                    {pole.name}
                  </h3>
                  <p style={{
                    fontSize: '0.62rem', letterSpacing: '0.22em',
                    textTransform: 'uppercase', color: pole.color,
                    marginBottom: '16px', fontWeight: 400,
                  }}>
                    {pole.tag}
                  </p>
                  <div style={{ height: '1px', background: 'rgba(232,228,220,0.06)', marginBottom: '16px' }} />
                  <p style={{
                    fontSize: 'clamp(0.8rem,1.8vw,0.85rem)',
                    color: 'rgba(232,228,220,0.42)',
                    lineHeight: 1.75, marginBottom: 'clamp(16px,3vw,28px)', fontWeight: 300,
                  }}>
                    {pole.description}
                  </p>
                  <Link to={pole.pageroute} className="av-pole-link" style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    fontSize: '0.7rem', letterSpacing: '0.15em',
                    textTransform: 'uppercase', fontWeight: 500,
                    color: pole.color, opacity: 0,
                    transform: 'translateY(8px)', transition: '0.3s',
                  }}>
                    Découvrir <ArrowRight size={13} />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <div style={{
        height: '1px', margin: '0 var(--px)',
        background: 'linear-gradient(to right,transparent,rgba(200,135,42,0.25),rgba(46,123,181,0.15),transparent)',
      }} />

      {/* ══ QUI SOMMES-NOUS ══ */}
      <section className="av-section-inner">
        <div className="av-container">
          <div className="av-about-grid">
            <motion.div initial={{ opacity: 0, x: -28 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.8 }}>
              <Eyebrow>À propos</Eyebrow>
              <h2 style={{
                fontFamily: "'Cormorant Garamond',serif",
                fontSize: H2_SIZE,
                fontWeight: 300, lineHeight: 1.15,
                color: '#E8E4DC', marginBottom: '22px',
              }}>
                Qui sommes-<em style={{ fontStyle: 'italic', color: '#C8872A' }}>nous ?</em>
              </h2>
              <p style={{
                fontSize: 'clamp(0.85rem,2vw,0.92rem)',
                color: 'rgba(232,228,220,0.48)',
                lineHeight: 1.85, marginBottom: '14px', fontWeight: 300,
              }}>
                <span style={{ color: '#E8E4DC', fontWeight: 400 }}>Altitude-Vision</span>{' '}
                est une agence multidisciplinaire basée à Brazzaville. Nos trois pôles d'expertise travaillent en synergie pour vous offrir visibilité et résultats concrets.
              </p>
              <p style={{
                fontSize: 'clamp(0.82rem,1.8vw,0.88rem)',
                color: 'rgba(232,228,220,0.35)',
                lineHeight: 1.85, marginBottom: '32px', fontWeight: 300,
              }}>
                Immobilier de prestige, événementiel haut de gamme ou stratégie de communication — une seule agence suffit pour tous vos projets.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '36px' }}>
                {[
                  { icon: MapPin, text: 'Brazzaville, République du Congo' },
                  { icon: Phone,  text: '+242 06 800 21 51' },
                  { icon: Mail,   text: 'contact@altitudevision.agency' },
                ].map(({ icon: Icon, text }, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    fontSize: 'clamp(0.75rem,1.8vw,0.82rem)',
                    color: 'rgba(232,228,220,0.38)', fontWeight: 300,
                  }}>
                    <Icon size={13} style={{ color: '#C8872A', flexShrink: 0 }} />
                    {text}
                  </div>
                ))}
              </div>
              <Link to="/contact" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: 'clamp(10px,2vw,13px) clamp(18px,3vw,28px)',
                borderRadius: '40px', background: '#C8872A', color: '#0A0C0F',
                fontSize: 'clamp(0.68rem,1.5vw,0.75rem)', fontWeight: 500,
                letterSpacing: '0.08em', textTransform: 'uppercase', transition: '0.25s',
              }}>
                Nous contacter <ArrowRight size={13} />
              </Link>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 28 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.1 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {poles.map((pole, i) => {
                const Icon = pole.icon;
                return (
                  <motion.div key={pole.id}
                    initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
                    style={{
                      display: 'flex', alignItems: 'center',
                      gap: 'clamp(12px,2vw,20px)',
                      padding: 'clamp(18px,3vw,24px) clamp(16px,3vw,28px)',
                      border: '1px solid rgba(232,228,220,0.06)',
                      cursor: 'pointer', position: 'relative',
                      overflow: 'hidden', transition: '0.3s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = pole.colorLight;
                      e.currentTarget.querySelector('.mini-acc').style.opacity = '1';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.querySelector('.mini-acc').style.opacity = '0';
                    }}>
                    <div className="mini-acc" style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: '2px', background: pole.color, opacity: 0, transition: '0.3s',
                    }} />
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '10px',
                      background: pole.colorLight, border: `1px solid ${pole.colorBorder}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Icon size={16} style={{ color: pole.color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '0.88rem', fontWeight: 400, color: '#E8E4DC', marginBottom: '2px' }}>{pole.name}</p>
                      <p style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(232,228,220,0.32)' }}>{pole.tag}</p>
                    </div>
                    <Link to={pole.pageroute} style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      fontSize: '0.68rem', letterSpacing: '0.1em',
                      textTransform: 'uppercase', color: pole.color,
                      fontWeight: 400, flexShrink: 0,
                    }}>
                      Voir <ArrowRight size={12} />
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </section>

      <StatsCounter />

      {/* ══ ANNONCES ══ */}
      <section className="av-section-inner" style={{ background: 'linear-gradient(to bottom,rgba(17,20,24,0.5),transparent)' }}>
        <div className="av-container">
          <motion.div style={{ marginBottom: 'clamp(32px,5vw,56px)' }}
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.7 }}>
            <Eyebrow>Notre Sélection</Eyebrow>
            {/* ✅ Même taille que "Qui sommes-nous ?" */}
            <h2 style={{
              fontFamily: "'Cormorant Garamond',serif",
              fontSize: H2_SIZE,
              fontWeight: 300, lineHeight: 1.1,
              letterSpacing: '-0.01em', color: '#E8E4DC',
            }}>
              Nos Dernières{' '}
              <em style={{ fontStyle: 'italic', color: '#C8872A' }}>Annonces</em>
            </h2>
          </motion.div>

          <div className="av-tabs">
            {poles.map(pole => {
              const Icon = pole.icon;
              const isActive = activePole === pole.id;
              return (
                <motion.button key={pole.id}
                  onClick={() => setActivePole(pole.id)}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '7px',
                    padding: 'clamp(8px,1.5vw,10px) clamp(14px,3vw,22px)',
                    borderRadius: '40px',
                    border: isActive ? 'none' : `1px solid ${pole.colorBorder}`,
                    background: isActive ? pole.gradient : 'transparent',
                    color: isActive ? '#fff' : pole.color,
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 'clamp(0.68rem,1.5vw,0.78rem)',
                    fontWeight: 400, letterSpacing: '0.06em',
                    textTransform: 'uppercase', cursor: 'pointer', transition: '0.3s',
                    boxShadow: isActive ? `0 4px 24px ${pole.color}30` : 'none',
                  }}
                  aria-pressed={isActive}>
                  <Icon size={13} /> {pole.name}
                </motion.button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={activePole}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
              <div style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '24px', flexWrap: 'wrap', gap: '12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '2px', height: '20px', borderRadius: '1px', background: activePoleData?.color }} />
                  <h3 style={{
                    fontFamily: "'Cormorant Garamond',serif",
                    fontSize: 'clamp(1rem,2.5vw,1.2rem)',
                    fontWeight: 400, color: '#E8E4DC',
                  }}>
                    {activePoleData?.name}
                  </h3>
                </div>
                <Link to={activePoleData?.route} style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  fontSize: '0.7rem', letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: activePoleData?.color,
                  fontWeight: 400, transition: '0.2s',
                }}>
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
                <div style={{
                  textAlign: 'center',
                  padding: 'clamp(48px,8vw,80px) clamp(24px,4vw,40px)',
                  border: `1px dashed ${activePoleData?.colorBorder}`,
                  borderRadius: '20px', background: activePoleData?.colorLight,
                }}>
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '14px',
                    background: activePoleData?.gradient,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}>
                    {activePoleData && <activePoleData.icon size={22} color="#fff" />}
                  </div>
                  <p style={{ fontWeight: 400, color: '#E8E4DC', marginBottom: '6px' }}>Aucune annonce disponible</p>
                  <p style={{ fontSize: '0.82rem', color: 'rgba(232,228,220,0.38)', fontWeight: 300 }}>
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

      <section className="av-section-inner">
        <div className="av-container">
          <CtaCommission />
        </div>
      </section>
    </div>
  );
};

export default HomePage;