'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
    ShieldCheck,
    Zap,
    Users,
    MapPin,
    Handshake,
    Star,
    ArrowRight,
} from 'lucide-react';

const REASONS = [
    {
        icon:  ShieldCheck,
        title: 'Expertise Certifiée',
        desc:  'Nos équipes sont formées et certifiées dans leurs domaines respectifs — immobilier, événementiel et communication.',
        color: '#2E7BB5',
        delay: 0,
    },
    {
        icon:  Zap,
        title: 'Réactivité Totale',
        desc:  'Nous répondons à chaque demande sous 24h. Votre projet est notre priorité, du premier contact à la livraison.',
        color: '#C8960C',
        delay: 0.08,
    },
    {
        icon:  Users,
        title: 'Approche Sur Mesure',
        desc:  'Pas de solution générique — chaque client reçoit une stratégie personnalisée adaptée à ses besoins et son budget.',
        color: '#D42B2B',
        delay: 0.16,
    },
    {
        icon:  MapPin,
        title: 'Ancrage Local Fort',
        desc:  "Basés à Brazzaville, nous connaissons parfaitement le marché congolais et ses opportunités uniques.",
        color: '#2E7BB5',
        delay: 0.24,
    },
    {
        icon:  Handshake,
        title: 'Transparence Totale',
        desc:  'Tarifs clairs, contrats détaillés, suivi régulier. Nous construisons une relation de confiance durable.',
        color: '#C8960C',
        delay: 0.32,
    },
    {
        icon:  Star,
        title: 'Synergie des Pôles',
        desc:  "Immobilier, événementiel et communication travaillent ensemble. Une seule agence pour tous vos projets.",
        color: '#D42B2B',
        delay: 0.40,
    },
];

const ReasonCard = ({ reason }) => {
    const Icon = reason.icon;
    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.55, delay: reason.delay, ease: [0.25, 0.46, 0.45, 0.94] }}
            whileHover={{ y: -4 }}
            className="group relative p-6 rounded-2xl border overflow-hidden cursor-default transition-all duration-400"
            style={{
                borderColor: `${reason.color}18`,
                background:  `${reason.color}06`,
            }}
        >
            {/* Halo hover */}
            <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
                style={{ background: `radial-gradient(circle at 30% 50%, ${reason.color}10, transparent 70%)` }}
            />

            {/* Ligne accent en haut */}
            <div
                className="absolute top-0 left-0 right-0 h-px rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ backgroundColor: reason.color }}
            />

            {/* Icône */}
            <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                style={{
                    backgroundColor: `${reason.color}16`,
                    border:          `1px solid ${reason.color}28`,
                }}
            >
                <Icon className="w-5 h-5" style={{ color: reason.color }} />
            </div>

            {/* Titre */}
            <h3
                className="font-medium mb-2"
                style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize:   '1rem',
                    color:      '#E8E4DC',
                }}
            >
                {reason.title}
            </h3>

            {/* Description */}
            <p
                className="leading-relaxed text-sm"
                style={{
                    fontFamily: "'DM Sans', sans-serif",
                    color:      'rgba(232,228,220,0.45)',
                }}
            >
                {reason.desc}
            </p>
        </motion.div>
    );
};

const WhyChooseUs = () => {
    return (
        <section
            className="py-20 sm:py-24 relative overflow-hidden"
            style={{ background: '#0A0C0F' }}
        >
            {/* Décoration fond */}
            <div
                className="absolute -right-32 top-0 bottom-0 w-96 opacity-[0.04] pointer-events-none"
                style={{
                    background: 'linear-gradient(135deg, #C8960C 0%, transparent 60%)',
                    clipPath:   'polygon(100% 0, 0 50%, 100% 100%)',
                }}
            />
            {/* Ligne de séparation haut */}
            <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{ background: 'linear-gradient(to right, transparent, rgba(200,135,42,0.18), transparent)' }}
            />

            <div className="container mx-auto px-4 sm:px-6 max-w-7xl">

                <div className="lg:grid lg:grid-cols-[1fr_2fr] lg:gap-16 lg:items-start">

                    {/* Colonne gauche — titre sticky */}
                    <div className="mb-12 lg:mb-0 lg:sticky lg:top-24">
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
                        >
                            <p
                                className="text-xs font-bold uppercase tracking-widest mb-4"
                                style={{ color: '#C8960C', fontFamily: "'DM Sans', sans-serif" }}
                            >
                                Pourquoi nous choisir
                            </p>

                            <h2
                                className="mb-6"
                                style={{
                                    fontFamily:    "'Cormorant Garamond', Georgia, serif",
                                    fontSize:      'clamp(2.2rem, 4vw, 4.5rem)',
                                    fontWeight:    300,
                                    lineHeight:    1.1,
                                    letterSpacing: '-0.01em',
                                    color:         '#E8E4DC',
                                }}
                            >
                                L'excellence à
                                <span
                                    className="block"
                                    style={{
                                        background:           'linear-gradient(135deg, #C8960C, #2E7BB5)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor:  'transparent',
                                        backgroundClip:       'text',
                                    }}
                                >
                                    votre service
                                </span>
                            </h2>

                            <div
                                className="h-px w-16 rounded-full mb-6"
                                style={{ background: 'linear-gradient(to right, #C8960C, #2E7BB5)' }}
                            />

                            <p
                                className="leading-relaxed mb-8"
                                style={{
                                    fontFamily: "'DM Sans', sans-serif",
                                    fontSize:   '1rem',
                                    color:      'rgba(232,228,220,0.45)',
                                }}
                            >
                                Altitude-Vision réunit trois pôles d'expertise en une seule agence. Une approche unique, des résultats concrets, une relation de confiance.
                            </p>

                            <Link
                                href="/contact"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:scale-105 hover:shadow-xl group"
                                style={{
                                    background:  'linear-gradient(135deg, #C8960C, #E5A84B)',
                                    boxShadow:   '0 4px 20px rgba(200,135,42,0.25)',
                                    fontFamily:  "'DM Sans', sans-serif",
                                    color:       '#0A0C0F',
                                }}
                            >
                                Nous contacter
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </motion.div>
                    </div>

                    {/* Grille des cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {REASONS.map((reason, index) => (
                            <ReasonCard key={index} reason={reason} />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default WhyChooseUs;
