import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';

const slides = [
    {
        url:         'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=1175&auto=format&fit=crop',
        urlMd:       'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=800&auto=format&fit=crop',
        urlSm:       'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=480&auto=format&fit=crop',
        width: 1175, height: 783,
        alt:         'Maison familiale à Brazzaville — Altimmo',
        eyebrow:     'Altimmo · Vente',
        headline:    'Chaque famille mérite\nsa maison de rêve.',
        body:        'De la recherche à la remise des clés, nous sommes à vos côtés à chaque étape pour concrétiser le projet le plus important de votre vie.',
        quote:       '"Grâce à Altimmo, nous avons trouvé notre chez-nous en 3 semaines."',
        cta:         { label: 'Nos annonces', to: '/altimmo/annonces' },
        stat:        { value: '200+', label: 'familles accompagnées' },
        accent:      '#2E7BB5',
        accentLight: '#7BB8E0',
        grad1: 'linear-gradient(108deg, rgba(5,12,22,0.92) 0%, rgba(5,10,18,0.58) 52%, rgba(5,10,18,0.1) 100%)',
        grad2: 'linear-gradient(to top, rgba(5,10,18,0.88) 0%, transparent 50%)',
    },
    {
        url:         'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=1460&auto=format&fit=crop',
        urlMd:       'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=800&auto=format&fit=crop',
        urlSm:       'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=480&auto=format&fit=crop',
        width: 1460, height: 973,
        alt:         'Investissement immobilier sécurisé au Congo',
        eyebrow:     'Altimmo · Conseil',
        headline:    'Investir à Brazzaville\nen toute sérénité.',
        body:        'Notre équipe analyse le marché local pour vous offrir les meilleures opportunités. Accompagnement juridique inclus, transparence totale sur les frais.',
        quote:       '"Un partenaire qui connaît vraiment le marché congolais."',
        cta:         { label: 'Conseil gratuit', to: '/altimmo' },
        stat:        { value: '98%', label: 'clients satisfaits' },
        accent:      '#1A5A8A',
        accentLight: '#5A9AC0',
        grad1: 'linear-gradient(108deg, rgba(3,10,20,0.94) 0%, rgba(3,8,16,0.6) 52%, rgba(3,8,16,0.1) 100%)',
        grad2: 'linear-gradient(to top, rgba(3,8,16,0.9) 0%, transparent 50%)',
    },
    {
        url:         'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1470&auto=format&fit=crop',
        urlMd:       'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=800&auto=format&fit=crop',
        urlSm:       'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=480&auto=format&fit=crop',
        width: 1470, height: 980,
        alt:         'Villa de luxe Brazzaville — Altimmo prestige',
        eyebrow:     'Altimmo · Prestige',
        headline:    "L'élégance,\nà votre portée.",
        body:        "Des villas d'exception aux appartements modernes — nous sélectionnons les biens les plus exclusifs de Brazzaville pour une clientèle exigeante.",
        quote:       '"Une sélection impeccable, un service d\'une rare qualité."',
        cta:         { label: "Voir l'exclusif", to: '/altimmo/annonces' },
        stat:        { value: '5 ans', label: "d'expertise locale" },
        accent:      '#C8872A',
        accentLight: '#E8B86D',
        grad1: 'linear-gradient(108deg, rgba(18,10,2,0.92) 0%, rgba(12,6,0,0.58) 52%, rgba(12,6,0,0.1) 100%)',
        grad2: 'linear-gradient(to top, rgba(12,6,0,0.88) 0%, transparent 50%)',
    },
];

const SLIDE_DURATION = 7000;

/* ─── CSS mobile-first ─── */
const SLIDER_CSS = `
  @keyframes altPulse {
    0%,100% { opacity:1; transform:scale(1); }
    50%      { opacity:.5; transform:scale(1.5); }
  }

  /* ── Contenu texte ── */
  .ash-content {
    position: absolute; inset: 0; z-index: 10;
    display: flex; flex-direction: column; justify-content: center;
    /* padding-bottom : laisse place aux pills de recherche (72px) + atouts (52px) */
    padding: 90px 24px 150px;
  }
  @media (min-width: 640px) {
    .ash-content { padding: 100px 48px 175px; }
  }
  @media (min-width: 1024px) {
    .ash-content { padding: 100px 80px 185px; }
  }

  /* ── Eyebrow pill ── */
  .ash-eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 5px 14px 5px 7px; border-radius: 40px;
    backdrop-filter: blur(10px);
    margin-bottom: clamp(14px, 2vw, 18px);
  }
  .ash-eyebrow-text {
    font-family: 'Outfit', sans-serif;
    font-size: clamp(0.62rem, 1.5vw, 0.62rem);  /* lisible mobile */
    font-weight: 500; letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  /* ── Titre ── */
  .ash-title {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(2.4rem, 7vw, 4rem);         /* ↑ mobile : 2.4rem */
    font-weight: 600; line-height: 1.06;
    letter-spacing: -0.02em; color: #F5F2EE;
    margin-bottom: clamp(8px, 1vw, 10px);
    white-space: pre-line;
  }

  /* ── Corps ── */
  .ash-body {
    font-family: 'Outfit', sans-serif;
    font-size: clamp(0.9rem, 2vw, 0.92rem);      /* ↑ mobile : 0.9rem */
    font-weight: 300; line-height: 1.72;
    color: rgba(245,242,238,0.62);
    margin-bottom: clamp(10px, 1.5vw, 16px);
  }

  /* ── Citation ── */
  .ash-quote {
    padding: 9px 14px; border-radius: 0 6px 6px 0;
    margin-bottom: clamp(16px, 2.5vw, 24px);
  }
  .ash-quote-text {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(0.84rem, 1.5vw, 0.86rem);   /* ↑ mobile */
    font-style: italic; font-weight: 400;
    color: rgba(245,242,238,0.48); line-height: 1.5;
  }

  /* ── CTA row ── */
  .ash-cta-row {
    display: flex; align-items: center;
    gap: clamp(10px, 2vw, 16px); flex-wrap: wrap;
  }
  .ash-cta-btn {
    display: inline-flex; align-items: center; gap: 7px;
    border-radius: 40px; color: #fff;
    font-family: 'Outfit', sans-serif;
    font-size: clamp(0.76rem, 1.5vw, 0.74rem);   /* ↑ mobile */
    font-weight: 600; letter-spacing: 0.07em;
    text-transform: uppercase; text-decoration: none;
    transition: transform 0.2s, box-shadow 0.2s;
    white-space: nowrap;
    /* Padding tactile généreux */
    padding: clamp(11px, 1.8vw, 12px) clamp(18px, 2.8vw, 24px);
  }
  .ash-cta-btn:hover { transform: translateY(-2px); }

  /* ── Stat ── */
  .ash-stat-value {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(1.3rem, 2.5vw, 1.4rem);     /* ↑ mobile */
    font-weight: 600; line-height: 1; margin-bottom: 2px;
  }
  .ash-stat-label {
    font-family: 'Outfit', sans-serif;
    font-size: clamp(0.6rem, 1vw, 0.6rem);
    font-weight: 300; letter-spacing: 0.1em;
    color: rgba(245,242,238,0.32);
    text-transform: uppercase; white-space: nowrap;
  }

  /* ── Flèches ── */
  .ash-arrow {
    position: absolute; top: 50%; transform: translateY(-50%);
    z-index: 20; border-radius: 50%;
    background: rgba(245,242,238,0.07);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(245,242,238,0.1);
    color: rgba(245,242,238,0.55);
    display: flex; align-items: center; justifyContent: center;
    cursor: pointer; transition: 0.2s;
    /* ↑ cible tactile 48px */
    width: 48px; height: 48px;
  }
  @media (min-width: 768px) {
    .ash-arrow { width: 40px; height: 40px; }
  }
  .ash-arrow-left  { left: clamp(12px, 2vw, 20px); }
  .ash-arrow-right { right: clamp(12px, 2vw, 20px); }

  /* ── Indicateurs ── */
  .ash-indicators {
    position: absolute;
    right: 16px;
    top: 50%; transform: translateY(-50%);
    z-index: 20;
    display: flex; flex-direction: column;
    align-items: center; gap: 10px;
  }
  @media (min-width: 768px) {
    .ash-indicators { right: 18px; }
  }
  /* Masquer sur très petits écrans */
  @media (max-width: 360px) {
    .ash-indicators { display: none; }
  }

  .ash-counter {
    font-family: 'Outfit', sans-serif;
    font-size: clamp(0.6rem, 1vw, 0.56rem);
    letter-spacing: 0.16em;
    color: rgba(245,242,238,0.25);
    user-select: none; writing-mode: vertical-rl;
  }

  .ash-dot-btn {
    padding: 0; border: none; cursor: pointer;
    width: 28px; height: 24px;
    display: flex; align-items: center; justify-content: center;
    background: transparent;
  }
  .ash-dot-inner {
    display: block; height: 4px; border-radius: 2px;
    transition: all 0.4s ease;
  }
`;

const imgV = {
    enter:  (d) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: '0%', opacity: 1, transition: { duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] } },
    exit:   (d) => ({ x: d < 0 ? '100%' : '-100%', opacity: 0, transition: { duration: 0.7, ease: [0.55, 0, 1, 0.45] } }),
};

const stagger = (delay) => ({
    hidden:  { opacity: 0, y: 20, filter: 'blur(3px)' },
    visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] } },
    exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } },
});

const HeroSliderAlt = () => {
    const [idx, setIdx]           = useState(0);
    const [dir, setDir]           = useState(1);
    const [progress, setProgress] = useState(0);
    const timerRef    = useRef(null);
    const progressRef = useRef(null);

    const resetTimers = useCallback(() => {
        clearInterval(timerRef.current);
        clearInterval(progressRef.current);
        setProgress(0);
        timerRef.current = setInterval(() => {
            setDir(1);
            setIdx(p => (p + 1) % slides.length);
            setProgress(0);
        }, SLIDE_DURATION);
        progressRef.current = setInterval(() => {
            setProgress(p => p >= 100 ? 0 : p + 100 / (SLIDE_DURATION / 50));
        }, 50);
    }, []);

    useEffect(() => {
        resetTimers();
        return () => { clearInterval(timerRef.current); clearInterval(progressRef.current); };
    }, [resetTimers]);

    const goTo = (i) => { setDir(i > idx ? 1 : -1); setIdx(i); resetTimers(); };
    const prev = () => { setDir(-1); setIdx(p => (p - 1 + slides.length) % slides.length); resetTimers(); };
    const next = () => { setDir(1);  setIdx(p => (p + 1) % slides.length); resetTimers(); };

    const s = slides[idx];

    return (
        <div className="absolute inset-0 overflow-hidden"
            role="region" aria-label="Diaporama Altimmo" aria-roledescription="carousel">
            <style>{SLIDER_CSS}</style>

            {/* ── IMAGE ─── */}
            <AnimatePresence initial={false} custom={dir} mode="wait">
                <motion.div key={'img-' + idx} custom={dir} variants={imgV}
                    initial="enter" animate="center" exit="exit"
                    className="absolute inset-0"
                    role="group" aria-roledescription="diapositive"
                    aria-label={`${idx + 1} sur ${slides.length} : ${s.eyebrow}`}>
                    <motion.div className="absolute inset-0"
                        initial={{ scale: 1.08 }} animate={{ scale: 1.02 }}
                        transition={{ duration: SLIDE_DURATION / 1000, ease: 'linear' }}>
                        <img
                            src={s.url}
                            srcSet={`${s.urlSm} 480w, ${s.urlMd} 800w, ${s.url} 1175w`}
                            sizes="(max-width: 640px) 480px, (max-width: 1024px) 800px, 1175px"
                            alt={s.alt} width={s.width} height={s.height}
                            fetchpriority={idx === 0 ? 'high' : 'low'}
                            loading={idx === 0 ? 'eager' : 'lazy'}
                            decoding={idx === 0 ? 'sync' : 'async'}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
                        />
                    </motion.div>
                    <div style={{ position: 'absolute', inset: 0, background: s.grad1 }} />
                    <div style={{ position: 'absolute', inset: 0, background: s.grad2 }} />
                    <motion.div
                        initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                        transition={{ duration: 1.1, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
                        style={{
                            position: 'absolute', top: 0, left: 0, width: '2px', height: '100%',
                            background: `linear-gradient(to bottom, transparent 8%, ${s.accent} 35%, ${s.accent} 65%, transparent 92%)`,
                            transformOrigin: 'top',
                        }} />
                </motion.div>
            </AnimatePresence>

            {/* ── CONTENU ─── */}
            <div className="ash-content">
                <AnimatePresence mode="wait">
                    <div key={'text-' + idx} style={{ maxWidth: '540px' }}>

                        {/* Eyebrow */}
                        <motion.div variants={stagger(0.08)} initial="hidden" animate="visible" exit="exit">
                            <span className="ash-eyebrow"
                                style={{ border: `1px solid ${s.accent}40`, background: `${s.accent}12` }}>
                                <span style={{
                                    width: '5px', height: '5px', borderRadius: '50%',
                                    background: s.accent, boxShadow: `0 0 6px ${s.accent}`,
                                    animation: 'altPulse 2.2s ease-in-out infinite', flexShrink: 0,
                                }} />
                                <span className="ash-eyebrow-text" style={{ color: s.accentLight }}>
                                    {s.eyebrow}
                                </span>
                            </span>
                        </motion.div>

                        {/* Titre */}
                        <motion.h1 variants={stagger(0.18)} initial="hidden" animate="visible" exit="exit"
                            className="ash-title">
                            {s.headline}
                        </motion.h1>

                        {/* Filet */}
                        <motion.div
                            initial={{ width: 0, opacity: 0 }} animate={{ width: '40px', opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.5, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
                            style={{
                                height: '1.5px', borderRadius: '2px',
                                background: `linear-gradient(to right, ${s.accent}, transparent)`,
                                marginBottom: 'clamp(10px, 1.6vw, 16px)',
                            }}
                        />

                        {/* Corps */}
                        <motion.p variants={stagger(0.28)} initial="hidden" animate="visible" exit="exit"
                            className="ash-body">
                            {s.body}
                        </motion.p>

                        {/* Citation */}
                        <motion.blockquote variants={stagger(0.36)} initial="hidden" animate="visible" exit="exit"
                            className="ash-quote"
                            style={{ borderLeft: `2px solid ${s.accent}55`, background: `${s.accent}07` }}>
                            <span className="ash-quote-text">{s.quote}</span>
                        </motion.blockquote>

                        {/* CTA + Stat */}
                        <motion.div variants={stagger(0.44)} initial="hidden" animate="visible" exit="exit"
                            className="ash-cta-row">
                            <Link to={s.cta.to} className="ash-cta-btn"
                                style={{
                                    background: `linear-gradient(135deg, ${s.accent}, ${s.accent}CC)`,
                                    boxShadow: `0 5px 20px ${s.accent}40`,
                                }}>
                                {s.cta.label}
                                <ArrowRight size={13} aria-hidden="true" />
                            </Link>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '1px', height: '28px', background: 'rgba(245,242,238,0.1)' }} />
                                <div>
                                    <p className="ash-stat-value" style={{ color: s.accentLight }}>{s.stat.value}</p>
                                    <p className="ash-stat-label">{s.stat.label}</p>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </AnimatePresence>
            </div>

            {/* ── FLÈCHES ─── */}
            {[
                { fn: prev, side: 'left',  Icon: ChevronLeft,  label: 'Image précédente' },
                { fn: next, side: 'right', Icon: ChevronRight, label: 'Image suivante'   },
            ].map(({ fn, side, Icon, label }) => (
                <button key={side} onClick={fn} aria-label={label}
                    className={`ash-arrow ash-arrow-${side}`}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = `${s.accent}25`;
                        e.currentTarget.style.borderColor = `${s.accent}45`;
                        e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(245,242,238,0.07)';
                        e.currentTarget.style.borderColor = 'rgba(245,242,238,0.1)';
                        e.currentTarget.style.color = 'rgba(245,242,238,0.55)';
                    }}>
                    <Icon size={18} aria-hidden="true" />
                </button>
            ))}

            {/* ── INDICATEURS ─── */}
            <div className="ash-indicators">
                {/* Barre de progression */}
                <div style={{ width: '1px', height: '44px', background: 'rgba(245,242,238,0.1)', overflow: 'hidden' }}
                    role="progressbar" aria-valuenow={Math.round(progress)}
                    aria-valuemin={0} aria-valuemax={100} aria-label="Progression">
                    <div style={{ width: '100%', height: `${progress}%`, background: s.accent }} />
                </div>

                {/* Dots */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}
                    role="tablist" aria-label="Diapositives">
                    {slides.map((sl, i) => (
                        <button key={i} onClick={() => goTo(i)}
                            role="tab" aria-selected={i === idx}
                            aria-label={`Aller à : ${sl.eyebrow}`}
                            className="ash-dot-btn">
                            <span className="ash-dot-inner" style={{
                                width: i === idx ? '16px' : '4px',
                                background: i === idx ? s.accent : 'rgba(245,242,238,0.2)',
                                boxShadow: i === idx ? `0 0 5px ${s.accent}80` : 'none',
                            }} />
                        </button>
                    ))}
                </div>

                {/* Compteur */}
                <p className="ash-counter" aria-hidden="true">
                    {String(idx + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
                </p>
            </div>
        </div>
    );
};

export default HeroSliderAlt;