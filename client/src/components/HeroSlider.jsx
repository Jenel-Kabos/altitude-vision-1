import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Building2, Calendar, Briefcase } from 'lucide-react';

const slides = [
  {
    title: "L'Immobilier\nde Prestige",
    subtitle: "Trouvez le bien qui vous ressemble — vente, location, conseil expert à Brazzaville",
    image: "https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=1600&q=80",
    cta: { label: "Découvrir Altimmo", route: "/altimmo" },
    accent: "#2E7BB5",
    pole: "Altimmo",
  },
  {
    title: "L'Art de\nl'Événementiel",
    subtitle: "Mariages, galas, conférences — nous transformons chaque moment en souvenir inoubliable",
    image: "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?q=80&w=1170&auto=format&fit=crop",
    cta: { label: "Découvrir Mila Events", route: "/mila-events" },
    accent: "#D42B2B",
    pole: "Mila Events",
  },
  {
    title: "La Communication\nQui Impacte",
    subtitle: "Stratégie, branding, visibilité digitale — propulsez votre image au niveau supérieur",
    image: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1170&auto=format&fit=crop",
    cta: { label: "Découvrir Altcom", route: "/altcom" },
    accent: "#C8872A",
    pole: "Altcom",
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
      setCurrentIndex(prev => (prev + 1) % slides.length);
      setProgress(0);
    }, SLIDE_DURATION);
    progressRef.current = setInterval(() => {
      setProgress(prev => Math.min(prev + 100 / (SLIDE_DURATION / 50), 100));
    }, 50);
  }, []);

  useEffect(() => {
    resetTimers();
    return () => { clearInterval(timerRef.current); clearInterval(progressRef.current); };
  }, [resetTimers]);

  const goTo = (index) => {
    if (index === currentIndex) return;
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
    resetTimers();
  };

  const prev = () => { setDirection(-1); setCurrentIndex(p => (p - 1 + slides.length) % slides.length); resetTimers(); };
  const next = () => { setDirection(1);  setCurrentIndex(p => (p + 1) % slides.length); resetTimers(); };

  const slideVariants = {
    enter:  (dir) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: '0%', opacity: 1, transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] } },
    exit:   (dir) => ({ x: dir < 0 ? '100%' : '-100%', opacity: 0, transition: { duration: 0.65, ease: [0.55, 0, 1, 0.45] } }),
  };

  const textVariants = {
    hidden:  { opacity: 0, y: 36 },
    visible: (delay) => ({
      opacity: 1, y: 0,
      transition: { duration: 0.75, delay, ease: [0.25, 0.46, 0.45, 0.94] },
    }),
  };

  const current = slides[currentIndex];

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>

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
        >
          {/* Image Ken Burns */}
          <motion.div
            style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${current.image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
            initial={{ scale: 1.08 }}
            animate={{ scale: 1.02 }}
            transition={{ duration: SLIDE_DURATION / 1000, ease: 'linear' }}
          />

          {/* Overlays */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(105deg, rgba(5,8,12,0.88) 0%, rgba(5,8,12,0.55) 50%, rgba(5,8,12,0.25) 100%)',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(5,8,12,0.75) 0%, transparent 45%)',
          }} />

          {/* Accent coloré vertical */}
          <motion.div
            style={{
              position: 'absolute', top: 0, left: 0,
              width: '2px', height: '100%',
              background: `linear-gradient(to bottom, transparent, ${current.accent}, transparent)`,
            }}
            initial={{ scaleY: 0, originY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 1.2, delay: 0.2 }}
          />
        </motion.div>
      </AnimatePresence>

      {/* ── Contenu texte ── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 10,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 64px 160px',
      }}>
        <AnimatePresence mode="wait">
          <div key={currentIndex}>

            {/* Badge pôle */}
            <motion.div
              custom={0.1} variants={textVariants} initial="hidden" animate="visible"
              style={{ marginBottom: '20px' }}
            >
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '6px 16px', borderRadius: '40px',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(8px)',
                background: `${current.accent}22`,
                fontSize: '0.65rem', fontWeight: 400,
                letterSpacing: '0.28em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.9)',
              }}>
                <span style={{
                  width: '5px', height: '5px', borderRadius: '50%',
                  background: current.accent,
                  animation: 'avPulse 2s ease-in-out infinite',
                }} />
                {current.pole}
              </span>
            </motion.div>

            {/* Titre */}
            <motion.h1
              custom={0.25} variants={textVariants} initial="hidden" animate="visible"
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 'clamp(3rem, 6.5vw, 6rem)',
                fontWeight: 300,
                lineHeight: 1.0,
                letterSpacing: '-0.02em',
                color: '#fff',
                marginBottom: '20px',
                maxWidth: '700px',
                whiteSpace: 'pre-line',
              }}
            >
              {current.title}
            </motion.h1>

            {/* Ligne décorative */}
            <motion.div
              custom={0.38} variants={textVariants} initial="hidden" animate="visible"
              style={{ marginBottom: '20px' }}
            >
              <div style={{
                height: '1px', width: '60px', borderRadius: '1px',
                background: `linear-gradient(to right, ${current.accent}, transparent)`,
              }} />
            </motion.div>

            {/* Sous-titre */}
            <motion.p
              custom={0.45} variants={textVariants} initial="hidden" animate="visible"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 'clamp(0.9rem, 1.6vw, 1.1rem)',
                fontWeight: 300,
                color: 'rgba(255,255,255,0.65)',
                maxWidth: '460px',
                lineHeight: 1.8,
                marginBottom: '40px',
              }}
            >
              {current.subtitle}
            </motion.p>

            {/* CTAs */}
            <motion.div
              custom={0.55} variants={textVariants} initial="hidden" animate="visible"
              style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}
            >
              <Link to={current.cta.route} style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '13px 28px', borderRadius: '40px',
                background: current.accent,
                color: '#0A0C0F', fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.78rem', fontWeight: 500,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                textDecoration: 'none', transition: '0.25s',
                boxShadow: `0 8px 32px ${current.accent}50`,
              }}>
                {current.cta.label} <span style={{ fontSize: '1rem' }}>→</span>
              </Link>

              <Link to="/contact" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '12px 28px', borderRadius: '40px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.2)',
                backdropFilter: 'blur(8px)',
                color: 'rgba(255,255,255,0.8)',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.78rem', fontWeight: 300,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                textDecoration: 'none', transition: '0.25s',
              }}>
                Nous contacter
              </Link>
            </motion.div>
          </div>
        </AnimatePresence>
      </div>

      {/* ── Flèches nav ── */}
      <button onClick={prev} aria-label="Slide précédente" style={{
        position: 'absolute', left: '20px', top: '50%',
        transform: 'translateY(-50%)', zIndex: 20,
        padding: '10px', borderRadius: '50%',
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
        display: 'flex', transition: '0.2s',
      }}>
        <ChevronLeft size={20} />
      </button>

      <button onClick={next} aria-label="Slide suivante" style={{
        position: 'absolute', right: '20px', top: '50%',
        transform: 'translateY(-50%)', zIndex: 20,
        padding: '10px', borderRadius: '50%',
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
        display: 'flex', transition: '0.2s',
      }}>
        <ChevronRight size={20} />
      </button>

      {/* ── Compteur ── */}
      <div style={{
        position: 'absolute', top: '24px', right: '24px', zIndex: 20,
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '0.65rem', letterSpacing: '0.25em',
        color: 'rgba(255,255,255,0.25)',
        userSelect: 'none', pointerEvents: 'none',
      }}>
        {String(currentIndex + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
      </div>

      {/* ── Progress + dots ── */}
      <div style={{
        position: 'absolute', bottom: '140px', right: '24px', zIndex: 20,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px',
      }}>
        {/* Barre progression */}
        <div style={{
          width: '1px', height: '56px',
          background: 'rgba(255,255,255,0.1)', borderRadius: '1px', overflow: 'hidden',
        }}>
          <motion.div style={{
            width: '100%', borderRadius: '1px',
            height: `${progress}%`,
            background: current.accent,
          }} />
        </div>
        {/* Dots */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {slides.map((_, i) => (
            <button key={i} onClick={() => goTo(i)}
              aria-label={`Slide ${i + 1}`}
              style={{
                border: 'none', cursor: 'pointer', padding: 0,
                borderRadius: '50%', transition: '0.3s',
                width: i === currentIndex ? '8px' : '5px',
                height: i === currentIndex ? '8px' : '5px',
                background: i === currentIndex ? current.accent : 'rgba(255,255,255,0.25)',
                boxShadow: i === currentIndex ? `0 0 8px ${current.accent}` : 'none',
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Bandeau pôles bas ── */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20 }}>
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          background: 'rgba(5,8,12,0.55)',
          backdropFilter: 'blur(20px)',
        }}>
          {poles.map((pole, i) => {
            const Icon = pole.icon;
            const isActive = slides[currentIndex].pole === pole.label;
            return (
              <Link key={i} to={pole.route} style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '18px 28px', textDecoration: 'none',
                borderRight: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                position: 'relative', overflow: 'hidden', transition: '0.3s',
                background: 'transparent',
              }}>
                {/* Accent top */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                  background: pole.color,
                  opacity: isActive ? 1 : 0, transition: '0.3s',
                }} />

                {/* Icône */}
                <div style={{
                  padding: '8px', borderRadius: '10px',
                  background: isActive ? `${pole.color}22` : 'rgba(255,255,255,0.05)',
                  flexShrink: 0, display: 'flex', transition: '0.3s',
                }}>
                  <Icon size={16} style={{ color: isActive ? pole.color : 'rgba(255,255,255,0.45)' }} />
                </div>

                {/* Texte */}
                <div className="hidden sm:block" style={{ minWidth: 0 }}>
                  <p style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.82rem', fontWeight: isActive ? 400 : 300,
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
                    transition: '0.3s', whiteSpace: 'nowrap',
                  }}>
                    {pole.label}
                  </p>
                  <p style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.65rem', letterSpacing: '0.1em',
                    color: isActive ? pole.color : 'rgba(255,255,255,0.3)',
                    transition: '0.3s',
                  }}>
                    {pole.sub}
                  </p>
                </div>

                <span className="hidden sm:block" style={{
                  marginLeft: 'auto', fontSize: '0.7rem',
                  color: pole.color, opacity: 0, transition: '0.3s',
                }}>→</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Keyframe pulse inline */}
      <style>{`
        @keyframes avPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
};

export default HeroSlider;