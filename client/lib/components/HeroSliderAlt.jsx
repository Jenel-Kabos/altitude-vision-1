"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';

const slides = [
    {
        url:    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=1175&auto=format&fit=crop',
        urlMd:  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=800&auto=format&fit=crop',
        urlSm:  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=480&auto=format&fit=crop',
        width: 1175, height: 783,
        alt:     'Maison familiale à Brazzaville — Altimmo',
        eyebrow: 'Altimmo · Vente',
        headline: 'Chaque famille mérite\nsa maison de rêve.',
        body:    'De la recherche à la remise des clés, nous vous accompagnons à chaque étape.',
        quote:   '"Grâce à Altimmo, nous avons trouvé notre chez-nous en 3 semaines."',
        cta:     { label: 'Nos annonces', to: '/altimmo/annonces' },
        stat:    { value: '200+', label: 'familles accompagnées' },
        accent:  '#2E7BB5', accentLight: '#7BB8E0',
        grad1: 'linear-gradient(108deg, rgba(5,12,22,0.93) 0%, rgba(5,10,18,0.60) 50%, rgba(5,10,18,0.08) 100%)',
        grad2: 'linear-gradient(to top, rgba(5,10,18,0.90) 0%, rgba(5,10,18,0.30) 40%, transparent 65%)',
    },
    {
        url:    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=1460&auto=format&fit=crop',
        urlMd:  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=800&auto=format&fit=crop',
        urlSm:  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=480&auto=format&fit=crop',
        width: 1460, height: 973,
        alt:     'Investissement immobilier sécurisé au Congo',
        eyebrow: 'Altimmo · Conseil',
        headline: 'Investir à Brazzaville\nen toute sérénité.',
        body:    "Notre équipe analyse le marché local pour vous offrir les meilleures opportunités.",
        quote:   '"Un partenaire qui connaît vraiment le marché congolais."',
        cta:     { label: 'Conseil gratuit', to: '/altimmo' },
        stat:    { value: '98%', label: 'clients satisfaits' },
        accent:  '#1A5A8A', accentLight: '#5A9AC0',
        grad1: 'linear-gradient(108deg, rgba(3,10,20,0.94) 0%, rgba(3,8,16,0.62) 50%, rgba(3,8,16,0.08) 100%)',
        grad2: 'linear-gradient(to top, rgba(3,8,16,0.92) 0%, rgba(3,8,16,0.30) 40%, transparent 65%)',
    },
    {
        url:    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1470&auto=format&fit=crop',
        urlMd:  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=800&auto=format&fit=crop',
        urlSm:  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=480&auto=format&fit=crop',
        width: 1470, height: 980,
        alt:     'Villa de luxe Brazzaville — Altimmo prestige',
        eyebrow: 'Altimmo · Prestige',
        headline: "L'élégance,\nà votre portée.",
        body:    "Villas d'exception et appartements exclusifs, sélectionnés pour une clientèle exigeante.",
        quote:   '"Une sélection impeccable, un service d\'une rare qualité."',
        cta:     { label: "Voir l'exclusif", to: '/altimmo/annonces' },
        stat:    { value: '5 ans', label: "d'expertise locale" },
        accent:  '#C8872A', accentLight: '#E8B86D',
        grad1: 'linear-gradient(108deg, rgba(18,10,2,0.93) 0%, rgba(12,6,0,0.60) 50%, rgba(12,6,0,0.08) 100%)',
        grad2: 'linear-gradient(to top, rgba(12,6,0,0.90) 0%, rgba(12,6,0,0.30) 40%, transparent 65%)',
    },
];

const SLIDE_DURATION = 7000;

const SLIDER_CSS = `
  @keyframes altPulse {
    0%,100% { opacity:1; transform:scale(1); }
    50%      { opacity:.5; transform:scale(1.5); }
  }

  /* ══ ZONE TEXTE ══ */
  .ash-content {
    position: absolute; inset: 0; z-index: 10;
    display: flex; flex-direction: column;
    justify-content: flex-start;
    padding-top: clamp(68px, 13vw, 120px);
    padding-left: clamp(20px, 5vw, 80px);
    padding-right: clamp(58px, 9vw, 160px);
    /* Mobile : atouts (96px) + actions (pill ~36px + liens ~22px + gaps ~28px) = ~182px + marge 20px */
    padding-bottom: 202px;
    overflow: hidden;
  }
  @media (min-width: 640px) {
    .ash-content {
      justify-content: center;
      padding-top: clamp(80px, 10vw, 100px);
      /* Desktop : atouts (44px) + actions (~68px) + marge */
      padding-bottom: 132px;
      padding-left: clamp(40px, 6vw, 80px);
    }
  }
  @media (min-width: 1024px) {
    .ash-content { padding-bottom: 120px; padding-left: 80px; padding-right: 140px; }
  }
  @media (min-width: 1440px) {
    .ash-content { padding-left: 120px; padding-right: 200px; }
  }
  @media (min-width: 1920px) {
    .ash-content { padding-left: 160px; padding-right: 240px; }
  }

  /* Bloc texte — protégé des flèches */
  .ash-text-block {
    width: 100%;
    max-width: 640px;
  }
  @media (max-width: 639px) {
    .ash-text-block { max-width: calc(100vw - 72px); }
  }

  /* ══ EYEBROW ══ */
  .ash-eyebrow {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 11px 4px 6px; border-radius: 40px;
    backdrop-filter: blur(10px);
    margin-bottom: clamp(10px, 1.6vw, 14px);
  }
  .ash-eyebrow-dot {
    width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
    animation: altPulse 2.2s ease-in-out infinite;
  }
  .ash-eyebrow-text {
    font-family: 'Outfit', sans-serif;
    font-size: clamp(0.58rem, 0.9vw, 0.85rem); font-weight: 600;
    letter-spacing: 0.22em; text-transform: uppercase;
  }

  /* ══ TITRE — compact mobile, grand desktop ══ */
  .ash-title {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(2rem, 5.5vw, 8rem);
    font-weight: 600; line-height: 1.06;
    letter-spacing: -0.02em; color: #F5F2EE;
    margin-bottom: clamp(6px, 1.2vw, 10px);
    white-space: pre-line;
  }

  /* ══ FILET ══ */
  .ash-rule {
    height: 1.5px; width: 32px; border-radius: 2px;
    margin-bottom: clamp(8px, 1.4vw, 14px);
  }

  /* ══ CORPS — 2 lignes max mobile ══ */
  .ash-body {
    font-family: 'Outfit', sans-serif;
    font-size: clamp(0.80rem, 1.5vw, 0.88rem);
    font-weight: 300; line-height: 1.65;
    color: rgba(245,242,238,0.78);
    margin-bottom: clamp(8px, 1.4vw, 14px);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  @media (min-width: 640px) {
    .ash-body { -webkit-line-clamp: unset; overflow: visible; }
  }

  /* ══ CITATION — masquée mobile ══ */
  .ash-quote {
    padding: 7px 12px; border-radius: 0 5px 5px 0;
    margin-bottom: clamp(12px, 1.8vw, 18px);
    display: none;
  }
  @media (min-width: 540px) { .ash-quote { display: block; } }
  .ash-quote-text {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(0.76rem, 1.2vw, 0.82rem);
    font-style: italic; font-weight: 400;
    color: rgba(245,242,238,0.40); line-height: 1.5;
  }

  /* ══ CTA — bouton compact, rectangulaire = professionnel ══ */
  .ash-cta-row {
    display: flex; align-items: center;
    gap: 14px; flex-wrap: nowrap;
  }
  .ash-cta-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 10px 20px;
    border-radius: 5px;
    color: #fff; font-family: 'Outfit', sans-serif;
    font-size: 0.72rem; font-weight: 600;
    letter-spacing: 0.10em; text-transform: uppercase;
    text-decoration: none;
    transition: transform 0.2s, box-shadow 0.2s;
    white-space: nowrap; flex-shrink: 0;
    min-height: 44px;
  }
  .ash-cta-btn:hover { transform: translateY(-2px); }
  @media (min-width: 1440px) {
    .ash-cta-btn { font-size: 0.88rem; padding: 14px 28px; min-height: 52px; }
  }

  /* Stat inline */
  .ash-stat-sep { width:1px; height:24px; background:rgba(245,242,238,0.12); flex-shrink:0; }
  .ash-stat-value {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(1.05rem, 1.8vw, 1.25rem);
    font-weight: 600; line-height: 1; margin-bottom: 1px;
  }
  .ash-stat-label {
    font-family: 'Outfit', sans-serif; font-size: 0.52rem;
    font-weight: 400; letter-spacing: 0.10em;
    color: rgba(245,242,238,0.55); text-transform: uppercase; white-space: nowrap;
  }

  /* ══ FLÈCHES — discrètes, bien positionnées ══ */
  .ash-arrow {
    position: absolute;
    top: calc(50% - 55px); transform: translateY(-50%);
    z-index: 20; border-radius: 50%;
    background: rgba(245,242,238,0.06);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(245,242,238,0.10);
    color: rgba(245,242,238,0.48);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s, color 0.2s;
    width: 34px; height: 34px;
  }
  @media (min-width: 640px) {
    .ash-arrow { top: 50%; transform: translateY(-50%); width: 40px; height: 40px; }
  }
  .ash-arrow-left  { left: 10px; }
  .ash-arrow-right { right: 10px; }
  @media (min-width: 640px) {
    .ash-arrow-left  { left: 20px; }
    .ash-arrow-right { right: 20px; }
  }

  /* ══ INDICATEURS ══ */
  .ash-indicators {
    position: absolute; right: 12px; z-index: 20;
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    /* Mobile : ancrés au centre de la zone image (au-dessus de la zone actions) */
    top: 50%; transform: translateY(-50%);
    /* Décalé vers le haut pour ne pas tomber dans la zone actions */
    margin-top: -60px;
  }
  @media (min-width: 640px) {
    .ash-indicators { margin-top: 0; right: 16px; }
  }
  @media (max-width: 380px) { .ash-indicators { display: none; } }

  .ash-dot-btn {
    padding: 0; border: none; cursor: pointer;
    width: 22px; height: 18px;
    display: flex; align-items: center; justify-content: center;
    background: transparent;
  }
  .ash-dot-inner { display: block; height: 3px; border-radius: 2px; transition: all 0.4s ease; }
  .ash-counter {
    font-family: 'Outfit', sans-serif; font-size: 0.48rem;
    letter-spacing: 0.12em; color: rgba(245,242,238,0.20);
    user-select: none; writing-mode: vertical-rl;
  }
`;

const imgV = {
    enter:  (d) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: '0%', opacity: 1, transition: { duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] } },
    exit:   (d) => ({ x: d < 0 ? '100%' : '-100%', opacity: 0, transition: { duration: 0.7, ease: [0.55, 0, 1, 0.45] } }),
};

const stagger = (delay) => ({
    hidden:  { opacity: 0, y: 14, filter: 'blur(2px)' },
    visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] } },
    exit:    { opacity: 0, y: -6, transition: { duration: 0.16 } },
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
            setDir(1); setIdx(p => (p + 1) % slides.length); setProgress(0);
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

            {/* IMAGE */}
            <AnimatePresence initial={false} custom={dir} mode="wait">
                <motion.div key={'img-' + idx} custom={dir} variants={imgV}
                    initial="enter" animate="center" exit="exit"
                    className="absolute inset-0"
                    role="group" aria-roledescription="diapositive"
                    aria-label={`${idx + 1} sur ${slides.length} : ${s.eyebrow}`}>
                    <motion.div className="absolute inset-0"
                        initial={{ scale: 1.07 }} animate={{ scale: 1.02 }}
                        transition={{ duration: SLIDE_DURATION / 1000, ease: 'linear' }}>
                        <img src={s.url}
                            srcSet={`${s.urlSm} 480w, ${s.urlMd} 800w, ${s.url} 1175w`}
                            sizes="(max-width: 640px) 480px, (max-width: 1024px) 800px, 1175px"
                            alt={s.alt} width={s.width} height={s.height}
                            fetchPriority={idx === 0 ? 'high' : 'low'}
                            loading={idx === 0 ? 'eager' : 'lazy'}
                            decoding={idx === 0 ? 'sync' : 'async'}
                            style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center' }}
                        />
                    </motion.div>
                    <div style={{ position:'absolute', inset:0, background:s.grad1 }} />
                    <div style={{ position:'absolute', inset:0, background:s.grad2 }} />
                    <motion.div initial={{ scaleY:0 }} animate={{ scaleY:1 }}
                        transition={{ duration:1.1, delay:0.25, ease:[0.22,1,0.36,1] }}
                        style={{
                            position:'absolute', top:0, left:0, width:'2px', height:'100%',
                            background:`linear-gradient(to bottom, transparent 10%, ${s.accent} 35%, ${s.accent} 65%, transparent 90%)`,
                            transformOrigin:'top',
                        }} />
                </motion.div>
            </AnimatePresence>

            {/* CONTENU */}
            <div className="ash-content">
                <AnimatePresence mode="wait">
                    <div key={'text-' + idx} className="ash-text-block">

                        <motion.div variants={stagger(0.06)} initial="hidden" animate="visible" exit="exit">
                            <span className="ash-eyebrow"
                                style={{ border:`1px solid ${s.accent}35`, background:`${s.accent}14` }}>
                                <span className="ash-eyebrow-dot"
                                    style={{ background:s.accent, boxShadow:`0 0 5px ${s.accent}` }} />
                                <span className="ash-eyebrow-text" style={{ color:s.accentLight }}>
                                    {s.eyebrow}
                                </span>
                            </span>
                        </motion.div>

                        <motion.h1 variants={stagger(0.16)} initial="hidden" animate="visible" exit="exit"
                            className="ash-title">
                            {s.headline}
                        </motion.h1>

                        <motion.div
                            initial={{ width:0, opacity:0 }} animate={{ width:'32px', opacity:1 }}
                            exit={{ width:0, opacity:0 }}
                            transition={{ duration:0.45, delay:0.28, ease:[0.22,1,0.36,1] }}
                            className="ash-rule"
                            style={{ background:`linear-gradient(to right, ${s.accent}, transparent)` }}
                        />

                        <motion.p variants={stagger(0.24)} initial="hidden" animate="visible" exit="exit"
                            className="ash-body">
                            {s.body}
                        </motion.p>

                        <motion.blockquote variants={stagger(0.30)} initial="hidden" animate="visible" exit="exit"
                            className="ash-quote"
                            style={{ borderLeft:`2px solid ${s.accent}45`, background:`${s.accent}07` }}>
                            <span className="ash-quote-text">{s.quote}</span>
                        </motion.blockquote>

                        <motion.div variants={stagger(0.36)} initial="hidden" animate="visible" exit="exit"
                            className="ash-cta-row">
                            <Link href={s.cta.to} className="ash-cta-btn"
                                style={{
                                    background:`linear-gradient(135deg, ${s.accent}, ${s.accent}CC)`,
                                    boxShadow:`0 4px 16px ${s.accent}45`,
                                }}>
                                {s.cta.label}
                                <ArrowRight size={11} aria-hidden="true" />
                            </Link>
                            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                                <div className="ash-stat-sep" />
                                <div>
                                    <p className="ash-stat-value" style={{ color:s.accentLight }}>{s.stat.value}</p>
                                    <p className="ash-stat-label">{s.stat.label}</p>
                                </div>
                            </div>
                        </motion.div>

                    </div>
                </AnimatePresence>
            </div>

            {/* FLÈCHES */}
            {[
                { fn:prev, side:'left',  Icon:ChevronLeft,  label:'Image précédente' },
                { fn:next, side:'right', Icon:ChevronRight, label:'Image suivante'   },
            ].map(({ fn, side, Icon, label }) => (
                <button key={side} onClick={fn} aria-label={label}
                    className={`ash-arrow ash-arrow-${side}`}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = `${s.accent}20`;
                        e.currentTarget.style.borderColor = `${s.accent}40`;
                        e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(245,242,238,0.06)';
                        e.currentTarget.style.borderColor = 'rgba(245,242,238,0.10)';
                        e.currentTarget.style.color = 'rgba(245,242,238,0.48)';
                    }}>
                    <Icon size={15} aria-hidden="true" />
                </button>
            ))}

            {/* INDICATEURS */}
            <div className="ash-indicators">
                <div style={{ width:'1px', height:'34px', background:'rgba(245,242,238,0.1)', overflow:'hidden' }}
                    role="progressbar" aria-valuenow={Math.round(progress)}
                    aria-valuemin={0} aria-valuemax={100} aria-label="Progression">
                    <div style={{ width:'100%', height:`${progress}%`, background:s.accent }} />
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}
                    role="tablist" aria-label="Diapositives">
                    {slides.map((sl, i) => (
                        <button key={i} onClick={() => goTo(i)}
                            role="tab" aria-selected={i === idx}
                            aria-label={`Aller à : ${sl.eyebrow}`}
                            className="ash-dot-btn">
                            <span className="ash-dot-inner" style={{
                                width: i === idx ? '14px' : '4px',
                                background: i === idx ? s.accent : 'rgba(245,242,238,0.18)',
                                boxShadow: i === idx ? `0 0 4px ${s.accent}70` : 'none',
                            }} />
                        </button>
                    ))}
                </div>
                <p className="ash-counter" aria-hidden="true">
                    {String(idx + 1).padStart(2,'0')} / {String(slides.length).padStart(2,'0')}
                </p>
            </div>
        </div>
    );
};

export default HeroSliderAlt;