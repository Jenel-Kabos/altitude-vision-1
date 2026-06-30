"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Send, MessageSquare, Clock, CheckCircle } from 'lucide-react';

const RED      = '#D42B2B';
const RED_DARK = '#A01E1E';
const GOLD     = '#C8960C';

const CONTACT_INFO = [
    {
        icon:  MapPin,
        title: "Adresse de l'agence",
        lines: ['24 Rue de Mfoa, Poto-Poto', 'Derrière Canal Olympia', 'Brazzaville, Congo'],
        color: RED,
    },
    {
        icon:  Mail,
        title: 'Email professionnel',
        lines: ['Milaevents@altitudevision.agency'],
        href:  'mailto:Milaevents@altitudevision.agency',
        color: GOLD,
    },
    {
        icon:  Phone,
        title: 'Téléphone',
        lines: ['+242 05 330 16 75'],
        href:  'tel:+242053301675',
        color: RED,
    },
];

const HORAIRES = [
    { day: 'Lundi – Vendredi', time: '8h30 – 17h30', closed: false },
    { day: 'Samedi',           time: '9h00 – 12h00', closed: false },
    { day: 'Dimanche',         time: 'Fermé',         closed: true  },
];

const inputStyle = {
    width:        '100%',
    padding:      '11px 14px',
    background:   'rgba(232,228,220,0.04)',
    border:       '1px solid rgba(232,228,220,0.1)',
    borderRadius: '12px',
    color:        '#E8E4DC',
    fontSize:     '0.875rem',
    fontFamily:   "'DM Sans', sans-serif",
    outline:      'none',
    transition:   'border-color 0.2s, box-shadow 0.2s',
};
const labelStyle = {
    display:       'block',
    fontSize:      '0.6rem',
    fontWeight:    700,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color:         'rgba(232,228,220,0.35)',
    fontFamily:    "'DM Sans', sans-serif",
    marginBottom:  '6px',
};

// ─── Champ formulaire ─────────────────────────────────────────
const Field = ({ label, id, type = 'text', required, isTextArea }) => (
    <div>
        <label htmlFor={id} style={labelStyle}>
            {label}{required && <span style={{ color: RED, marginLeft: '4px' }}>*</span>}
        </label>
        {isTextArea ? (
            <textarea id={id} name={id} rows={4} required={required}
                style={{ ...inputStyle, resize: 'none' }}
                onFocus={e => { e.target.style.borderColor = `${RED}88`; e.target.style.boxShadow = `0 0 0 3px ${RED}15`; }}
                onBlur={e =>  { e.target.style.borderColor = 'rgba(232,228,220,0.1)'; e.target.style.boxShadow = 'none'; }}
                placeholder="Décrivez votre projet événementiel..."
            />
        ) : (
            <input type={type} id={id} name={id} required={required}
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = `${RED}88`; e.target.style.boxShadow = `0 0 0 3px ${RED}15`; }}
                onBlur={e =>  { e.target.style.borderColor = 'rgba(232,228,220,0.1)'; e.target.style.boxShadow = 'none'; }}
                placeholder={`Votre ${label.toLowerCase().replace(' *', '')}`}
            />
        )}
    </div>
);

// ─── Composant principal ──────────────────────────────────────
const MilaContact = () => {
    const [sent, setSent] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        setSent(true);
        setTimeout(() => setSent(false), 4000);
    };

    return (
        <section id="contact-mila" style={{ padding: 'clamp(52px,9vw,96px) 0', background: '#0A0C0F', position: 'relative', overflow: 'hidden' }}>

            {/* Décorations */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: `linear-gradient(to right, transparent, ${RED}25, transparent)` }} />
            <div style={{ position: 'absolute', left: '-128px', top: '50%', transform: 'translateY(-50%)', width: '384px', height: '384px', borderRadius: '50%', filter: 'blur(140px)', opacity: 0.05, background: RED, pointerEvents: 'none' }} />

            <div className="container mx-auto px-4 sm:px-6 max-w-7xl" style={{ position: 'relative', zIndex: 10 }}>

                {/* En-tête */}
                <motion.div style={{ marginBottom: '56px' }}
                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }} transition={{ duration: 0.6 }}>
                    <p style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: RED, fontFamily: "'DM Sans', sans-serif", marginBottom: '10px' }}>
                        Contactez-nous
                    </p>
                    <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(2rem, 4vw, 4.5rem)', fontWeight: 300, lineHeight: 1.1, color: '#E8E4DC' }}>
                        Prenons Contact
                    </h2>
                    <div style={{ height: '2px', width: '48px', marginTop: '12px', borderRadius: '2px', background: `linear-gradient(to right, ${RED}, ${GOLD})` }} />
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">

                    {/* Formulaire */}
                    <motion.div initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }} transition={{ duration: 0.6 }}>
                        <div style={{ background: 'rgba(17,20,24,0.8)', borderRadius: '20px', border: '1px solid rgba(232,228,220,0.07)', padding: '28px', backdropFilter: 'blur(8px)' }}>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid rgba(232,228,220,0.07)' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: `linear-gradient(135deg, ${RED_DARK}, ${RED})` }}>
                                    <MessageSquare className="w-4 h-4 text-white" />
                                </div>
                                <h3 style={{ fontWeight: 700, color: '#E8E4DC', fontSize: '1.1rem', fontFamily: "'DM Sans', sans-serif" }}>
                                    Envoyez-nous un message
                                </h3>
                            </div>

                            {sent ? (
                                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: '16px' }}>
                                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${RED}12` }}>
                                        <CheckCircle style={{ width: '28px', height: '28px', color: RED }} />
                                    </div>
                                    <p style={{ fontWeight: 700, color: '#E8E4DC', fontSize: '1.1rem', fontFamily: "'DM Sans', sans-serif" }}>
                                        Message envoyé !
                                    </p>
                                    <p style={{ color: 'rgba(232,228,220,0.4)', fontSize: '0.875rem', textAlign: 'center', fontFamily: "'DM Sans', sans-serif" }}>
                                        Notre équipe vous répondra sous 24h.
                                    </p>
                                </motion.div>
                            ) : (
                                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Field label="Nom complet" id="fullName" required />
                                        <Field label="Téléphone"   id="phone" type="tel" />
                                    </div>
                                    <Field label="Adresse email" id="email"   type="email" required />
                                    <Field label="Votre message" id="message" required isTextArea />

                                    <motion.button type="submit"
                                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', borderRadius: '12px', fontWeight: 700, color: 'white', fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', background: `linear-gradient(135deg, ${RED_DARK}, ${RED})`, boxShadow: `0 4px 20px ${RED}30`, fontFamily: "'DM Sans', sans-serif", border: 'none', cursor: 'pointer' }}>
                                        <Send className="w-4 h-4" />
                                        Envoyer le message
                                    </motion.button>
                                    <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'rgba(232,228,220,0.25)', fontFamily: "'DM Sans', sans-serif" }}>
                                        Réponse garantie sous 24h ouvrées
                                    </p>
                                </form>
                            )}
                        </div>
                    </motion.div>

                    {/* Coordonnées */}
                    <motion.div initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                        {CONTACT_INFO.map(({ icon: Icon, title, lines, href, color }, i) => (
                            <motion.div key={i}
                                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}
                                className="group"
                                style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '18px', borderRadius: '16px', background: 'rgba(17,20,24,0.6)', border: '1px solid rgba(232,228,220,0.07)', transition: 'border-color 0.3s, box-shadow 0.3s' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}28`; e.currentTarget.style.boxShadow = `0 4px 20px rgba(0,0,0,0.3)`; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(232,228,220,0.07)'; e.currentTarget.style.boxShadow = 'none'; }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: `${color}12`, border: `1px solid ${color}20` }}>
                                    <Icon style={{ width: '18px', height: '18px', color }} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <p style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(232,228,220,0.3)', fontFamily: "'DM Sans', sans-serif", marginBottom: '4px' }}>
                                        {title}
                                    </p>
                                    {lines.map((line, j) =>
                                        href && j === 0 ? (
                                            <a key={j} href={href}
                                                style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color, fontFamily: "'DM Sans', sans-serif", textDecoration: 'none', transition: 'opacity 0.2s' }}
                                                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                                                {line}
                                            </a>
                                        ) : (
                                            <p key={j} style={{ fontSize: '0.875rem', color: 'rgba(232,228,220,0.45)', fontFamily: "'DM Sans', sans-serif" }}>
                                                {line}
                                            </p>
                                        )
                                    )}
                                </div>
                            </motion.div>
                        ))}

                        {/* Horaires */}
                        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.35 }}
                            style={{ padding: '18px', borderRadius: '16px', background: `${RED}06`, border: `1px solid ${RED}18` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${RED}12` }}>
                                    <Clock style={{ width: '16px', height: '16px', color: RED }} />
                                </div>
                                <h4 style={{ fontWeight: 700, color: '#E8E4DC', fontSize: '0.875rem', fontFamily: "'DM Sans', sans-serif" }}>
                                    Horaires d'ouverture
                                </h4>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {HORAIRES.map(({ day, time, closed }, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                        <span style={{ color: 'rgba(232,228,220,0.45)', fontFamily: "'DM Sans', sans-serif" }}>
                                            {day}
                                        </span>
                                        <span style={{ fontWeight: 600, color: closed ? 'rgba(232,228,220,0.25)' : RED, fontFamily: "'DM Sans', sans-serif" }}>
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

export default MilaContact;
