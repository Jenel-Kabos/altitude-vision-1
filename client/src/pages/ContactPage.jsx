import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Mail, Phone, Send, Loader2, CheckCircle,
  AlertTriangle, MessageSquare, User, FileText, Navigation,
  ArrowUpRight,
} from 'lucide-react';
import SEOHead from '../components/SEOHead';

const BLUE = '#2E7BB5';
const GOLD = '#C8872A';
const RED  = '#D42B2B';

// Coordonnées précises : Rue Mfoa n°24, Poto-Poto, Brazzaville
const AGENCY_LAT = -4.2519;
const AGENCY_LNG = 15.2825;

// URL Maps avec marqueur agence + itinéraire
const MAPS_EMBED = `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3978.96!2d${AGENCY_LNG}!3d${AGENCY_LAT}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x1a6a33b2e3f6e5a7%3A0x0!2sRue+Mfoa+24%2C+Poto-Poto%2C+Brazzaville!5e0!3m2!1sfr!2scg!4v1700000000000!5m2!1sfr!2scg`;
const DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${AGENCY_LAT},${AGENCY_LNG}&destination_place_id=ChIJ&travelmode=driving`;

// ─── Toast ────────────────────────────────────────────────────
const Toast = ({ msg, type, onDone }) => {
  React.useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -48, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -48, scale: 0.96 }}
      className="fixed top-5 right-5 z-[100] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl text-white text-sm font-medium"
      style={{
        background: type === 'success'
          ? 'linear-gradient(135deg, #166534, #16A34A)'
          : `linear-gradient(135deg, #991B1B, ${RED})`,
        fontFamily: "'Outfit', sans-serif",
        backdropFilter: 'blur(12px)',
      }}>
      {type === 'success'
        ? <CheckCircle size={18} />
        : <AlertTriangle size={18} />}
      {msg}
    </motion.div>
  );
};

// ─── Input Field ──────────────────────────────────────────────
const Field = ({ label, icon: Icon, accent = BLUE, children }) => (
  <div className="space-y-1.5">
    <SEOHead
  title="Contactez-nous"
  description="Altitude-Vision — Rue Mfoa n°24, Poto-Poto, Brazzaville. Contactez notre équipe pour vos projets immobiliers, événementiels ou de communication."
  url="/contact"
/>
    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest"
      style={{ color: accent, fontFamily: "'Outfit', sans-serif" }}>
      <Icon size={12} />
      {label} <span style={{ color: RED }}>*</span>
    </label>
    {children}
  </div>
);

// ─── Contact Info Card ────────────────────────────────────────
const InfoCard = ({ icon: Icon, label, value, href, color, delay }) => (
  <motion.a
    href={href || '#'}
    target={href?.startsWith('http') ? '_blank' : undefined}
    rel="noopener noreferrer"
    initial={{ opacity: 0, x: 24 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay, duration: 0.45 }}
    whileHover={{ x: 6 }}
    className="flex items-center gap-4 p-4 rounded-2xl group transition-all cursor-pointer"
    style={{ background: `${color}0A`, border: `1px solid ${color}20` }}>
    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-110"
      style={{ background: `${color}18` }}>
      <Icon size={18} style={{ color }} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-semibold uppercase tracking-widest mb-0.5"
        style={{ color: `${color}80`, fontFamily: "'Outfit', sans-serif" }}>{label}</p>
      <p className="text-sm font-medium text-white truncate"
        style={{ fontFamily: "'Outfit', sans-serif" }}>{value}</p>
    </div>
    <ArrowUpRight size={14} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
      style={{ color }} />
  </motion.a>
);

// ─── MAIN ────────────────────────────────────────────────────
const ContactPage = () => {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | success | error
  const [toast, setToast] = useState(null);
  const [focused, setFocused] = useState(null);

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const inputStyle = (field) => ({
    fontFamily: "'Outfit', sans-serif",
    background: '#161B22',
    border: `1px solid ${focused === field ? BLUE : 'rgba(255,255,255,0.08)'}`,
    boxShadow: focused === field ? `0 0 0 3px ${BLUE}25` : 'none',
    color: '#F1F5F9',
    borderRadius: '12px',
    transition: 'all 0.2s',
  });

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      showToast('Veuillez remplir tous les champs obligatoires.', 'error');
      return;
    }
    setStatus('sending');
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setStatus('success');
      showToast('Message envoyé ! Nous vous répondrons très bientôt.');
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch {
      setStatus('error');
      showToast('Une erreur est survenue. Veuillez réessayer.', 'error');
    } finally {
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: '#0D1117', fontFamily: "'Outfit', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap');
        ::placeholder { color: rgba(148,163,184,0.5); }
        textarea { resize: vertical; }
        .map-wrapper iframe { display: block; }
      `}</style>

      <AnimatePresence>
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      </AnimatePresence>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-24 pb-20 px-6">
        {/* Fond décoratif */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full opacity-10 blur-3xl"
            style={{ background: `radial-gradient(ellipse, ${BLUE}, transparent)` }} />
          <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full opacity-8 blur-3xl"
            style={{ background: `radial-gradient(ellipse, ${GOLD}, transparent)` }} />
          {/* Lignes décoratives */}
          <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M 48 0 L 0 0 0 48" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          {/* Badge */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 text-xs font-semibold uppercase tracking-widest"
            style={{ background: `${BLUE}18`, border: `1px solid ${BLUE}30`, color: BLUE }}>
            <MessageSquare size={12} />
            Contactez-nous
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="text-5xl sm:text-6xl font-bold text-white mb-5 leading-tight"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Parlons de{' '}
            <span style={{
              background: `linear-gradient(135deg, ${GOLD}, ${BLUE})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              votre projet
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="text-base text-gray-400 leading-relaxed max-w-xl mx-auto">
            Notre équipe est à votre écoute pour tout projet immobilier, événementiel ou de communication. Répondons ensemble à vos ambitions.
          </motion.p>

          {/* Séparateur ornemental */}
          <motion.div initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-3 mt-8">
            <div className="h-px w-16" style={{ background: `linear-gradient(to right, transparent, ${GOLD})` }} />
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
            <div className="h-px w-16" style={{ background: `linear-gradient(to left, transparent, ${GOLD})` }} />
          </motion.div>
        </div>
      </section>

      {/* ── Contenu principal ─────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── Formulaire — 3 colonnes ──────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="lg:col-span-3 rounded-3xl p-8 space-y-6"
            style={{ background: '#161B22', border: '1px solid rgba(255,255,255,0.06)' }}>

            <div className="flex items-center gap-3 pb-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${BLUE}20` }}>
                <Send size={16} style={{ color: BLUE }} />
              </div>
              <h2 className="text-xl font-bold text-white"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                Envoyez-nous un message
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Votre nom" icon={User} accent={BLUE}>
                <input type="text" name="name" value={formData.name} onChange={handleChange}
                  placeholder="Jean Dupont"
                  onFocus={() => setFocused('name')} onBlur={() => setFocused(null)}
                  className="w-full px-4 py-3 text-sm outline-none"
                  style={inputStyle('name')} />
              </Field>

              <Field label="Votre email" icon={Mail} accent={BLUE}>
                <input type="email" name="email" value={formData.email} onChange={handleChange}
                  placeholder="jean@email.com"
                  onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                  className="w-full px-4 py-3 text-sm outline-none"
                  style={inputStyle('email')} />
              </Field>
            </div>

            <Field label="Sujet" icon={FileText} accent={GOLD}>
              <input type="text" name="subject" value={formData.subject} onChange={handleChange}
                placeholder="Ex : Demande de devis pour un événement"
                onFocus={() => setFocused('subject')} onBlur={() => setFocused(null)}
                className="w-full px-4 py-3 text-sm outline-none"
                style={inputStyle('subject')} />
            </Field>

            <Field label="Votre message" icon={MessageSquare} accent={GOLD}>
              <textarea name="message" value={formData.message} onChange={handleChange}
                placeholder="Décrivez votre projet ou votre demande en détail…"
                rows={6}
                onFocus={() => setFocused('message')} onBlur={() => setFocused(null)}
                className="w-full px-4 py-3 text-sm outline-none"
                style={inputStyle('message')} />
            </Field>

            <button onClick={handleSubmit} disabled={status === 'sending'}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-white font-semibold text-sm transition-all hover:opacity-90 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: `linear-gradient(135deg, #1A5A8A, ${BLUE})`,
                boxShadow: `0 6px 24px ${BLUE}35`,
                fontFamily: "'Outfit', sans-serif",
              }}>
              {status === 'sending' ? (
                <><Loader2 size={17} className="animate-spin" /> Envoi en cours…</>
              ) : (
                <><Send size={16} /> Envoyer le message</>
              )}
            </button>
          </motion.div>

          {/* ── Infos + Carte — 2 colonnes ───────────────────── */}
          <div className="lg:col-span-2 flex flex-col gap-5">

            {/* Coordonnées */}
            <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="rounded-3xl p-6 space-y-3"
              style={{ background: '#161B22', border: '1px solid rgba(255,255,255,0.06)' }}>

              <div className="flex items-center gap-3 pb-4"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${GOLD}20` }}>
                  <Phone size={16} style={{ color: GOLD }} />
                </div>
                <h2 className="text-xl font-bold text-white"
                  style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                  Nos Coordonnées
                </h2>
              </div>

              <InfoCard icon={MapPin} label="Adresse" color={RED}
                value="Rue Mfoa n°24, Poto-Poto, Brazzaville"
                href={DIRECTIONS_URL}
                delay={0.3} />

              <InfoCard icon={Mail} label="Email" color={BLUE}
                value="contact@altitudevision.agency"
                href="mailto:contact@altitudevision.agency"
                delay={0.35} />

              <InfoCard icon={Phone} label="Téléphone" color={GOLD}
                value="+242 06 800 21 51 / 05 330 16 75"
                href="tel:+24206800215"
                delay={0.4} />
            </motion.div>

            {/* Carte Maps */}
            <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="rounded-3xl overflow-hidden flex-1"
              style={{
                border: '1px solid rgba(255,255,255,0.06)',
                minHeight: '280px',
                position: 'relative',
              }}>

              {/* Badge agence sur la carte */}
              <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold shadow-lg"
                style={{
                  background: '#0D1117EE',
                  border: `1px solid ${GOLD}40`,
                  color: GOLD,
                  fontFamily: "'Outfit', sans-serif",
                  backdropFilter: 'blur(8px)',
                }}>
                <MapPin size={12} style={{ color: GOLD }} />
                Altitude-Vision — Poto-Poto
              </div>

              {/* Bouton Itinéraire */}
              <a href={DIRECTIONS_URL} target="_blank" rel="noopener noreferrer"
                className="absolute bottom-3 right-3 z-10 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white shadow-lg transition-all hover:scale-105"
                style={{
                  background: `linear-gradient(135deg, #1A5A8A, ${BLUE})`,
                  boxShadow: `0 4px 16px ${BLUE}40`,
                  fontFamily: "'Outfit', sans-serif",
                }}>
                <Navigation size={13} />
                Itinéraire
              </a>

              {/* iFrame Google Maps — centré sur Poto-Poto, marqueur agence */}
              <div className="map-wrapper w-full h-full" style={{ minHeight: '280px' }}>
                <iframe
                  title="Localisation Altitude-Vision — Rue Mfoa n°24, Poto-Poto, Brazzaville"
                  width="100%"
                  height="100%"
                  style={{ border: 0, minHeight: '280px', display: 'block' }}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d994.7418316498!2d15.28201!3d-4.25190!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNMKwMTUnMDYuOCJTIDE1wrAxNic1NS4yIkU!5e0!3m2!1sfr!2scg!4v1700000000000!5m2!1sfr!2scg&markers=color:red%7Clabel:AV%7C${AGENCY_LAT},${AGENCY_LNG}`}
                />
              </div>
            </motion.div>

          </div>
        </div>

        {/* ── Pied de section — pôles ────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { pole:'Altimmo',    desc:'Immobilier & gestion locative',   color:BLUE, icon:'🏢' },
            { pole:'Mila Events',desc:'Événementiel & organisation',     color:RED,  icon:'🎪' },
            { pole:'Altcom',     desc:'Communication & stratégie',       color:GOLD, icon:'📣' },
          ].map(({ pole, desc, color, icon }) => (
            <div key={pole}
              className="flex items-center gap-4 p-4 rounded-2xl"
              style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
              <span className="text-2xl">{icon}</span>
              <div>
                <p className="text-sm font-bold" style={{ color, fontFamily: "'Outfit', sans-serif" }}>{pole}</p>
                <p className="text-xs text-gray-500" style={{ fontFamily: "'Outfit', sans-serif" }}>{desc}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </section>
    </div>
  );
};

export default ContactPage;