// src/components/ChatWidget.jsx
// Widget flottant : FAQ statique + bouton WhatsApp
// Usage: <ChatWidget /> dans App.jsx (hors routes, après <Footer />)

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, X, Send, ChevronRight,
  Home, Calendar, Megaphone, HelpCircle, Phone,
} from 'lucide-react';

const BLUE = '#2E7BB5';
const GOLD = '#C8872A';
const RED  = '#D42B2B';
const WHATSAPP_NUMBER = '242068002151'; // sans +

// ─── FAQ par catégorie ────────────────────────────────────────
const FAQ = [
  {
    category: 'Altimmo — Immobilier',
    icon: Home,
    color: BLUE,
    questions: [
      {
        q: 'Comment déposer une annonce immobilière ?',
        a: 'Créez un compte propriétaire, puis accédez à "Publier un bien" dans votre espace. Votre annonce sera visible après validation par notre équipe sous 24h.',
      },
      {
        q: 'Les annonces sont-elles gratuites ?',
        a: 'La publication d\'une annonce est gratuite. Des options de mise en avant payantes sont disponibles pour augmenter la visibilité de votre bien.',
      },
      {
        q: 'Comment contacter un propriétaire ?',
        a: 'Sur chaque annonce, cliquez sur "Contacter le propriétaire". Vous pouvez envoyer un message directement via notre plateforme.',
      },
      {
        q: 'Quels types de biens sont disponibles ?',
        a: 'Appartements, maisons, terrains, bureaux et locaux commerciaux à Brazzaville et dans tout le Congo.',
      },
    ],
  },
  {
    category: 'Mila Events — Événements',
    icon: Calendar,
    color: RED,
    questions: [
      {
        q: 'Comment réserver un événement ?',
        a: 'Sur la page de l\'événement, cliquez sur "Réserver" et remplissez le formulaire. Notre équipe vous confirmera par email ou WhatsApp.',
      },
      {
        q: 'Proposez-vous l\'organisation d\'événements privés ?',
        a: 'Oui ! Mariages, conférences, galas, soirées d\'entreprise… Contactez-nous via WhatsApp pour un devis personnalisé.',
      },
      {
        q: 'Comment soumettre un événement à publier ?',
        a: 'Créez un compte, accédez à votre tableau de bord et soumettez votre événement. Il sera publié après validation.',
      },
    ],
  },
  {
    category: 'Altcom — Communication',
    icon: Megaphone,
    color: GOLD,
    questions: [
      {
        q: 'Quels services de communication proposez-vous ?',
        a: 'Branding & design, stratégie digitale, campagnes publicitaires, production audiovisuelle, gestion des réseaux sociaux.',
      },
      {
        q: 'Comment obtenir un devis ?',
        a: 'Remplissez le formulaire de devis sur la page Altcom ou contactez-nous directement sur WhatsApp. Réponse sous 48h.',
      },
      {
        q: 'Travaillez-vous avec des PME locales ?',
        a: 'Absolument. Nous accompagnons les entreprises de toutes tailles au Congo et en Afrique centrale.',
      },
    ],
  },
  {
    category: 'Général',
    icon: HelpCircle,
    color: '#7C3AED',
    questions: [
      {
        q: 'Où êtes-vous situés ?',
        a: 'Nos bureaux sont au Rue Mfoa n°24, Poto-Poto, Brazzaville. Ouvert du lundi au vendredi, 8h–18h.',
      },
      {
        q: 'Comment vous contacter ?',
        a: 'Par email : contact@altitudevision.agency\nPar téléphone : +242 06 800 21 51 ou +242 05 330 16 75\nOu directement sur WhatsApp.',
      },
      {
        q: 'Comment créer un compte ?',
        a: 'Cliquez sur "S\'inscrire" en haut à droite du site. Remplissez le formulaire et validez votre email.',
      },
    ],
  },
];

// ─── Message type ─────────────────────────────────────────────
// { id, from: 'bot'|'user', text, time }

const botMsg = (text) => ({
  id: Date.now() + Math.random(),
  from: 'bot',
  text,
  time: new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }),
});

const userMsg = (text) => ({
  id: Date.now() + Math.random(),
  from: 'user',
  text,
  time: new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }),
});

const WELCOME = botMsg(
  'Bonjour 👋 Je suis l\'assistant Altitude-Vision.\n\nComment puis-je vous aider aujourd\'hui ?'
);

// ─── COMPONENT ───────────────────────────────────────────────
const ChatWidget = ({ currentPageTitle = '' }) => {
  const [open, setOpen]             = useState(false);
  const [messages, setMessages]     = useState([WELCOME]);
  const [view, setView]             = useState('menu'); // menu | category | chat
  const [activeCategory, setActive] = useState(null);
  const [input, setInput]           = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [unread, setUnread]         = useState(1);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) { setUnread(0); }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessages = (msgs) => {
    setMessages(prev => [...prev, ...msgs]);
  };

  const handleCategory = (cat) => {
    setActive(cat);
    setView('category');
  };

  const handleQuestion = (q, a) => {
    addMessages([userMsg(q), botMsg(a)]);
    setView('chat');
  };

  const handleWhatsApp = () => {
    const page = currentPageTitle ? ` (page : ${currentPageTitle})` : '';
    const msg  = encodeURIComponent(`Bonjour Altitude-Vision, j'ai une question${page}.`);
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, '_blank');
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    addMessages([
      userMsg(text),
      botMsg(
        'Merci pour votre message. Pour une réponse rapide, contactez-nous directement sur WhatsApp — notre équipe répond généralement en moins de 2h.'
      ),
    ]);
    setView('chat');
  };

  const handleBack = () => {
    if (view === 'category') setView('menu');
    else if (view === 'chat') setView(activeCategory ? 'category' : 'menu');
  };

  return (
    <>
      {/* ── Bouton flottant WhatsApp ────────────────────────── */}
      <motion.a
        href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Bonjour Altitude-Vision, j\'ai une question.')}`}
        target="_blank"
        rel="noopener noreferrer"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1.2, type: 'spring' }}
        whileHover={{ scale: 1.1 }}
        className="fixed z-40 flex items-center justify-center rounded-full shadow-2xl"
        style={{
          bottom: '90px',
          right: '24px',
          width: '52px',
          height: '52px',
          background: 'linear-gradient(135deg, #1DAA61, #128C7E)',
          boxShadow: '0 6px 24px rgba(29,170,97,0.45)',
        }}
        title="Nous contacter sur WhatsApp">
        {/* WhatsApp SVG icon */}
        <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </motion.a>

      {/* ── Bouton FAQ ──────────────────────────────────────── */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1, type: 'spring' }}
        whileHover={{ scale: 1.08 }}
        onClick={() => setOpen(o => !o)}
        className="fixed z-40 flex items-center justify-center rounded-full shadow-2xl"
        style={{
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
          background: open
            ? '#DC2626'
            : `linear-gradient(135deg, #1A5A8A, ${BLUE})`,
          boxShadow: `0 6px 24px ${BLUE}50`,
          transition: 'background 0.3s',
        }}>
        {open
          ? <X size={22} color="white" />
          : <MessageCircle size={24} color="white" />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ background: RED, fontFamily:"'Outfit', sans-serif" }}>
            {unread}
          </span>
        )}
      </motion.button>

      {/* ── Panel ───────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="fixed z-50 flex flex-col overflow-hidden rounded-3xl shadow-2xl"
            style={{
              bottom: '92px',
              right: '24px',
              width: '360px',
              maxWidth: 'calc(100vw - 32px)',
              height: '520px',
              background: '#0D1117',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>

            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#161B22' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${BLUE}20` }}>
                <MessageCircle size={18} style={{ color: BLUE }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-bold"
                  style={{ fontFamily:"'Outfit', sans-serif" }}>Assistant Altitude-Vision</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <p className="text-xs text-gray-400" style={{ fontFamily:"'Outfit', sans-serif" }}>En ligne</p>
                </div>
              </div>
              {(view === 'category' || view === 'chat') && (
                <button onClick={handleBack}
                  className="text-xs text-gray-400 hover:text-white px-3 py-1 rounded-lg transition"
                  style={{ background:'rgba(255,255,255,0.05)', fontFamily:"'Outfit', sans-serif" }}>
                  ← Retour
                </button>
              )}
            </div>

            {/* Corps */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">

              {/* Vue Menu */}
              {view === 'menu' && (
                <>
                  {/* Message bot */}
                  <div className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background:`${BLUE}20` }}>
                      <MessageCircle size={13} style={{ color:BLUE }} />
                    </div>
                    <div className="rounded-2xl rounded-tl-none px-4 py-3 max-w-[85%]"
                      style={{ background:'#161B22', border:'1px solid rgba(255,255,255,0.06)' }}>
                      <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-line"
                        style={{ fontFamily:"'Outfit', sans-serif" }}>
                        {WELCOME.text}
                      </p>
                    </div>
                  </div>

                  {/* Catégories */}
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 px-1 pt-1"
                    style={{ fontFamily:"'Outfit', sans-serif" }}>
                    Choisissez un sujet
                  </p>
                  {FAQ.map((cat) => (
                    <button key={cat.category} onClick={() => handleCategory(cat)}
                      className="w-full flex items-center gap-3 p-3.5 rounded-2xl transition-all hover:scale-[1.02] text-left"
                      style={{ background:`${cat.color}0F`, border:`1px solid ${cat.color}25` }}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background:`${cat.color}20` }}>
                        <cat.icon size={15} style={{ color: cat.color }} />
                      </div>
                      <span className="flex-1 text-sm font-medium text-gray-200"
                        style={{ fontFamily:"'Outfit', sans-serif" }}>{cat.category}</span>
                      <ChevronRight size={14} className="text-gray-500" />
                    </button>
                  ))}

                  {/* WhatsApp CTA */}
                  <button onClick={handleWhatsApp}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl text-white text-sm font-semibold mt-2 transition hover:opacity-90"
                    style={{ background:'linear-gradient(135deg, #1DAA61, #128C7E)', fontFamily:"'Outfit', sans-serif" }}>
                    <Phone size={15} />
                    Parler à un conseiller
                  </button>
                </>
              )}

              {/* Vue Catégorie */}
              {view === 'category' && activeCategory && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-widest px-1"
                    style={{ color: activeCategory.color, fontFamily:"'Outfit', sans-serif" }}>
                    {activeCategory.category}
                  </p>
                  {activeCategory.questions.map(({ q, a }) => (
                    <button key={q} onClick={() => handleQuestion(q, a)}
                      className="w-full text-left p-3.5 rounded-2xl transition-all hover:scale-[1.01]"
                      style={{ background:'#161B22', border:'1px solid rgba(255,255,255,0.06)' }}>
                      <p className="text-gray-200 text-sm leading-snug"
                        style={{ fontFamily:"'Outfit', sans-serif" }}>{q}</p>
                    </button>
                  ))}
                </>
              )}

              {/* Vue Chat */}
              {view === 'chat' && (
                <>
                  {messages.slice(1).map((msg) => (
                    <div key={msg.id}
                      className={`flex gap-2.5 ${msg.from === 'user' ? 'flex-row-reverse' : ''}`}>
                      {msg.from === 'bot' && (
                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background:`${BLUE}20` }}>
                          <MessageCircle size={13} style={{ color:BLUE }} />
                        </div>
                      )}
                      <div className="rounded-2xl px-4 py-3 max-w-[80%]"
                        style={msg.from === 'user'
                          ? { background:`linear-gradient(135deg, #1A5A8A, ${BLUE})`, borderBottomRightRadius:'4px' }
                          : { background:'#161B22', border:'1px solid rgba(255,255,255,0.06)', borderTopLeftRadius:'4px' }}>
                        <p className="text-sm text-white leading-relaxed whitespace-pre-line"
                          style={{ fontFamily:"'Outfit', sans-serif" }}>{msg.text}</p>
                        <p className="text-xs mt-1.5 opacity-50 text-right"
                          style={{ fontFamily:"'Outfit', sans-serif" }}>{msg.time}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="px-4 py-3 flex-shrink-0"
              style={{ borderTop:'1px solid rgba(255,255,255,0.06)', background:'#161B22' }}>
              <div className="flex gap-2 items-center">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Votre question…"
                  className="flex-1 px-4 py-2.5 text-sm text-white rounded-xl outline-none"
                  style={{
                    background: '#0D1117',
                    border: `1px solid ${inputFocused ? BLUE : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: inputFocused ? `0 0 0 3px ${BLUE}25` : 'none',
                    fontFamily:"'Outfit', sans-serif",
                    transition: 'all 0.2s',
                  }} />
                <button onClick={handleSend}
                  disabled={!input.trim()}
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition hover:opacity-90 disabled:opacity-30"
                  style={{ background:`linear-gradient(135deg, #1A5A8A, ${BLUE})` }}>
                  <Send size={15} color="white" />
                </button>
              </div>
              <p className="text-center text-xs text-gray-600 mt-2"
                style={{ fontFamily:"'Outfit', sans-serif" }}>
                Altitude-Vision © {new Date().getFullYear()}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatWidget;

/*
─── INTÉGRATION dans App.jsx ─────────────────────────────────

import ChatWidget from './components/ChatWidget';
import { useLocation } from 'react-router-dom';

// Dans le composant App, récupérer le titre selon la route:
const location = useLocation();
const pageTitle = location.pathname.includes('altimmo') ? 'Altimmo'
  : location.pathname.includes('mila-events') ? 'Mila Events'
  : location.pathname.includes('altcom') ? 'Altcom'
  : '';

// Ajouter avant </BrowserRouter> ou après <Footer />:
<ChatWidget currentPageTitle={pageTitle} />

// Le widget n'apparaît PAS sur les pages dashboard (à filtrer):
{!location.pathname.startsWith('/dashboard') && <ChatWidget currentPageTitle={pageTitle} />}
──────────────────────────────────────────────────────────────
*/