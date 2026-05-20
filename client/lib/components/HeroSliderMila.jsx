"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';

const slides = [
    {
        url:    'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1470&auto=format&fit=crop',
        urlMd:  'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=800&auto=format&fit=crop',
        urlSm:  'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=480&auto=format&fit=crop',
        width:  1470, height: 980,
        alt:    'Mariage élégant organisé par Mila Events à Brazzaville',
        eyebrow:     'Mila Events · Mariage',
        headline:    'Le plus beau jour\nde votre vie, sublimé.',
        body:        'Chaque détail orchestré avec une attention absolue — décors, traiteur, musique, coordination — pour que vous viviez pleinement chaque instant.',
        quote:       '"Mila Events a transformé notre mariage en un conte de fées inoubliable."',
        cta:         { label: 'Demander un devis', to: '/mila-events' },
        stat:        { value: '30+', label: 'mariages organisés' },
        accent:      '#D42B2B',
        accentLight: '#F08080',
        grad1: 'linear-gradient(108deg, rgba(80,10,20,0.92) 0%, rgba(10,5,8,0.6) 52%, rgba(10,5,8,0.1) 100%)',
        grad2: 'linear-gradient(to top, rgba(10,5,8,0.88) 0%, transparent 50%)',
    },
    {
        url:    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=1470&auto=format&fit=crop',
        urlMd:  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=800&auto=format&fit=crop',
        urlSm:  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=480&auto=format&fit=crop',
        width:  1470, height: 980,
        alt:    'Événement corporate professionnel organisé par Mila Events',
        eyebrow:     'Mila Events · Corporate',
        headline:    'Des événements\nqui marquent les esprits.',
        body:        'Conférences, galas, lancements de produits — nous concevons des expériences professionnelles qui reflètent l\'excellence de votre marque.',
        quote:       '"Un niveau d\'organisation et de rigueur qui dépasse toutes nos attentes."',
        cta:         { label: 'Nos réalisations', to: '/mila-events/annonces' },
        stat:        { value: '20+', label: 'événements corporate' },
        accent:      '#A01E1E',
        accentLight: '#D88080',
        grad1: 'linear-gradient(108deg, rgba(20,5,5,0.94) 0%, rgba(10,5,8,0.6) 52%, rgba(10,5,8,0.08) 100%)',
        grad2: 'linear-gradient(to top, rgba(10,5,8,0.9) 0%, transparent 50%)',
    },
    {
        url:    'https://images.unsplash.com/photo-1478146896981-b80fe463b330?q=80&w=1374&auto=format&fit=crop',
        urlMd:  'https://images.unsplash.com/photo-1478146896981-b80fe463b330?q=80&w=800&auto=format&fit=crop',
        urlSm:  'https://images.unsplash.com/photo-1478146896981-b80fe463b330?q=80&w=480&auto=format&fit=crop',
        width:  1374, height: 916,
        alt:    'Décoration et scénographie luxueuse par Mila Events',
        eyebrow:     'Mila Events · Scénographie',
        headline:    'Chaque espace,\nune signature unique.',
        body:        'Nos créateurs transforment vos lieux en décors sur-mesure — fleurs, lumières, structures — pour créer des ambiances qui vous ressemblent.',
        quote:       '"La salle était d\'une beauté à couper le souffle, exactement notre vision."',
        cta:         { label: 'Voir nos créations', to: '/mila-events/annonces' },
        stat:        { value: '100%', label: 'sur mesure' },
        accent:      '#C8872A',
        accentLight: '#E8B86D',
        grad1: 'linear-gradient(108deg, rgba(30,15,0,0.92) 0%, rgba(10,5,0,0.6) 52%, rgba(10,5,0,0.08) 100%)',
        grad2: 'linear-gradient(to top, rgba(10,5,0,0.88) 0%, transparent 50%)',
    },
];

const SLIDE_DURATION = 7000;

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

const HeroSliderMila = () => {
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
            role="region" aria-label="Diaporama Mila Events" aria-roledescription="carousel">

            {/* ── IMAGE ─────────────────────────────────────────────── */}
            <AnimatePresence initial={false} custom={dir} mode="wait">
                <motion.div key={"img-" + idx} custom={dir} variants={imgV}
                    initial="enter" animate="center" exit="exit"
                    className="absolute inset-0"
                    role="group" aria-roledescription="diapositive"
                    aria-label={(idx + 1) + " sur " + slides.length + " : " + s.eyebrow}>
                    <motion.div className="absolute inset-0"
                        initial={{ scale: 1.08 }} animate={{ scale: 1.02 }}
                        transition={{ duration: SLIDE_DURATION / 1000, ease: 'linear' }}>
                        <img src={s.url}
                            srcSet={s.urlSm + " 480w, " + s.urlMd + " 800w, " + s.url + " 1470w"}
                            sizes="(max-width: 640px) 480px, (max-width: 1024px) 800px, 1470px"
                            alt={s.alt} width={s.width} height={s.height}
                            fetchPriority={idx === 0 ? 'high' : 'low'}
                            loading={idx === 0 ? 'eager' : 'lazy'}
                            decoding={idx === 0 ? 'sync' : 'async'}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
                        />
                    </motion.div>
                    <div style={{ position: 'absolute', inset: 0, background: s.grad1 }} />
                    <div style={{ position: 'absolute', inset: 0, background: s.grad2 }} />
                    <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                        transition={{ duration: 1.1, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
                        style={{ position: 'absolute', top: 0, left: 0, width: '2px', height: '100%',
                            background: "linear-gradient(to bottom, transparent 8%, " + s.accent + " 35%, " + s.accent + " 65%, transparent 92%)",
                            transformOrigin: 'top' }} />
                </motion.div>
            </AnimatePresence>

            {/* ── CONTENU ─────────────────────────────────────────────
                flex-start + padding-top 110px minimum :
                - header fixe = 72px
                - marge visuelle = ~38px
                → eyebrow toujours visible sous le header
                padding-bottom 160px : laisse la place aux CTAs
                flottants de MilaEventsPage (bottom: 72px + bande 52px)
            ────────────────────────────────────────────────────────── */}
            <div style={{
                position: 'absolute', inset: 0, zIndex: 10,
                display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
                padding: 'clamp(110px,14vw,160px) clamp(24px,6vw,120px) clamp(160px,22vw,220px)',
            }}>
                <AnimatePresence mode="wait">
                    <div key={"text-" + idx} style={{ maxWidth: '680px' }}>

                        {/* Eyebrow */}
                        <motion.div variants={stagger(0.08)} initial="hidden" animate="visible" exit="exit"
                            style={{ marginBottom: 'clamp(12px,1.8vw,18px)' }}>
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                padding: '4px 12px 4px 6px', borderRadius: '40px',
                                border: "1px solid " + s.accent + "40",
                                background: s.accent + "12", backdropFilter: 'blur(10px)',
                            }}>
                                <span style={{
                                    width: '5px', height: '5px', borderRadius: '50%',
                                    background: s.accent, boxShadow: "0 0 6px " + s.accent,
                                    animation: 'milaPulse 2.2s ease-in-out infinite',
                                }} />
                                <span style={{
                                    fontFamily: "'Outfit', sans-serif",
                                    fontSize: 'clamp(0.55rem,1vw,0.62rem)', fontWeight: 500,
                                    letterSpacing: '0.2em', textTransform: 'uppercase', color: s.accentLight,
                                }}>
                                    {s.eyebrow}
                                </span>
                            </span>
                        </motion.div>

                        {/* Titre */}
                        <motion.h1 variants={stagger(0.18)} initial="hidden" animate="visible" exit="exit"
                            style={{
                                fontFamily: "'Cormorant Garamond', Georgia, serif",
                                fontSize: 'clamp(1.9rem,4.8vw,7rem)',
                                fontWeight: 600, lineHeight: 1.06,
                                letterSpacing: '-0.02em', color: '#FDF8F5',
                                marginBottom: 'clamp(6px,1vw,10px)',
                                whiteSpace: 'pre-line',
                            }}>
                            {s.headline}
                        </motion.h1>

                        {/* Filet */}
                        <motion.div
                            initial={{ width: 0, opacity: 0 }} animate={{ width: '40px', opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.5, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
                            style={{
                                height: '1.5px', borderRadius: '2px',
                                background: "linear-gradient(to right, " + s.accent + ", transparent)",
                                marginBottom: 'clamp(10px,1.6vw,16px)',
                            }}
                        />

                        {/* Corps */}
                        <motion.p variants={stagger(0.28)} initial="hidden" animate="visible" exit="exit"
                            style={{
                                fontFamily: "'Outfit', sans-serif",
                                fontSize: 'clamp(0.8rem,1.3vw,1.2rem)',
                                fontWeight: 300, lineHeight: 1.72,
                                color: 'rgba(253,248,245,0.6)',
                                marginBottom: 'clamp(10px,1.5vw,16px)',
                            }}>
                            {s.body}
                        </motion.p>

                        {/* Citation */}
                        <motion.blockquote variants={stagger(0.36)} initial="hidden" animate="visible" exit="exit"
                            style={{
                                padding: '8px 12px',
                                borderLeft: "2px solid " + s.accent + "55",
                                background: s.accent + "07",
                                borderRadius: '0 6px 6px 0',
                                marginBottom: 'clamp(14px,2.2vw,24px)',
                            }}>
                            <span style={{
                                fontFamily: "'Cormorant Garamond', serif",
                                fontSize: 'clamp(0.76rem,1.2vw,0.86rem)',
                                fontStyle: 'italic', fontWeight: 400,
                                color: 'rgba(253,248,245,0.45)', lineHeight: 1.5,
                            }}>
                                {s.quote}
                            </span>
                        </motion.blockquote>

                        {/* CTA + Stat */}
                        <motion.div variants={stagger(0.44)} initial="hidden" animate="visible" exit="exit"
                            style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                            <Link href={s.cta.to}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                                    padding: 'clamp(9px,1.5vw,12px) clamp(16px,2.5vw,24px)',
                                    borderRadius: '40px',
                                    background: "linear-gradient(135deg, " + s.accent + ", " + s.accent + "CC)",
                                    color: '#fff',
                                    fontFamily: "'Outfit', sans-serif",
                                    fontSize: 'clamp(0.65rem,1.1vw,0.74rem)',
                                    fontWeight: 600, letterSpacing: '0.07em',
                                    textTransform: 'uppercase', textDecoration: 'none',
                                    boxShadow: "0 5px 20px " + s.accent + "40",
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                    whiteSpace: 'nowrap',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = "0 10px 28px " + s.accent + "55"; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = "0 5px 20px " + s.accent + "40"; }}>
                                {s.cta.label}
                                <ArrowRight size={12} aria-hidden="true" />
                            </Link>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '1px', height: '28px', background: 'rgba(253,248,245,0.1)' }} />
                                <div>
                                    <p style={{
                                        fontFamily: "'Cormorant Garamond', serif",
                                        fontSize: 'clamp(1.1rem,1.8vw,1.4rem)',
                                        fontWeight: 600, color: s.accentLight,
                                        lineHeight: 1, marginBottom: '1px',
                                    }}>
                                        {s.stat.value}
                                    </p>
                                    <p style={{
                                        fontFamily: "'Outfit', sans-serif",
                                        fontSize: 'clamp(0.54rem,0.9vw,0.6rem)',
                                        fontWeight: 300, letterSpacing: '0.1em',
                                        color: 'rgba(253,248,245,0.32)',
                                        textTransform: 'uppercase', whiteSpace: 'nowrap',
                                    }}>
                                        {s.stat.label}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </AnimatePresence>
            </div>

            {/* ── FLÈCHES ───────────────────────────────────────────── */}
            {[
                { fn: prev, side: 'left',  Icon: ChevronLeft,  label: 'Image précédente' },
                { fn: next, side: 'right', Icon: ChevronRight, label: 'Image suivante'   },
            ].map(({ fn, side, Icon, label }) => (
                <button key={side} onClick={fn} aria-label={label}
                    style={{
                        position: 'absolute', [side]: 'clamp(12px,2vw,20px)',
                        top: '50%', transform: 'translateY(-50%)',
                        zIndex: 20, width: '40px', height: '40px',
                        borderRadius: '50%',
                        background: 'rgba(253,248,245,0.07)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(253,248,245,0.1)',
                        color: 'rgba(253,248,245,0.55)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: '0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = s.accent + "25"; e.currentTarget.style.borderColor = s.accent + "45"; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(253,248,245,0.07)'; e.currentTarget.style.borderColor = 'rgba(253,248,245,0.1)'; e.currentTarget.style.color = 'rgba(253,248,245,0.55)'; }}>
                    <Icon size={16} aria-hidden="true" />
                </button>
            ))}

            {/* ── INDICATEURS — centrés verticalement ──────────────── */}
            <div style={{
                position: 'absolute', right: '18px',
                top: '50%', transform: 'translateY(-50%)',
                zIndex: 20, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: '10px',
            }}>
                <div style={{
                    width: '1px', height: '44px',
                    background: 'rgba(253,248,245,0.1)', overflow: 'hidden',
                }}
                    role="progressbar"
                    aria-valuenow={Math.round(progress)}
                    aria-valuemin={0} aria-valuemax={100}
                    aria-label="Progression">
                    <div style={{ width: '100%', height: progress + '%', background: s.accent }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}
                    role="tablist" aria-label="Diapositives">
                    {slides.map((sl, i) => (
                        <button key={i} onClick={() => goTo(i)}
                            role="tab" aria-selected={i === idx}
                            aria-label={"Aller à : " + sl.eyebrow}
                            style={{
                                padding: 0, border: 'none', cursor: 'pointer',
                                width: '28px', height: '24px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'transparent',
                            }}>
                            <span style={{
                                display: 'block',
                                width: i === idx ? '16px' : '4px',
                                height: '4px', borderRadius: '2px',
                                background: i === idx ? s.accent : 'rgba(253,248,245,0.2)',
                                boxShadow: i === idx ? "0 0 5px " + s.accent + "80" : 'none',
                                transition: 'all 0.4s ease',
                            }} />
                        </button>
                    ))}
                </div>

                <p style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: '0.56rem', letterSpacing: '0.16em',
                    color: 'rgba(253,248,245,0.25)', userSelect: 'none',
                    writingMode: 'vertical-rl',
                }} aria-hidden="true">
                    {String(idx + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
                </p>
            </div>

            <style>{`@keyframes milaPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.5)} }`}</style>
        </div>
    );
};

export default HeroSliderMila;