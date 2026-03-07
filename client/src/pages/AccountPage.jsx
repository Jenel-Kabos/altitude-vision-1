import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { updateMe, updateMyPassword } from "../services/userService";
import { Toaster, toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
    User, Mail, Lock, Save, AlertTriangle,
    CheckCircle, Eye, EyeOff, Loader2, ShieldCheck,
} from "lucide-react";

const BLUE      = '#2E7BB5';
const BLUE_DARK = '#1A5A8A';
const GOLD      = '#C8872A';

const focusIn  = e => { e.target.style.borderColor = BLUE; e.target.style.boxShadow = `0 0 0 3px ${BLUE}15`; e.target.style.backgroundColor = '#fff'; };
const focusOut = e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; e.target.style.backgroundColor = '#F9FAFB'; };

const inputCls = "w-full pl-10 pr-4 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-gray-900 text-sm focus:outline-none transition-all placeholder-gray-400";

// ── Champ texte/email ─────────────────────────────────────────
const InputField = ({ label, type='text', name, value, onChange, placeholder, Icon }) => (
    <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5"
            style={{ fontFamily:"'Outfit', sans-serif" }}>{label}</label>
        <div className="relative">
            <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input type={type} name={name} value={value} onChange={onChange}
                placeholder={placeholder} required
                className={inputCls} style={{ fontFamily:"'Outfit', sans-serif" }}
                onFocus={focusIn} onBlur={focusOut} />
        </div>
    </div>
);

// ── Champ mot de passe ────────────────────────────────────────
const PassField = ({ label, name, value, onChange, placeholder, error, show, onToggle }) => (
    <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5"
            style={{ fontFamily:"'Outfit', sans-serif" }}>{label}</label>
        <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input type={show ? 'text' : 'password'} name={name} value={value} onChange={onChange}
                placeholder={placeholder} required
                className="w-full pl-10 pr-10 py-3 border rounded-2xl bg-gray-50 text-gray-900 text-sm focus:outline-none transition-all placeholder-gray-400"
                style={{ borderColor: error ? '#EF4444' : '#E5E7EB', fontFamily:"'Outfit', sans-serif" }}
                onFocus={e => { if (!error) focusIn(e); }}
                onBlur={e => { if (!error) focusOut(e); }} />
            <button type="button" onClick={onToggle}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
        </div>
        <AnimatePresence>
            {error && (
                <motion.p initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
                    exit={{ opacity:0, height:0 }}
                    className="text-xs text-red-500 mt-1 flex items-center gap-1 overflow-hidden"
                    style={{ fontFamily:"'Outfit', sans-serif" }}>
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />{error}
                </motion.p>
            )}
        </AnimatePresence>
    </div>
);

// ─────────────────────────────────────────────────────────────
const AccountPage = () => {
    const { user, login } = useAuth();

    const [infoData,    setInfoData]    = useState({ name:'', email:'' });
    const [infoLoading, setInfoLoading] = useState(false);

    const [passData,    setPassData]    = useState({ passwordCurrent:'', password:'', passwordConfirm:'' });
    const [passLoading, setPassLoading] = useState(false);
    const [errors,      setErrors]      = useState({});
    const [showFields,  setShowFields]  = useState({ current:false, newp:false, confirm:false });

    useEffect(() => {
        if (user) setInfoData({ name: user.name || '', email: user.email || '' });
    }, [user]);

    const handleInfoChange = e =>
        setInfoData(d => ({ ...d, [e.target.name]: e.target.value }));

    const handlePassChange = e => {
        const { name, value } = e.target;
        setPassData(d => ({ ...d, [name]: value }));
        // Validation instantanée
        if (name === 'passwordConfirm') {
            setErrors(er => ({
                ...er,
                passwordConfirm: value && value !== passData.password ? 'Les mots de passe ne correspondent pas.' : null,
            }));
        }
        if (name === 'password') {
            setErrors(er => ({
                ...er,
                passwordConfirm: passData.passwordConfirm && value !== passData.passwordConfirm
                    ? 'Les mots de passe ne correspondent pas.' : null,
            }));
        }
    };

    const toggleShow = key => setShowFields(f => ({ ...f, [key]: !f[key] }));

    // ── Submit infos ──────────────────────────────────────────
    const handleSubmitInfo = async e => {
        e.preventDefault();
        setInfoLoading(true);
        const tid = toast.loading('Mise à jour du profil...');
        try {
            const res = await updateMe(infoData);
            if (res?.data?.user) {
                login(res.data.user, localStorage.getItem('token'));
                toast.success('Profil mis à jour avec succès !');
            } else {
                toast.error('Impossible de mettre à jour le profil.');
            }
        } catch (err) {
            toast.error(err?.message || 'Erreur de mise à jour du profil.');
        } finally {
            toast.dismiss(tid);
            setInfoLoading(false);
        }
    };

    // ── Submit mot de passe ───────────────────────────────────
    const handleSubmitPassword = async e => {
        e.preventDefault();
        if (passData.password !== passData.passwordConfirm) {
            setErrors({ passwordConfirm: 'Les mots de passe ne correspondent pas.' });
            return toast.error('Les mots de passe ne correspondent pas.');
        }
        if (passData.password.length < 8) {
            setErrors({ password: 'Le mot de passe doit contenir au moins 8 caractères.' });
            return toast.error('Mot de passe trop court.');
        }
        setPassLoading(true);
        const tid = toast.loading('Mise à jour du mot de passe...');
        try {
            const res = await updateMyPassword(passData);
            if (res?.token && res?.data?.user) {
                localStorage.setItem('token', res.token);
                login(res.data.user, res.token);
                toast.success('Mot de passe changé avec succès !');
                setPassData({ passwordCurrent:'', password:'', passwordConfirm:'' });
                setErrors({});
            } else {
                toast.error('Erreur inattendue lors du changement de mot de passe.');
            }
        } catch (err) {
            toast.error(err?.message || 'Échec du changement de mot de passe.');
        } finally {
            toast.dismiss(tid);
            setPassLoading(false);
        }
    };

    const passDisabled = passLoading || !passData.passwordCurrent || !passData.password
        || !passData.passwordConfirm || !!errors.passwordConfirm;

    if (!user) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="flex items-center gap-3 text-gray-500" style={{ fontFamily:"'Outfit', sans-serif" }}>
                <Loader2 className="w-5 h-5 animate-spin" style={{ color:BLUE }} />
                Chargement du profil...
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50" style={{ fontFamily:"'Outfit', sans-serif" }}>
            <Toaster position="top-right" toastOptions={{
                style: { fontFamily:"'Outfit', sans-serif", borderRadius:'16px', fontSize:'14px' },
                success: { iconTheme: { primary: BLUE, secondary:'#fff' } },
            }} />

            {/* ── Hero compact ─────────────────────────────── */}
            <div className="relative py-16 text-white overflow-hidden"
                style={{ background:`linear-gradient(135deg, #0D1117 0%, #0e1e30 60%, #0D1117 100%)` }}>
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 right-1/3 w-64 h-64 rounded-full blur-[100px] opacity-10"
                        style={{ background:BLUE }} />
                    <div className="absolute bottom-0 left-1/4 w-48 h-48 rounded-full blur-[80px] opacity-6"
                        style={{ background:GOLD }} />
                </div>
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background:`linear-gradient(to right, transparent, ${BLUE}50, transparent)` }} />

                <div className="container mx-auto max-w-4xl px-4 sm:px-6 relative z-10 text-center">
                    {/* Avatar */}
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                        style={{ background:`linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})` }}>
                        <User className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-white mb-2"
                        style={{ fontFamily:"'Cormorant Garamond', Georgia, serif", fontSize:'clamp(2rem, 4vw, 3rem)', fontWeight:700 }}>
                        Mon Compte
                    </h1>
                    <div className="h-0.5 w-12 rounded-full mx-auto mb-3"
                        style={{ background:`linear-gradient(to right, ${BLUE}, ${GOLD})` }} />
                    <p className="text-white/50 text-sm">{user.name} · {user.email}</p>
                </div>
            </div>

            {/* ── Contenu ──────────────────────────────────── */}
            <div className="container mx-auto max-w-4xl px-4 sm:px-6 py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                    {/* ── Infos profil ─────────────────────── */}
                    <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
                        transition={{ duration:0.4 }}
                        className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">

                        <div className="px-7 py-5 border-b border-gray-100 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                                style={{ background:`${BLUE}12` }}>
                                <User className="w-4 h-4" style={{ color:BLUE }} />
                            </div>
                            <h2 className="font-bold text-gray-900 text-base"
                                style={{ fontFamily:"'Outfit', sans-serif" }}>
                                Informations du Profil
                            </h2>
                        </div>

                        <form onSubmit={handleSubmitInfo} className="px-7 py-6 space-y-4">
                            <InputField label="Nom complet" name="name" value={infoData.name}
                                onChange={handleInfoChange} placeholder="Votre nom complet" Icon={User} />
                            <InputField label="Adresse email" type="email" name="email" value={infoData.email}
                                onChange={handleInfoChange} placeholder="exemple@email.com" Icon={Mail} />

                            <motion.button type="submit" disabled={infoLoading}
                                whileHover={{ scale: infoLoading ? 1 : 1.02 }} whileTap={{ scale:0.98 }}
                                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-white text-sm transition-all mt-2"
                                style={{
                                    background: infoLoading ? '#9CA3AF' : `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})`,
                                    boxShadow:  infoLoading ? 'none' : `0 4px 16px ${BLUE}30`,
                                    fontFamily: "'Outfit', sans-serif",
                                }}>
                                {infoLoading
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Mise à jour...</>
                                    : <><Save className="w-4 h-4" /> Sauvegarder</>}
                            </motion.button>
                        </form>
                    </motion.div>

                    {/* ── Mot de passe ─────────────────────── */}
                    <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
                        transition={{ duration:0.4, delay:0.08 }}
                        className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">

                        <div className="px-7 py-5 border-b border-gray-100 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                                style={{ background:`${GOLD}12` }}>
                                <Lock className="w-4 h-4" style={{ color:GOLD }} />
                            </div>
                            <h2 className="font-bold text-gray-900 text-base"
                                style={{ fontFamily:"'Outfit', sans-serif" }}>
                                Changer le Mot de Passe
                            </h2>
                        </div>

                        <form onSubmit={handleSubmitPassword} className="px-7 py-6 space-y-4">
                            <PassField label="Mot de passe actuel" name="passwordCurrent"
                                value={passData.passwordCurrent} onChange={handlePassChange}
                                placeholder="Votre mot de passe actuel" error={errors.passwordCurrent}
                                show={showFields.current} onToggle={() => toggleShow('current')} />

                            <PassField label="Nouveau mot de passe" name="password"
                                value={passData.password} onChange={handlePassChange}
                                placeholder="Minimum 8 caractères" error={errors.password}
                                show={showFields.newp} onToggle={() => toggleShow('newp')} />

                            <PassField label="Confirmer le nouveau mot de passe" name="passwordConfirm"
                                value={passData.passwordConfirm} onChange={handlePassChange}
                                placeholder="Répétez le nouveau mot de passe" error={errors.passwordConfirm}
                                show={showFields.confirm} onToggle={() => toggleShow('confirm')} />

                            <motion.button type="submit" disabled={passDisabled}
                                whileHover={{ scale: passDisabled ? 1 : 1.02 }} whileTap={{ scale:0.98 }}
                                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-white text-sm transition-all mt-2"
                                style={{
                                    background: passDisabled ? '#9CA3AF' : `linear-gradient(135deg, #7A5520, ${GOLD})`,
                                    boxShadow:  passDisabled ? 'none' : `0 4px 16px ${GOLD}40`,
                                    fontFamily: "'Outfit', sans-serif",
                                    cursor:     passDisabled ? 'not-allowed' : 'pointer',
                                }}>
                                {passLoading
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Mise à jour...</>
                                    : <><ShieldCheck className="w-4 h-4" /> Changer le mot de passe</>}
                            </motion.button>

                            {/* Note */}
                            <div className="flex items-start gap-2 pt-1">
                                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color:'#F59E0B' }} />
                                <p className="text-xs text-gray-400 leading-relaxed"
                                    style={{ fontFamily:"'Outfit', sans-serif" }}>
                                    Après le changement, vous serez reconnecté automatiquement.
                                </p>
                            </div>
                        </form>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default AccountPage;