import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { updateMe, updateMyPassword } from "../services/userService";
import { Toaster, toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
    User, Mail, Lock, Save, AlertTriangle,
    Eye, EyeOff, Loader2, ShieldCheck, Camera, Trash2, Upload, Phone,
} from "lucide-react";

const BLUE      = '#2E7BB5';
const BLUE_DARK = '#1A5A8A';
const GOLD      = '#C8872A';

const focusIn  = e => { e.target.style.borderColor = BLUE; e.target.style.boxShadow = `0 0 0 3px ${BLUE}15`; e.target.style.backgroundColor = '#fff'; };
const focusOut = e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; e.target.style.backgroundColor = '#F9FAFB'; };

const inputCls = "w-full pl-10 pr-4 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-gray-900 text-sm focus:outline-none transition-all placeholder-gray-400";

// ── Champ texte/email ─────────────────────────────────────────
const InputField = ({ label, type = 'text', name, value, onChange, placeholder, Icon }) => (
    <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5"
            style={{ fontFamily: "'Outfit', sans-serif" }}>{label}</label>
        <div className="relative">
            <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input type={type} name={name} value={value} onChange={onChange}
                placeholder={placeholder} required
                className={inputCls} style={{ fontFamily: "'Outfit', sans-serif" }}
                onFocus={focusIn} onBlur={focusOut} />
        </div>
    </div>
);

// ── Champ téléphone avec indicatif ────────────────────────────
const DIAL_CODES = [
    { code: '+242', flag: '🇨🇬', label: 'Congo' },
    { code: '+243', flag: '🇨🇩', label: 'RDC' },
    { code: '+33',  flag: '🇫🇷', label: 'France' },
    { code: '+32',  flag: '🇧🇪', label: 'Belgique' },
    { code: '+41',  flag: '🇨🇭', label: 'Suisse' },
    { code: '+1',   flag: '🇺🇸', label: 'USA' },
    { code: '+44',  flag: '🇬🇧', label: 'UK' },
    { code: '+212', flag: '🇲🇦', label: 'Maroc' },
    { code: '+225', flag: '🇨🇮', label: "Côte d'Ivoire" },
    { code: '+237', flag: '🇨🇲', label: 'Cameroun' },
    { code: '+221', flag: '🇸🇳', label: 'Sénégal' },
    { code: '+241', flag: '🇬🇦', label: 'Gabon' },
];

const parsePhone = (val = '') => {
    const match = DIAL_CODES.find(d => val.startsWith(d.code));
    return match
        ? { dialCode: match.code, local: val.slice(match.code.length).trim() }
        : { dialCode: '+242', local: val };
};

const PhoneField = ({ value, onChange }) => {
    const { dialCode, local } = parsePhone(value);
    const selected = DIAL_CODES.find(d => d.code === dialCode) || DIAL_CODES[0];

    const handleDialChange  = e => onChange(`${e.target.value} ${local}`.trim());
    const handleLocalChange = e => {
        const clean = e.target.value.replace(/[^\d\s\-]/g, '');
        onChange(`${dialCode} ${clean}`.trim());
    };

    return (
        <div>
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5"
                style={{ fontFamily: "'Outfit', sans-serif" }}>
                Téléphone
                <span className="normal-case font-normal tracking-normal text-gray-300" style={{ fontSize: '0.65rem' }}>
                    (optionnel)
                </span>
            </label>
            <div className="flex gap-2">
                <div className="relative flex-shrink-0">
                    <select value={dialCode} onChange={handleDialChange}
                        className="h-full pl-3 pr-7 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-gray-900 text-sm focus:outline-none appearance-none cursor-pointer transition-all"
                        style={{ fontFamily: "'Outfit', sans-serif", minWidth: '90px' }}
                        onFocus={focusIn} onBlur={focusOut}>
                        {DIAL_CODES.map(d => (
                            <option key={d.code} value={d.code}>{d.flag} {d.code}</option>
                        ))}
                    </select>
                    <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
                <div className="relative flex-1">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input type="tel" value={local} onChange={handleLocalChange}
                        placeholder="06 123 45 67"
                        className={inputCls}
                        style={{ fontFamily: "'Outfit', sans-serif" }}
                        onFocus={focusIn} onBlur={focusOut} />
                </div>
            </div>
            {local && (
                <p className="text-xs text-gray-400 mt-1.5 pl-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    {selected.flag} Numéro complet :{' '}
                    <span className="text-gray-500 font-medium">{dialCode} {local}</span>
                </p>
            )}
        </div>
    );
};

// ── Champ mot de passe ────────────────────────────────────────
const PassField = ({ label, name, value, onChange, placeholder, error, show, onToggle }) => (
    <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5"
            style={{ fontFamily: "'Outfit', sans-serif" }}>{label}</label>
        <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input type={show ? 'text' : 'password'} name={name} value={value} onChange={onChange}
                placeholder={placeholder} required
                className="w-full pl-10 pr-10 py-3 border rounded-2xl bg-gray-50 text-gray-900 text-sm focus:outline-none transition-all placeholder-gray-400"
                style={{ borderColor: error ? '#EF4444' : '#E5E7EB', fontFamily: "'Outfit', sans-serif" }}
                onFocus={e => { if (!error) focusIn(e); }}
                onBlur={e => { if (!error) focusOut(e); }} />
            <button type="button" onClick={onToggle}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
        </div>
        <AnimatePresence>
            {error && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-xs text-red-500 mt-1 flex items-center gap-1 overflow-hidden"
                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />{error}
                </motion.p>
            )}
        </AnimatePresence>
    </div>
);

// ── Avatar Upload ─────────────────────────────────────────────
const AvatarUpload = ({ user, preview, onFileChange, onRemove, uploading }) => {
    const fileRef  = useRef(null);
    const hasPhoto = preview || user?.photo;

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="relative group" style={{ width: 96, height: 96 }}>
                <div className="w-24 h-24 rounded-2xl overflow-hidden flex items-center justify-center"
                    style={{
                        background: hasPhoto ? 'transparent' : `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})`,
                        boxShadow:  `0 0 0 3px rgba(46,123,181,0.15)`,
                    }}>
                    {hasPhoto
                        ? <img src={preview || user.photo} alt="Photo de profil" className="w-full h-full object-cover" />
                        : <User className="w-10 h-10 text-white opacity-80" />
                    }
                </div>
                <button type="button" onClick={() => fileRef.current?.click()}
                    className="absolute inset-0 rounded-2xl flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                    style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}>
                    <Camera className="w-6 h-6 text-white" />
                </button>
                {uploading && (
                    <div className="absolute inset-0 rounded-2xl flex items-center justify-center"
                        style={{ background: 'rgba(0,0,0,0.5)' }}>
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2">
                <button type="button" onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                    style={{ background: `${BLUE}12`, color: BLUE, fontFamily: "'Outfit', sans-serif", border: `1px solid ${BLUE}20` }}>
                    <Upload className="w-3 h-3" />
                    {hasPhoto ? 'Changer' : 'Ajouter une photo'}
                </button>
                {hasPhoto && (
                    <button type="button" onClick={onRemove}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                        style={{ background: '#FEF2F2', color: '#EF4444', fontFamily: "'Outfit', sans-serif", border: '1px solid #FECACA' }}>
                        <Trash2 className="w-3 h-3" /> Supprimer
                    </button>
                )}
            </div>
            <p className="text-xs text-gray-400" style={{ fontFamily: "'Outfit', sans-serif" }}>
                JPG, PNG ou WebP · Max 5 Mo
            </p>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
                className="hidden" onChange={onFileChange} />
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
const AccountPage = () => {
    const { user, login } = useAuth();

    const [infoData,    setInfoData]    = useState({ name: '', email: '', phone: '' });
    const [infoLoading, setInfoLoading] = useState(false);

    const [photoFile,      setPhotoFile]      = useState(null);
    const [photoPreview,   setPhotoPreview]   = useState(null);
    const [photoUploading, setPhotoUploading] = useState(false);
    const [removePhoto,    setRemovePhoto]    = useState(false);

    const [passData,    setPassData]    = useState({ passwordCurrent: '', password: '', passwordConfirm: '' });
    const [passLoading, setPassLoading] = useState(false);
    const [errors,      setErrors]      = useState({});
    const [showFields,  setShowFields]  = useState({ current: false, newp: false, confirm: false });

    useEffect(() => {
        if (user) setInfoData({
            name:  user.name  || '',
            email: user.email || '',
            phone: user.phone || '',
        });
    }, [user]);

    useEffect(() => {
        return () => { if (photoPreview) URL.revokeObjectURL(photoPreview); };
    }, [photoPreview]);

    const handleInfoChange  = e => setInfoData(d => ({ ...d, [e.target.name]: e.target.value }));
    const handlePhoneChange = val => setInfoData(d => ({ ...d, phone: val }));

    const handleFileChange = e => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024)
            return toast.error('La photo ne doit pas dépasser 5 Mo.');
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
            return toast.error('Format non supporté. Utilisez JPG, PNG ou WebP.');
        setPhotoFile(file);
        setRemovePhoto(false);
        if (photoPreview) URL.revokeObjectURL(photoPreview);
        setPhotoPreview(URL.createObjectURL(file));
    };

    const handleRemovePhoto = () => {
        if (photoPreview) URL.revokeObjectURL(photoPreview);
        setPhotoFile(null);
        setPhotoPreview(null);
        setRemovePhoto(true);
    };

    const handlePassChange = e => {
        const { name, value } = e.target;
        setPassData(d => ({ ...d, [name]: value }));
        if (name === 'passwordConfirm') {
            setErrors(er => ({
                ...er,
                passwordConfirm: value && value !== passData.password
                    ? 'Les mots de passe ne correspondent pas.' : null,
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

    // ── Submit infos + photo ──────────────────────────────────
    const handleSubmitInfo = async e => {
        e.preventDefault();
        setInfoLoading(true);
        const tid = toast.loading('Mise à jour du profil...');
        try {
            let payload;
            if (photoFile || removePhoto) {
                const fd = new FormData();
                fd.append('name',  infoData.name);
                fd.append('email', infoData.email);
                if (infoData.phone) fd.append('phone', infoData.phone);
                if (photoFile)      fd.append('photo', photoFile);
                if (removePhoto)    fd.append('removePhoto', 'true');
                payload = fd;
            } else {
                payload = infoData; // JSON classique — Content-Type auto
            }

            // 🔧 userService retourne { success, user, message }
            const res = await updateMe(payload);
            if (res.success && res.user) {
                login(res.user, localStorage.getItem('token'));
                setPhotoFile(null);
                setPhotoPreview(null);
                setRemovePhoto(false);
                toast.success('Profil mis à jour avec succès !');
            } else {
                toast.error(res.message || 'Impossible de mettre à jour le profil.');
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
            // 🔧 userService retourne { success, user, token, message }
            const res = await updateMyPassword(passData);
            if (res.success && res.user) {
                if (res.token) localStorage.setItem('token', res.token);
                login(res.user, res.token || localStorage.getItem('token'));
                toast.success('Mot de passe changé avec succès !');
                setPassData({ passwordCurrent: '', password: '', passwordConfirm: '' });
                setErrors({});
            } else {
                toast.error(res.message || 'Erreur inattendue lors du changement de mot de passe.');
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

    const heroPhoto = photoPreview || user?.photo;

    if (!user) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="flex items-center gap-3 text-gray-500" style={{ fontFamily: "'Outfit', sans-serif" }}>
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: BLUE }} />
                Chargement du profil...
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Outfit', sans-serif" }}>
            <Toaster position="top-right" toastOptions={{
                style: { fontFamily: "'Outfit', sans-serif", borderRadius: '16px', fontSize: '14px' },
                success: { iconTheme: { primary: BLUE, secondary: '#fff' } },
            }} />

            {/* ── Hero ─────────────────────────────────────── */}
            <div className="relative py-16 text-white overflow-hidden"
                style={{ background: `linear-gradient(135deg, #0D1117 0%, #0e1e30 60%, #0D1117 100%)` }}>
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 right-1/3 w-64 h-64 rounded-full blur-[100px] opacity-10"
                        style={{ background: BLUE }} />
                    <div className="absolute bottom-0 left-1/4 w-48 h-48 rounded-full blur-[80px] opacity-6"
                        style={{ background: GOLD }} />
                </div>
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(to right, transparent, ${BLUE}50, transparent)` }} />

                <div className="container mx-auto max-w-4xl px-4 sm:px-6 relative z-10 text-center">
                    <motion.div
                        key={heroPhoto || 'default'}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.25 }}
                        className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center mx-auto mb-4"
                        style={{
                            background: heroPhoto ? 'transparent' : `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})`,
                            boxShadow:  `0 0 0 3px rgba(46,123,181,0.2), 0 8px 32px rgba(0,0,0,0.4)`,
                        }}
                    >
                        {heroPhoto
                            ? <img src={heroPhoto} alt="Avatar" className="w-full h-full object-cover" />
                            : <User className="w-9 h-9 text-white" />
                        }
                    </motion.div>

                    <h1 className="text-white mb-2"
                        style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700 }}>
                        Mon Compte
                    </h1>
                    <div className="h-0.5 w-12 rounded-full mx-auto mb-3"
                        style={{ background: `linear-gradient(to right, ${BLUE}, ${GOLD})` }} />
                    <div className="flex items-center justify-center gap-3 text-white/50 text-sm flex-wrap">
                        <span>{user.name} · {user.email}</span>
                        {user.phone && (
                            <>
                                <span className="opacity-30">·</span>
                                <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" /> {user.phone}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Contenu ──────────────────────────────────── */}
            <div className="container mx-auto max-w-4xl px-4 sm:px-6 py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                    {/* ── Infos profil ─────────────────────── */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">

                        <div className="px-7 py-5 border-b border-gray-100 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                                style={{ background: `${BLUE}12` }}>
                                <User className="w-4 h-4" style={{ color: BLUE }} />
                            </div>
                            <h2 className="font-bold text-gray-900 text-base"
                                style={{ fontFamily: "'Outfit', sans-serif" }}>
                                Informations du Profil
                            </h2>
                        </div>

                        <form onSubmit={handleSubmitInfo} className="px-7 py-6 space-y-5">

                            {/* Photo */}
                            <div className="pb-5 border-b border-gray-100">
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-3"
                                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                                    Photo de profil
                                </label>
                                <AvatarUpload
                                    user={user}
                                    preview={photoPreview}
                                    onFileChange={handleFileChange}
                                    onRemove={handleRemovePhoto}
                                    uploading={photoUploading}
                                />
                                <AnimatePresence>
                                    {(photoFile || removePhoto) && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -4 }}
                                            className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                                            style={{
                                                background: photoFile ? `${BLUE}08` : '#FEF2F2',
                                                color:      photoFile ? BLUE : '#EF4444',
                                                border:     `1px solid ${photoFile ? `${BLUE}18` : '#FECACA'}`,
                                                fontFamily: "'Outfit', sans-serif",
                                            }}
                                        >
                                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                                style={{ background: photoFile ? BLUE : '#EF4444' }} />
                                            {photoFile
                                                ? `Photo sélectionnée : ${photoFile.name}`
                                                : 'La photo sera supprimée à la sauvegarde'}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <InputField label="Nom complet" name="name" value={infoData.name}
                                onChange={handleInfoChange} placeholder="Votre nom complet" Icon={User} />

                            <InputField label="Adresse email" type="email" name="email" value={infoData.email}
                                onChange={handleInfoChange} placeholder="exemple@email.com" Icon={Mail} />

                            <PhoneField value={infoData.phone} onChange={handlePhoneChange} />

                            <motion.button type="submit" disabled={infoLoading}
                                whileHover={{ scale: infoLoading ? 1 : 1.02 }} whileTap={{ scale: 0.98 }}
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
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.08 }}
                        className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">

                        <div className="px-7 py-5 border-b border-gray-100 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                                style={{ background: `${GOLD}12` }}>
                                <Lock className="w-4 h-4" style={{ color: GOLD }} />
                            </div>
                            <h2 className="font-bold text-gray-900 text-base"
                                style={{ fontFamily: "'Outfit', sans-serif" }}>
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
                                whileHover={{ scale: passDisabled ? 1 : 1.02 }} whileTap={{ scale: 0.98 }}
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

                            <div className="flex items-start gap-2 pt-1">
                                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#F59E0B' }} />
                                <p className="text-xs text-gray-400 leading-relaxed"
                                    style={{ fontFamily: "'Outfit', sans-serif" }}>
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