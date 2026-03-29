import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';

// ─── Slides narratifs Altimmo ─────────────────────────────────
// Chaque slide raconte une histoire humaine liée au service.
// 3 récits : famille → investisseur → prestige
const slides = [
    {
        // Famille qui vient d'acheter sa maison
        url:         'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=1175&auto=format&fit=crop',
        urlMd:       'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=800&auto=format&fit=crop',
        urlSm:       'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=480&auto=format&fit=crop',
        width:       1175,
        height:      783,
        alt:         'Maison familiale à Brazzaville — Altimmo',
        eyebrow:     'Altimmo · Vente',
        headline:    'Chaque famille mérite\nsa maison de rêve.',
        body:        'De la recherche à la remise des clés, nous sommes à vos côtés à chaque étape pour concrétiser le projet le plus important de votre vie.',
        quote:       '"Grâce à Altimmo, nous avons trouvé notre chez-nous en 3 semaines."',
        cta:         { label: 'Nos annonces', to: '/altimmo/annonces' },
        stat:        { value: '200+', label: 'familles accompagnées' },
        accent:      '#2E7BB5',
        accentLight: '#7BB8E0',
    },
    {
        // Investisseur confiant, vue intérieure élégante
        url:         'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=1460&auto=format&fit=crop',
        urlMd:       'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=800&auto=format&fit=crop',
        urlSm:       'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=480&auto=format&fit=crop',
        width:       1460,
        height:      973,
        alt:         'Investissement immobilier sécurisé au Congo',
        eyebrow:     'Altimmo · Conseil',
        headline:    'Investir à Brazzaville\nen toute sérénité.',
        body:        'Notre équipe analyse le marché local pour vous offrir les meilleures opportunités. Accompagnement juridique inclus, transparence totale sur les frais.',
        quote:       '"Un partenaire qui connaît vraiment le marché congolais."',
        cta:         { label: 'Conseil gratuit', to: '/altimmo' },
        stat:        { value: '98%', label: 'clients satisfaits' },
        accent:      '#1A5A8A',
        accentLight: '#5A9AC0',
    },
    {
        // Villa de prestige — cible haut de gamme
        url:         'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1470&auto=format&fit=crop',
        urlMd:       'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=800&auto=format&fit=crop',
        urlSm:       'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=480&auto=format&fit=crop',
        width:       1470,
        height:      980,
        alt:         'Villa de luxe Brazzaville — Altimmo prestige',
        eyebrow:     'Altimmo · Prestige',
        headline:    'L\'élégance,\nà votre portée.',
        body:        'Des villas d\'exception aux appartements modernes — nous sélectionnons les biens les plus exclusifs de Brazzaville pour une clientèle exigeante.',
        quote:       '"Une sélection impeccable, un service d\'une rare qualité."',
        cta:         { label: 'Voir l\'exclusif', to: '/altimmo/annonces' },
        stat:        { value: '5 ans', label: 'd\'expertise locale' },
        accent:      '#C8872A',
        accentLight: '#E8B86D',
    },
];

const SLIDE_DURATION = 7000;

const imgVariants = {
    enter:  (d) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: '0%', opacity: 1, transition: { duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] } },
    exit:   (d) => ({ x: d < 0 ? '100%' : '-100%', opacity: 0, transition: { duration: 0.7, ease: [0.55, 0, 1, 0.45] } }),
};

const stagger = (delay) => ({
    hidden:  { opacity: 0, y: 24, filter: 'blur(3px)' },
    visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] } },
    exit:    { opacity: 0, y: -10, transition: { duration: 0.25 } },
});

const HeroSliderAlt = () => {
    const [idx, setIdx]         = useState(0);
    const [dir, setDir]         = useState(1);
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
        <div
            className="absolute inset-0 overflow-hidden"
            role="region"
            aria-label="Diaporama Altimmo"
            aria-roledescription="carousel"
        >
            {/* ══ IMAGE FOND ══════════════════════════════════════════ */}
            <AnimatePresence initial={false} custom={dir} mode="wait">
                <motion.div
                    key={`img-${idx}`}
                    custom={dir}
                    variants={imgVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="absolute inset-0"
                    role="group"
                    aria-roledescription="diapositive"
                    aria-label={`${idx + 1} sur ${slides.length} : ${s.eyebrow}`}
                >
                    <motion.div
                        className="absolute inset-0"
                        initial={{ scale: 1.08 }}
                        animate={{ scale: 1.02 }}
                        transition={{ duration: SLIDE_DURATION / 1000, ease: 'linear' }}
                    >
                        {/* ✅ srcset responsive — mobile charge 480px au lieu de 1175px */}
                        <img
                            src={s.url}
                            srcSet={`${s.urlSm} 480w, ${s.urlMd} 800w, ${s.url} 1175w`}
                            sizes="(max-width: 640px) 480px, (max-width: 1024px) 800px, 1175px"
                            alt={s.alt}
                            width={s.width}
                            height={s.height}
                            fetchpriority={idx === 0 ? 'high' : 'low'}
                            loading={idx === 0 ? 'eager' : 'lazy'}
                            decoding={idx === 0 ? 'sync' : 'async'}
                            style={{
                                position: 'absolute', inset: 0,
                                width: '100%', height: '100%',
                                objectFit: 'cover', objectPosition: 'center',
                            }}
                        />
                    </motion.div>

                    {/* Calques de dégradé */}
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(108deg, rgba(5,10,18,0.9) 0%, rgba(5,10,18,0.55) 48%, rgba(5,10,18,0.1) 100%)',
                    }} />
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(to top, rgba(5,10,18,0.8) 0%, transparent 52%)',
                    }} />

                    {/* Ligne accent animée */}
                    <motion.div
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 1.1, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
                        style={{
                            position: 'absolute', top: 0, left: 0,
                            width: '2px', height: '100%',
                            background: `linear-gradient(to bottom, transparent 8%, ${s.accent} 40%, ${s.accent} 70%, transparent 92%)`,
                            transformOrigin: 'top',
                        }}
                    />
                </motion.div>
            </AnimatePresence>

            {/* ══ CONTENU ÉDITORIAL ═══════════════════════════════════ */}
            <div style={{
                position: 'absolute', inset: 0, zIndex: 10,
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                padding: 'clamp(68px,10vw,92px) clamp(22px,6vw,80px) clamp(90px,14vw,130px)',
            }}>
                <AnimatePresence mode="wait">
                    <div key={`text-${idx}`} style={{ maxWidth: '560px' }}>

                        {/* Eyebrow pill */}
                        <motion.div variants={stagger(0.1)} initial="hidden" animate="visible" exit="exit"
                            style={{ marginBottom: 'clamp(14px,2vw,22px)' }}>
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '9px',
                                padding: '5px 14px 5px 7px', borderRadius: '40px',
                                border: `1px solid ${s.accent}45`,
                                background: `${s.accent}15`,
                                backdropFilter: 'blur(10px)',
                            }}>
                                <span style={{
                                    width: '6px', height: '6px', borderRadius: '50%',
                                    background: s.accent,
                                    boxShadow: `0 0 8px ${s.accent}`,
                                    animation: 'altPulse 2.2s ease-in-out infinite',
                                }} />
                                <span style={{
                                    fontFamily: "'Outfit', sans-serif",
                                    fontSize: 'clamp(0.58rem,1.1vw,0.66rem)',
                                    fontWeight: 500, letterSpacing: '0.22em',
                                    textTransform: 'uppercase', color: s.accentLight,
                                }}>
                                    {s.eyebrow}
                                </span>
                            </span>
                        </motion.div>

                        {/* Titre principal */}
                        <motion.h1
                            variants={stagger(0.2)}
                            initial="hidden" animate="visible" exit="exit"
                            style={{
                                fontFamily: "'Cormorant Garamond', Georgia, serif",
                                fontSize: 'clamp(2rem,5.5vw,4.6rem)',
                                fontWeight: 600, lineHeight: 1.04,
                                letterSpacing: '-0.025em', color: '#F5F2EE',
                                marginBottom: 'clamp(8px,1.2vw,12px)',
                                whiteSpace: 'pre-line',
                            }}
                        >
                            {s.headline}
                        </motion.h1>

                        {/* Filet décoratif */}
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: '48px', opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.55, delay: 0.38, ease: [0.22, 1, 0.36, 1] }}
                            style={{
                                height: '1.5px', borderRadius: '2px',
                                background: `linear-gradient(to right, ${s.accent}, transparent)`,
                                marginBottom: 'clamp(12px,2vw,20px)',
                            }}
                        />

                        {/* Corps */}
                        <motion.p
                            variants={stagger(0.35)}
                            initial="hidden" animate="visible" exit="exit"
                            style={{
                                fontFamily: "'Outfit', sans-serif",
                                fontSize: 'clamp(0.84rem,1.5vw,1rem)',
                                fontWeight: 300, lineHeight: 1.78,
                                color: 'rgba(245,242,238,0.62)',
                                marginBottom: 'clamp(14px,2vw,22px)',
                            }}
                        >
                            {s.body}
                        </motion.p>

                        {/* Citation client */}
                        <motion.blockquote
                            variants={stagger(0.45)}
                            initial="hidden" animate="visible" exit="exit"
                            style={{
                                display: 'flex', alignItems: 'flex-start', gap: '10px',
                                padding: '10px 14px',
                                borderLeft: `2px solid ${s.accent}60`,
                                background: `${s.accent}08`,
                                borderRadius: '0 8px 8px 0',
                                marginBottom: 'clamp(18px,3vw,30px)',
                            }}
                        >
                            <span style={{
                                fontFamily: "'Cormorant Garamond', serif",
                                fontSize: 'clamp(0.8rem,1.4vw,0.92rem)',
                                fontStyle: 'italic',
                                fontWeight: 400,
                                color: 'rgba(245,242,238,0.5)',
                                lineHeight: 1.6,
                            }}>
                                {s.quote}
                            </span>
                        </motion.blockquote>

                        {/* CTA + Stat */}
                        <motion.div
                            variants={stagger(0.52)}
                            initial="hidden" animate="visible" exit="exit"
                            style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}
                        >
                            <Link
                                to={s.cta.to}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '9px',
                                    padding: 'clamp(11px,1.8vw,14px) clamp(20px,3vw,28px)',
                                    borderRadius: '40px',
                                    background: `linear-gradient(135deg, ${s.accent}, ${s.accent}BB)`,
                                    color: '#fff',
                                    fontFamily: "'Outfit', sans-serif",
                                    fontSize: 'clamp(0.7rem,1.3vw,0.8rem)',
                                    fontWeight: 500, letterSpacing: '0.07em',
                                    textTransform: 'uppercase', textDecoration: 'none',
                                    boxShadow: `0 6px 24px ${s.accent}40`,
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                    whiteSpace: 'nowrap',
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = `0 12px 32px ${s.accent}55`;
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'none';
                                    e.currentTarget.style.boxShadow = `0 6px 24px ${s.accent}40`;
                                }}
                            >
                                {s.cta.label}
                                <ArrowRight size={13} aria-hidden="true" />
                            </Link>

                            {/* Stat */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <div style={{
                                    width: '1px', height: '34px',
                                    background: 'rgba(245,242,238,0.1)',
                                }} />
                                <div>
                                    <p style={{
                                        fontFamily: "'Cormorant Garamond', serif",
                                        fontSize: 'clamp(1.25rem,2.2vw,1.7rem)',
                                        fontWeight: 600, color: s.accentLight,
                                        lineHeight: 1, marginBottom: '2px',
                                    }}>
                                        {s.stat.value}
                                    </p>
                                    <p style={{
                                        fontFamily: "'Outfit', sans-serif",
                                        fontSize: 'clamp(0.58rem,1vw,0.65rem)',
                                        fontWeight: 300, letterSpacing: '0.1em',
                                        color: 'rgba(245,242,238,0.35)',
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

            {/* ══ FLÈCHES ═════════════════════════════════════════════ */}
            {[
                { fn: prev, side: 'left',  Icon: ChevronLeft,  label: 'Image précédente' },
                { fn: next, side: 'right', Icon: ChevronRight, label: 'Image suivante'   },
            ].map(({ fn, side, Icon, label }) => (
                <button
                    key={side}
                    onClick={fn}
                    aria-label={label}
                    style={{
                        position: 'absolute',
                        [side]: 'clamp(12px,2.5vw,24px)',
                        top: '50%', transform: 'translateY(-50%)',
                        zIndex: 20,
                        width: '44px', height: '44px',
                        borderRadius: '50%',
                        background: 'rgba(245,242,238,0.07)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(245,242,238,0.1)',
                        color: 'rgba(245,242,238,0.6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: '0.2s',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = `${s.accent}28`;
                        e.currentTarget.style.borderColor = `${s.accent}50`;
                        e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(245,242,238,0.07)';
                        e.currentTarget.style.borderColor = 'rgba(245,242,238,0.1)';
                        e.currentTarget.style.color = 'rgba(245,242,238,0.6)';
                    }}
                >
                    <Icon size={17} aria-hidden="true" />
                </button>
            ))}

            {/* ══ INDICATEURS DROITE ══════════════════════════════════ */}
            <div style={{
                position: 'absolute', bottom: '28px', right: '20px',
                zIndex: 20, display: 'flex', flexDirection: 'column',
                alignItems: 'flex-end', gap: '12px',
            }}>
                {/* Barre progression verticale */}
                <div
                    style={{
                        width: '1px', height: '52px',
                        background: 'rgba(245,242,238,0.1)', overflow: 'hidden',
                    }}
                    role="progressbar"
                    aria-valuenow={Math.round(progress)}
                    aria-valuemin={0} aria-valuemax={100}
                    aria-label="Progression"
                >
                    <div style={{
                        width: '100%', height: `${progress}%`,
                        background: s.accent, transition: 'none',
                    }} />
                </div>

                {/* Dots */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                    role="tablist" aria-label="Diapositives">
                    {slides.map((sl, i) => (
                        <button
                            key={i}
                            onClick={() => goTo(i)}
                            role="tab"
                            aria-selected={i === idx}
                            aria-label={`Aller à : ${sl.eyebrow}`}
                            style={{
                                padding: 0, border: 'none', cursor: 'pointer',
                                width: '32px', height: '28px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'transparent',
                            }}
                        >
                            <span style={{
                                display: 'block',
                                width: i === idx ? '18px' : '5px',
                                height: '4px', borderRadius: '2px',
                                background: i === idx ? s.accent : 'rgba(245,242,238,0.22)',
                                boxShadow: i === idx ? `0 0 6px ${s.accent}90` : 'none',
                                transition: 'all 0.4s ease',
                            }} />
                        </button>
                    ))}
                </div>

                {/* Compteur */}
                <p style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: '0.6rem', letterSpacing: '0.18em',
                    color: 'rgba(245,242,238,0.28)', userSelect: 'none',
                }} aria-hidden="true">
                    {String(idx + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
                </p>
            </div>

            <style>{`
                @keyframes altPulse {
                    0%, 100% { opacity: 1;  transform: scale(1);   }
                    50%       { opacity: 0.5; transform: scale(1.5); }
                }
            `}</style>
        </div>
    );
};

export default HeroSliderAlt;