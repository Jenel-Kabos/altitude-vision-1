"use client";
import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
    ArrowLeft, Calculator, CheckCircle, Clock, ShieldCheck, Mail,
} from 'lucide-react';

import EstimationForm from '../components/EstimationForm';

const GOLD = '#C8960C';

// Texte repris tel quel de la section estimation d'AltimmoPage (lignes 811-828)
const ADVANTAGES = [
    { icon: CheckCircle, text: '100% gratuit, sans engagement' },
    { icon: Clock,       text: 'Réponse garantie sous 24h' },
    { icon: ShieldCheck, text: 'Expertise marché local Congo Brazzaville' },
    { icon: Mail,        text: 'Confirmation par email immédiate' },
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

const PAGE_CSS = `
  .ep-page {
    font-family: 'DM Sans', sans-serif;
    background: linear-gradient(135deg, #0A0C0F 0%, #101828 60%, #0F1E35 100%);
    min-height: 100vh;
  }
  .ep-container { max-width: 1100px; margin: 0 auto; padding: 0 20px; }
  @media (min-width: 1024px) { .ep-container { padding: 0 48px; } }

  .ep-back {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 0.82rem; color: rgba(255,255,255,0.5);
    text-decoration: none; margin-bottom: 28px; transition: color 0.2s;
  }
  .ep-back:hover { color: rgba(255,255,255,0.85); }

  .ep-hero { padding: clamp(48px, 8vw, 88px) 0 clamp(32px, 6vw, 56px); text-align: center; }
  .ep-eyebrow {
    font-size: 0.76rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;
    color: ${GOLD}; display: inline-flex; align-items: center; gap: 8px; justify-content: center;
    margin-bottom: 16px; width: 100%;
  }
  .ep-h1 {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(2rem, 5vw, 3.4rem); font-weight: 700; line-height: 1.12;
    color: rgba(255,255,255,0.96); margin-bottom: 16px;
  }
  .ep-subtitle {
    font-size: clamp(0.9rem, 1.8vw, 1rem); color: rgba(255,255,255,0.58);
    line-height: 1.75; max-width: 560px; margin: 0 auto;
  }

  .ep-advantages {
    display: grid; grid-template-columns: 1fr; gap: 14px;
    max-width: 720px; margin: 40px auto 0;
  }
  @media (min-width: 640px) { .ep-advantages { grid-template-columns: 1fr 1fr; } }
  .ep-advantage-card {
    display: flex; align-items: center; gap: 12px;
    padding: 16px 18px; border-radius: 16px;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  }
  .ep-advantage-icon {
    width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, ${GOLD}, #E5A84B);
  }
  .ep-advantage-text { font-size: 0.86rem; color: rgba(255,255,255,0.78); line-height: 1.4; }

  .ep-form-section { padding: clamp(40px, 7vw, 80px) 0 clamp(64px, 10vw, 120px); }
  .ep-form-wrap { max-width: 640px; margin: 0 auto; }
`;

const EstimationPage = () => {
    return (
        <div className="ep-page">
            <style>{PAGE_CSS}</style>

            <div className="ep-container ep-hero">
                <FadeIn>
                    <Link href="/altimmo" className="ep-back">
                        <ArrowLeft size={14} /> Retour à Altimmo
                    </Link>

                    <p className="ep-eyebrow">
                        <Calculator size={13} /> Estimation gratuite
                    </p>
                    <h1 className="ep-h1">Estimation gratuite de votre bien</h1>
                    <p className="ep-subtitle">
                        Remplissez le formulaire. Notre équipe vous contacte sous{' '}
                        <strong style={{ color: '#fff', fontWeight: 600 }}>24h</strong> avec une estimation
                        personnalisée et sans engagement.
                    </p>
                </FadeIn>

                <FadeIn delay={0.1}>
                    <div className="ep-advantages">
                        {ADVANTAGES.map(({ icon: Icon, text }, i) => (
                            <div key={i} className="ep-advantage-card">
                                <div className="ep-advantage-icon">
                                    <Icon size={16} color="#fff" />
                                </div>
                                <span className="ep-advantage-text">{text}</span>
                            </div>
                        ))}
                    </div>
                </FadeIn>
            </div>

            <div className="ep-form-section">
                <div className="ep-container">
                    <FadeIn delay={0.15}>
                        <div className="ep-form-wrap">
                            <EstimationForm />
                        </div>
                    </FadeIn>
                </div>
            </div>
        </div>
    );
};

export default EstimationPage;
