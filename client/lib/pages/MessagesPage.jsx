"use client";

// src/pages/MessagesPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageCircle, Loader2, Plus, X, Search,
    Send, ArrowLeft, MoreVertical, Archive,
    CheckCheck, Clock, Inbox, ChevronRight,
} from 'lucide-react';
import ConversationList from '../components/messaging/ConversationList';
import ChatWindow       from '../components/messaging/ChatWindow';
import { getUserConversations, createOrGetConversation } from '../services/conversationService';
import { useAuth } from '../context/AuthContext';

// ── Design tokens ──────────────────────────────────────────────
const C = {
    bg:        '#0A0C0F',
    surface:   '#111418',
    surfaceHi: '#181D24',
    border:    'rgba(232,228,220,0.06)',
    borderHi:  'rgba(200,135,42,0.2)',
    gold:      '#C8872A',
    goldLight: '#E5A84B',
    blue:      '#2E7BB5',
    text:      '#E8E4DC',
    textMuted: 'rgba(232,228,220,0.45)',
    textFaint: 'rgba(232,228,220,0.2)',
};

// ── Avatar initiale ────────────────────────────────────────────
const Avatar = ({ name = 'U', photo, size = 40, online = false }) => {
    const [imgErr, setImgErr] = useState(false);
    return (
        <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
                width: size, height: size, borderRadius: '50%',
                overflow: 'hidden', flexShrink: 0,
                background: photo && !imgErr ? 'transparent' : `linear-gradient(135deg, ${C.blue}, ${C.gold})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: size * 0.38, fontWeight: 600, color: '#fff',
                border: `2px solid ${C.border}`,
            }}>
                {photo && !imgErr
                    ? <img src={photo} alt={name} onError={() => setImgErr(true)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (name || 'U')[0].toUpperCase()
                }
            </div>
            {online && (
                <div style={{
                    position: 'absolute', bottom: 1, right: 1,
                    width: size * 0.28, height: size * 0.28,
                    borderRadius: '50%', background: '#22C55E',
                    border: `2px solid ${C.bg}`,
                }} />
            )}
        </div>
    );
};

// ── Skeleton conversation ──────────────────────────────────────
const ConvSkeleton = () => (
    <div style={{ display: 'flex', gap: 12, padding: '14px 20px', alignItems: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.surfaceHi, flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ height: 12, borderRadius: 6, background: C.surfaceHi, width: '60%' }} />
            <div style={{ height: 10, borderRadius: 6, background: C.surfaceHi, width: '80%' }} />
        </div>
    </div>
);

// ── Formatage heure ────────────────────────────────────────────
const fmtTime = (d) => {
    if (!d) return '';
    const date = new Date(d);
    const now  = new Date();
    const diff = (now - date) / 1000;
    if (diff < 60)       return 'maintenant';
    if (diff < 3600)     return `${Math.floor(diff / 60)}min`;
    if (diff < 86400)    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800)   return date.toLocaleDateString('fr-FR', { weekday: 'short' });
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
};

// ─────────────────────────────────────────────────────────────
const MessagesPage = () => {
    const { user }  = useAuth();
    const [convs,   setConvs]    = useState([]);
    const [selConv, setSelConv]  = useState(null);
    const [loading, setLoading]  = useState(true);
    const [unread,  setUnread]   = useState(0);
    const [search,  setSearch]   = useState('');
    const [modal,   setModal]    = useState(false);
    const [mobile,  setMobile]   = useState(false); // true = affiche le chat sur mobile

    useEffect(() => { fetchConvs(); }, []);

    const fetchConvs = async () => {
        try {
            setLoading(true);
            const data = await getUserConversations();
            setConvs(data.conversations || []);
            setUnread(data.totalUnread || 0);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const selectConv = (conv) => {
        setSelConv(conv);
        setMobile(true);
        setConvs(c => c.map(x => x._id === conv._id ? { ...x, unreadCount: 0 } : x));
        setUnread(u => Math.max(0, u - (conv.unreadCount || 0)));
    };

    const filtered = convs.filter(c => {
        // ✅ CORRIGÉ : utilise && pour que les deux conditions soient vraies simultanément
        const other = c.participants?.find(
            p => p._id !== user?._id && p._id !== user?.id
        );
        return !search || (other?.name || '').toLowerCase().includes(search.toLowerCase());
    });

    return (
        <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'DM Sans', sans-serif", paddingTop: '72px' }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Cormorant+Garamond:wght@500;600;700&display=swap');
                * { box-sizing: border-box; }
                ::-webkit-scrollbar { width: 4px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(200,135,42,0.2); border-radius: 4px; }
                ::-webkit-scrollbar-thumb:hover { background: rgba(200,135,42,0.4); }
                textarea:focus, input:focus { outline: none; }
            `}</style>

            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px', height: 'calc(100vh - 72px)' }}>

                {/* ── Titre page ── */}
                <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
                    style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.6rem,3vw,2.2rem)', fontWeight: 700, color: C.text, margin: 0, lineHeight: 1.1 }}>
                            Messagerie
                        </h1>
                        <p style={{ fontSize: '0.78rem', color: C.textMuted, margin: '4px 0 0', fontWeight: 300 }}>
                            {unread > 0 ? `${unread} message${unread > 1 ? 's' : ''} non lu${unread > 1 ? 's' : ''}` : 'Tout est lu'}
                        </p>
                    </div>
                    <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                        onClick={() => setModal(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '10px 20px', borderRadius: 40,
                            background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})`,
                            border: 'none', color: '#0A0C0F', fontSize: '0.82rem',
                            fontWeight: 600, cursor: 'pointer', letterSpacing: '0.03em',
                            boxShadow: `0 4px 20px ${C.gold}35`,
                        }}>
                        <Plus size={15} />
                        Nouveau message
                    </motion.button>
                </motion.div>

                {/* ── Layout principal ── */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 360px) 1fr',
                    gap: 0,
                    height: 'calc(100vh - 180px)',
                    borderRadius: 20,
                    overflow: 'hidden',
                    border: `1px solid ${C.border}`,
                    background: C.surface,
                }}>

                    {/* ══ SIDEBAR CONVERSATIONS ══ */}
                    <div style={{
                        borderRight: `1px solid ${C.border}`,
                        display: 'flex', flexDirection: 'column', overflow: 'hidden',
                        // Mobile: masqué si chat ouvert
                        ...(mobile && selConv ? { display: 'none' } : {}),
                    }}
                        className="conv-sidebar">
                        <style>{`
                            @media (min-width: 768px) { .conv-sidebar { display: flex !important; } }
                        `}</style>

                        {/* Barre recherche */}
                        <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${C.border}` }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={14} style={{
                                    position: 'absolute', left: 14, top: '50%',
                                    transform: 'translateY(-50%)', color: C.textFaint,
                                    pointerEvents: 'none',
                                }} />
                                <input type="text" placeholder="Rechercher..."
                                    value={search} onChange={e => setSearch(e.target.value)}
                                    style={{
                                        width: '100%', padding: '10px 14px 10px 36px',
                                        background: C.surfaceHi, border: `1px solid ${C.border}`,
                                        borderRadius: 14, color: C.text, fontSize: '0.82rem',
                                        fontFamily: "'DM Sans', sans-serif",
                                        transition: 'border-color 0.2s',
                                    }}
                                    onFocus={e => e.target.style.borderColor = `${C.gold}50`}
                                    onBlur={e => e.target.style.borderColor = C.border}
                                />
                            </div>
                        </div>

                        {/* Liste */}
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                        transition={{ delay: i * 0.05 }}>
                                        <ConvSkeleton />
                                    </motion.div>
                                ))
                            ) : filtered.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                                    <Inbox size={40} style={{ color: C.textFaint, margin: '0 auto 12px' }} />
                                    <p style={{ color: C.textMuted, fontSize: '0.85rem', margin: 0 }}>
                                        {search ? 'Aucun résultat' : 'Aucune conversation'}
                                    </p>
                                    {!search && (
                                        <button onClick={() => setModal(true)}
                                            style={{ marginTop: 16, padding: '8px 18px', borderRadius: 40, background: `${C.gold}15`, border: `1px solid ${C.gold}30`, color: C.gold, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                                            Démarrer
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <AnimatePresence>
                                    {filtered.map((conv, i) => {
                                        // ✅ CORRIGÉ : utilise && pour identifier correctement l'autre participant
                                        const other = conv.participants?.find(
                                            p => (p._id || p) !== user?._id && (p._id || p) !== user?.id
                                        );
                                        const isActive = selConv?._id === conv._id;
                                        return (
                                            <motion.button key={conv._id}
                                                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.04 }}
                                                onClick={() => selectConv(conv)}
                                                style={{
                                                    width: '100%', display: 'flex', alignItems: 'center',
                                                    gap: 12, padding: '14px 16px', border: 'none',
                                                    background: isActive ? `${C.gold}10` : 'transparent',
                                                    borderLeft: `3px solid ${isActive ? C.gold : 'transparent'}`,
                                                    cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left',
                                                }}
                                                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = C.surfaceHi; }}
                                                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>

                                                <Avatar name={other?.name} photo={other?.photo} size={44} online={false} />

                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                                        <span style={{ fontSize: '0.88rem', fontWeight: conv.unreadCount ? 600 : 400, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                                                            {other?.name || 'Utilisateur'}
                                                        </span>
                                                        <span style={{ fontSize: '0.7rem', color: C.textFaint, flexShrink: 0 }}>
                                                            {fmtTime(conv.lastMessage?.createdAt || conv.updatedAt)}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <p style={{ margin: 0, fontSize: '0.78rem', color: conv.unreadCount ? C.textMuted : C.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%', fontWeight: conv.unreadCount ? 500 : 300 }}>
                                                            {conv.lastMessage?.content || 'Démarrer la conversation'}
                                                        </p>
                                                        {conv.unreadCount > 0 && (
                                                            <span style={{ minWidth: 20, height: 20, borderRadius: 10, background: `linear-gradient(135deg,${C.gold},${C.goldLight})`, color: '#0A0C0F', fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 }}>
                                                                {conv.unreadCount}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.button>
                                        );
                                    })}
                                </AnimatePresence>
                            )}
                        </div>
                    </div>

                    {/* ══ FENÊTRE CHAT ══ */}
                    <div style={{
                        display: 'flex', flexDirection: 'column', overflow: 'hidden',
                        background: C.bg,
                        ...(mobile && !selConv ? { display: 'none' } : {}),
                    }}
                        className="chat-panel">
                        <style>{`
                            @media (min-width: 768px) { .chat-panel { display: flex !important; } }
                        `}</style>

                        {selConv ? (
                            <>
                                {/* Header chat */}
                                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 14, background: C.surface, flexShrink: 0 }}>
                                    {/* Retour mobile */}
                                    <button onClick={() => { setMobile(false); setSelConv(null); }}
                                        className="back-btn"
                                        style={{ display: 'none', background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', padding: 4 }}>
                                        <ArrowLeft size={18} />
                                    </button>
                                    <style>{`@media (max-width:767px){ .back-btn { display:block !important; } }`}</style>

                                    {(() => {
                                        // ✅ CORRIGÉ : utilise && pour identifier correctement l'autre participant
                                        const other = selConv.participants?.find(
                                            p => (p._id || p) !== user?._id && (p._id || p) !== user?.id
                                        );
                                        return (
                                            <>
                                                <Avatar name={other?.name} photo={other?.photo} size={40} online />
                                                <div style={{ flex: 1 }}>
                                                    <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600, color: C.text }}>
                                                        {other?.name || 'Utilisateur'}
                                                    </p>
                                                    <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#22C55E', fontWeight: 400 }}>
                                                        En ligne
                                                    </p>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>

                                {/* Composant ChatWindow existant */}
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <ChatWindow
                                        conversation={selConv}
                                        onBack={() => { setMobile(false); setSelConv(null); }}
                                        onArchive={() => { setSelConv(null); setMobile(false); fetchConvs(); }}
                                    />
                                </div>
                            </>
                        ) : (
                            /* Placeholder aucune conversation sélectionnée */
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
                                <div style={{ width: 80, height: 80, borderRadius: 24, background: `${C.gold}10`, border: `1px solid ${C.gold}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                                    <MessageCircle size={36} style={{ color: C.gold, opacity: 0.6 }} />
                                </div>
                                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 600, color: C.text, margin: '0 0 8px' }}>
                                    Vos conversations
                                </h3>
                                <p style={{ color: C.textMuted, fontSize: '0.85rem', maxWidth: 280, lineHeight: 1.6, margin: '0 0 28px', fontWeight: 300 }}>
                                    Sélectionnez une conversation ou démarrez-en une nouvelle avec l'équipe.
                                </p>
                                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                                    onClick={() => setModal(true)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 40, background: `linear-gradient(135deg,${C.gold},${C.goldLight})`, border: 'none', color: '#0A0C0F', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', boxShadow: `0 4px 20px ${C.gold}30` }}>
                                    <Plus size={16} />
                                    Démarrer une conversation
                                </motion.button>
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>

            {/* ══ MODAL NOUVELLE CONVERSATION ══ */}
            <AnimatePresence>
                {modal && (
                    <NewConversationModal
                        onClose={() => setModal(false)}
                        onCreated={(conv) => {
                            setModal(false);
                            fetchConvs();
                            setSelConv(conv);
                            setMobile(true);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
const NewConversationModal = ({ onClose, onCreated }) => {
    const [message,  setMessage]  = useState('');
    const [loading,  setLoading]  = useState(false);
    const [error,    setError]    = useState('');
    const textRef = useRef(null);

    useEffect(() => { textRef.current?.focus(); }, []);

    const handleSubmit = async e => {
        e.preventDefault();
        if (!message.trim()) return setError('Veuillez écrire un message.');
        setLoading(true); setError('');
        try {
            const adminId = process.env.NEXT_PUBLIC_ADMIN_ID || '68f8edbad1e9333e12874f8c';
            const conv    = await createOrGetConversation(adminId, message);
            onCreated(conv);
        } catch {
            setError('Erreur lors de l\'envoi. Réessayez.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', padding: '0 16px 0' }}
            onClick={e => e.target === e.currentTarget && onClose()}>

            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                style={{ background: C.surface, borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 560, border: `1px solid ${C.border}`, borderBottom: 'none', overflow: 'hidden', marginBottom: 0, paddingBottom: 'env(safe-area-inset-bottom)' }}>

                {/* Poignée */}
                <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
                    <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border }} />
                </div>

                {/* Header modal */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 24px 16px' }}>
                    <div>
                        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 700, color: C.text, margin: 0 }}>
                            Nouveau message
                        </h3>
                        <p style={{ fontSize: '0.75rem', color: C.textMuted, margin: '4px 0 0', fontWeight: 300 }}>
                            L'équipe Altitude Vision vous répondra rapidement
                        </p>
                    </div>
                    <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, background: C.surfaceHi, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.textMuted }}>
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Info bande */}
                    <div style={{ margin: '0 24px 16px', padding: '12px 16px', borderRadius: 14, background: `${C.blue}12`, border: `1px solid ${C.blue}20`, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg,${C.blue},${C.gold})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>AV</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: C.textMuted, lineHeight: 1.5, fontWeight: 300 }}>
                            Équipe <strong style={{ color: C.text, fontWeight: 600 }}>Altitude Vision</strong> — Réponse sous 24h
                        </p>
                    </div>

                    {/* Zone texte */}
                    <div style={{ margin: '0 24px' }}>
                        <textarea ref={textRef}
                            value={message}
                            onChange={e => { setMessage(e.target.value); setError(''); }}
                            placeholder="Décrivez votre demande..."
                            maxLength={2000} rows={5}
                            style={{
                                width: '100%', padding: '14px 16px',
                                background: C.surfaceHi, border: `1px solid ${error ? '#EF4444' : C.border}`,
                                borderRadius: 16, color: C.text, fontSize: '0.88rem',
                                fontFamily: "'DM Sans', sans-serif", resize: 'none',
                                lineHeight: 1.6, transition: 'border-color 0.2s',
                            }}
                            onFocus={e => e.target.style.borderColor = `${C.gold}50`}
                            onBlur={e => e.target.style.borderColor = error ? '#EF4444' : C.border}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                            {error
                                ? <span style={{ fontSize: '0.75rem', color: '#EF4444' }}>{error}</span>
                                : <span />
                            }
                            <span style={{ fontSize: '0.72rem', color: C.textFaint }}>{message.length}/2000</span>
                        </div>
                    </div>

                    {/* Boutons */}
                    <div style={{ display: 'flex', gap: 10, padding: '16px 24px 24px' }}>
                        <button type="button" onClick={onClose}
                            style={{ flex: 1, padding: '12px', borderRadius: 14, background: 'transparent', border: `1px solid ${C.border}`, color: C.textMuted, fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                            Annuler
                        </button>
                        <motion.button type="submit" disabled={loading || !message.trim()}
                            whileHover={{ scale: (loading || !message.trim()) ? 1 : 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 14, background: (loading || !message.trim()) ? C.surfaceHi : `linear-gradient(135deg,${C.gold},${C.goldLight})`, border: 'none', color: (loading || !message.trim()) ? C.textFaint : '#0A0C0F', fontSize: '0.85rem', fontWeight: 600, cursor: (loading || !message.trim()) ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.2s', boxShadow: (loading || !message.trim()) ? 'none' : `0 4px 16px ${C.gold}30` }}>
                            {loading
                                ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Envoi...</>
                                : <><Send size={16} /> Envoyer</>
                            }
                        </motion.button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
};

export default MessagesPage;