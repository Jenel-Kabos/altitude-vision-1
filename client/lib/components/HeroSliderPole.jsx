"use client";

/**
 * HeroSliderPole — composant hero canonique pour les pages de pôle.
 * Utilisé par Altimmo, Mila Events et Altcom.
 *
 * Props:
 *   slides[]        — données des diapositives (voir shape ci-dessous)
 *   ariaLabel       — label région ARIA du carousel
 *   onStartProject? — callback optionnel (bouton Altcom slide 1)
 *
 * Slide shape:
 *   { url, alt, eyebrow, headline, body, quote?, cta:{label,to,action?},
 *     stat?:{value,label}, accent, accentLight, grad1, grad2 }
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import Image from 'next/image';

// ─── Constantes ────────────────────────────────────────────────
const SLIDE_DURATION = 7000;

// ─── Variants Framer Motion ─────────────────────────────────────
const imgVariants = {
  enter:  (d) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: '0%', opacity: 1, transition: { duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:   (d) => ({ x: d < 0 ? '100%' : '-100%', opacity: 0, transition: { duration: 0.7, ease: [0.55, 0, 1, 0.45] } }),
};

const stagger = (delay) => ({
  hidden:  { opacity: 0, y: 20, filter: 'blur(3px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } },
});

// ─── CSS partagé ────────────────────────────────────────────────
const POLE_CSS = `
  @keyframes heroPulse {
    0%,100% { opacity:1; transform:scale(1); }
    50%      { opacity:.5; transform:scale(1.5); }
  }

  /* Zone contenu — position & padding */
  .hp-content {
    position: absolute; inset: 0; z-index: 10;
    display: flex; flex-direction: column; justify-content: flex-start;
    padding:
      clamp(110px,14vw,160px)
      clamp(24px,6vw,80px)
      clamp(140px,20vw,200px);
    overflow: hidden;
  }
  @media (min-width: 1440px) { .hp-content { padding-left: 120px; padding-right: 160px; } }
  @media (min-width: 1920px) { .hp-content { padding-left: 160px; padding-right: 200px; } }

  /* Bloc texte — largeur max + protection des flèches sur mobile */
  .hp-text {
    width: 100%;
    max-width: clamp(600px, 55vw, 860px);
  }
  @media (max-width: 639px) { .hp-text { max-width: calc(100vw - 72px); } }

  /* ── Eyebrow ── */
  .hp-eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 4px 13px 4px 7px; border-radius: 40px;
    backdrop-filter: blur(10px);
    margin-bottom: clamp(12px,1.8vw,18px);
  }
  .hp-eyebrow-dot {
    width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
    animation: heroPulse 2.2s ease-in-out infinite;
  }
  .hp-eyebrow-text {
    font-family: 'DM Sans', -apple-system, sans-serif;
    font-size: clamp(0.62rem,0.9vw,0.82rem);
    font-weight: 500; letter-spacing: 0.22em; text-transform: uppercase;
  }

  /* ── Titre ── */
  .hp-title {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(2.2rem,6vw,8rem);
    font-weight: 600; line-height: 1.06;
    letter-spacing: -0.02em; color: #F5F2EE;
    margin-bottom: clamp(6px,1vw,10px);
    white-space: pre-line;
  }

  /* ── Filet décoratif ── */
  .hp-rule {
    height: 1.5px; width: 36px; border-radius: 2px;
    margin-bottom: clamp(10px,1.6vw,16px);
  }

  /* ── Corps ── */
  .hp-body {
    font-family: 'DM Sans', -apple-system, sans-serif;
    font-size: clamp(0.85rem,1.4vw,1.2rem);
    font-weight: 300; line-height: 1.7;
    color: rgba(245,242,238,0.72);
    margin-bottom: clamp(10px,1.5vw,16px);
    display: -webkit-box;
    -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  @media (min-width: 640px) { .hp-body { -webkit-line-clamp: unset; overflow: visible; } }

  /* ── Citation — masquée mobile ── */
  .hp-quote {
    display: none;
    padding: 8px 12px;
    border-radius: 0 6px 6px 0;
    margin-bottom: clamp(14px,2vw,22px);
  }
  @media (min-width: 540px) { .hp-quote { display: block; } }
  .hp-quote-text {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(0.76rem,1.1vw,0.86rem);
    font-style: italic; font-weight: 400;
    color: rgba(245,242,238,0.42); line-height: 1.5;
  }

  /* ── CTA row ── */
  .hp-cta-row {
    display: flex; align-items: center;
    gap: 14px; flex-wrap: wrap;
  }
  .hp-cta-btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: clamp(10px,1.5vw,14px) clamp(18px,2.5vw,28px);
    border-radius: 40px;
    font-family: 'DM Sans', -apple-system, sans-serif;
    font-size: clamp(0.68rem,1vw,0.82rem);
    font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
    text-decoration: none; border: none; cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    white-space: nowrap; min-height: 44px;
  }
  .hp-cta-btn:hover { transform: translateY(-2px); }

  /* ── Stat inline ── */
  .hp-stat-sep { width: 1px; height: 28px; background: rgba(245,242,238,0.1); flex-shrink: 0; }
  .hp-stat-value {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(1.1rem,1.8vw,1.5rem);
    font-weight: 600; line-height: 1; margin-bottom: 1px;
  }
  .hp-stat-label {
    font-family: 'DM Sans', -apple-system, sans-serif;
    font-size: clamp(0.52rem,0.85vw,0.6rem); font-weight: 400;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: rgba(245,242,238,0.38); white-space: nowrap;
  }

  /* ── Flèches ── */
  .hp-arrow {
    position: absolute; top: 50%; transform: translateY(-50%);
    z-index: 20; width: 40px; height: 40px; border-radius: 50%;
    background: rgba(245,242,238,0.06); backdrop-filter: blur(10px);
    border: 1px solid rgba(245,242,238,0.1); color: rgba(245,242,238,0.55);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: 0.2s;
  }
  .hp-arrow-left  { left:  clamp(12px,2vw,20px); }
  .hp-arrow-right { right: clamp(12px,2vw,20px); }

  /* ── Indicateurs droite ── */
  .hp-indicators {
    position: absolute; right: 18px;
    top: 50%; transform: translateY(-50%);
    z-index: 20; display: flex; flex-direction: column;
    align-items: center; gap: 10px;
  }
  @media (max-width: 380px) { .hp-indicators { display: none; } }

  .hp-dot-btn {
    padding: 0; border: none; cursor: pointer; background: transparent;
    width: 28px; height: 24px;
    display: flex; align-items: center; justify-content: center;
  }
  .hp-dot-inner {
    display: block; height: 4px; border-radius: 2px;
    transition: all 0.4s ease;
  }
  .hp-counter {
    font-family: 'DM Sans', -apple-system, sans-serif;
    font-size: 0.52rem; letter-spacing: 0.16em;
    color: rgba(245,242,238,0.22); user-select: none;
    writing-mode: vertical-rl;
  }
`;

// ─── Composant ──────────────────────────────────────────────────
const HeroSliderPole = ({ slides, ariaLabel = 'Diaporama', onStartProject }) => {
  const [idx,      setIdx]      = useState(0);
  const [dir,      setDir]      = useState(1);
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
  }, [slides.length]);

  useEffect(() => {
    resetTimers();
    return () => { clearInterval(timerRef.current); clearInterval(progressRef.current); };
  }, [resetTimers]);

  const goTo = (i) => { setDir(i > idx ? 1 : -1); setIdx(i); resetTimers(); };
  const prev = () => { setDir(-1); setIdx(p => (p - 1 + slides.length) % slides.length); resetTimers(); };
  const next = () => { setDir(1);  setIdx(p => (p + 1) % slides.length); resetTimers(); };

  const s = slides[idx];

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      role="region"
      aria-label={ariaLabel}
      aria-roledescription="carousel"
    >
      <style>{POLE_CSS}</style>

      {/* ── IMAGE ──────────────────────────────────────────────── */}
      <AnimatePresence initial={false} custom={dir} mode="wait">
        <motion.div
          key={'img-' + idx}
          custom={dir}
          variants={imgVariants}
          initial="enter" animate="center" exit="exit"
          className="absolute inset-0"
          role="group" aria-roledescription="diapositive"
          aria-label={`${idx + 1} sur ${slides.length} : ${s.eyebrow}`}
        >
          <motion.div
            className="absolute inset-0"
            initial={{ scale: 1.08 }} animate={{ scale: 1.02 }}
            transition={{ duration: SLIDE_DURATION / 1000, ease: 'linear' }}
          >
            <Image
              src={s.url} alt={s.alt} fill
              priority={idx === 0}
              sizes="(max-width: 640px) 480px, (max-width: 1024px) 800px, 1600px"
              className="object-cover object-center"
            />
          </motion.div>

          {/* Dégradés d'opacité */}
          <div style={{ position: 'absolute', inset: 0, background: s.grad1 }} />
          <div style={{ position: 'absolute', inset: 0, background: s.grad2 }} />

          {/* Ligne accent gauche */}
          <motion.div
            initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
            transition={{ duration: 1.1, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'absolute', top: 0, left: 0, width: '2px', height: '100%',
              background: `linear-gradient(to bottom, transparent 8%, ${s.accent} 35%, ${s.accent} 65%, transparent 92%)`,
              transformOrigin: 'top',
            }}
          />
        </motion.div>
      </AnimatePresence>

      {/* ── CONTENU ────────────────────────────────────────────── */}
      <div className="hp-content">
        <AnimatePresence mode="wait">
          <div key={'text-' + idx} className="hp-text">

            {/* Eyebrow */}
            <motion.div variants={stagger(0.08)} initial="hidden" animate="visible" exit="exit"
              style={{ marginBottom: 0 }}>
              <span
                className="hp-eyebrow"
                style={{ border: `1px solid ${s.accent}35`, background: `${s.accent}12` }}
              >
                <span
                  className="hp-eyebrow-dot"
                  style={{ background: s.accent, boxShadow: `0 0 6px ${s.accent}` }}
                />
                <span className="hp-eyebrow-text" style={{ color: s.accentLight }}>
                  {s.eyebrow}
                </span>
              </span>
            </motion.div>

            {/* Titre */}
            <motion.h1
              variants={stagger(0.18)} initial="hidden" animate="visible" exit="exit"
              className="hp-title"
            >
              {s.headline}
            </motion.h1>

            {/* Filet */}
            <motion.div
              initial={{ width: 0, opacity: 0 }} animate={{ width: '36px', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.5, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="hp-rule"
              style={{ background: `linear-gradient(to right, ${s.accent}, transparent)` }}
            />

            {/* Corps */}
            <motion.p
              variants={stagger(0.28)} initial="hidden" animate="visible" exit="exit"
              className="hp-body"
            >
              {s.body}
            </motion.p>

            {/* Citation optionnelle */}
            {s.quote && (
              <motion.blockquote
                variants={stagger(0.35)} initial="hidden" animate="visible" exit="exit"
                className="hp-quote"
                style={{ borderLeft: `2px solid ${s.accent}50`, background: `${s.accent}07` }}
              >
                <span className="hp-quote-text">{s.quote}</span>
              </motion.blockquote>
            )}

            {/* CTA + Stat */}
            <motion.div
              variants={stagger(0.44)} initial="hidden" animate="visible" exit="exit"
              className="hp-cta-row"
            >
              {s.cta.action === 'openProject' && onStartProject ? (
                <button
                  onClick={onStartProject}
                  className="hp-cta-btn"
                  style={{
                    background: `linear-gradient(135deg, ${s.accent}, ${s.accent}CC)`,
                    color: '#0A0800',
                    boxShadow: `0 5px 20px ${s.accent}40`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 10px 28px ${s.accent}55`; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 5px 20px ${s.accent}40`; }}
                >
                  {s.cta.label} <ArrowRight size={12} aria-hidden="true" />
                </button>
              ) : (
                <Link
                  href={s.cta.to}
                  className="hp-cta-btn"
                  style={{
                    background: `linear-gradient(135deg, ${s.accent}, ${s.accent}CC)`,
                    color: '#0A0800',
                    boxShadow: `0 5px 20px ${s.accent}40`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 10px 28px ${s.accent}55`; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 5px 20px ${s.accent}40`; }}
                >
                  {s.cta.label} <ArrowRight size={12} aria-hidden="true" />
                </Link>
              )}

              {s.stat && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="hp-stat-sep" />
                  <div>
                    <p className="hp-stat-value" style={{ color: s.accentLight }}>{s.stat.value}</p>
                    <p className="hp-stat-label">{s.stat.label}</p>
                  </div>
                </div>
              )}
            </motion.div>

          </div>
        </AnimatePresence>
      </div>

      {/* ── FLÈCHES ────────────────────────────────────────────── */}
      {[
        { fn: prev, side: 'left',  Icon: ChevronLeft,  label: 'Diapositive précédente' },
        { fn: next, side: 'right', Icon: ChevronRight, label: 'Diapositive suivante'   },
      ].map(({ fn, side, Icon, label }) => (
        <button
          key={side}
          onClick={fn}
          aria-label={label}
          className={`hp-arrow hp-arrow-${side}`}
          onMouseEnter={e => {
            e.currentTarget.style.background    = `${s.accent}22`;
            e.currentTarget.style.borderColor   = `${s.accent}45`;
            e.currentTarget.style.color         = '#fff';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background    = 'rgba(245,242,238,0.06)';
            e.currentTarget.style.borderColor   = 'rgba(245,242,238,0.1)';
            e.currentTarget.style.color         = 'rgba(245,242,238,0.55)';
          }}
        >
          <Icon size={16} aria-hidden="true" />
        </button>
      ))}

      {/* ── INDICATEURS ────────────────────────────────────────── */}
      <div className="hp-indicators">
        {/* Barre de progression */}
        <div
          style={{ width: '1px', height: '44px', background: 'rgba(245,242,238,0.1)', overflow: 'hidden' }}
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0} aria-valuemax={100}
          aria-label="Progression de la diapositive"
        >
          <div style={{ width: '100%', height: `${progress}%`, background: s.accent }} />
        </div>

        {/* Dots */}
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
          role="tablist"
          aria-label="Sélectionner une diapositive"
        >
          {slides.map((sl, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              role="tab"
              aria-selected={i === idx}
              aria-label={`Aller à : ${sl.eyebrow}`}
              className="hp-dot-btn"
            >
              <span
                className="hp-dot-inner"
                style={{
                  width:      i === idx ? '16px' : '4px',
                  background: i === idx ? s.accent : 'rgba(245,242,238,0.2)',
                  boxShadow:  i === idx ? `0 0 5px ${s.accent}80` : 'none',
                }}
              />
            </button>
          ))}
        </div>

        <p className="hp-counter" aria-hidden="true">
          {String(idx + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
        </p>
      </div>
    </div>
  );
};

export default HeroSliderPole;
