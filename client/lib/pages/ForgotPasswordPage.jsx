"use client";

// src/pages/ForgotPasswordPage.jsx
import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowLeft, Send, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '../services/api';

const BLUE      = '#2E7BB5';
const BLUE_DARK = '#1A5A8A';
const GOLD      = '#C8960C';

const focusIn  = e => { e.target.style.borderColor = BLUE; e.target.style.boxShadow = `0 0 0 3px ${BLUE}15`; e.target.style.backgroundColor = '#fff'; };
const focusOut = e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; e.target.style.backgroundColor = '#F9FAFB'; };

const ForgotPasswordPage = () => {
    const [email,   setEmail]   = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error,   setError]   = useState('');

    const handleSubmit = async e => {
        e.preventDefault();
        if (!email.trim()) return setError('Veuillez saisir votre adresse email.');

        setLoading(true);
        setError('');
        try {
            await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
            setSuccess(true);
        } catch (err) {
            setError(err.response?.data?.message || 'Une erreur est survenue. Réessayez.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>

            {/* Halos décoratifs */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-[140px]"
                    style={{ background: BLUE, opacity: 0.07 }} />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-[120px]"
                    style={{ background: GOLD, opacity: 0.05 }} />
            </div>

            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md relative z-10">

                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">

                    {/* En-tête */}
                    <div className="px-8 pt-8 pb-6 text-center border-b border-gray-100">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                            style={{ background: `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})` }}>
                            <Mail className="w-7 h-7 text-white" />
                        </div>
                        <h2 className="text-gray-900 mb-1"
                            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.9rem', fontWeight: 700 }}>
                            Mot de passe oublié
                        </h2>
                        <p className="text-sm text-gray-500">
                            Saisissez votre email pour recevoir un lien de réinitialisation.
                        </p>
                    </div>

                    <div className="px-8 py-7">

                        <AnimatePresence mode="wait">

                            {/* ── État succès ─────────────────────── */}
                            {success ? (
                                <motion.div key="success"
                                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                    className="text-center py-4">
                                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                                        style={{ background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.25)' }}>
                                        <CheckCircle className="w-8 h-8 text-green-500" />
                                    </div>
                                    <h3 className="font-bold text-gray-900 text-lg mb-2"
                                        style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                        Email envoyé !
                                    </h3>
                                    <p className="text-gray-500 text-sm leading-relaxed mb-2">
                                        Si l'adresse <span className="font-semibold text-gray-700">{email}</span> est associée à un compte, vous recevrez un lien de réinitialisation.
                                    </p>
                                    <p className="text-gray-400 text-xs mb-6">
                                        Le lien expire dans <strong>10 minutes</strong>. Vérifiez aussi vos spams.
                                    </p>
                                    <div className="space-y-3">
                                        <button onClick={() => { setSuccess(false); setEmail(''); }}
                                            className="w-full py-3 rounded-2xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
                                            style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                            Renvoyer un email
                                        </button>
                                        <Link href="/login"
                                            className="block w-full py-3 rounded-2xl text-sm font-semibold text-white text-center transition-all hover:opacity-90"
                                            style={{ background: `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})`, fontFamily: "'DM Sans', sans-serif" }}>
                                            Retour à la connexion
                                        </Link>
                                    </div>
                                </motion.div>
                            ) : (

                            /* ── Formulaire ─────────────────────── */
                            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

                                <AnimatePresence>
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="flex items-center gap-2.5 px-4 py-3 rounded-2xl border text-sm font-medium mb-4 overflow-hidden"
                                            style={{ backgroundColor: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)', color: '#DC2626' }}>
                                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                            {error}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                                            Adresse email
                                        </label>
                                        <div className="relative">
                                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                            <input type="email" placeholder="votre@email.com"
                                                value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                                                required autoFocus
                                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-gray-900 text-sm focus:outline-none transition-all placeholder-gray-400"
                                                style={{ fontFamily: "'DM Sans', sans-serif" }}
                                                onFocus={focusIn} onBlur={focusOut} />
                                        </div>
                                    </div>

                                    <motion.button type="submit" disabled={loading}
                                        whileHover={{ scale: loading ? 1 : 1.02 }} whileTap={{ scale: 0.98 }}
                                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-white text-sm transition-all"
                                        style={{
                                            background: loading ? '#9CA3AF' : `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})`,
                                            boxShadow:  loading ? 'none' : `0 4px 20px ${BLUE}35`,
                                            fontFamily: "'DM Sans', sans-serif",
                                        }}>
                                        {loading
                                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi en cours...</>
                                            : <><Send className="w-4 h-4" /> Envoyer le lien</>
                                        }
                                    </motion.button>
                                </form>

                                <p className="text-center text-sm text-gray-500 pt-5 mt-1 border-t border-gray-100">
                                    <Link href="/login"
                                        className="inline-flex items-center gap-1.5 font-semibold hover:opacity-80 transition-opacity"
                                        style={{ color: BLUE }}>
                                        <ArrowLeft className="w-3.5 h-3.5" /> Retour à la connexion
                                    </Link>
                                </p>
                            </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Lien inscription */}
                <p className="text-center text-sm text-gray-400 mt-6">
                    Pas encore de compte ?{' '}
                    <Link href="/register" className="font-semibold hover:opacity-80 transition-opacity" style={{ color: GOLD }}>
                        S'inscrire
                    </Link>
                </p>
            </motion.div>
        </div>
    );
};

export default ForgotPasswordPage;