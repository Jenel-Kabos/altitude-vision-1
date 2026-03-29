import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';

const slides = [
    {
        url:         'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=1175&auto=format&fit=crop',
        urlMd:       'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=800&auto=format&fit=crop',
        urlSm:       'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=480&auto=format&fit=crop',
        width:       1175, height: 783,
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
        width:       1460, height: 973,
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
        width:       1470, height: 980,
        alt:         'Villa de luxe Brazzaville — Altimmo prestige',
        eyebrow:     'Altimmo · Prestige',
        headline:    'L\'élégance,\nà votre portée.',
        body:        'Des villas d\'exception aux appartements modernes — nous sélectionnons les biens les plus exclusifs de Brazzaville pour une clientèle exigeante.',
        quote:       '"Une sélection impeccable, un service d\'une rare qualité."',
        cta:         { label: 'Voir l\'exclusif', to: '/altimmo/annonces' },
        stat:        { value: '5 ans', label: 'd\'expertise locale' },
        accent:      '#C8872A',
        accentLight: '#E8B86D',
        grad1: 'linear-gradient(108deg, rgba(18,10,2,0.92) 0%, rgba(12,6,0,0.58) 52%, rgba(12,6,0,0.1) 100%)',
        grad2: 'linear-gradient(to top, rgba(12,6,0,0.88) 0%, transparent 50%)',
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
                            srcSet={s.urlSm + " 480w, " + s.urlMd + " 800w, " + s.url + " 1175w"}
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
                    <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                        transition={{ duration: 1.1, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
                        style={{ position: 'absolute', top: 0, left: 0, width: '2px', height: '100%',
                            background: "linear-gradient(to bottom, transparent 8%, " + s.accent + " 35%, " + s.accent + " 65%, transparent 92%)",
                            transformOrigin: 'top' }} />
                </motion.div>
            </AnimatePresence>

            {/* ── CONTENU ───────────────────────────────────────────── */}
            <div style={{
                position: 'absolute', inset: 0, zIndex: 10,
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                // padding-bottom généreux : laisse la place aux pills de recherche
                // de AltimmoPage (bottom: 72px) + bande atouts (52px)
                padding: 'clamp(80px,11vw,100px) clamp(24px,6vw,80px) clamp(150px,22vw,185px)',
            }}>
                <AnimatePresence mode="wait">
                    <div key={"text-" + idx} style={{ maxWidth: '520px' }}>

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
                                    animation: 'altPulse 2.2s ease-in-out infinite',
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
                                fontSize: 'clamp(1.9rem,4.8vw,4rem)',
                                fontWeight: 600, lineHeight: 1.06,
                                letterSpacing: '-0.02em', color: '#F5F2EE',
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
                                fontSize: 'clamp(0.8rem,1.3vw,0.92rem)',
                                fontWeight: 300, lineHeight: 1.72,
                                color: 'rgba(245,242,238,0.6)',
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
                                color: 'rgba(245,242,238,0.45)', lineHeight: 1.5,
                            }}>
                                {s.quote}
                            </span>
                        </motion.blockquote>

                        {/* CTA + Stat */}
                        <motion.div variants={stagger(0.44)} initial="hidden" animate="visible" exit="exit"
                            style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                            <Link to={s.cta.to}
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
                                <div style={{ width: '1px', height: '28px', background: 'rgba(245,242,238,0.1)' }} />
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
                                        color: 'rgba(245,242,238,0.32)',
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
                        background: 'rgba(245,242,238,0.07)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(245,242,238,0.1)',
                        color: 'rgba(245,242,238,0.55)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: '0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = s.accent + "25"; e.currentTarget.style.borderColor = s.accent + "45"; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,242,238,0.07)'; e.currentTarget.style.borderColor = 'rgba(245,242,238,0.1)'; e.currentTarget.style.color = 'rgba(245,242,238,0.55)'; }}>
                    <Icon size={16} aria-hidden="true" />
                </button>
            ))}

            {/* ── INDICATEURS — centrés verticalement, pas en bas ──── */}
            {/* Centré à mid-hauteur pour ne pas interférer avec les pills
                de recherche flottants (bottom: 72px) de AltimmoPage     */}
            <div style={{
                position: 'absolute', right: '18px',
                top: '50%', transform: 'translateY(-50%)',
                zIndex: 20, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: '10px',
            }}>
                <div style={{
                    width: '1px', height: '44px',
                    background: 'rgba(245,242,238,0.1)', overflow: 'hidden',
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
                                background: i === idx ? s.accent : 'rgba(245,242,238,0.2)',
                                boxShadow: i === idx ? "0 0 5px " + s.accent + "80" : 'none',
                                transition: 'all 0.4s ease',
                            }} />
                        </button>
                    ))}
                </div>

                <p style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: '0.56rem', letterSpacing: '0.16em',
                    color: 'rgba(245,242,238,0.25)', userSelect: 'none',
                    writingMode: 'vertical-rl',
                }} aria-hidden="true">
                    {String(idx + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
                </p>
            </div>

            <style>{`@keyframes altPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.5)} }`}</style>
        </div>
    );
};

export default HeroSliderAlt;