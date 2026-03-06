import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Building2, Calendar, Award, ThumbsUp } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// Données des statistiques — à adapter selon vos vrais chiffres
// ─────────────────────────────────────────────────────────────
const STATS = [
    {
        icon:    Building2,
        value:   200,
        suffix:  '+',
        label:   'Biens vendus',
        sublabel:'Transactions réussies',
        color:   '#2E7BB5',   // Bleu Altimmo
        delay:   0,
    },
    {
        icon:    Calendar,
        value:   50,
        suffix:  '+',
        label:   'Événements organisés',
        sublabel:'Moments inoubliables',
        color:   '#D42B2B',   // Rouge Mila Events
        delay:   0.1,
    },
    {
        icon:    Award,
        value:   5,
        suffix:  ' ans',
        label:   "D'expérience",
        sublabel:"Au service de l'excellence",
        color:   '#C8872A',   // Or Altcom
        delay:   0.2,
    },
    {
        icon:    ThumbsUp,
        value:   98,
        suffix:  '%',
        label:   'Clients satisfaits',
        sublabel:'Taux de satisfaction',
        color:   '#2E7BB5',   // Bleu
        delay:   0.3,
    },
];

// ─────────────────────────────────────────────────────────────
// Hook — compteur animé
// ─────────────────────────────────────────────────────────────
const useCounter = (target, duration = 2000, started = false) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!started) return;

        let startTime = null;
        const startValue = 0;

        const step = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            // Easing — ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(startValue + eased * (target - startValue)));
            if (progress < 1) requestAnimationFrame(step);
        };

        requestAnimationFrame(step);
    }, [started, target, duration]);

    return count;
};

// ─────────────────────────────────────────────────────────────
// Carte statistique individuelle
// ─────────────────────────────────────────────────────────────
const StatCard = ({ stat, started, index }) => {
    const count = useCounter(stat.value, 2200, started);
    const Icon  = stat.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: stat.delay, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative flex flex-col items-center text-center px-6 py-8 group"
        >
            {/* Séparateur vertical — masqué sur le dernier */}
            {index < STATS.length - 1 && (
                <div className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 w-px h-16"
                    style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.1), transparent)' }} />
            )}

            {/* Icône */}
            <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 shadow-lg"
                style={{
                    backgroundColor: `${stat.color}20`,
                    border:          `1px solid ${stat.color}30`,
                }}
            >
                <Icon className="w-7 h-7" style={{ color: stat.color }} />
            </motion.div>

            {/* Chiffre animé */}
            <div className="mb-2 flex items-end justify-center gap-1">
                <span
                    className="leading-none"
                    style={{
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontSize:   'clamp(3rem, 5vw, 4.5rem)',
                        fontWeight: 700,
                        color:      stat.color,
                        lineHeight: 1,
                    }}
                >
                    {count}
                </span>
                <span
                    className="pb-1"
                    style={{
                        fontFamily: "'Outfit', sans-serif",
                        fontSize:   'clamp(1.2rem, 2vw, 1.8rem)',
                        fontWeight: 600,
                        color:      stat.color,
                        opacity:    0.8,
                    }}
                >
                    {stat.suffix}
                </span>
            </div>

            {/* Label principal */}
            <p
                className="font-bold text-white mb-1"
                style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontSize:   'clamp(0.95rem, 1.5vw, 1.1rem)',
                }}
            >
                {stat.label}
            </p>

            {/* Sous-label */}
            <p
                className="text-xs text-gray-500"
                style={{ fontFamily: "'Outfit', sans-serif" }}
            >
                {stat.sublabel}
            </p>

            {/* Ligne décorative en bas */}
            <motion.div
                className="mt-4 h-0.5 rounded-full"
                initial={{ width: 0 }}
                whileInView={{ width: '40px' }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: stat.delay + 0.4 }}
                style={{ backgroundColor: stat.color, opacity: 0.5 }}
            />
        </motion.div>
    );
};

// ─────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────
const StatsCounter = () => {
    const ref       = useRef(null);
    const isInView  = useInView(ref, { once: true, margin: '-80px' });

    return (
        <section
            ref={ref}
            className="relative py-20 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0D1117 0%, #111827 50%, #0D1117 100%)' }}
        >
            {/* ── Halos de fond ───────────────────── */}
            <div className="absolute inset-0 pointer-events-none">
                <div
                    className="absolute top-0 left-0 w-80 h-80 rounded-full blur-[120px] opacity-10"
                    style={{ background: '#2E7BB5' }}
                />
                <div
                    className="absolute bottom-0 right-0 w-80 h-80 rounded-full blur-[120px] opacity-8"
                    style={{ background: '#C8872A' }}
                />
                <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-[100px] opacity-5"
                    style={{ background: '#D42B2B' }}
                />
            </div>

            {/* ── Ligne décorative haut ───────────── */}
            <div className="absolute top-0 left-0 right-0 h-px"
                style={{ background: 'linear-gradient(to right, transparent, rgba(200,135,42,0.4), transparent)' }} />

            <div className="container mx-auto px-4 sm:px-6 max-w-6xl relative z-10">

                {/* ── En-tête ─────────────────────────── */}
                <motion.div
                    className="text-center mb-14"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                >
                    <p
                        className="text-xs font-bold uppercase tracking-widest mb-3"
                        style={{ color: '#C8872A', fontFamily: "'Outfit', sans-serif" }}
                    >
                        Altitude-Vision en chiffres
                    </p>
                    <h2
                        className="text-white"
                        style={{
                            fontFamily: "'Cormorant Garamond', Georgia, serif",
                            fontSize:   'clamp(2rem, 4vw, 3rem)',
                            fontWeight: 600,
                            lineHeight: 1.2,
                        }}
                    >
                        Des résultats qui parlent d'eux-mêmes
                    </h2>
                </motion.div>

                {/* ── Grille des stats ─────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 relative">
                    {/* Bordure globale */}
                    <div
                        className="absolute inset-0 rounded-3xl border pointer-events-none"
                        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                    />
                    <div
                        className="absolute inset-0 rounded-3xl pointer-events-none"
                        style={{ background: 'rgba(255,255,255,0.02)' }}
                    />

                    {STATS.map((stat, index) => (
                        <StatCard
                            key={index}
                            stat={stat}
                            index={index}
                            started={isInView}
                        />
                    ))}
                </div>
            </div>

            {/* ── Ligne décorative bas ────────────── */}
            <div className="absolute bottom-0 left-0 right-0 h-px"
                style={{ background: 'linear-gradient(to right, transparent, rgba(46,123,181,0.4), transparent)' }} />
        </section>
    );
};

export default StatsCounter;