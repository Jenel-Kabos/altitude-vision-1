"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Building2, Calendar, Award, ThumbsUp } from 'lucide-react';

const STATS = [
    {
        icon:     Building2,
        value:    200,
        suffix:   '+',
        label:    'Biens vendus',
        sublabel: 'Transactions réussies',
        color:    '#2E7BB5',
        delay:    0,
    },
    {
        icon:     Calendar,
        value:    80,
        suffix:   '+',
        label:    'Événements organisés',
        sublabel: 'Moments inoubliables',
        color:    '#D42B2B',   // Mila Events rouge
        delay:    0.1,
    },
    {
        icon:     Award,
        value:    5,
        suffix:   ' ans',
        label:    "D'expérience",
        sublabel: "Au service de l'excellence",
        color:    '#C8960C',
        delay:    0.2,
    },
    {
        icon:     ThumbsUp,
        value:    98,
        suffix:   '%',
        label:    'Clients satisfaits',
        sublabel: 'Taux de satisfaction',
        color:    '#2E7BB5',
        delay:    0.3,
    },
];

const useCounter = (target, duration = 2000, started = false) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!started) return;
        let startTime = null;
        const step = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const eased    = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }, [started, target, duration]);

    return count;
};

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
            {/* Séparateur vertical */}
            {index < STATS.length - 1 && (
                <div className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 w-px h-16 bg-gradient-to-b from-transparent via-gray-200 to-transparent" />
            )}

            {/* Icône */}
            <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 shadow-sm"
                style={{
                    backgroundColor: `${stat.color}12`,
                    border:          `1px solid ${stat.color}20`,
                }}
            >
                <Icon className="w-7 h-7" style={{ color: stat.color }} />
            </motion.div>

            {/* Chiffre animé */}
            <div className="mb-2 flex items-end justify-center gap-1">
                <span
                    className="font-display-alt font-bold leading-none"
                    style={{
                        fontSize:   'clamp(3rem, 5vw, 6rem)',
                        color:      stat.color,
                        lineHeight: 1,
                    }}
                >
                    {count}
                </span>
                <span
                    className="pb-1 font-body font-semibold opacity-80"
                    style={{
                        fontSize: 'clamp(1.2rem, 2vw, 2.5rem)',
                        color:    stat.color,
                    }}
                >
                    {stat.suffix}
                </span>
            </div>

            {/* Label */}
            <p className="font-semibold text-ink mb-1 font-body text-[clamp(0.95rem,1.5vw,1.1rem)]">
                {stat.label}
            </p>

            {/* Sous-label */}
            <p className="text-xs text-ink-soft font-body">{stat.sublabel}</p>

            {/* Ligne décorative */}
            <motion.div
                className="mt-4 h-0.5 rounded-full opacity-40"
                initial={{ width: 0 }}
                whileInView={{ width: '40px' }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: stat.delay + 0.4 }}
                style={{ backgroundColor: stat.color }}
            />
        </motion.div>
    );
};

const StatsCounter = () => {
    const ref      = useRef(null);
    const isInView = useInView(ref, { once: true, margin: '-80px' });

    return (
        <section ref={ref} className="relative py-20 overflow-hidden bg-white">

            {/* Halos très subtils */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-80 h-80 rounded-full blur-[140px] opacity-[0.04]"
                    style={{ background: '#2E7BB5' }} />
                <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full blur-[140px] opacity-[0.06]"
                    style={{ background: '#C8960C' }} />
            </div>

            {/* Ligne décorative haut */}
            <div className="absolute top-0 left-0 right-0 h-px"
                style={{ background: 'linear-gradient(to right, transparent, rgba(200,150,12,0.2), transparent)' }} />

            <div className="container mx-auto px-4 sm:px-6 max-w-7xl relative z-10">

                {/* En-tête */}
                <motion.div
                    className="text-center mb-14"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                >
                    <p className="text-xs font-bold uppercase tracking-widest mb-3 text-gold font-body">
                        Altitude-Vision en chiffres
                    </p>
                    <h2 className="font-display-alt font-semibold text-ink text-[clamp(2rem,4vw,4.5rem)] leading-tight">
                        Des résultats qui parlent d'eux-mêmes
                    </h2>
                </motion.div>

                {/* Grille */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 relative">
                    <div className="absolute inset-0 rounded-3xl border border-gray-100 pointer-events-none" />
                    <div className="absolute inset-0 rounded-3xl bg-surface/60 pointer-events-none" />

                    {STATS.map((stat, index) => (
                        <StatCard key={index} stat={stat} index={index} started={isInView} />
                    ))}
                </div>
            </div>

            {/* Ligne décorative bas */}
            <div className="absolute bottom-0 left-0 right-0 h-px"
                style={{ background: 'linear-gradient(to right, transparent, rgba(46,123,181,0.15), transparent)' }} />
        </section>
    );
};

export default StatsCounter;
