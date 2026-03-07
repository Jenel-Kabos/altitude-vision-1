import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { motion, AnimatePresence } from "framer-motion";
import {
    UserPlus, User, Mail, Lock, Briefcase,
    AlertTriangle, Eye, EyeOff, Loader2, CheckCircle,
} from "lucide-react";

const BLUE      = '#2E7BB5';
const BLUE_DARK = '#1A5A8A';
const GOLD      = '#C8872A';

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

// ─────────────────────────────────────────────────────────────
const RegisterPage = () => {
    const [form,        setForm]        = useState({ name:'', email:'', password:'', confirmPassword:'', role:'Client' });
    const [showPass,    setShowPass]    = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error,       setError]       = useState('');
    const [loading,     setLoading]     = useState(false);
    const navigate = useNavigate();
    const auth     = useAuth();

    useEffect(() => {
        if (auth.user) navigate(
            auth.user.role === 'Admin'        ? '/admin'     :
            auth.user.role === 'Proprietaire' ? '/mes-biens' : '/'
        );
    }, [navigate, auth.user]);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async e => {
        e.preventDefault();
        if (form.password !== form.confirmPassword)
            return setError('Les mots de passe ne correspondent pas.');
        if (form.password.length < 8)
            return setError('Le mot de passe doit contenir au moins 8 caractères.');
        setLoading(true); setError('');
        try {
            await api.post('/users/signup', {
                name: form.name.trim(),
                email: form.email.trim().toLowerCase(),
                password: form.password,
                passwordConfirm: form.confirmPassword,
                role: form.role,
            });
            navigate(`/verify-email-pending?email=${encodeURIComponent(form.email.trim().toLowerCase())}`);
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
            style={{ fontFamily:"'Outfit', sans-serif" }}>

            {/* Halos */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-[140px]"
                    style={{ background:BLUE, opacity:0.07 }} />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-[120px]"
                    style={{ background:GOLD, opacity:0.05 }} />
            </div>

            <motion.div initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }}
                transition={{ duration:0.5 }} className="w-full max-w-md relative z-10">

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
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Nom complet</label>
                                <div className="relative">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <input type="text" placeholder="Votre nom complet" value={form.name}
                                        onChange={e => set('name', e.target.value)} required
                                        className={inputCls} onFocus={focusIn} onBlur={focusOut} />
                                </div>
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Adresse email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <input type="email" placeholder="exemple@email.com" value={form.email}
                                        onChange={e => set('email', e.target.value)} required
                                        className={inputCls} onFocus={focusIn} onBlur={focusOut} />
                                </div>
                            </div>

                            {/* Mot de passe */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Mot de passe</label>
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
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Confirmer le mot de passe</label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <input type={showConfirm ? 'text' : 'password'}
                                        placeholder="Répétez votre mot de passe"
                                        value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)}
                                        required minLength={8}
                                        className="w-full pl-10 pr-16 py-3 border rounded-2xl bg-gray-50 text-gray-900 text-sm focus:outline-none transition-all placeholder-gray-400"
                                        style={{ borderColor: form.confirmPassword ? (pwMatch ? '#22C55E' : '#EF4444') : '#E5E7EB', fontFamily:"'Outfit', sans-serif" }}
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
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Je m'inscris en tant que</label>
                                <div className="relative">
                                    <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <select value={form.role} onChange={e => set('role', e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-gray-900 text-sm focus:outline-none transition-all appearance-none cursor-pointer"
                                        style={{ fontFamily:"'Outfit', sans-serif" }}
                                        onFocus={focusIn} onBlur={focusOut}>
                                        <option value="Client">Client (recherche de bien)</option>
                                        <option value="Proprietaire">Propriétaire / Apporteur d'affaires</option>
                                        <option value="Prestataire">Prestataire de services</option>
                                    </select>
                                </div>
                            </div>

                            {/* Submit */}
                            <motion.button type="submit" disabled={loading}
                                whileHover={{ scale: loading ? 1 : 1.02 }} whileTap={{ scale:0.98 }}
                                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-white text-sm mt-2 transition-all"
                                style={{
                                    background: loading ? '#9CA3AF' : `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})`,
                                    boxShadow:  loading ? 'none' : `0 4px 20px ${BLUE}35`,
                                    fontFamily: "'Outfit', sans-serif",
                                }}>
                                {loading
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Création en cours...</>
                                    : <><UserPlus className="w-4 h-4" /> Créer mon compte</>}
                            </motion.button>
                        </form>

                        <p className="text-center text-sm text-gray-500 pt-5 mt-1 border-t border-gray-100">
                            Déjà un compte ?{' '}
                            <Link to="/login" className="font-semibold hover:opacity-80 transition-opacity" style={{ color:BLUE }}>
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