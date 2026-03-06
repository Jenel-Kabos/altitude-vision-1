import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Send, MessageSquare, Clock, CheckCircle } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// Données
// ─────────────────────────────────────────────────────────────
const CONTACT_INFO = [
    {
        icon:    MapPin,
        title:   "Adresse de l'agence",
        lines:   ['24 Rue de Mfoa, Poto-Poto', 'Derrière Canal Olympia', 'Brazzaville, Congo'],
        color:   '#2E7BB5',
    },
    {
        icon:    Mail,
        title:   'Email professionnel',
        lines:   ['altimmo@altitudevision.agency'],
        href:    'mailto:altimmo@altitudevision.agency',
        color:   '#C8872A',
    },
    {
        icon:    Phone,
        title:   'Téléphone',
        lines:   ['+242 06 800 21 51'],
        href:    'tel:+242068002151',
        color:   '#2E7BB5',
    },
];

const HORAIRES = [
    { day: 'Lundi – Vendredi', time: '8h00 – 18h00',  closed: false },
    { day: 'Samedi',           time: '9h00 – 14h00',  closed: false },
    { day: 'Dimanche',         time: 'Fermé',          closed: true  },
];

// ─────────────────────────────────────────────────────────────
// Champ formulaire
// ─────────────────────────────────────────────────────────────
const Field = ({ label, id, type = 'text', required, isTextArea }) => (
    <div>
        <label htmlFor={id}
            className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5"
            style={{ fontFamily: "'Outfit', sans-serif" }}>
            {label}{required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {isTextArea ? (
            <textarea id={id} name={id} rows={4} required={required}
                className="w-full px-4 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-gray-900 text-sm resize-none transition-all duration-200 focus:outline-none focus:border-[#2E7BB5] focus:ring-2 focus:ring-[#2E7BB5]/10 focus:bg-white hover:border-gray-300 placeholder-gray-400"
                style={{ fontFamily: "'Outfit', sans-serif" }}
                placeholder="Décrivez votre projet immobilier..."
            />
        ) : (
            <input type={type} id={id} name={id} required={required}
                className="w-full px-4 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-gray-900 text-sm transition-all duration-200 focus:outline-none focus:border-[#2E7BB5] focus:ring-2 focus:ring-[#2E7BB5]/10 focus:bg-white hover:border-gray-300 placeholder-gray-400"
                style={{ fontFamily: "'Outfit', sans-serif" }}
                placeholder={`Votre ${label.toLowerCase().replace(' *', '')}`}
            />
        )}
    </div>
);

// ─────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────
const AltimmoContact = () => {
    const [sent, setSent] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        // Logique d'envoi ici
        setSent(true);
        setTimeout(() => setSent(false), 4000);
    };

    return (
        <section id="contact-altimmo" className="py-20 sm:py-24 bg-white relative overflow-hidden">

            {/* Décoration fond */}
            <div className="absolute top-0 left-0 right-0 h-px"
                style={{ background: 'linear-gradient(to right, transparent, rgba(46,123,181,0.2), transparent)' }} />
            <div className="absolute -right-32 top-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-[140px] opacity-[0.04] pointer-events-none"
                style={{ background: '#2E7BB5' }} />

            <div className="container mx-auto px-4 sm:px-6 max-w-6xl relative z-10">

                {/* ── En-tête ─────────────────────────── */}
                <motion.div
                    className="mb-14"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                >
                    <p className="text-xs font-bold uppercase tracking-widest mb-3"
                        style={{ color: '#2E7BB5', fontFamily: "'Outfit', sans-serif" }}>
                        Contactez-nous
                    </p>
                    <h2 className="text-gray-900"
                        style={{
                            fontFamily: "'Cormorant Garamond', Georgia, serif",
                            fontSize:   'clamp(2rem, 4vw, 3rem)',
                            fontWeight: 700,
                            lineHeight: 1.1,
                        }}>
                        Prenons Contact
                    </h2>
                    <div className="h-0.5 w-12 mt-3 rounded-full"
                        style={{ background: 'linear-gradient(to right, #2E7BB5, #C8872A)' }} />
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">

                    {/* ── Formulaire ──────────────────────── */}
                    <motion.div
                        initial={{ opacity: 0, x: -24 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <div className="bg-white rounded-3xl border border-gray-100 p-7 shadow-sm hover:shadow-lg transition-shadow duration-500">

                            {/* Card header */}
                            <div className="flex items-center gap-3 mb-7 pb-5 border-b border-gray-100">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'linear-gradient(135deg, #2E7BB5, #1A5A8A)' }}>
                                    <MessageSquare className="w-4 h-4 text-white" />
                                </div>
                                <h3 className="font-bold text-gray-900 text-lg"
                                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                                    Envoyez-nous un message
                                </h3>
                            </div>

                            {sent ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex flex-col items-center justify-center py-12 gap-4"
                                >
                                    <div className="w-14 h-14 rounded-full flex items-center justify-center"
                                        style={{ background: 'rgba(46,123,181,0.1)' }}>
                                        <CheckCircle className="w-7 h-7" style={{ color: '#2E7BB5' }} />
                                    </div>
                                    <p className="font-bold text-gray-900 text-lg"
                                        style={{ fontFamily: "'Outfit', sans-serif" }}>
                                        Message envoyé !
                                    </p>
                                    <p className="text-gray-500 text-sm text-center"
                                        style={{ fontFamily: "'Outfit', sans-serif" }}>
                                        Notre équipe vous répondra sous 24h.
                                    </p>
                                </motion.div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Field label="Nom complet"    id="fullName" required />
                                        <Field label="Téléphone"      id="phone"    type="tel" />
                                    </div>
                                    <Field label="Adresse email"  id="email"   type="email" required />
                                    <Field label="Votre message"  id="message" required isTextArea />

                                    <motion.button
                                        type="submit"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-white text-sm transition-all duration-300"
                                        style={{
                                            background: 'linear-gradient(135deg, #2E7BB5, #1A5A8A)',
                                            boxShadow:  '0 4px 20px rgba(46,123,181,0.3)',
                                            fontFamily: "'Outfit', sans-serif",
                                        }}
                                    >
                                        <Send className="w-4 h-4" />
                                        Envoyer le message
                                    </motion.button>

                                    <p className="text-center text-xs text-gray-400"
                                        style={{ fontFamily: "'Outfit', sans-serif" }}>
                                        Réponse garantie sous 24h ouvrées
                                    </p>
                                </form>
                            )}
                        </div>
                    </motion.div>

                    {/* ── Infos contact ───────────────────── */}
                    <motion.div
                        initial={{ opacity: 0, x: 24 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="space-y-4"
                    >
                        {/* Cards contact */}
                        {CONTACT_INFO.map(({ icon: Icon, title, lines, href, color }, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: i * 0.1 }}
                                className="group flex items-start gap-4 p-5 rounded-2xl border border-gray-100 bg-white hover:shadow-md transition-all duration-300"
                                style={{ borderColor: 'rgba(0,0,0,0.06)' }}
                            >
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
                                    style={{ backgroundColor: `${color}12`, border: `1px solid ${color}20` }}>
                                    <Icon className="w-5 h-5" style={{ color }} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1"
                                        style={{ fontFamily: "'Outfit', sans-serif" }}>
                                        {title}
                                    </p>
                                    {lines.map((line, j) =>
                                        href && j === 0 ? (
                                            <a key={j} href={href}
                                                className="block text-sm font-semibold transition-colors duration-200"
                                                style={{ color, fontFamily: "'Outfit', sans-serif" }}>
                                                {line}
                                            </a>
                                        ) : (
                                            <p key={j} className="text-sm text-gray-600"
                                                style={{ fontFamily: "'Outfit', sans-serif" }}>
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
                            transition={{ duration: 0.5, delay: 0.35 }}
                            className="p-5 rounded-2xl border"
                            style={{
                                backgroundColor: 'rgba(46,123,181,0.04)',
                                borderColor:     'rgba(46,123,181,0.12)',
                            }}
                        >
                            <div className="flex items-center gap-2.5 mb-4">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: 'rgba(46,123,181,0.12)' }}>
                                    <Clock className="w-4 h-4" style={{ color: '#2E7BB5' }} />
                                </div>
                                <h4 className="font-bold text-gray-900 text-sm"
                                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                                    Horaires d'ouverture
                                </h4>
                            </div>
                            <div className="space-y-2">
                                {HORAIRES.map(({ day, time, closed }, i) => (
                                    <div key={i} className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600 font-medium"
                                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                                            {day}
                                        </span>
                                        <span className="font-semibold"
                                            style={{
                                                color:      closed ? '#D42B2B' : '#2E7BB5',
                                                fontFamily: "'Outfit', sans-serif",
                                            }}>
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