import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';

// ─── Slides narratifs Altcom ──────────────────────────────────
// Chaque slide raconte un service de communication avec un client réel
const slides = [
    {
        // Stratégie digitale — marque qui se développe
        url:    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1415&auto=format&fit=crop',
        urlMd:  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=800&auto=format&fit=crop',
        urlSm:  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=480&auto=format&fit=crop',
        width:  1415,
        height: 943,
        alt:    'Stratégie de communication digitale — Altcom Brazzaville',
        eyebrow:     'Altcom · Stratégie Digitale',
        headline:    'Votre marque mérite\nd\'être entendue.',
        body:        'Nous bâtissons des stratégies de communication sur-mesure qui amplifient votre voix, engagent votre audience et propulsent votre visibilité au Congo et au-delà.',
        quote:       '"Altcom a transformé notre présence digitale en véritable atout commercial."',
        cta:         { label: 'Démarrer un projet', to: '/altcom' },
        stat:        { value: '80+', label: 'projets réalisés' },
        accent:      '#C8872A',
        accentLight: '#E8B86D',
        grad1:       'linear-gradient(108deg, rgba(30,18,2,0.9) 0%, rgba(12,8,0,0.55) 50%, rgba(12,8,0,0.08) 100%)',
        grad2:       'linear-gradient(to top, rgba(13,17,23,0.85) 0%, transparent 55%)',
    },
    {
        // Branding & Identité visuelle
        url:    'https://images.unsplash.com/photo-1561070791-2526d30994b5?q=80&w=1528&auto=format&fit=crop',
        urlMd:  'https://images.unsplash.com/photo-1561070791-2526d30994b5?q=80&w=800&auto=format&fit=crop',
        urlSm:  'https://images.unsplash.com/photo-1561070791-2526d30994b5?q=80&w=480&auto=format&fit=crop',
        width:  1528,
        height: 1019,
        alt:    'Branding et identité visuelle — Altcom agence de communication',
        eyebrow:     'Altcom · Branding & Design',
        headline:    'Une identité visuelle\nqui marque les esprits.',
        body:        'Logo, charte graphique, supports de communication — nous créons des identités visuelles cohérentes et mémorables qui distinguent votre marque de la concurrence.',
        quote:       '"Notre nouveau logo est reconnu partout. Altcom a capturé l\'essence de notre marque."',
        cta:         { label: 'Voir nos créations', to: '/altcom/annonces' },
        stat:        { value: '100%', label: 'sur mesure' },
        accent:      '#B87520',
        accentLight: '#DFA050',
        grad1:       'linear-gradient(108deg, rgba(25,14,0,0.92) 0%, rgba(12,6,0,0.52) 50%, rgba(12,6,0,0.06) 100%)',
        grad2:       'linear-gradient(to top, rgba(13,17,23,0.88) 0%, transparent 55%)',
    },
    {
        // Production photo/vidéo — couverture médiatique
        url:    'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?q=80&w=1470&auto=format&fit=crop',
        urlMd:  'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?q=80&w=800&auto=format&fit=crop',
        urlSm:  'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?q=80&w=480&auto=format&fit=crop',
        width:  1470,
        height: 980,
        alt:    'Production photo et vidéo professionnelle — Altcom',
        eyebrow:     'Altcom · Production Média',
        headline:    'Chaque moment capturé\navec précision et élégance.',
        body:        'Photographie corporate, films institutionnels, couverture événementielle — nos équipes créatives immortalisent vos instants clés avec un niveau de qualité premium.',
        quote:       '"Les photos de notre événement ont été partagées des centaines de fois. Qualité exceptionnelle."',
        cta:         { label: 'Contacter l\'équipe', to: '/altcom' },
        stat:        { value: '5 ans', label: 'd\'expertise locale' },
        accent:      '#D4972E',
        accentLight: '#F0BC60',
        grad1:       'linear-gradient(108deg, rgba(20,12,0,0.9) 0%, rgba(10,6,0,0.5) 50%, rgba(10,6,0,0.06) 100%)',
        grad2:       'linear-gradient(to top, rgba(13,17,23,0.82) 0%, transparent 55%)',
    },
];

const SLIDE_DURATION = 7000;

const imgV = {
    enter:  (d) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: '0%', opacity: 1, transition: { duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] } },
    exit:   (d) => ({ x: d < 0 ? '100%' : '-100%', opacity: 0, transition: { duration: 0.7, ease: [0.55, 0, 1, 0.45] } }),
};

const stagger = (delay) => ({
    hidden:  { opacity: 0, y: 24, filter: 'blur(3px)' },
    visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] } },
    exit:    { opacity: 0, y: -10, transition: { duration: 0.25 } },
});

const HeroSliderAltcom = () => {
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
        <div className="absolute inset-0 overflow-hidden" role="region" aria-label="Diaporama Altcom" aria-roledescription="carousel">

            {/* IMAGE */}
            <AnimatePresence initial={false} custom={dir} mode="wait">
                <motion.div key={"img-" + idx} custom={dir} variants={imgV} initial="enter" animate="center" exit="exit"
                    className="absolute inset-0" role="group" aria-roledescription="diapositive"
                    aria-label={(idx + 1) + " sur " + slides.length + " : " + s.eyebrow}>
                    <motion.div className="absolute inset-0" initial={{ scale: 1.08 }} animate={{ scale: 1.02 }}
                        transition={{ duration: SLIDE_DURATION / 1000, ease: 'linear' }}>
                        <img src={s.url}
                            srcSet={s.urlSm + " 480w, " + s.urlMd + " 800w, " + s.url + " 1470w"}
                            sizes="(max-width: 640px) 480px, (max-width: 1024px) 800px, 1470px"
                            alt={s.alt} width={s.width} height={s.height}
                            fetchpriority={idx === 0 ? 'high' : 'low'}
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
                            background: "linear-gradient(to bottom, transparent 8%, " + s.accent + " 40%, " + s.accent + " 70%, transparent 92%)",
                            transformOrigin: 'top' }} />
                </motion.div>
            </AnimatePresence>

            {/* TEXTE */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column',
                justifyContent: 'center', padding: 'clamp(68px,10vw,92px) clamp(22px,6vw,80px) clamp(90px,14vw,130px)' }}>
                <AnimatePresence mode="wait">
                    <div key={"text-" + idx} style={{ maxWidth: '560px' }}>

                        <motion.div variants={stagger(0.1)} initial="hidden" animate="visible" exit="exit"
                            style={{ marginBottom: 'clamp(14px,2vw,22px)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '9px',
                                padding: '5px 14px 5px 7px', borderRadius: '40px',
                                border: "1px solid " + s.accent + "45",
                                background: s.accent + "15", backdropFilter: 'blur(10px)' }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%',
                                    background: s.accent, boxShadow: "0 0 8px " + s.accent,
                                    animation: 'altcomPulse 2.2s ease-in-out infinite' }} />
                                <span style={{ fontFamily: "'Outfit', sans-serif",
                                    fontSize: 'clamp(0.58rem,1.1vw,0.66rem)', fontWeight: 500,
                                    letterSpacing: '0.22em', textTransform: 'uppercase', color: s.accentLight }}>
                                    {s.eyebrow}
                                </span>
                            </span>
                        </motion.div>

                        <motion.h1 variants={stagger(0.2)} initial="hidden" animate="visible" exit="exit"
                            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif",
                                fontSize: 'clamp(2rem,5.5vw,4.6rem)', fontWeight: 600, lineHeight: 1.04,
                                letterSpacing: '-0.025em', color: '#FBF6EE',
                                marginBottom: 'clamp(8px,1.2vw,12px)', whiteSpace: 'pre-line' }}>
                            {s.headline}
                        </motion.h1>

                        <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: '48px', opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.55, delay: 0.38, ease: [0.22, 1, 0.36, 1] }}
                            style={{ height: '1.5px', borderRadius: '2px',
                                background: "linear-gradient(to right, " + s.accent + ", transparent)",
                                marginBottom: 'clamp(12px,2vw,20px)' }} />

                        <motion.p variants={stagger(0.35)} initial="hidden" animate="visible" exit="exit"
                            style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(0.84rem,1.5vw,1rem)',
                                fontWeight: 300, lineHeight: 1.78, color: 'rgba(251,246,238,0.62)',
                                marginBottom: 'clamp(14px,2vw,20px)' }}>
                            {s.body}
                        </motion.p>

                        <motion.blockquote variants={stagger(0.45)} initial="hidden" animate="visible" exit="exit"
                            style={{ display: 'flex', alignItems: 'flex-start', gap: '10px',
                                padding: '10px 14px', borderLeft: "2px solid " + s.accent + "60",
                                background: s.accent + "08", borderRadius: '0 8px 8px 0',
                                marginBottom: 'clamp(18px,3vw,30px)' }}>
                            <span style={{ fontFamily: "'Cormorant Garamond', serif",
                                fontSize: 'clamp(0.8rem,1.4vw,0.92rem)', fontStyle: 'italic',
                                fontWeight: 400, color: 'rgba(251,246,238,0.5)', lineHeight: 1.6 }}>
                                {s.quote}
                            </span>
                        </motion.blockquote>

                        <motion.div variants={stagger(0.52)} initial="hidden" animate="visible" exit="exit"
                            style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                            <Link to={s.cta.to}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '9px',
                                    padding: 'clamp(11px,1.8vw,14px) clamp(20px,3vw,28px)', borderRadius: '40px',
                                    background: "linear-gradient(135deg, " + s.accent + ", " + s.accent + "CC)",
                                    color: '#0A0800', fontFamily: "'Outfit', sans-serif",
                                    fontSize: 'clamp(0.7rem,1.3vw,0.8rem)', fontWeight: 600,
                                    letterSpacing: '0.07em', textTransform: 'uppercase', textDecoration: 'none',
                                    boxShadow: "0 6px 24px " + s.accent + "45",
                                    transition: 'transform 0.2s, box-shadow 0.2s', whiteSpace: 'nowrap' }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = "0 12px 32px " + s.accent + "60"; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = "0 6px 24px " + s.accent + "45"; }}>
                                {s.cta.label}
                                <ArrowRight size={13} aria-hidden="true" />
                            </Link>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <div style={{ width: '1px', height: '34px', background: 'rgba(251,246,238,0.1)' }} />
                                <div>
                                    <p style={{ fontFamily: "'Cormorant Garamond', serif",
                                        fontSize: 'clamp(1.25rem,2.2vw,1.7rem)', fontWeight: 600,
                                        color: s.accentLight, lineHeight: 1, marginBottom: '2px' }}>
                                        {s.stat.value}
                                    </p>
                                    <p style={{ fontFamily: "'Outfit', sans-serif",
                                        fontSize: 'clamp(0.58rem,1vw,0.65rem)', fontWeight: 300,
                                        letterSpacing: '0.1em', color: 'rgba(251,246,238,0.35)',
                                        textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                                        {s.stat.label}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </AnimatePresence>
            </div>

            {/* FLÈCHES */}
            {[{ fn: prev, side: 'left', Icon: ChevronLeft, label: 'Image précédente' },
              { fn: next, side: 'right', Icon: ChevronRight, label: 'Image suivante' }].map(({ fn, side, Icon, label }) => (
                <button key={side} onClick={fn} aria-label={label}
                    style={{ position: 'absolute', [side]: 'clamp(12px,2.5vw,24px)', top: '50%',
                        transform: 'translateY(-50%)', zIndex: 20, width: '44px', height: '44px',
                        borderRadius: '50%', background: 'rgba(251,246,238,0.06)',
                        backdropFilter: 'blur(12px)', border: '1px solid rgba(251,246,238,0.1)',
                        color: 'rgba(251,246,238,0.6)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', cursor: 'pointer', transition: '0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = s.accent + "28"; e.currentTarget.style.borderColor = s.accent + "50"; e.currentTarget.style.color = '#0A0800'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(251,246,238,0.06)'; e.currentTarget.style.borderColor = 'rgba(251,246,238,0.1)'; e.currentTarget.style.color = 'rgba(251,246,238,0.6)'; }}>
                    <Icon size={17} aria-hidden="true" />
                </button>
            ))}

            {/* INDICATEURS */}
            <div style={{ position: 'absolute', bottom: '28px', right: '20px', zIndex: 20,
                display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
                <div style={{ width: '1px', height: '52px', background: 'rgba(251,246,238,0.1)', overflow: 'hidden' }}
                    role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Progression">
                    <div style={{ width: '100%', height: progress + '%', background: s.accent }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} role="tablist" aria-label="Diapositives">
                    {slides.map((sl, i) => (
                        <button key={i} onClick={() => goTo(i)} role="tab" aria-selected={i === idx}
                            aria-label={"Aller à : " + sl.eyebrow}
                            style={{ padding: 0, border: 'none', cursor: 'pointer', width: '32px', height: '28px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
                            <span style={{ display: 'block', width: i === idx ? '18px' : '5px', height: '4px',
                                borderRadius: '2px', background: i === idx ? s.accent : 'rgba(251,246,238,0.22)',
                                boxShadow: i === idx ? "0 0 6px " + s.accent + "90" : 'none',
                                transition: 'all 0.4s ease' }} />
                        </button>
                    ))}
                </div>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '0.6rem', letterSpacing: '0.18em',
                    color: 'rgba(251,246,238,0.28)', userSelect: 'none' }} aria-hidden="true">
                    {String(idx + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
                </p>
            </div>

            <style>{`@keyframes altcomPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.5)} }`}</style>
        </div>
    );
};

export default HeroSliderAltcom;