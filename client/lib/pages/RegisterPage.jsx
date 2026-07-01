"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from 'next-auth/react';
import { useAuth } from '../context/AuthContext';
import api from "../services/api";
import { motion, AnimatePresence } from "framer-motion";
import {
    UserPlus, User, Mail, Lock, Briefcase,
    AlertTriangle, Eye, EyeOff, Loader2, CheckCircle, FileText, Check,
    ScrollText, ChevronDown, Shield,
} from "lucide-react";
import { contratHebergement } from "../data/contratHebergement";

const BLUE      = '#2E7BB5';
const BLUE_DARK = '#1A5A8A';
const GOLD      = '#C8960C';

const focusIn  = e => { e.target.style.borderColor = BLUE; e.target.style.boxShadow = `0 0 0 3px ${BLUE}15`; e.target.style.backgroundColor = '#fff'; };
const focusOut = e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; e.target.style.backgroundColor = '#F9FAFB'; };

const inputCls = "w-full pl-10 pr-10 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-gray-900 text-sm focus:outline-none transition-all placeholder-gray-400";

// ── Indicateur force ──────────────────────────────────────────
const pwScore = p => {
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8)          s++;
    if (/[A-Z]/.test(p))        s++;
    if (/[0-9]/.test(p))        s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
};
const PW_C = ['#E5E7EB','#EF4444','#F59E0B',BLUE,'#22C55E'];
const PW_L = ['','Faible','Moyen','Bon','Fort'];

const CERTIFICATIONS_LIST = [
    {
        key:   'contratAccepte',
        label: "J'ai lu et j'accepte intégralement le contrat d'hébergement d'Altitude Vision",
    },
    {
        key:   'informationsVraies',
        label: 'Je certifie que toutes les informations fournies sont vraies, exactes et complètes',
    },
    {
        key:   'estProprietaireLegal',
        label: "Je certifie être le propriétaire légal ou l'apporteur d'affaires autorisé pour ces biens",
    },
    {
        key:   'engagementHonnetete',
        label: "Je m'engage à être honnête et transparent dans toutes mes interactions avec la plateforme et les clients",
    },
    {
        key:   'commissionAcceptee',
        label: "J'accepte les conditions de rémunération : je percevrai 30% de la commission reçue par Altitude Vision (soit 30% de 80% du loyer mensuel) pour chaque location conclue via la plateforme",
    },
];

// ─────────────────────────────────────────────────────────────
const RegisterPage = () => {
    const [form,        setForm]        = useState({ name:'', email:'', password:'', confirmPassword:'', role:'Client' });
    const [showPass,    setShowPass]    = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error,       setError]       = useState('');
    const [loading,     setLoading]     = useState(false);
    const [contratLu,   setContratLu]   = useState(false);
    const [certifications, setCertifications] = useState({
        contratAccepte:       false,
        informationsVraies:   false,
        estProprietaireLegal: false,
        engagementHonnetete:  false,
        commissionAcceptee:   false,
    });

    const router = useRouter();
    const auth   = useAuth();

    useEffect(() => {
        if (auth.user) router.push(
            auth.user.role === 'Admin'        ? '/admin'     :
            auth.user.role === 'Proprietaire' ? '/mes-biens' : '/'
        );
    }, [router, auth.user]);

    const set     = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const toggleC = k => setCertifications(c => ({ ...c, [k]: !c[k] }));

    const contractRef = useRef(null);

    const handleContractScroll = useCallback(() => {
        const el = contractRef.current;
        if (!el) return;
        const scrolled = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
        if (scrolled) setContratLu(true);
    }, []);

    const isProprietaire = form.role === 'Proprietaire';
    const toutAccepte    = isProprietaire
        ? contratLu && Object.values(certifications).every(v => v === true)
        : true;

    const handleSubmit = async e => {
        e.preventDefault();
        if (form.password !== form.confirmPassword)
            return setError('Les mots de passe ne correspondent pas.');
        if (form.password.length < 8)
            return setError('Le mot de passe doit contenir au moins 8 caractères.');
        if (isProprietaire && !toutAccepte)
            return setError('Vous devez cocher toutes les cases pour vous inscrire en tant que Propriétaire.');

        setLoading(true); setError('');
        try {
            await api.post('/users/signup', {
                name:            form.name.trim(),
                email:           form.email.trim().toLowerCase(),
                password:        form.password,
                passwordConfirm: form.confirmPassword,
                role:            form.role,
                ...(isProprietaire && {
                    contratAccepte: true,
                    informationsVraies:   certifications.informationsVraies,
                    estProprietaireLegal: certifications.estProprietaireLegal,
                    engagementHonnetete:  certifications.engagementHonnetete,
                    commissionAcceptee:   certifications.commissionAcceptee,
                }),
            });
            router.push(`/verify-email-pending?email=${encodeURIComponent(form.email.trim().toLowerCase())}`);
        } catch (err) {
            setError(err.response?.data?.message || "Erreur lors de l'inscription. Vérifiez vos informations.");
        } finally {
            setLoading(false);
        }
    };

    const score   = pwScore(form.password);
    const pwMatch = form.confirmPassword && form.password === form.confirmPassword;

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4"
            style={{ fontFamily:"'DM Sans', sans-serif" }}>

            {/* Halos */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-[140px]"
                    style={{ background:BLUE, opacity:0.07 }} />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-[120px]"
                    style={{ background:GOLD, opacity:0.05 }} />
            </div>

            <motion.div initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }}
                transition={{ duration:0.5 }} className="w-full max-w-lg relative z-10">

                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">

                    {/* En-tête */}
                    <div className="px-8 pt-8 pb-6 text-center border-b border-gray-100">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                            style={{ background:`linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})` }}>
                            <UserPlus className="w-7 h-7 text-white" />
                        </div>
                        <h2 className="text-gray-900 mb-1"
                            style={{ fontFamily:"'Cormorant Garamond', Georgia, serif", fontSize:'1.9rem', fontWeight:700 }}>
                            Créez votre compte
                        </h2>
                        <p className="text-sm text-gray-500">Rejoignez la plateforme en quelques clics.</p>
                    </div>

                    <div className="px-8 py-7">

                        {/* Bouton Google */}
                        <button
                            type="button"
                            onClick={() => signIn('google', { callbackUrl: '/completer-profil' })}
                            className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-2xl py-3 px-4 hover:bg-gray-50 transition-colors font-medium text-gray-700 text-sm mb-4"
                        >
                            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            S'inscrire avec Google
                        </button>

                        {/* Séparateur */}
                        <div className="relative mb-4">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200" />
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="px-3 text-gray-400 bg-white">ou avec un email</span>
                            </div>
                        </div>

                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
                                    exit={{ opacity:0, height:0 }}
                                    className="flex items-center gap-2.5 px-4 py-3 rounded-2xl border text-sm font-medium mb-4 overflow-hidden"
                                    style={{ backgroundColor:'rgba(239,68,68,0.06)', borderColor:'rgba(239,68,68,0.2)', color:'#DC2626' }}>
                                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                    {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <form onSubmit={handleSubmit} className="space-y-4">

                            {/* Nom */}
                            <div>
                                <label className="block text-[0.72rem] font-bold uppercase tracking-wider text-gray-600 mb-1.5">Nom complet</label>
                                <div className="relative">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <input type="text" placeholder="Votre nom complet" value={form.name}
                                        onChange={e => set('name', e.target.value)} required
                                        className={inputCls} onFocus={focusIn} onBlur={focusOut} />
                                </div>
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-[0.72rem] font-bold uppercase tracking-wider text-gray-600 mb-1.5">Adresse email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <input type="email" placeholder="exemple@email.com" value={form.email}
                                        onChange={e => set('email', e.target.value)} required
                                        className={inputCls} onFocus={focusIn} onBlur={focusOut} />
                                </div>
                            </div>

                            {/* Mot de passe */}
                            <div>
                                <label className="block text-[0.72rem] font-bold uppercase tracking-wider text-gray-600 mb-1.5">Mot de passe</label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <input type={showPass ? 'text' : 'password'} placeholder="Minimum 8 caractères"
                                        value={form.password} onChange={e => set('password', e.target.value)}
                                        required minLength={8}
                                        className={inputCls} onFocus={focusIn} onBlur={focusOut} />
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
                                        <span className="text-xs font-semibold ml-1" style={{ color:PW_C[score] }}>
                                            {PW_L[score]}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Confirmation */}
                            <div>
                                <label className="block text-[0.72rem] font-bold uppercase tracking-wider text-gray-600 mb-1.5">Confirmer le mot de passe</label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <input type={showConfirm ? 'text' : 'password'}
                                        placeholder="Répétez votre mot de passe"
                                        value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)}
                                        required minLength={8}
                                        className="w-full pl-10 pr-16 py-3 border rounded-2xl bg-gray-50 text-gray-900 text-sm focus:outline-none transition-all placeholder-gray-400"
                                        style={{ borderColor: form.confirmPassword ? (pwMatch ? '#22C55E' : '#EF4444') : '#E5E7EB', fontFamily:"'DM Sans', sans-serif" }}
                                        onFocus={e => { if (!form.confirmPassword) focusIn(e); }}
                                        onBlur={e => { if (!form.confirmPassword) focusOut(e); }} />
                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                        {form.confirmPassword && (
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

                            {/* Rôle */}
                            <div>
                                <label className="block text-[0.72rem] font-bold uppercase tracking-wider text-gray-600 mb-1.5">Je m'inscris en tant que</label>
                                <div className="relative">
                                    <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <select value={form.role} onChange={e => set('role', e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-gray-900 text-sm focus:outline-none transition-all appearance-none cursor-pointer"
                                        style={{ fontFamily:"'DM Sans', sans-serif" }}
                                        onFocus={focusIn} onBlur={focusOut}>
                                        <option value="Client">Client (recherche de bien)</option>
                                        <option value="Proprietaire">Propriétaire / Apporteur d'affaires</option>
                                        <option value="Prestataire">Prestataire de services</option>
                                    </select>
                                </div>
                            </div>

                            {/* ── Contrat de partenariat (Propriétaire uniquement) ── */}
                            <AnimatePresence>
                            {isProprietaire && (
                                <motion.div
                                    initial={{ opacity:0, height:0 }}
                                    animate={{ opacity:1, height:'auto' }}
                                    exit={{ opacity:0, height:0 }}
                                    transition={{ duration:0.35 }}
                                    className="overflow-hidden">
                                    <div className="rounded-2xl border overflow-hidden"
                                        style={{ borderColor: BLUE + '30', boxShadow: `0 2px 12px ${BLUE}10` }}>

                                        {/* ── En-tête contrat ────────────────────────── */}
                                        <div className="px-5 py-4"
                                            style={{ background: `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})` }}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                                                    <ScrollText className="w-4.5 h-4.5 text-white" />
                                                </div>
                                                <div>
                                                    <p className="text-white font-bold text-sm tracking-wide">
                                                        Contrat de Partenariat Propriétaire
                                                    </p>
                                                    <p className="text-white/70 text-xs mt-0.5">
                                                        Altitude Vision — Altimmo · Version 1.0 · 2026
                                                    </p>
                                                </div>
                                                <div className="ml-auto flex-shrink-0">
                                                    {contratLu
                                                        ? <span className="flex items-center gap-1 text-xs font-semibold text-green-300">
                                                            <CheckCircle className="w-3.5 h-3.5" /> Lu
                                                          </span>
                                                        : <span className="flex items-center gap-1 text-xs text-white/60">
                                                            <ChevronDown className="w-3.5 h-3.5 animate-bounce" /> Défiler
                                                          </span>
                                                    }
                                                </div>
                                            </div>
                                        </div>

                                        {/* ── Indicateur lecture ──────────────────────── */}
                                        {!contratLu && (
                                            <div className="px-5 py-2 flex items-center gap-2 text-xs font-medium"
                                                style={{ background: '#FFF7ED', borderBottom: '1px solid #FED7AA', color: '#C2410C' }}>
                                                <Shield className="w-3.5 h-3.5 flex-shrink-0" />
                                                Faites défiler le contrat jusqu'en bas pour pouvoir cocher les cases
                                            </div>
                                        )}

                                        {/* ── Corps du contrat scrollable ─────────────── */}
                                        <div
                                            ref={contractRef}
                                            onScroll={handleContractScroll}
                                            className="overflow-y-auto relative"
                                            style={{
                                                maxHeight: '340px',
                                                background: '#FAFAFA',
                                                borderBottom: '1px solid #E5E7EB',
                                            }}>
                                            <div className="p-5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                                {/* Titre intégré */}
                                                <div className="text-center mb-5 pb-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
                                                    <h3 className="font-bold text-gray-900 text-base mb-1">
                                                        CONTRAT D'HÉBERGEMENT DE BIEN IMMOBILIER
                                                    </h3>
                                                    <p className="text-xs text-gray-500">Altitude Vision — Altimmo · Version 1.0 · 2026</p>
                                                </div>
                                                {/* Contenu article par article */}
                                                {contratHebergement
                                                    .split(/\n\n+/)
                                                    .filter(Boolean)
                                                    .map((block, i) => {
                                                        const isTitle = /^(ENTRE LES SOUSSIGNÉS|IL A ÉTÉ CONVENU|ARTICLE \d+|CONTRAT)/i.test(block.trim());
                                                        const isArticleHeader = /^ARTICLE \d+/i.test(block.trim());
                                                        if (isArticleHeader) {
                                                            const [header, ...rest] = block.split('\n');
                                                            return (
                                                                <div key={i} className="mb-4">
                                                                    <p className="text-xs font-bold uppercase tracking-wider mb-1.5"
                                                                        style={{ color: BLUE }}>
                                                                        {header.trim()}
                                                                    </p>
                                                                    <p className="text-sm text-gray-700 leading-relaxed">
                                                                        {rest.join('\n').trim()}
                                                                    </p>
                                                                </div>
                                                            );
                                                        }
                                                        if (isTitle) {
                                                            return (
                                                                <p key={i} className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-3">
                                                                    {block.trim()}
                                                                </p>
                                                            );
                                                        }
                                                        return (
                                                            <p key={i} className="text-sm text-gray-600 leading-relaxed mb-3 whitespace-pre-line">
                                                                {block.trim()}
                                                            </p>
                                                        );
                                                    })
                                                }
                                                {/* Fin du contrat */}
                                                <div className="mt-5 pt-4 text-center" style={{ borderTop: '1px solid #E5E7EB' }}>
                                                    <p className="text-xs text-gray-500 italic">
                                                        Fait à Brazzaville — accepté électroniquement lors de l'inscription
                                                    </p>
                                                    <p className="text-xs font-semibold mt-1" style={{ color: BLUE }}>
                                                        Altitude Vision — contact@altitudevision.agency
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ── Cases à cocher ─────────────────────────── */}
                                        <div className="p-5 space-y-3 bg-white">
                                            <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                                Certifications requises
                                            </p>
                                            {CERTIFICATIONS_LIST.map(({ key, label }) => {
                                                const disabled = !contratLu;
                                                return (
                                                    <label key={key}
                                                        className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-blue-50'}`}
                                                        style={{ border: '1px solid', borderColor: certifications[key] ? BLUE + '40' : '#E5E7EB' }}>
                                                        <div
                                                            onClick={() => !disabled && toggleC(key)}
                                                            className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                                                            style={{
                                                                cursor:          disabled ? 'not-allowed' : 'pointer',
                                                                borderColor:     certifications[key] ? BLUE : '#D1D5DB',
                                                                backgroundColor: certifications[key] ? BLUE : 'transparent',
                                                            }}>
                                                            {certifications[key] && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                                        </div>
                                                        <span
                                                            className="text-sm text-gray-700 leading-relaxed select-none"
                                                            onClick={() => !disabled && toggleC(key)}>
                                                            {label} <span className="text-red-400">*</span>
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                            <p className="text-xs text-gray-500 pt-1">* Tous les champs sont obligatoires. Les cases se déverrouillent après lecture complète du contrat.</p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                            </AnimatePresence>

                            {/* Submit */}
                            <motion.button type="submit"
                                disabled={loading || (isProprietaire && !toutAccepte)}
                                whileHover={{ scale: (loading || (isProprietaire && !toutAccepte)) ? 1 : 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-white text-sm mt-2 transition-all"
                                style={{
                                    background:  (loading || (isProprietaire && !toutAccepte)) ? '#9CA3AF' : `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})`,
                                    boxShadow:   (loading || (isProprietaire && !toutAccepte)) ? 'none' : `0 4px 20px ${BLUE}35`,
                                    fontFamily:  "'DM Sans', sans-serif",
                                    cursor:      (isProprietaire && !toutAccepte) ? 'not-allowed' : 'pointer',
                                    opacity:     (isProprietaire && !toutAccepte) ? 0.6 : 1,
                                }}>
                                {loading
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Création en cours...</>
                                    : isProprietaire
                                        ? <><UserPlus className="w-4 h-4" /> S'inscrire en tant que Propriétaire</>
                                        : <><UserPlus className="w-4 h-4" /> Créer mon compte</>}
                            </motion.button>
                        </form>

                        <p className="text-center text-sm text-gray-500 pt-5 mt-1 border-t border-gray-100">
                            Déjà un compte ?{' '}
                            <Link href="/login" className="font-semibold hover:opacity-80 transition-opacity" style={{ color:BLUE }}>
                                Connectez-vous
                            </Link>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default RegisterPage;
