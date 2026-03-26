// src/components/messaging/MessageBubble.jsx
import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Trash2, Paperclip, CheckCheck, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Tokens alignés sur MessagesPage ──────────────────────────
const C = {
    bg:        '#0A0C0F',
    surface:   '#111418',
    surfaceHi: '#181D24',
    border:    'rgba(232,228,220,0.06)',
    gold:      '#C8872A',
    goldLight: '#E5A84B',
    blue:      '#2E7BB5',
    text:      '#E8E4DC',
    textMuted: 'rgba(232,228,220,0.45)',
    textFaint: 'rgba(232,228,220,0.2)',
    danger:    '#EF4444',
    dangerBg:  'rgba(239,68,68,0.12)',
};

// ── Mini avatar ───────────────────────────────────────────────
const MiniAvatar = ({ name, photo }) => {
    const [err, setErr] = useState(false);
    return (
        <div style={{
            width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
            background: photo && !err ? 'transparent' : `linear-gradient(135deg, ${C.blue}, ${C.gold})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.65rem', fontWeight: 700, color: '#fff',
            overflow: 'hidden', border: `1.5px solid ${C.border}`,
        }}>
            {photo && !err
                ? <img src={photo} alt={name} onError={() => setErr(true)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (name || '?')[0].toUpperCase()
            }
        </div>
    );
};

// ── Modal confirmation suppression ───────────────────────────
const DeleteConfirmModal = ({ onConfirm, onCancel }) => (
    <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{
            position: 'fixed', inset: 0, zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
            padding: 16,
        }}
        onClick={e => e.target === e.currentTarget && onCancel()}>
        <motion.div
            initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            style={{
                background: C.surface, borderRadius: 20,
                border: `1px solid ${C.border}`,
                padding: '28px 28px 24px',
                width: '100%', maxWidth: 340,
                textAlign: 'center',
                boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
            }}>

            {/* Icône */}
            <div style={{
                width: 52, height: 52, borderRadius: 16,
                background: C.dangerBg,
                border: `1px solid rgba(239,68,68,0.2)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
            }}>
                <Trash2 size={22} style={{ color: C.danger }} />
            </div>

            <h3 style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '1.25rem', fontWeight: 700,
                color: C.text, margin: '0 0 8px',
            }}>
                Supprimer ce message ?
            </h3>
            <p style={{
                fontSize: '0.82rem', color: C.textMuted,
                margin: '0 0 24px', lineHeight: 1.6, fontWeight: 300,
            }}>
                Le message sera remplacé par <em>"Message supprimé"</em>. Cette action est irréversible.
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onCancel}
                    style={{
                        flex: 1, padding: '11px 0', borderRadius: 12,
                        background: 'transparent', border: `1px solid ${C.border}`,
                        color: C.textMuted, fontSize: '0.85rem', fontWeight: 500,
                        cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => e.target.style.borderColor = C.textFaint}
                    onMouseLeave={e => e.target.style.borderColor = C.border}>
                    Annuler
                </button>
                <motion.button onClick={onConfirm}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    style={{
                        flex: 1, padding: '11px 0', borderRadius: 12,
                        background: 'linear-gradient(135deg, #DC2626, #EF4444)',
                        border: 'none', color: '#fff',
                        fontSize: '0.85rem', fontWeight: 600,
                        cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                        boxShadow: '0 4px 16px rgba(239,68,68,0.3)',
                    }}>
                    Supprimer
                </motion.button>
            </div>
        </motion.div>
    </motion.div>
);

// ─────────────────────────────────────────────────────────────
const MessageBubble = ({ message, isOwnMessage, onDelete }) => {
    const [hovered,     setHovered]     = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const timeAgo = formatDistanceToNow(new Date(message.createdAt), {
        addSuffix: true, locale: fr,
    });

    const handleDeleteClick = () => setConfirmOpen(true);

    const handleConfirmDelete = async () => {
        setConfirmOpen(false);
        await onDelete(message._id);
    };

    const isDeleted = message.isDeleted;

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    display: 'flex',
                    justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
                    alignItems: 'flex-end',
                    gap: 8,
                    marginBottom: 12,
                    padding: '0 4px',
                }}>

                {/* Avatar autres */}
                {!isOwnMessage && (
                    <div style={{ paddingBottom: 4 }}>
                        <MiniAvatar
                            name={message.sender?.name}
                            photo={message.sender?.photo || message.sender?.avatar}
                        />
                    </div>
                )}

                {/* ── Bouton supprimer (propres messages) ── */}
                {isOwnMessage && !isDeleted && (
                    <AnimatePresence>
                        {hovered && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.15 }}
                                onClick={handleDeleteClick}
                                title="Supprimer le message"
                                style={{
                                    width: 30, height: 30, borderRadius: 10,
                                    background: C.dangerBg,
                                    border: `1px solid rgba(239,68,68,0.2)`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', flexShrink: 0,
                                    transition: 'all 0.2s',
                                    marginBottom: 4,
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
                                    e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = C.dangerBg;
                                    e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)';
                                }}>
                                <Trash2 size={14} style={{ color: C.danger }} />
                            </motion.button>
                        )}
                    </AnimatePresence>
                )}

                {/* ── Contenu bulle ── */}
                <div style={{ maxWidth: '72%', minWidth: 80 }}>

                    {/* Nom expéditeur (messages reçus) */}
                    {!isOwnMessage && !isDeleted && (
                        <p style={{
                            margin: '0 0 4px 4px',
                            fontSize: '0.72rem', fontWeight: 600,
                            color: C.textMuted, letterSpacing: '0.02em',
                        }}>
                            {message.sender?.name || 'Utilisateur'}
                        </p>
                    )}

                    {/* Bulle */}
                    <div style={{
                        padding: isDeleted ? '10px 14px' : '12px 16px',
                        borderRadius: isOwnMessage
                            ? '18px 18px 4px 18px'
                            : '18px 18px 18px 4px',
                        background: isDeleted
                            ? C.surfaceHi
                            : isOwnMessage
                                ? `linear-gradient(135deg, ${C.blue}, #1A5A8A)`
                                : C.surfaceHi,
                        border: isDeleted
                            ? `1px solid ${C.border}`
                            : isOwnMessage
                                ? 'none'
                                : `1px solid ${C.border}`,
                        boxShadow: isOwnMessage && !isDeleted
                            ? `0 4px 16px rgba(46,123,181,0.25)`
                            : 'none',
                        transition: 'all 0.2s',
                        position: 'relative',
                    }}>

                        {/* Contenu texte */}
                        {isDeleted ? (
                            <p style={{
                                margin: 0, fontSize: '0.82rem',
                                color: C.textFaint, fontStyle: 'italic',
                                display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                                <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                                Message supprimé
                            </p>
                        ) : (
                            <p style={{
                                margin: 0, fontSize: '0.88rem',
                                color: isOwnMessage ? '#fff' : C.text,
                                lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                fontFamily: "'DM Sans', sans-serif", fontWeight: 300,
                            }}>
                                {message.content}
                            </p>
                        )}

                        {/* Pièces jointes */}
                        {!isDeleted && message.attachments?.length > 0 && (
                            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {message.attachments.map((att, i) => (
                                    <a key={i} href={att} target="_blank" rel="noopener noreferrer"
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            fontSize: '0.78rem',
                                            color: isOwnMessage ? 'rgba(255,255,255,0.75)' : C.textMuted,
                                            textDecoration: 'none',
                                            padding: '6px 10px', borderRadius: 8,
                                            background: isOwnMessage ? 'rgba(255,255,255,0.1)' : C.surfaceHi,
                                            border: `1px solid ${isOwnMessage ? 'rgba(255,255,255,0.12)' : C.border}`,
                                            transition: 'opacity 0.15s',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                                        <Paperclip size={12} />
                                        Pièce jointe {i + 1}
                                    </a>
                                ))}
                            </div>
                        )}

                        {/* Timestamp + statut */}
                        {!isDeleted && (
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                                gap: 4, marginTop: 6,
                            }}>
                                <span style={{
                                    fontSize: '0.68rem',
                                    color: isOwnMessage ? 'rgba(255,255,255,0.45)' : C.textFaint,
                                    fontWeight: 300,
                                }}>
                                    {timeAgo}
                                </span>
                                {isOwnMessage && (
                                    <CheckCheck size={12} style={{ color: 'rgba(255,255,255,0.45)', flexShrink: 0 }} />
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Espace droite pour messages reçus (symétrie) */}
                {!isOwnMessage && <div style={{ width: 30, flexShrink: 0 }} />}
            </motion.div>

            {/* Modal confirmation */}
            <AnimatePresence>
                {confirmOpen && (
                    <DeleteConfirmModal
                        onConfirm={handleConfirmDelete}
                        onCancel={() => setConfirmOpen(false)}
                    />
                )}
            </AnimatePresence>
        </>
    );
};

export default MessageBubble;