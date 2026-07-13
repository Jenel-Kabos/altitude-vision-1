"use client";
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ChevronDown } from 'lucide-react';

import EstimationForm from '../components/EstimationForm';

const GOLD = '#C8960C';
const DARK = '#0A0805'; // == rgba(10,8,5,x) utilisé dans l'overlay du hero — cohérent sur toute la page

const STATS = [
    { chiffre: '24h',   label: 'Délai de réponse' },
    { chiffre: '100%',  label: 'Gratuit & sans engagement' },
    { chiffre: '5 ans', label: 'Expertise locale Congo' },
];

const CAROUSEL_IMAGES = [
    { url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80', label: 'Villa moderne' },
    { url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&q=80', label: 'Résidence prestige' },
    { url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&q=80', label: 'Appartement de luxe' },
    { url: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=600&q=80', label: 'Maison contemporaine' },
    { url: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=600&q=80', label: 'Villa avec piscine' },
];
const CAROUSEL_VISIBLE = 3;
const CAROUSEL_CARD_W  = 280;
const CAROUSEL_GAP     = 16;

const PERKS = [
    { icon: '🔍', titre: 'Analyse précise',  desc: 'Étude comparative des biens similaires dans votre quartier' },
    { icon: '⚡', titre: 'Réponse rapide',   desc: 'Estimation personnalisée envoyée sous 24 heures' },
    { icon: '🤝', titre: 'Expertise locale', desc: "5 ans d'expérience sur le marché congolais" },
];

const FadeIn = ({ children, delay = 0, y = 20 }) => (
    <motion.div
        initial={{ opacity: 0, y }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.65, delay, ease: [0.25, 0.46, 0.45, 0.94] }}>
        {children}
    </motion.div>
);

// Avance d'une carte toutes les `intervalMs`, boucle une fois la fin atteinte
const useAutoCarousel = (length, visible, intervalMs = 4000) => {
    const [index, setIndex] = useState(0);
    const maxIndex = Math.max(length - visible, 0);
    useEffect(() => {
        const id = setInterval(() => {
            setIndex((i) => (i >= maxIndex ? 0 : i + 1));
        }, intervalMs);
        return () => clearInterval(id);
    }, [maxIndex, intervalMs]);
    return index;
};

const PAGE_CSS = `
  .ep-page { font-family: 'DM Sans', sans-serif; }
  .ep-container { max-width: 1100px; margin: 0 auto; padding: 0 20px; }
  @media (min-width: 1024px) { .ep-container { padding: 0 48px; } }

  .ep-back {
    position: absolute; top: 24px; left: 20px; z-index: 2;
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 0.82rem; color: rgba(255,255,255,0.75);
    text-decoration: none; transition: color 0.2s;
  }
  .ep-back:hover { color: #fff; }

  /* ══ SECTION 1 — HERO ══ */
  .ep-hero {
    position: relative; overflow: hidden;
    min-height: 70vh;
    display: flex; align-items: center; justify-content: center;
  }
  .ep-hero-overlay {
    position: absolute; inset: 0; z-index: 1;
    background: linear-gradient(180deg, rgba(10,8,5,0.65) 0%, rgba(10,8,5,0.3) 100%);
  }
  .ep-hero-content {
    position: relative; z-index: 2; text-align: center;
    max-width: 680px; padding: 0 20px;
  }
  .ep-eyebrow {
    font-size: 0.76rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;
    color: ${GOLD}; display: inline-flex; align-items: center; gap: 8px; justify-content: center;
    margin-bottom: 16px; width: 100%;
  }
  .ep-h1 {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(2rem, 5vw, 3.4rem); font-weight: 700; line-height: 1.12;
    color: #fff; margin-bottom: 16px;
  }
  .ep-subtitle {
    font-size: clamp(0.9rem, 1.8vw, 1rem); color: rgba(255,255,255,0.78);
    line-height: 1.75; max-width: 560px; margin: 0 auto;
  }
  .ep-scroll-indicator {
    position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%);
    z-index: 2; color: rgba(255,255,255,0.75);
  }

  /* ══ SECTION 2 — STATS ══ */
  .ep-stats-section { background: ${DARK}; padding: clamp(48px, 8vw, 72px) 0; }
  .ep-stats-grid {
    display: flex; flex-wrap: wrap; justify-content: center;
    gap: clamp(32px, 8vw, 96px); text-align: center;
  }
  .ep-stat-num {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(2.2rem, 5vw, 3rem); font-weight: 700; color: ${GOLD}; line-height: 1;
  }
  .ep-stat-label { font-size: 0.82rem; color: rgba(255,255,255,0.55); margin-top: 8px; }

  /* ══ SECTION 3 — CAROUSEL ══ */
  .ep-carousel-section { background: #fff; padding: clamp(56px, 8vw, 96px) 0; }
  .ep-carousel-title {
    text-align: center; font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(1.6rem, 3.5vw, 2.4rem); font-weight: 700; color: #1A1612;
    margin: 0 0 40px;
  }
  .ep-carousel-viewport {
    overflow: hidden;
    max-width: ${CAROUSEL_VISIBLE * CAROUSEL_CARD_W + (CAROUSEL_VISIBLE - 1) * CAROUSEL_GAP}px;
    margin: 0 auto;
  }
  .ep-carousel-track {
    display: flex; gap: ${CAROUSEL_GAP}px;
    transition: transform 0.6s cubic-bezier(0.65,0,0.35,1);
  }
  .ep-carousel-card {
    position: relative; flex: 0 0 ${CAROUSEL_CARD_W}px; height: 200px;
    border-radius: 12px; overflow: hidden; background: #E5E7EB;
  }
  .ep-carousel-card-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.75) 100%);
  }
  .ep-carousel-card-label {
    position: absolute; bottom: 12px; left: 14px; z-index: 2;
    color: #fff; font-size: 0.85rem; font-weight: 600;
  }

  /* ══ SECTION 4 — FORMULAIRE ══ */
  .ep-form-section { background: ${DARK}; padding: clamp(56px, 8vw, 96px) 0; }
  .ep-form-title {
    text-align: center; font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(1.8rem, 4vw, 2.6rem); font-weight: 700; color: #fff;
    margin: 0 0 10px;
  }
  .ep-form-subtitle {
    text-align: center; font-size: 0.9rem; color: rgba(255,255,255,0.55);
    margin: 0 0 40px;
  }
  .ep-form-wrap { max-width: 620px; margin: 0 auto; }

  /* ══ SECTION 5 — AVANTAGES ══ */
  .ep-perks-section { background: #fff; padding: clamp(56px, 8vw, 96px) 0; }
  .ep-perks-grid {
    display: grid; grid-template-columns: 1fr; gap: 24px;
    max-width: 960px; margin: 0 auto;
  }
  @media (min-width: 768px) { .ep-perks-grid { grid-template-columns: repeat(3, 1fr); } }
  .ep-perk-card {
    text-align: center; padding: 32px 24px; border-radius: 16px;
    background: #F8F8F5;
  }
  .ep-perk-icon { font-size: 2rem; margin-bottom: 14px; }
  .ep-perk-title {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-weight: 700; font-size: 1.2rem; color: #1A1612; margin: 0 0 8px;
  }
  .ep-perk-desc { font-size: 0.86rem; color: #6B6560; line-height: 1.6; margin: 0; }
`;

const EstimationPage = () => {
    const carouselIndex = useAutoCarousel(CAROUSEL_IMAGES.length, CAROUSEL_VISIBLE);

    return (
        <div className="ep-page">
            <style>{PAGE_CSS}</style>

            {/* ══ SECTION 1 — HERO ══ */}
            <section className="ep-hero">
                <Image
                    src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1400&q=90"
                    alt="Villa de luxe Congo Brazzaville"
                    fill
                    priority
                    sizes="100vw"
                    style={{ objectFit: 'cover' }}
                />
                <div className="ep-hero-overlay" />

                <Link href="/altimmo" className="ep-back">
                    <ArrowLeft size={14} /> Retour à Altimmo
                </Link>

                <div className="ep-hero-content">
                    <FadeIn>
                        <p className="ep-eyebrow">Estimation gratuite</p>
                        <h1 className="ep-h1">Quelle est la valeur<br />de votre bien ?</h1>
                        <p className="ep-subtitle">
                            Nos experts immobiliers à Brazzaville vous répondent sous 24h,
                            gratuitement et sans engagement.
                        </p>
                    </FadeIn>
                </div>

                <motion.div
                    className="ep-scroll-indicator"
                    animate={{ y: [0, 8, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                >
                    <ChevronDown size={22} />
                </motion.div>
            </section>

            {/* ══ SECTION 2 — STATS ══ */}
            <section className="ep-stats-section">
                <div className="ep-container">
                    <FadeIn>
                        <div className="ep-stats-grid">
                            {STATS.map(({ chiffre, label }, i) => (
                                <div key={i}>
                                    <p className="ep-stat-num">{chiffre}</p>
                                    <p className="ep-stat-label">{label}</p>
                                </div>
                            ))}
                        </div>
                    </FadeIn>
                </div>
            </section>

            {/* ══ SECTION 3 — CAROUSEL ══ */}
            <section className="ep-carousel-section">
                <div className="ep-container">
                    <FadeIn>
                        <h2 className="ep-carousel-title">
                            Des biens d&apos;exception estimés par nos experts
                        </h2>
                    </FadeIn>
                    <FadeIn delay={0.1}>
                        <div className="ep-carousel-viewport">
                            <div
                                className="ep-carousel-track"
                                style={{ transform: `translateX(-${carouselIndex * (CAROUSEL_CARD_W + CAROUSEL_GAP)}px)` }}
                            >
                                {CAROUSEL_IMAGES.map((img, i) => (
                                    <div key={i} className="ep-carousel-card">
                                        <Image
                                            src={img.url}
                                            alt={img.label}
                                            fill
                                            sizes={`${CAROUSEL_CARD_W}px`}
                                            style={{ objectFit: 'cover' }}
                                        />
                                        <div className="ep-carousel-card-overlay" />
                                        <span className="ep-carousel-card-label">{img.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </FadeIn>
                </div>
            </section>

            {/* ══ SECTION 4 — FORMULAIRE ══ */}
            <section className="ep-form-section">
                <div className="ep-container">
                    <FadeIn>
                        <h2 className="ep-form-title">Obtenez votre estimation</h2>
                        <p className="ep-form-subtitle">
                            Deux minutes suffisent — notre équipe s&apos;occupe du reste.
                        </p>
                    </FadeIn>
                    <FadeIn delay={0.1}>
                        <div className="ep-form-wrap">
                            <EstimationForm />
                        </div>
                    </FadeIn>
                </div>
            </section>

            {/* ══ SECTION 5 — AVANTAGES ══ */}
            <section className="ep-perks-section">
                <div className="ep-container">
                    <div className="ep-perks-grid">
                        {PERKS.map(({ icon, titre, desc }, i) => (
                            <FadeIn key={i} delay={i * 0.08}>
                                <div className="ep-perk-card">
                                    <div className="ep-perk-icon">{icon}</div>
                                    <h3 className="ep-perk-title">{titre}</h3>
                                    <p className="ep-perk-desc">{desc}</p>
                                </div>
                            </FadeIn>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default EstimationPage;
