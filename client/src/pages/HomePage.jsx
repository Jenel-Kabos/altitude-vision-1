import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Building2, Calendar, Briefcase,
  MapPin, Phone, Mail,
} from 'lucide-react';

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

// ─── Données pôles ──────────────────────────────────────────
const poles = [
  {
    id:          'Altimmo',
    name:        'Altimmo',
    num:         '01',
    route:       '/altimmo/annonces',
    pageroute:   '/altimmo',
    icon:        Building2,
    color:       '#2E7BB5',
    colorLight:  'rgba(46,123,181,0.08)',
    colorBorder: 'rgba(46,123,181,0.15)',
    gradient:    'linear-gradient(135deg, #1A5A8A, #2E7BB5)',
    description: 'Trouvez le bien idéal parmi notre sélection exclusive de propriétés à Brazzaville. Vente, location et conseil expert.',
    tag:         'Immobilier',
  },
  {
    id:          'MilaEvents',
    name:        'Mila Events',
    num:         '02',
    route:       '/mila-events/annonces',
    pageroute:   '/mila-events',
    icon:        Calendar,
    color:       '#D42B2B',
    colorLight:  'rgba(212,43,43,0.08)',
    colorBorder: 'rgba(212,43,43,0.15)',
    gradient:    'linear-gradient(135deg, #A01E1E, #D42B2B)',
    description: 'Mariages, galas, séminaires — nous concevons des expériences sur mesure qui marquent les esprits.',
    tag:         'Événementiel',
  },
  {
    id:          'Altcom',
    name:        'Altcom',
    num:         '03',
    route:       '/altcom/annonces',
    pageroute:   '/altcom',
    icon:        Briefcase,
    color:       '#C8872A',
    colorLight:  'rgba(200,135,42,0.08)',
    colorBorder: 'rgba(200,135,42,0.15)',
    gradient:    'linear-gradient(135deg, #A0671A, #C8872A)',
    description: 'Stratégie de communication, branding et visibilité digitale pour propulser votre image.',
    tag:         'Communication',
  },
];

// ─── Skeleton ───────────────────────────────────────────────
const PageSkeleton = () => (
  <div style={{ minHeight: '100vh', background: '#0A0C0F' }}>
    <div style={{ height: '100vh', background: 'linear-gradient(160deg, #0D1520, #080B0E)' }} />
    <div style={{ padding: '120px 48px', maxWidth: '900px', margin: '0 auto' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          height: '16px', borderRadius: '8px', marginBottom: '16px',
          background: 'rgba(232,228,220,0.05)',
          width: i === 1 ? '40%' : i === 2 ? '70%' : '55%',
          animation: 'avSkeletonPulse 2s ease-in-out infinite',
        }} />
      ))}
    </div>
    <style>{`@keyframes avSkeletonPulse { 0%,100%{opacity:.4} 50%{opacity:.8} }`}</style>
  </div>
);

// ─── Ticker component ────────────────────────────────────────
const Ticker = () => {
  const items = [
    'Altimmo — Immobilier',
    'Mila Events — Événementiel',
    'Altcom — Communication',
    'Brazzaville, Congo',
    'Votre vision. Notre expertise.',
  ];
  const doubled = [...items, ...items];

  return (
    <div style={{
      background: '#C8872A',
      padding: '13px 0',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{
        display: 'flex',
        animation: 'avTicker 28s linear infinite',
        whiteSpace: 'nowrap',
      }}>
        {doubled.map((item, i) => (
          <span key={i} style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.7rem',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: '#0A0C0F',
            fontWeight: 500,
            padding: '0 40px',
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '20px',
          }}>
            {item}
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(10,12,15,0.35)' }} />
          </span>
        ))}
      </div>
      <style>{`@keyframes avTicker { from{transform:translateX(0)} to{transform:translateX(-50%)} }`}</style>
    </div>
  );
};

// ─── Composant principal ──────────────────────────────────────
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
        const recentEvents    = allEvents.filter(e => e.status === 'Publié').slice(0, 5);
        const recentPortfolio = allPortfolio
          .filter(item => item.isPublished)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 5);
        setLatestProperties({
          Altimmo:    propertiesResults.Altimmo || [],
          MilaEvents: recentEvents,
          Altcom:     recentPortfolio,
        });
      } catch {
        setLatestProperties({});
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const activePoleItems = latestProperties[activePole] || [];
  const activePoleData  = poles.find(p => p.id === activePole);

  if (isLoading) return <PageSkeleton />;

  return (
    <div style={{ minHeight: '100vh', background: '#0A0C0F', fontFamily: "'DM Sans', sans-serif" }}>
      <SEOHead
        title="Immobilier, Événements & Communication à Brazzaville"
        description="Altitude-Vision — Trouvez votre bien immobilier, organisez vos événements et boostez votre communication à Brazzaville, Congo."
        url="/"
      />

      {/* ══════════════════════════════════════════
          HERO
      ══════════════════════════════════════════ */}
      <header style={{
        position: 'relative', color: '#fff',
        height: '100vh', minHeight: '640px',
        overflow: 'hidden',
      }}>
        <HeroSlider />
      </header>

      {/* ══════════════════════════════════════════
          TICKER
      ══════════════════════════════════════════ */}
      <Ticker />

      {/* ══════════════════════════════════════════
          STATS
      ══════════════════════════════════════════ */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        borderTop: '1px solid rgba(232,228,220,0.06)',
        borderBottom: '1px solid rgba(232,228,220,0.06)',
      }}>
        {[
          { num: '3',    label: 'Pôles d\'expertise',   color: '#C8872A' },
          { num: '150+', label: 'Biens immobiliers',     color: '#2E7BB5' },
          { num: '80+',  label: 'Événements organisés',  color: '#D42B2B' },
          { num: '∞',    label: 'Possibilités offertes', color: '#C8872A' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: i * 0.1 }}
            style={{
              padding: '52px 44px',
              borderRight: i < 3 ? '1px solid rgba(232,228,220,0.06)' : 'none',
            }}
          >
            <div style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(2.5rem, 4vw, 4rem)',
              fontWeight: 300, lineHeight: 1,
              letterSpacing: '-0.02em',
              color: stat.color,
              marginBottom: '8px',
            }}>
              {stat.num}
            </div>
            <div style={{
              fontSize: '0.72rem', letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(232,228,220,0.4)',
              fontWeight: 400,
            }}>
              {stat.label}
            </div>
          </motion.div>
        ))}
      </div>

      {/* ══════════════════════════════════════════
          NOS PÔLES D'EXCELLENCE
      ══════════════════════════════════════════ */}
      <section style={{ padding: '120px 48px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

          {/* En-tête */}
          <motion.div
            style={{ marginBottom: '72px' }}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <p style={{
              fontSize: '0.68rem', letterSpacing: '0.3em',
              textTransform: 'uppercase', color: '#C8872A',
              display: 'flex', alignItems: 'center', gap: '14px',
              marginBottom: '20px', fontWeight: 400,
            }}>
              <span style={{ width: '24px', height: '1px', background: '#C8872A', flexShrink: 0 }} />
              Notre Expertise
            </p>
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(2.5rem, 5vw, 4rem)',
              fontWeight: 300, lineHeight: 1.1,
              letterSpacing: '-0.01em',
              color: '#E8E4DC', maxWidth: '560px',
            }}>
              Trois pôles,{' '}
              <em style={{ fontStyle: 'italic', color: '#C8872A' }}>une seule vision</em>
            </h2>
          </motion.div>

          {/* Grid des pôles */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            border: '1px solid rgba(232,228,220,0.06)',
          }}>
            {poles.map((pole, i) => {
              const Icon = pole.icon;
              return (
                <motion.div
                  key={pole.id}
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.6, delay: i * 0.12 }}
                  className="group"
                  style={{
                    padding: '52px 44px',
                    borderRight: i < 2 ? '1px solid rgba(232,228,220,0.06)' : 'none',
                    cursor: 'pointer', position: 'relative', overflow: 'hidden',
                    transition: '0.4s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = pole.colorLight;
                    e.currentTarget.querySelector('.pole-link').style.opacity = '1';
                    e.currentTarget.querySelector('.pole-link').style.transform = 'translateY(0)';
                    e.currentTarget.querySelector('.pole-top-accent').style.opacity = '1';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.querySelector('.pole-link').style.opacity = '0';
                    e.currentTarget.querySelector('.pole-link').style.transform = 'translateY(8px)';
                    e.currentTarget.querySelector('.pole-top-accent').style.opacity = '0';
                  }}
                >
                  {/* Accent top */}
                  <div className="pole-top-accent" style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                    background: pole.color, opacity: 0, transition: '0.3s',
                  }} />

                  {/* Numéro */}
                  <span style={{
                    display: 'block',
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: '0.85rem', fontWeight: 300,
                    color: 'rgba(232,228,220,0.25)',
                    letterSpacing: '0.15em',
                    marginBottom: '36px',
                  }}>
                    {pole.num}
                  </span>

                  {/* Icône */}
                  <div style={{
                    width: '48px', height: '48px',
                    borderRadius: '12px',
                    background: pole.colorLight,
                    border: `1px solid ${pole.colorBorder}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '28px',
                    transition: '0.3s',
                  }}>
                    <Icon size={20} style={{ color: pole.color }} />
                  </div>

                  {/* Nom */}
                  <h3 style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: '2rem', fontWeight: 600,
                    lineHeight: 1.1, letterSpacing: '-0.01em',
                    color: '#E8E4DC', marginBottom: '6px',
                  }}>
                    {pole.name}
                  </h3>

                  {/* Tag */}
                  <p style={{
                    fontSize: '0.65rem', letterSpacing: '0.22em',
                    textTransform: 'uppercase', color: pole.color,
                    marginBottom: '18px', fontWeight: 400,
                  }}>
                    {pole.tag}
                  </p>

                  {/* Séparateur */}
                  <div style={{
                    height: '1px', background: 'rgba(232,228,220,0.06)',
                    marginBottom: '18px',
                  }} />

                  {/* Description */}
                  <p style={{
                    fontSize: '0.85rem', color: 'rgba(232,228,220,0.45)',
                    lineHeight: 1.75, marginBottom: '28px', fontWeight: 300,
                  }}>
                    {pole.description}
                  </p>

                  {/* Lien */}
                  <Link
                    to={pole.pageroute}
                    className="pole-link"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '8px',
                      fontSize: '0.72rem', letterSpacing: '0.15em',
                      textTransform: 'uppercase', fontWeight: 500,
                      color: pole.color, textDecoration: 'none',
                      opacity: 0, transform: 'translateY(8px)',
                      transition: '0.3s',
                    }}
                  >
                    Découvrir <ArrowRight size={13} />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div style={{
        height: '1px', margin: '0 48px',
        background: 'linear-gradient(to right, transparent, rgba(200,135,42,0.25), rgba(46,123,181,0.15), transparent)',
      }} />

      {/* ══════════════════════════════════════════
          QUI SOMMES-NOUS
      ══════════════════════════════════════════ */}
      <section style={{ padding: '120px 48px' }}>
        <div style={{
          maxWidth: '1200px', margin: '0 auto',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '100px',
          alignItems: 'center',
        }}>

          {/* Gauche */}
          <motion.div
            initial={{ opacity: 0, x: -32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <p style={{
              fontSize: '0.68rem', letterSpacing: '0.3em',
              textTransform: 'uppercase', color: '#C8872A',
              display: 'flex', alignItems: 'center', gap: '14px',
              marginBottom: '20px', fontWeight: 400,
            }}>
              <span style={{ width: '24px', height: '1px', background: '#C8872A', flexShrink: 0 }} />
              À propos
            </p>

            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(2.2rem, 4vw, 3.5rem)',
              fontWeight: 300, lineHeight: 1.15,
              letterSpacing: '-0.01em',
              color: '#E8E4DC', marginBottom: '24px',
            }}>
              Qui sommes-<em style={{ fontStyle: 'italic', color: '#C8872A' }}>nous ?</em>
            </h2>

            <p style={{
              fontSize: '0.92rem', color: 'rgba(232,228,220,0.5)',
              lineHeight: 1.85, marginBottom: '16px', fontWeight: 300,
            }}>
              <span style={{ color: '#E8E4DC', fontWeight: 400 }}>Altitude-Vision</span>{' '}
              est une agence multidisciplinaire basée à Brazzaville. Nos trois pôles d'expertise travaillent en synergie pour vous offrir visibilité et résultats concrets.
            </p>
            <p style={{
              fontSize: '0.88rem', color: 'rgba(232,228,220,0.38)',
              lineHeight: 1.85, marginBottom: '36px', fontWeight: 300,
            }}>
              Immobilier de prestige, événementiel haut de gamme ou stratégie de communication — une seule agence suffit pour tous vos projets.
            </p>

            {/* Contacts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '40px' }}>
              {[
                { icon: MapPin, text: 'Brazzaville, République du Congo' },
                { icon: Phone,  text: '+242 06 800 21 51' },
                { icon: Mail,   text: 'contact@altitudevision.agency' },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  fontSize: '0.82rem', color: 'rgba(232,228,220,0.4)', fontWeight: 300,
                }}>
                  <Icon size={14} style={{ color: '#C8872A', flexShrink: 0 }} />
                  {text}
                </div>
              ))}
            </div>

            <Link to="/contact" style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '13px 28px', borderRadius: '40px',
              background: '#C8872A', color: '#0A0C0F',
              fontSize: '0.75rem', fontWeight: 500,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              textDecoration: 'none', transition: '0.25s',
            }}>
              Nous contacter <ArrowRight size={13} />
            </Link>
          </motion.div>

          {/* Droite — mini-cards pôles */}
          <motion.div
            initial={{ opacity: 0, x: 32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.1 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}
          >
            {poles.map((pole, i) => {
              const Icon = pole.icon;
              return (
                <motion.div
                  key={pole.id}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '20px',
                    padding: '24px 28px',
                    border: '1px solid rgba(232,228,220,0.06)',
                    cursor: 'pointer', position: 'relative',
                    overflow: 'hidden', transition: '0.3s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = pole.colorLight;
                    e.currentTarget.querySelector('.mini-accent').style.opacity = '1';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.querySelector('.mini-accent').style.opacity = '0';
                  }}
                >
                  <div className="mini-accent" style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0, width: '2px',
                    background: pole.color, opacity: 0, transition: '0.3s',
                  }} />

                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    background: pole.colorLight,
                    border: `1px solid ${pole.colorBorder}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={17} style={{ color: pole.color }} />
                  </div>

                  <div style={{ flex: 1 }}>
                    <p style={{
                      fontSize: '0.9rem', fontWeight: 400,
                      color: '#E8E4DC', marginBottom: '2px',
                    }}>
                      {pole.name}
                    </p>
                    <p style={{
                      fontSize: '0.68rem', letterSpacing: '0.12em',
                      textTransform: 'uppercase', color: 'rgba(232,228,220,0.35)',
                    }}>
                      {pole.tag}
                    </p>
                  </div>

                  <Link to={pole.pageroute} style={{
                    fontSize: '0.72rem', letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: pole.color,
                    textDecoration: 'none', fontWeight: 400,
                    display: 'flex', alignItems: 'center', gap: '6px',
                    flexShrink: 0,
                  }}>
                    Voir <ArrowRight size={12} />
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          CHIFFRES CLÉS (composant existant)
      ══════════════════════════════════════════ */}
      <StatsCounter />

      {/* ══════════════════════════════════════════
          NOS DERNIÈRES ANNONCES
      ══════════════════════════════════════════ */}
      <section style={{
        padding: '120px 48px',
        background: 'linear-gradient(to bottom, rgba(17,20,24,0.6), transparent)',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

          {/* En-tête */}
          <motion.div
            style={{ marginBottom: '60px' }}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <p style={{
              fontSize: '0.68rem', letterSpacing: '0.3em',
              textTransform: 'uppercase', color: '#C8872A',
              display: 'flex', alignItems: 'center', gap: '14px',
              marginBottom: '20px', fontWeight: 400,
            }}>
              <span style={{ width: '24px', height: '1px', background: '#C8872A', flexShrink: 0 }} />
              Notre Sélection
            </p>
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(2.5rem, 5vw, 4rem)',
              fontWeight: 300, lineHeight: 1.1,
              letterSpacing: '-0.01em', color: '#E8E4DC',
            }}>
              Nos Dernières{' '}
              <em style={{ fontStyle: 'italic', color: '#C8872A' }}>Annonces</em>
            </h2>
          </motion.div>

          {/* Onglets */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '48px' }}>
            {poles.map(pole => {
              const Icon     = pole.icon;
              const isActive = activePole === pole.id;
              return (
                <motion.button
                  key={pole.id}
                  onClick={() => setActivePole(pole.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 22px', borderRadius: '40px',
                    border: isActive ? 'none' : `1px solid ${pole.colorBorder}`,
                    background: isActive ? pole.gradient : 'transparent',
                    color: isActive ? '#fff' : pole.color,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.78rem', fontWeight: 400,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    cursor: 'pointer', transition: '0.3s',
                    boxShadow: isActive ? `0 4px 24px ${pole.color}35` : 'none',
                  }}
                  aria-pressed={isActive}
                >
                  <Icon size={14} /> {pole.name}
                </motion.button>
              );
            })}
          </div>

          {/* Contenu annonces */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activePole}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
            >
              <div style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', marginBottom: '28px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '2px', height: '22px', borderRadius: '1px',
                    background: activePoleData?.color,
                  }} />
                  <h3 style={{
                    fontSize: '1.2rem', fontWeight: 400,
                    color: '#E8E4DC',
                    fontFamily: "'Cormorant Garamond', serif",
                    letterSpacing: '-0.01em',
                  }}>
                    {activePoleData?.name}
                  </h3>
                </div>
                <Link to={activePoleData?.route} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '0.72rem', letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: activePoleData?.color, textDecoration: 'none',
                  fontWeight: 400, transition: '0.2s',
                }}>
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
                  textAlign: 'center', padding: '80px 40px',
                  border: `1px dashed ${activePoleData?.colorBorder}`,
                  borderRadius: '20px',
                  background: activePoleData?.colorLight,
                }}>
                  <div style={{
                    width: '56px', height: '56px', borderRadius: '16px',
                    background: activePoleData?.gradient,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 20px',
                  }}>
                    {activePoleData && <activePoleData.icon size={24} color="#fff" />}
                  </div>
                  <p style={{ fontWeight: 400, color: '#E8E4DC', marginBottom: '6px' }}>
                    Aucune annonce disponible
                  </p>
                  <p style={{ fontSize: '0.82rem', color: 'rgba(232,228,220,0.4)', fontWeight: 300 }}>
                    Les nouvelles annonces pour {activePoleData?.name} arrivent bientôt
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          POURQUOI NOUS CHOISIR (composant existant)
      ══════════════════════════════════════════ */}
      <WhyChooseUs />

      {/* ══════════════════════════════════════════
          FIL FACEBOOK (composant existant)
      ══════════════════════════════════════════ */}
      <FacebookFeed />

      {/* ══════════════════════════════════════════
          TÉMOIGNAGES (composant existant)
      ══════════════════════════════════════════ */}
      <Testimonials />

      {/* ══════════════════════════════════════════
          CTA COMMISSION
      ══════════════════════════════════════════ */}
      <section style={{ padding: '0 48px 120px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <CtaCommission />
        </div>
      </section>
    </div>
  );
};

export default HomePage;