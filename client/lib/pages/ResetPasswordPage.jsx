"use client";

// src/pages/ResetPasswordPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Lock, Eye, EyeOff, Loader2, CheckCircle,
    AlertTriangle, KeyRound, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const BLUE      = '#2E7BB5';
const BLUE_DARK = '#1A5A8A';
const GOLD      = '#C8960C';

const focusIn  = e => { e.target.style.borderColor = BLUE; e.target.style.boxShadow = `0 0 0 3px ${BLUE}15`; e.target.style.backgroundColor = '#fff'; };
const focusOut = e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; e.target.style.backgroundColor = '#F9FAFB'; };

// ── Indicateur force mot de passe ─────────────────────────────
const pwScore = p => {
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8)           s++;
    if (/[A-Z]/.test(p))         s++;
    if (/[0-9]/.test(p))         s++;
    if (/[^A-Za-z0-9]/.test(p))  s++;
    return s;
};
const PW_C = ['#E5E7EB', '#EF4444', '#F59E0B', BLUE, '#22C55E'];
const PW_L = ['', 'Faible', 'Moyen', 'Bon', 'Fort'];

const ResetPasswordPage = () => {
    const { token }    = useParams();
    const router       = useRouter();
    const { login }    = useAuth();

    const [form,        setForm]        = useState({ password: '', passwordConfirm: '' });
    const [showPass,    setShowPass]    = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading,     setLoading]     = useState(false);
    const [success,     setSuccess]     = useState(false);
    const [error,       setError]       = useState('');
    const [tokenValid,  setTokenValid]  = useState(true);

    // Vérifier que le token est présent dans l'URL
    useEffect(() => {
        if (!token || token.length < 20) {
            setTokenValid(false);
            setError('Lien de réinitialisation invalide. Faites une nouvelle demande.');
        }
    }, [token]);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async e => {
        e.preventDefault();

        if (form.password !== form.passwordConfirm)
            return setError('Les mots de passe ne correspondent pas.');
        if (form.password.length < 8)
            return setError('Le mot de passe doit contenir au moins 8 caractères.');

        setLoading(true);
        setError('');
        try {
            const res = await api.patch(`/auth/reset-password/${token}`, {
                password:        form.password,
                passwordConfirm: form.passwordConfirm,
            });

            // Connecter automatiquement l'utilisateur
            if (res.data?.token && res.data?.data?.user) {
                login(res.data.data.user, res.data.token);
            }

            setSuccess(true);
            // Rediriger après 2 secondes
            setTimeout(() => router.push('/'), 2000);
        } catch (err) {
            const msg = err.response?.data?.message || 'Erreur lors de la réinitialisation.';
            setError(msg);
            if (msg.includes('invalide') || msg.includes('expiré')) {
                setTokenValid(false);
            }
        } finally {
            setLoading(false);
        }
    };

    const score   = pwScore(form.password);
    const pwMatch = form.passwordConfirm && form.password === form.passwordConfirm;

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>

            {/* Halos */}
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
                            style={{ background: success ? 'linear-gradient(135deg,#16a34a,#22c55e)' : `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})` }}>
                            {success
                                ? <CheckCircle className="w-7 h-7 text-white" />
                                : <KeyRound className="w-7 h-7 text-white" />
                            }
                        </div>
                        <h2 className="text-gray-900 mb-1"
                            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.9rem', fontWeight: 700 }}>
                            {success ? 'Mot de passe modifié !' : 'Nouveau mot de passe'}
                        </h2>
                        <p className="text-sm text-gray-500">
                            {success
                                ? 'Redirection en cours...'
                                : 'Choisissez un mot de passe sécurisé pour votre compte.'}
                        </p>
                    </div>

                    <div className="px-8 py-7">
                        <AnimatePresence mode="wait">

                            {/* ── Succès ─────────────────────────── */}
                            {success && (
                                <motion.div key="success"
                                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                    className="text-center py-4">
                                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                                        style={{ background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.25)' }}>
                                        <ShieldCheck className="w-8 h-8 text-green-500" />
                                    </div>
                                    <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                                        Votre mot de passe a été réinitialisé avec succès. Vous allez être redirigé automatiquement.
                                    </p>
                                    <Link href="/"
                                        className="block w-full py-3 rounded-2xl text-sm font-semibold text-white text-center"
                                        style={{ background: `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})`, fontFamily: "'DM Sans', sans-serif" }}>
                                        Aller à l'accueil
                                    </Link>
                                </motion.div>
                            )}

                            {/* ── Token invalide ─────────────────── */}
                            {!success && !tokenValid && (
                                <motion.div key="invalid"
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    className="text-center py-4">
                                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                                        style={{ background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.2)' }}>
                                        <AlertTriangle className="w-8 h-8 text-red-400" />
                                    </div>
                                    <h3 className="font-bold text-gray-900 text-lg mb-2">Lien expiré ou invalide</h3>
                                    <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                                        Ce lien de réinitialisation est invalide ou a expiré (durée : 10 minutes). Faites une nouvelle demande.
                                    </p>
                                    <Link href="/forgot-password"
                                        className="block w-full py-3 rounded-2xl text-sm font-semibold text-white text-center"
                                        style={{ background: `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})`, fontFamily: "'DM Sans', sans-serif" }}>
                                        Nouvelle demande
                                    </Link>
                                </motion.div>
                            )}

                            {/* ── Formulaire ─────────────────────── */}
                            {!success && tokenValid && (
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

                                        {/* Nouveau mot de passe */}
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                                                Nouveau mot de passe
                                            </label>
                                            <div className="relative">
                                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                                <input type={showPass ? 'text' : 'password'}
                                                    placeholder="Minimum 8 caractères"
                                                    value={form.password}
                                                    onChange={e => { set('password', e.target.value); setError(''); }}
                                                    required minLength={8} autoFocus
                                                    className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-gray-900 text-sm focus:outline-none transition-all placeholder-gray-400"
                                                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                                                    onFocus={focusIn} onBlur={focusOut} />
                                                <button type="button" onClick={() => setShowPass(!showPass)}
                                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                                                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                            {form.password && (
                                                <div className="mt-2 flex items-center gap-1">
                                                    {[1,2,3,4].map(i => (
                                                        <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                                                            style={{ backgroundColor: i <= score ? PW_C[score] : '#E5E7EB' }} />
                                                    ))}
                                                    <span className="text-xs font-semibold ml-1" style={{ color: PW_C[score] }}>
                                                        {PW_L[score]}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Confirmation */}
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                                                Confirmer le mot de passe
                                            </label>
                                            <div className="relative">
                                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                                <input type={showConfirm ? 'text' : 'password'}
                                                    placeholder="Répétez le mot de passe"
                                                    value={form.passwordConfirm}
                                                    onChange={e => { set('passwordConfirm', e.target.value); setError(''); }}
                                                    required minLength={8}
                                                    className="w-full pl-10 pr-16 py-3 border rounded-2xl bg-gray-50 text-gray-900 text-sm focus:outline-none transition-all placeholder-gray-400"
                                                    style={{
                                                        borderColor: form.passwordConfirm ? (pwMatch ? '#22C55E' : '#EF4444') : '#E5E7EB',
                                                        fontFamily: "'DM Sans', sans-serif",
                                                    }}
                                                    onFocus={e => { if (!form.passwordConfirm) focusIn(e); }}
                                                    onBlur={e => { if (!form.passwordConfirm) focusOut(e); }} />
                                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                    {form.passwordConfirm && (
                                                        pwMatch
                                                            ? <CheckCircle className="w-4 h-4 text-green-500" />
                                                            : <AlertTriangle className="w-4 h-4 text-red-400" />
                                                    )}
                                                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                                                        className="text-gray-400 hover:text-gray-600 transition-colors">
                                                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Règles mot de passe */}
                                        <div className="grid grid-cols-2 gap-2 py-1">
                                            {[
                                                { ok: form.password.length >= 8,          label: '8 caractères min.' },
                                                { ok: /[A-Z]/.test(form.password),         label: '1 majuscule' },
                                                { ok: /[0-9]/.test(form.password),         label: '1 chiffre' },
                                                { ok: /[^A-Za-z0-9]/.test(form.password),  label: '1 caractère spécial' },
                                            ].map(({ ok, label }) => (
                                                <div key={label} className="flex items-center gap-1.5 text-xs"
                                                    style={{ color: ok ? '#22C55E' : '#9CA3AF' }}>
                                                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                                        style={{ background: ok ? '#22C55E' : '#D1D5DB' }} />
                                                    {label}
                                                </div>
                                            ))}
                                        </div>

                                        <motion.button type="submit" disabled={loading}
                                            whileHover={{ scale: loading ? 1 : 1.02 }} whileTap={{ scale: 0.98 }}
                                            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-white text-sm mt-1 transition-all"
                                            style={{
                                                background: loading ? '#9CA3AF' : `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})`,
                                                boxShadow:  loading ? 'none' : `0 4px 20px ${BLUE}35`,
                                                fontFamily: "'DM Sans', sans-serif",
                                            }}>
                                            {loading
                                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Réinitialisation...</>
                                                : <><ShieldCheck className="w-4 h-4" /> Enregistrer le mot de passe</>
                                            }
                                        </motion.button>
                                    </form>

                                    <p className="text-center text-sm text-gray-500 pt-5 mt-1 border-t border-gray-100">
                                        <Link href="/forgot-password"
                                            className="font-semibold hover:opacity-80 transition-opacity"
                                            style={{ color: BLUE }}>
                                            Demander un nouveau lien
                                        </Link>
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default ResetPasswordPage;