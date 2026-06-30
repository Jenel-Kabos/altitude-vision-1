"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Send, MessageSquare, Clock, CheckCircle } from 'lucide-react';

const BLUE = '#2E7BB5';
const GOLD = '#C8960C';

const CONTACT_INFO = [
    {
        icon:  MapPin,
        title: "Adresse de l'agence",
        lines: ['24 Rue de Mfoa, Poto-Poto', 'Derrière Canal Olympia', 'Brazzaville, Congo'],
        color: BLUE,
    },
    {
        icon:  Mail,
        title: 'Email professionnel',
        lines: ['altimmo@altitudevision.agency'],
        href:  'mailto:altimmo@altitudevision.agency',
        color: GOLD,
    },
    {
        icon:  Phone,
        title: 'Téléphone',
        lines: ['+242 06 800 21 51'],
        href:  'tel:+242068002151',
        color: BLUE,
    },
];

const HORAIRES = [
    { day: 'Lundi – Vendredi', time: '8h00 – 18h00', closed: false },
    { day: 'Samedi',           time: '9h00 – 14h00', closed: false },
    { day: 'Dimanche',         time: 'Fermé',          closed: true  },
];

const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(232,228,220,0.04)',
    border: '1px solid rgba(232,228,220,0.1)',
    borderRadius: '10px',
    color: '#E8E4DC',
    fontSize: '0.85rem',
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
    transition: 'border-color 0.2s',
};

const Field = ({ label, id, type = 'text', required, isTextArea }) => (
    <div>
        <label
            htmlFor={id}
            style={{
                display: 'block',
                fontSize: '0.6rem',
                fontWeight: 700,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: 'rgba(232,228,220,0.35)',
                fontFamily: "'DM Sans', sans-serif",
                marginBottom: '6px',
            }}
        >
            {label}{required && <span style={{ color: '#D42B2B', marginLeft: '3px' }}>*</span>}
        </label>
        {isTextArea ? (
            <textarea
                id={id} name={id} rows={4} required={required}
                placeholder="Décrivez votre projet immobilier…"
                style={{ ...inputStyle, resize: 'none' }}
                onFocus={e => { e.target.style.borderColor = `${BLUE}55`; }}
                onBlur={e  => { e.target.style.borderColor = 'rgba(232,228,220,0.1)'; }}
            />
        ) : (
            <input
                type={type} id={id} name={id} required={required}
                placeholder={`Votre ${label.toLowerCase().replace(' *', '')}`}
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = `${BLUE}55`; }}
                onBlur={e  => { e.target.style.borderColor = 'rgba(232,228,220,0.1)'; }}
            />
        )}
    </div>
);

const AltimmoContact = () => {
    const [sent, setSent] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        setSent(true);
        setTimeout(() => setSent(false), 4000);
    };

    return (
        <section
            id="contact-altimmo"
            style={{ padding: 'clamp(52px,9vw,96px) 0', background: '#0A0C0F', position: 'relative', overflow: 'hidden' }}
        >
            {/* Décorations */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: `linear-gradient(to right, transparent, ${BLUE}28, transparent)` }} />
            <div style={{ position: 'absolute', right: '-80px', top: '50%', transform: 'translateY(-50%)', width: '360px', height: '360px', borderRadius: '50%', filter: 'blur(130px)', opacity: 0.06, background: BLUE, pointerEvents: 'none' }} />

            <div className="container mx-auto px-4 sm:px-6 max-w-7xl" style={{ position: 'relative', zIndex: 10 }}>

                {/* En-tête */}
                <motion.div
                    style={{ marginBottom: 'clamp(32px,5vw,52px)' }}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                >
                    <p style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: BLUE, fontFamily: "'DM Sans', sans-serif", marginBottom: '10px' }}>
                        Contactez-nous
                    </p>
                    <h2 style={{
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontSize: 'clamp(2rem, 4vw, 4.5rem)',
                        fontWeight: 300,
                        lineHeight: 1.08,
                        color: '#E8E4DC',
                    }}>
                        Prenons Contact
                    </h2>
                    <div style={{ height: '2px', width: '48px', borderRadius: '2px', marginTop: '12px', background: `linear-gradient(to right, ${BLUE}, ${GOLD})` }} />
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">

                    {/* ── Formulaire ── */}
                    <motion.div
                        initial={{ opacity: 0, x: -24 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <div style={{
                            background: 'rgba(17,20,24,0.8)',
                            borderRadius: '14px',
                            border: '1px solid rgba(232,228,220,0.07)',
                            padding: 'clamp(22px,4vw,32px)',
                        }}>
                            {/* Card header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '18px', borderBottom: '1px solid rgba(232,228,220,0.07)' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: `linear-gradient(135deg, ${BLUE}, #1A5A8A)` }}>
                                    <MessageSquare className="w-4 h-4 text-white" />
                                </div>
                                <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '1rem', fontWeight: 600, color: '#E8E4DC' }}>
                                    Envoyez-nous un message
                                </h3>
                            </div>

                            {sent ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '14px' }}
                                >
                                    <div style={{ width: '52px', height: '52px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `rgba(46,123,181,0.12)` }}>
                                        <CheckCircle className="w-6 h-6" style={{ color: BLUE }} />
                                    </div>
                                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, color: '#E8E4DC', fontSize: '1.05rem' }}>Message envoyé !</p>
                                    <p style={{ fontFamily: "'DM Sans', sans-serif", color: 'rgba(232,228,220,0.45)', fontSize: '0.85rem', textAlign: 'center' }}>
                                        Notre équipe vous répondra sous 24h.
                                    </p>
                                </motion.div>
                            ) : (
                                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Field label="Nom complet"   id="fullName" required />
                                        <Field label="Téléphone"     id="phone"    type="tel" />
                                    </div>
                                    <Field label="Adresse email" id="email"   type="email" required />
                                    <Field label="Votre message" id="message" required isTextArea />

                                    <motion.button
                                        type="submit"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        style={{
                                            width: '100%',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                            padding: '12px',
                                            borderRadius: '10px',
                                            fontFamily: "'DM Sans', sans-serif",
                                            fontSize: '0.76rem',
                                            fontWeight: 600,
                                            letterSpacing: '0.06em',
                                            textTransform: 'uppercase',
                                            color: '#fff',
                                            border: 'none',
                                            cursor: 'pointer',
                                            background: `linear-gradient(135deg, ${BLUE}, #1A5A8A)`,
                                            boxShadow: `0 4px 20px ${BLUE}30`,
                                        }}
                                    >
                                        <Send className="w-4 h-4" />
                                        Envoyer le message
                                    </motion.button>

                                    <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'rgba(232,228,220,0.28)', fontFamily: "'DM Sans', sans-serif" }}>
                                        Réponse garantie sous 24h ouvrées
                                    </p>
                                </form>
                            )}
                        </div>
                    </motion.div>

                    {/* ── Infos contact ── */}
                    <motion.div
                        initial={{ opacity: 0, x: 24 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
                    >
                        {CONTACT_INFO.map(({ icon: Icon, title, lines, href, color }, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: i * 0.08 }}
                                className="group"
                                style={{
                                    display: 'flex', alignItems: 'flex-start', gap: '14px',
                                    padding: '18px',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(232,228,220,0.07)',
                                    background: 'rgba(17,20,24,0.6)',
                                    transition: 'border-color 0.3s',
                                }}
                            >
                                <div style={{
                                    width: '38px', height: '38px', borderRadius: '10px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    backgroundColor: `${color}12`,
                                    border: `1px solid ${color}22`,
                                }}>
                                    <Icon className="w-4 h-4" style={{ color }} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <p style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(232,228,220,0.32)', fontFamily: "'DM Sans', sans-serif", marginBottom: '4px' }}>
                                        {title}
                                    </p>
                                    {lines.map((line, j) =>
                                        href && j === 0 ? (
                                            <a key={j} href={href} style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color, fontFamily: "'DM Sans', sans-serif", textDecoration: 'none' }}>
                                                {line}
                                            </a>
                                        ) : (
                                            <p key={j} style={{ fontSize: '0.85rem', color: 'rgba(232,228,220,0.45)', fontFamily: "'DM Sans', sans-serif" }}>
                                                {line}
                                            </p>
                                        )
                                    )}
                                </div>
                            </motion.div>
                        ))}

                        {/* Horaires */}
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                            style={{
                                padding: '18px',
                                borderRadius: '12px',
                                border: `1px solid rgba(46,123,181,0.14)`,
                                background: 'rgba(46,123,181,0.04)',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(46,123,181,0.12)' }}>
                                    <Clock className="w-4 h-4" style={{ color: BLUE }} />
                                </div>
                                <h4 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', fontWeight: 600, color: '#E8E4DC' }}>
                                    Horaires d'ouverture
                                </h4>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {HORAIRES.map(({ day, time, closed }, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '0.83rem', color: 'rgba(232,228,220,0.5)', fontFamily: "'DM Sans', sans-serif" }}>
                                            {day}
                                        </span>
                                        <span style={{ fontSize: '0.83rem', fontWeight: 600, color: closed ? '#D42B2B' : BLUE, fontFamily: "'DM Sans', sans-serif" }}>
                                            {time}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
};

export default AltimmoContact;
