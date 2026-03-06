import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    ShieldCheck,
    Zap,
    Users,
    MapPin,
    Handshake,
    Star,
    ArrowRight,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// Arguments différenciateurs
// ─────────────────────────────────────────────────────────────
const REASONS = [
    {
        icon:     ShieldCheck,
        title:    'Expertise Certifiée',
        desc:     'Nos équipes sont formées et certifiées dans leurs domaines respectifs — immobilier, événementiel et communication.',
        color:    '#2E7BB5',
        gradient: 'from-[#2E7BB5]/10 to-[#2E7BB5]/5',
        delay:    0,
    },
    {
        icon:     Zap,
        title:    'Réactivité Totale',
        desc:     'Nous répondons à chaque demande sous 24h. Votre projet est notre priorité, du premier contact à la livraison.',
        color:    '#C8872A',
        gradient: 'from-[#C8872A]/10 to-[#C8872A]/5',
        delay:    0.08,
    },
    {
        icon:     Users,
        title:    'Approche Sur Mesure',
        desc:     'Pas de solution générique — chaque client reçoit une stratégie personnalisée adaptée à ses besoins et son budget.',
        color:    '#D42B2B',
        gradient: 'from-[#D42B2B]/10 to-[#D42B2B]/5',
        delay:    0.16,
    },
    {
        icon:     MapPin,
        title:    'Ancrage Local Fort',
        desc:     "Basés à Brazzaville, nous connaissons parfaitement le marché congolais et ses opportunités uniques.",
        color:    '#2E7BB5',
        gradient: 'from-[#2E7BB5]/10 to-[#2E7BB5]/5',
        delay:    0.24,
    },
    {
        icon:     Handshake,
        title:    'Transparence Totale',
        desc:     'Tarifs clairs, contrats détaillés, suivi régulier. Nous construisons une relation de confiance durable.',
        color:    '#C8872A',
        gradient: 'from-[#C8872A]/10 to-[#C8872A]/5',
        delay:    0.32,
    },
    {
        icon:     Star,
        title:    'Synergie des Pôles',
        desc:     "Immobilier, événementiel et communication travaillent ensemble. Une seule agence pour tous vos projets.",
        color:    '#D42B2B',
        gradient: 'from-[#D42B2B]/10 to-[#D42B2B]/5',
        delay:    0.40,
    },
];

// ─────────────────────────────────────────────────────────────
// Card individuelle
// ─────────────────────────────────────────────────────────────
const ReasonCard = ({ reason }) => {
    const Icon = reason.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.55, delay: reason.delay, ease: [0.25, 0.46, 0.45, 0.94] }}
            whileHover={{ y: -4 }}
            className={`
                group relative p-6 rounded-2xl border bg-gradient-to-br ${reason.gradient}
                hover:shadow-xl transition-all duration-400 overflow-hidden cursor-default
            `}
            style={{ borderColor: `${reason.color}20` }}
        >
            {/* Halo de fond au hover */}
            <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
                style={{ background: `radial-gradient(circle at 30% 50%, ${reason.color}12, transparent 70%)` }}
            />

            {/* Ligne colorée en haut */}
            <div
                className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ backgroundColor: reason.color }}
            />

            {/* Icône */}
            <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                style={{
                    backgroundColor: `${reason.color}18`,
                    border:          `1px solid ${reason.color}25`,
                }}
            >
                <Icon className="w-5 h-5" style={{ color: reason.color }} />
            </div>

            {/* Titre */}
            <h3
                className="font-bold text-gray-900 mb-2 transition-colors duration-300 group-hover:text-gray-800"
                style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontSize:   '1rem',
                }}
            >
                {reason.title}
            </h3>

            {/* Description */}
            <p
                className="text-gray-500 leading-relaxed text-sm"
                style={{ fontFamily: "'Outfit', sans-serif" }}
            >
                {reason.desc}
            </p>
        </motion.div>
    );
};

// ─────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────
const WhyChooseUs = () => {
    return (
        <section className="py-20 sm:py-24 bg-white relative overflow-hidden">

            {/* ── Décoration de fond — triangle doré discret ── */}
            <div
                className="absolute -right-32 top-0 bottom-0 w-96 opacity-[0.03] pointer-events-none"
                style={{
                    background: 'linear-gradient(135deg, #C8872A 0%, transparent 60%)',
                    clipPath:   'polygon(100% 0, 0 50%, 100% 100%)',
                }}
            />

            <div className="container mx-auto px-4 sm:px-6 max-w-6xl">

                {/* ── Layout asymétrique ────────────────── */}
                <div className="lg:grid lg:grid-cols-[1fr_2fr] lg:gap-16 lg:items-start">

                    {/* ── Colonne gauche — Titre + accroche ── */}
                    <div className="mb-12 lg:mb-0 lg:sticky lg:top-24">
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
                        >
                            {/* Badge */}
                            <p
                                className="text-xs font-bold uppercase tracking-widest mb-4"
                                style={{ color: '#C8872A', fontFamily: "'Outfit', sans-serif" }}
                            >
                                Pourquoi nous choisir
                            </p>

                            {/* Grand titre */}
                            <h2
                                className="text-gray-900 mb-6"
                                style={{
                                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                                    fontSize:   'clamp(2.2rem, 4vw, 3.5rem)',
                                    fontWeight: 700,
                                    lineHeight: 1.1,
                                    letterSpacing: '-0.01em',
                                }}
                            >
                                L'excellence à
                                <span
                                    className="block"
                                    style={{
                                        background: 'linear-gradient(135deg, #C8872A, #2E7BB5)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        backgroundClip: 'text',
                                    }}
                                >
                                    votre service
                                </span>
                            </h2>

                            {/* Ligne décorative */}
                            <div
                                className="h-0.5 w-16 rounded-full mb-6"
                                style={{ background: 'linear-gradient(to right, #C8872A, #2E7BB5)' }}
                            />

                            {/* Accroche */}
                            <p
                                className="text-gray-500 leading-relaxed mb-8"
                                style={{
                                    fontFamily: "'Outfit', sans-serif",
                                    fontSize:   '1rem',
                                }}
                            >
                                Altitude-Vision réunit trois pôles d'expertise en une seule agence. Une approche unique, des résultats concrets, une relation de confiance.
                            </p>

                            {/* CTA */}
                            <Link
                                to="/contact"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white text-sm transition-all duration-300 hover:scale-105 hover:shadow-xl group"
                                style={{
                                    background:  'linear-gradient(135deg, #C8872A, #E5A84B)',
                                    boxShadow:   '0 4px 20px rgba(200,135,42,0.3)',
                                    fontFamily:  "'Outfit', sans-serif",
                                }}
                            >
                                Nous contacter
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </motion.div>
                    </div>

                    {/* ── Colonne droite — Grille des cards ── */}
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