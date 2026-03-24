import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Building2, Calendar, Briefcase } from 'lucide-react';

const slides = [
  {
    title:    "L'Immobilier\nde Prestige",
    subtitle: "Trouvez le bien qui vous ressemble — vente, location, conseil expert à Brazzaville",
    image:    "https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=1600&q=80",
    cta:      { label: "Découvrir Altimmo", route: "/altimmo" },
    accent:   "#2E7BB5",
    pole:     "Altimmo",
  },
  {
    title:    "L'Art de\nl'Événementiel",
    subtitle: "Mariages, galas, conférences — nous transformons chaque moment en souvenir inoubliable",
    image:    "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?q=80&w=1170&auto=format&fit=crop",
    cta:      { label: "Découvrir Mila Events", route: "/mila-events" },
    accent:   "#D42B2B",
    pole:     "Mila Events",
  },
  {
    title:    "La Communication\nQui Impacte",
    subtitle: "Stratégie, branding, visibilité digitale — propulsez votre image au niveau supérieur",
    image:    "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1170&auto=format&fit=crop",
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
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>

      {/* ── Slides ── */}
      <AnimatePresence initial={false} custom={direction} mode="wait">
        <motion.div key={currentIndex} custom={direction} variants={slideVariants}
          initial="enter" animate="center" exit="exit"
          style={{ position: 'absolute', inset: 0 }}>
          <motion.div
            style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${current.image})`,
              backgroundSize: 'cover', backgroundPosition: 'center',
            }}
            initial={{ scale: 1.08 }} animate={{ scale: 1.02 }}
            transition={{ duration: SLIDE_DURATION / 1000, ease: 'linear' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg, rgba(5,8,12,0.88) 0%, rgba(5,8,12,0.52) 55%, rgba(5,8,12,0.22) 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(5,8,12,0.8) 0%, transparent 50%)' }} />
          <motion.div style={{
            position: 'absolute', top: 0, left: 0,
            width: '2px', height: '100%',
            background: `linear-gradient(to bottom, transparent, ${current.accent}, transparent)`,
          }} initial={{ scaleY: 0, originY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 1.2, delay: 0.2 }} />
        </motion.div>
      </AnimatePresence>

      {/* ── Contenu texte ── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 10,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        /* Responsive: moins de padding bas sur mobile pour laisser place au bandeau */
        padding: 'clamp(80px, 10vw, 100px) clamp(20px, 5vw, 64px) clamp(130px, 20vw, 165px)',
      }}>
        <AnimatePresence mode="wait">
          <div key={currentIndex}>
            {/* Badge pôle */}
            <motion.div custom={0.1} variants={textV} initial="hidden" animate="visible"
              style={{ marginBottom: 'clamp(12px, 2vw, 20px)' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '5px 14px', borderRadius: '40px',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(8px)',
                background: `${current.accent}22`,
                fontSize: 'clamp(0.58rem, 1.2vw, 0.65rem)',
                fontWeight: 400, letterSpacing: '0.28em',
                textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)',
              }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: current.accent, animation: 'avPulse 2s ease-in-out infinite' }} />
                {current.pole}
              </span>
            </motion.div>

            {/* Titre */}
            <motion.h1 custom={0.25} variants={textV} initial="hidden" animate="visible"
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 'clamp(2.4rem, 7vw, 6rem)',
                fontWeight: 300, lineHeight: 1.0,
                letterSpacing: '-0.02em', color: '#fff',
                marginBottom: 'clamp(12px, 2vw, 20px)',
                maxWidth: '700px', whiteSpace: 'pre-line',
              }}>
              {current.title}
            </motion.h1>

            {/* Ligne décorative */}
            <motion.div custom={0.38} variants={textV} initial="hidden" animate="visible"
              style={{ marginBottom: 'clamp(12px, 2vw, 20px)' }}>
              <div style={{ height: '1px', width: '50px', background: `linear-gradient(to right, ${current.accent}, transparent)` }} />
            </motion.div>

            {/* Sous-titre */}
            <motion.p custom={0.45} variants={textV} initial="hidden" animate="visible"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 'clamp(0.82rem, 2vw, 1.05rem)',
                fontWeight: 300, color: 'rgba(255,255,255,0.62)',
                maxWidth: '460px', lineHeight: 1.75,
                marginBottom: 'clamp(24px, 4vw, 40px)',
              }}>
              {current.subtitle}
            </motion.p>

            {/* CTAs */}
            <motion.div custom={0.55} variants={textV} initial="hidden" animate="visible"
              style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link to={current.cta.route} style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: 'clamp(10px, 2vw, 13px) clamp(18px, 3vw, 28px)',
                borderRadius: '40px', background: current.accent,
                color: '#0A0C0F', fontFamily: "'DM Sans', sans-serif",
                fontSize: 'clamp(0.68rem, 1.5vw, 0.78rem)',
                fontWeight: 500, letterSpacing: '0.08em',
                textTransform: 'uppercase', transition: '0.25s',
                boxShadow: `0 8px 32px ${current.accent}50`,
              }}>
                {current.cta.label} →
              </Link>
              <Link to="/contact" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: 'clamp(10px, 2vw, 12px) clamp(18px, 3vw, 28px)',
                borderRadius: '40px', background: 'transparent',
                border: '1px solid rgba(255,255,255,0.2)',
                backdropFilter: 'blur(8px)', color: 'rgba(255,255,255,0.8)',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 'clamp(0.68rem, 1.5vw, 0.78rem)',
                fontWeight: 300, letterSpacing: '0.08em',
                textTransform: 'uppercase', transition: '0.25s',
              }}>
                Nous contacter
              </Link>
            </motion.div>
          </div>
        </AnimatePresence>
      </div>

      {/* ── Flèches nav ── */}
      {[
        { fn: prev, side: 'left',  label: 'Précédente' },
        { fn: next, side: 'right', label: 'Suivante'   },
      ].map(({ fn, side, label }) => (
        <button key={side} onClick={fn} aria-label={`Slide ${label}`} style={{
          position: 'absolute', [side]: 'clamp(8px, 2vw, 20px)', top: '50%',
          transform: 'translateY(-50%)', zIndex: 20,
          padding: '10px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.7)', display: 'flex', transition: '0.2s',
        }}>
          {side === 'left' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      ))}

      {/* ── Compteur — masqué sur très petits écrans ── */}
      <div style={{
        position: 'absolute', top: '20px', right: 'clamp(16px, 3vw, 24px)', zIndex: 20,
        fontFamily: "'DM Sans', sans-serif", fontSize: '0.62rem',
        letterSpacing: '0.22em', color: 'rgba(255,255,255,0.22)',
        userSelect: 'none', pointerEvents: 'none',
      }}>
        {String(currentIndex + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
      </div>

      {/* ── Indicateurs verticaux — masqués en dessous de 480px ── */}
      <div style={{
        position: 'absolute', bottom: 'clamp(100px, 18vw, 145px)',
        right: 'clamp(12px, 2vw, 24px)', zIndex: 20,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px',
      }}>
        <div style={{ width: '1px', height: '48px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          <motion.div style={{ width: '100%', background: current.accent, height: `${progress}%` }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {slides.map((_, i) => (
            <button key={i} onClick={() => goTo(i)} aria-label={`Slide ${i + 1}`} style={{
              border: 'none', cursor: 'pointer', padding: 0, borderRadius: '50%',
              transition: '0.3s',
              width: i === currentIndex ? '7px' : '5px',
              height: i === currentIndex ? '7px' : '5px',
              background: i === currentIndex ? current.accent : 'rgba(255,255,255,0.25)',
              boxShadow: i === currentIndex ? `0 0 8px ${current.accent}` : 'none',
            }} />
          ))}
        </div>
      </div>

      {/* ── Bandeau pôles bas ── */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20 }}>
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          background: 'rgba(5,8,12,0.6)', backdropFilter: 'blur(20px)',
        }}>
          {poles.map((pole, i) => {
            const Icon = pole.icon;
            const isActive = slides[currentIndex].pole === pole.label;
            return (
              <Link key={i} to={pole.route} style={{
                display: 'flex', alignItems: 'center',
                gap: 'clamp(8px, 2vw, 14px)',
                padding: 'clamp(12px, 2.5vw, 18px) clamp(10px, 2vw, 28px)',
                borderRight: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                position: 'relative', overflow: 'hidden', transition: '0.3s',
              }}>
                {/* Barre accent haut */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                  background: pole.color, opacity: isActive ? 1 : 0, transition: '0.3s',
                }} />
                {/* Icône */}
                <div style={{
                  padding: 'clamp(6px, 1.5vw, 8px)', borderRadius: '10px', flexShrink: 0,
                  background: isActive ? `${pole.color}22` : 'rgba(255,255,255,0.05)', transition: '0.3s',
                  display: 'flex',
                }}>
                  <Icon size={15} style={{ color: isActive ? pole.color : 'rgba(255,255,255,0.4)' }} />
                </div>
                {/* Texte — masqué en dessous de 480px */}
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}
                  className="hidden sm:block">
                  <p style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 'clamp(0.72rem, 1.8vw, 0.84rem)',
                    fontWeight: isActive ? 400 : 300,
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                    transition: '0.3s', whiteSpace: 'nowrap',
                  }}>
                    {pole.label}
                  </p>
                  <p style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 'clamp(0.58rem, 1.2vw, 0.65rem)',
                    letterSpacing: '0.1em',
                    color: isActive ? pole.color : 'rgba(255,255,255,0.28)',
                    transition: '0.3s', whiteSpace: 'nowrap',
                  }}>
                    {pole.sub}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <style>{`@keyframes avPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.3)} }`}</style>
    </div>
  );
};

export default HeroSlider;