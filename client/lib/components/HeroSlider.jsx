"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Building2, Calendar, Briefcase } from 'lucide-react';

const slides = [
  {
    title:    "L'Immobilier\nde Prestige",
    subtitle: "Trouvez le bien qui vous ressemble — vente, location, conseil expert à Brazzaville",
    image:    "https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=1600&q=80",
    imgWidth: 1600,
    imgHeight:1067,
    cta:      { label: "Découvrir Altimmo", route: "/altimmo" },
    accent:   "#2E7BB5",
    pole:     "Altimmo",
  },
  {
    title:    "L'Art de\nl'Événementiel",
    subtitle: "Mariages, galas, conférences — nous transformons chaque moment en souvenir inoubliable",
    image:    "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?q=80&w=1170&auto=format&fit=crop",
    imgWidth: 1170,
    imgHeight:780,
    cta:      { label: "Découvrir Mila Events", route: "/mila-events" },
    accent:   "#D42B2B",
    pole:     "Mila Events",
  },
  {
    title:    "La Communication\nQui Impacte",
    subtitle: "Stratégie, branding, visibilité digitale — propulsez votre image au niveau supérieur",
    image:    "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1170&auto=format&fit=crop",
    imgWidth: 1170,
    imgHeight:780,
    cta:      { label: "Découvrir Altcom", route: "/altcom" },
    accent:   "#C8872A",
    pole:     "Altcom",
  },
];

const poles = [
  { label: "Altimmo",     sub: "Immobilier",    icon: Building2, route: "/altimmo",     color: "#2E7BB5" },
  { label: "Mila Events", sub: "Événementiel",  icon: Calendar,  route: "/mila-events", color: "#D42B2B" },
  { label: "Altcom",      sub: "Communication", icon: Briefcase, route: "/altcom",      color: "#C8872A" },
];

const SLIDE_DURATION = 7000;

/* ─── CSS injecté une seule fois ─── */
const HERO_CSS = `
  @keyframes avPulse {
    0%,100% { opacity:1; transform:scale(1); }
    50%      { opacity:.6; transform:scale(1.3); }
  }
  @keyframes avTickerHero {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }

  /* ── Hero layout ── */
  .av-hero-content {
    position: absolute; inset: 0; z-index: 10;
    display: flex; flex-direction: column; justify-content: flex-end;
    padding: 0 0 0 0;
  }

  /* Zone texte — desktop : centré verticalement ; mobile : poussé vers le bas */
  .av-hero-text-zone {
    padding: 90px 24px 180px;
  }
  @media (min-width: 640px) {
    .av-hero-text-zone {
      padding: 100px 48px 200px;
    }
  }
  @media (min-width: 1024px) {
    .av-hero-text-zone {
      padding: 100px 64px 180px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      height: 100%;
    }
  }
  @media (min-width: 1440px) {
    .av-hero-text-zone {
      padding: 120px 120px 200px;
    }
  }
  @media (min-width: 1920px) {
    .av-hero-text-zone {
      padding: 140px 160px 220px;
    }
  }

  /* ── Pill pôle ── */
  .av-pole-pill {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 16px; border-radius: 40px;
    border: 1px solid rgba(255,255,255,0.14);
    backdrop-filter: blur(10px);
    font-size: clamp(0.65rem, 0.9vw, 0.85rem);
    font-weight: 400; letter-spacing: 0.26em;
    text-transform: uppercase; color: rgba(255,255,255,0.92);
    margin-bottom: 18px;
  }
  @media (min-width: 768px) {
    .av-pole-pill { font-size: 0.65rem; margin-bottom: 20px; }
  }

  /* ── Titre hero ── */
  .av-hero-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(2.6rem, 7vw, 8rem);
    font-weight: 300; line-height: 1.0;
    letter-spacing: -0.02em; color: #fff;
    margin-bottom: 16px;
    max-width: 900px; white-space: pre-line;
  }

  /* ── Sous-titre hero ── */
  .av-hero-subtitle {
    font-family: 'DM Sans', sans-serif;
    font-size: clamp(0.95rem, 2.5vw, 1.5rem);
    font-weight: 300; color: rgba(255,255,255,0.85);
    max-width: 600px; line-height: 1.75;
    margin-bottom: 32px;
  }

  /* ── Boutons CTA ── */
  .av-hero-cta-primary {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 14px 28px; border-radius: 40px;
    color: #0A0C0F;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.82rem;               /* mobile : 0.82rem lisible */
    font-weight: 600; letter-spacing: 0.06em;
    text-transform: uppercase; transition: 0.25s;
  }
  @media (min-width: 768px) {
    .av-hero-cta-primary { font-size: 0.78rem; padding: 13px 28px; }
  }
  @media (min-width: 1440px) {
    .av-hero-cta-primary { font-size: 0.9rem; padding: 15px 36px; min-height: 52px; }
  }

  .av-hero-cta-secondary {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 13px 28px; border-radius: 40px;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.22);
    backdrop-filter: blur(8px); color: rgba(255,255,255,0.85);
    font-family: 'DM Sans', sans-serif;
    font-size: 0.82rem;
    font-weight: 300; letter-spacing: 0.06em;
    text-transform: uppercase; transition: 0.25s;
  }
  @media (min-width: 768px) {
    .av-hero-cta-secondary { font-size: 0.78rem; padding: 12px 28px; }
  }
  @media (min-width: 1440px) {
    .av-hero-cta-secondary { font-size: 0.9rem; padding: 14px 36px; min-height: 52px; }
  }

  /* Wrap boutons mobile = colonne, desktop = ligne */
  .av-hero-cta-group {
    display: flex; gap: 12px; flex-wrap: wrap;
  }
  @media (max-width: 480px) {
    .av-hero-cta-group { flex-direction: column; align-items: flex-start; }
    .av-hero-cta-primary, .av-hero-cta-secondary { width: 100%; justify-content: center; }
  }

  /* ── Flèches nav ── */
  .av-arrow {
    position: absolute; top: 50%; transform: translateY(-50%);
    z-index: 20; border-radius: 50%;
    background: rgba(255,255,255,0.08);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.75);
    display: flex; align-items: center; justify-content: center;
    transition: 0.2s; cursor: pointer;
    /* ↑ mobile : cible tactile généreuse */
    min-width: 48px; min-height: 48px;
    width: 48px; height: 48px;
  }
  @media (min-width: 768px) {
    .av-arrow { width: 44px; height: 44px; min-width: 44px; min-height: 44px; }
  }
  .av-arrow-left  { left: 14px; }
  .av-arrow-right { right: 14px; }
  @media (min-width: 768px) {
    .av-arrow-left  { left: 20px; }
    .av-arrow-right { right: 20px; }
  }

  /* ── Compteur ── */
  .av-counter {
    position: absolute; top: 20px;
    right: 16px;
    z-index: 20;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.72rem;          /* ↑ mobile lisible */
    letter-spacing: 0.18em;
    color: rgba(255,255,255,0.3);
    user-select: none; pointer-events: none;
  }
  @media (min-width: 768px) {
    .av-counter { font-size: 0.62rem; right: 24px; }
  }

  /* ── Indicateurs verticaux ── */
  .av-dots-col {
    position: absolute;
    top: 50%; transform: translateY(-50%);
    right: 14px; z-index: 20;
    display: flex; flex-direction: column;
    align-items: center; gap: 10px;
  }
  @media (min-width: 768px) {
    .av-dots-col { right: 20px; }
  }
  /* Masquer sur très petits écrans pour laisser place au contenu */
  @media (max-width: 360px) {
    .av-dots-col { display: none; }
  }

  /* ── Bandeau pôles ── */
  .av-poles-band {
    position: absolute; bottom: 0; left: 0; right: 0; z-index: 20;
  }
  .av-poles-grid {
    display: grid; grid-template-columns: repeat(3, 1fr);
    background: rgba(5,8,12,0.7); backdrop-filter: blur(20px);
  }
  .av-pole-item {
    display: flex; align-items: center;
    gap: 10px;
    padding: 14px 12px;
    border-right: 1px solid rgba(255,255,255,0.05);
    position: relative; overflow: hidden; transition: 0.3s;
  }
  .av-pole-item:last-child { border-right: none; }
  @media (min-width: 640px) {
    .av-pole-item { padding: 16px 20px; gap: 12px; }
  }
  @media (min-width: 1024px) {
    .av-pole-item { padding: 18px 28px; gap: 14px; }
  }

  /* Icône pôle */
  .av-pole-icon {
    width: 34px; height: 34px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: 0.3s;
  }
  @media (min-width: 640px) {
    .av-pole-icon { width: 38px; height: 38px; border-radius: 10px; }
  }

  /* Texte pôle : masqué sur < 360px, visible ensuite */
  .av-pole-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.8rem; font-weight: 400;
    white-space: nowrap; transition: 0.3s;
  }
  .av-pole-sub {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.6rem; letter-spacing: 0.1em;
    text-transform: uppercase; white-space: nowrap; transition: 0.3s;
  }
  @media (max-width: 359px) {
    .av-pole-label, .av-pole-sub { display: none; }
    .av-pole-item { justify-content: center; }
  }
  @media (min-width: 768px) {
    .av-pole-label { font-size: 0.84rem; }
    .av-pole-sub   { font-size: 0.65rem; }
  }
`;

const HeroSlider = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection]       = useState(1);
  const [progress, setProgress]         = useState(0);
  const timerRef    = useRef(null);
  const progressRef = useRef(null);

  const resetTimers = useCallback(() => {
    clearInterval(timerRef.current);
    clearInterval(progressRef.current);
    setProgress(0);
    timerRef.current = setInterval(() => {
      setDirection(1);
      setCurrentIndex(p => (p + 1) % slides.length);
      setProgress(0);
    }, SLIDE_DURATION);
    progressRef.current = setInterval(() => {
      setProgress(p => Math.min(p + 100 / (SLIDE_DURATION / 50), 100));
    }, 50);
  }, []);

  useEffect(() => {
    resetTimers();
    return () => { clearInterval(timerRef.current); clearInterval(progressRef.current); };
  }, [resetTimers]);

  const goTo = (i) => { if (i === currentIndex) return; setDirection(i > currentIndex ? 1 : -1); setCurrentIndex(i); resetTimers(); };
  const prev = () => { setDirection(-1); setCurrentIndex(p => (p - 1 + slides.length) % slides.length); resetTimers(); };
  const next = () => { setDirection(1);  setCurrentIndex(p => (p + 1) % slides.length); resetTimers(); };

  const slideVariants = {
    enter:  (d) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: '0%', opacity: 1, transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] } },
    exit:   (d) => ({ x: d < 0 ? '100%' : '-100%', opacity: 0, transition: { duration: 0.65, ease: [0.55, 0, 1, 0.45] } }),
  };

  const textV = {
    hidden:  { opacity: 0, y: 36 },
    visible: (delay) => ({ opacity: 1, y: 0, transition: { duration: 0.75, delay, ease: [0.25, 0.46, 0.45, 0.94] } }),
  };

  const current = slides[currentIndex];

  return (
    <div
      style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
      role="region"
      aria-label="Diaporama Altitude-Vision"
      aria-roledescription="carousel"
    >
      <style>{HERO_CSS}</style>

      {/* ── Slides ── */}
      <AnimatePresence initial={false} custom={direction} mode="wait">
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          style={{ position: 'absolute', inset: 0 }}
          role="group"
          aria-roledescription="diapositive"
          aria-label={`${currentIndex + 1} sur ${slides.length} : ${current.pole}`}
        >
          <motion.div
            style={{ position: 'absolute', inset: 0 }}
            initial={{ scale: 1.08 }}
            animate={{ scale: 1.02 }}
            transition={{ duration: SLIDE_DURATION / 1000, ease: 'linear' }}
          >
            <img
              src={current.image}
              srcSet={`${current.image.replace('w=1600', 'w=480')} 480w,
                       ${current.image.replace('w=1600', 'w=800')} 800w,
                       ${current.image} 1600w`}
              sizes="(max-width: 640px) 480px, (max-width: 1024px) 800px, 1600px"
              alt={current.title.replace('\n', ' ')}
              width={current.imgWidth}
              height={current.imgHeight}
              fetchPriority={currentIndex === 0 ? 'high' : 'low'}
              loading={currentIndex === 0 ? 'eager' : 'lazy'}
              decoding={currentIndex === 0 ? 'sync' : 'async'}
              style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center' }}
            />
          </motion.div>

          {/* Dégradés superposés — plus dense sur mobile */}
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(105deg, rgba(5,8,12,0.92) 0%, rgba(5,8,12,0.58) 55%, rgba(5,8,12,0.28) 100%)' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(5,8,12,0.85) 0%, rgba(5,8,12,0.1) 60%)' }} />
          {/* Accent vertical */}
          <motion.div style={{
            position:'absolute', top:0, left:0, width:'2px', height:'100%',
            background:`linear-gradient(to bottom, transparent, ${current.accent}, transparent)`,
          }} initial={{ scaleY:0, originY:0 }} animate={{ scaleY:1 }} transition={{ duration:1.2, delay:0.2 }} />
        </motion.div>
      </AnimatePresence>

      {/* ── Contenu texte ── */}
      <div className="av-hero-content">
        <div className="av-hero-text-zone">
          <AnimatePresence mode="wait">
            <div key={currentIndex}>

              {/* Pill */}
              <motion.div custom={0.1} variants={textV} initial="hidden" animate="visible">
                <span className="av-pole-pill" style={{ background:`${current.accent}28` }}>
                  <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:current.accent, animation:'avPulse 2s ease-in-out infinite' }} />
                  {current.pole}
                </span>
              </motion.div>

              {/* Titre */}
              <motion.h1 custom={0.25} variants={textV} initial="hidden" animate="visible"
                className="av-hero-title">
                {current.title}
              </motion.h1>

              {/* Séparateur */}
              <motion.div custom={0.38} variants={textV} initial="hidden" animate="visible"
                style={{ marginBottom:'16px' }}>
                <div style={{ height:'1px', width:'50px', background:`linear-gradient(to right, ${current.accent}, transparent)` }} />
              </motion.div>

              {/* Sous-titre */}
              <motion.p custom={0.45} variants={textV} initial="hidden" animate="visible"
                className="av-hero-subtitle">
                {current.subtitle}
              </motion.p>

              {/* CTAs */}
              <motion.div custom={0.55} variants={textV} initial="hidden" animate="visible"
                className="av-hero-cta-group">
                <Link href={current.cta.route}
                  className="av-hero-cta-primary"
                  style={{ background:current.accent, boxShadow:`0 8px 32px ${current.accent}55` }}>
                  {current.cta.label} →
                </Link>
                <Link href="/contact" className="av-hero-cta-secondary">
                  Nous contacter
                </Link>
              </motion.div>

            </div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Flèches ── */}
      <button onClick={prev} aria-label="Slide Précédente" className="av-arrow av-arrow-left">
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <button onClick={next} aria-label="Slide Suivante" className="av-arrow av-arrow-right">
        <ChevronRight size={20} aria-hidden="true" />
      </button>

      {/* ── Compteur ── */}
      <div className="av-counter" aria-hidden="true">
        {String(currentIndex + 1).padStart(2,'0')} / {String(slides.length).padStart(2,'0')}
      </div>

      {/* ── Indicateurs verticaux ── */}
      <div className="av-dots-col">
        <div style={{ width:'1px', height:'48px', background:'rgba(255,255,255,0.1)', overflow:'hidden' }}>
          <motion.div style={{ width:'100%', background:current.accent, height:`${progress}%` }} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'7px' }} role="tablist" aria-label="Diapositives">
          {slides.map((_, i) => (
            <button key={i} onClick={() => goTo(i)} aria-label={`Slide ${i+1}`}
              role="tab" aria-selected={i === currentIndex}
              style={{
                border:'none', cursor:'pointer', padding:0, borderRadius:'50%',
                transition:'0.3s',
                width: i === currentIndex ? '7px' : '5px',
                height: i === currentIndex ? '7px' : '5px',
                background: i === currentIndex ? current.accent : 'rgba(255,255,255,0.25)',
                boxShadow: i === currentIndex ? `0 0 8px ${current.accent}` : 'none',
                minWidth:'20px', minHeight:'20px',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
              <span style={{
                width: i === currentIndex ? '7px' : '5px',
                height: i === currentIndex ? '7px' : '5px',
                borderRadius:'50%',
                background: i === currentIndex ? current.accent : 'rgba(255,255,255,0.25)',
                display:'block',
              }} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Bandeau pôles ── */}
      <div className="av-poles-band">
        <div style={{ height:'1px', background:'rgba(255,255,255,0.06)' }} />
        <div className="av-poles-grid">
          {poles.map((pole, i) => {
            const Icon = pole.icon;
            const isActive = slides[currentIndex].pole === pole.label;
            return (
              <Link key={i} href={pole.route} className="av-pole-item">
                <div style={{
                  position:'absolute', top:0, left:0, right:0, height:'2px',
                  background:pole.color, opacity: isActive ? 1 : 0, transition:'0.3s',
                }} />
                <div className="av-pole-icon" style={{
                  background: isActive ? `${pole.color}28` : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${isActive ? pole.color+'44' : 'rgba(255,255,255,0.07)'}`,
                }}>
                  <Icon size={15} style={{ color: isActive ? pole.color : 'rgba(255,255,255,0.4)' }} aria-hidden="true" />
                </div>
                <div style={{ minWidth:0, display:'flex', flexDirection:'column' }}>
                  <p className="av-pole-label" style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.5)', fontWeight: isActive ? 500 : 300 }}>
                    {pole.label}
                  </p>
                  <p className="av-pole-sub" style={{ color: isActive ? pole.color : 'rgba(255,255,255,0.28)' }}>
                    {pole.sub}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HeroSlider;