"use client";

// src/components/EstimationForm.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calculator, Building2, MapPin, Maximize2, BedDouble,
    Wrench, CalendarClock, User, Mail, Phone, Send,
    Loader2, AlertTriangle, CheckCircle, X, ArrowRight, ArrowLeft,
} from 'lucide-react';
import api from '../services/api';
import { PROPERTY_TYPES } from '../constants/propertyTypes';

const GOLD      = '#C8960C';
const BLUE      = '#2E7BB5';
const BLUE_DARK = '#1A5A8A';

const TYPES_BIENS   = [...PROPERTY_TYPES, 'Autre'];
const ETATS_BIEN    = ['Neuf', 'Très bon état', 'Bon état', 'À rénover'];
const DISPONIBILITES= ['Immédiatement', 'Dans la semaine', 'Dans le mois', 'Flexible'];

const INITIAL = {
    nom: '', email: '', telephone: '',
    typeBien: '', transaction: 'vente', adresse: '',
    surface: '', chambres: '', etat: '',
    description: '', disponibilite: '',
};

// ── Champ input générique ─────────────────────────────────────
const Field = ({ label, error, icon: Icon, required, children }) => (
    <div>
        <label className="block text-xs text-white/50 mb-1.5 flex items-center gap-1">
            {Icon && <Icon className="w-3 h-3" />} {label} {required && <span className="text-red-400">*</span>}
        </label>
        {children}
        {error && (
            <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {error}
            </p>
        )}
    </div>
);

const inputCls = (err) =>
    `w-full px-4 py-3 rounded-xl text-sm border transition-all focus:outline-none bg-white/8 text-white placeholder-white/30 focus:border-[#2E7BB5]/60 ${err ? 'border-red-400' : 'border-white/12'}`;

const selectCls = (err) =>
    `w-full px-4 py-3 rounded-xl text-sm border transition-all focus:outline-none bg-white/10 focus:bg-white/15 text-white ${err ? 'border-red-400' : 'border-white/12'}`;

// ─────────────────────────────────────────────────────────────
const EstimationForm = () => {
    const [step,       setStep]       = useState(1);   // 1 = bien, 2 = coordonnées
    const [form,       setForm]       = useState(INITIAL);
    const [errors,     setErrors]     = useState({});
    const [sending,    setSending]    = useState(false);
    const [status,     setStatus]     = useState(null); // 'success' | 'error'

    const set = (k, v) => {
        setForm(f => ({ ...f, [k]: v }));
        if (errors[k]) setErrors(e => ({ ...e, [k]: null }));
    };

    // ── Validation étape 1 ────────────────────────────────────
    const validateStep1 = () => {
        const errs = {};
        if (!form.typeBien)       errs.typeBien = 'Sélectionnez un type de bien.';
        if (!form.adresse.trim()) errs.adresse  = "L'adresse est requise.";
        if (!form.surface.trim()) errs.surface  = 'La surface est requise.';
        return errs;
    };

    // ── Validation étape 2 ────────────────────────────────────
    const validateStep2 = () => {
        const errs = {};
        if (!form.nom.trim())   errs.nom   = 'Votre nom est requis.';
        if (!form.email.trim()) errs.email = 'Votre email est requis.';
        else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Email invalide.';
        return errs;
    };

    const goToStep2 = () => {
        const errs = validateStep1();
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }
        setErrors({});
        setStep(2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = validateStep2();
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }

        setSending(true);
        setStatus(null);
        try {
            await api.post('/estimation', form);
            setStatus('success');
            setForm(INITIAL);
            setStep(1);
        } catch {
            setStatus('error');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6 sm:p-8">

            {/* ── En-tête avec étapes ─────────────────── */}
            <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${GOLD}, #E5A84B)` }}>
                    <Calculator className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                    <h3 className="text-white font-bold text-base" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        {step === 1 ? 'Votre bien' : 'Vos coordonnées'}
                    </h3>
                    <p className="text-white/40 text-xs mt-0.5">Étape {step} sur 2</p>
                </div>
                {/* Indicateur de progression */}
                <div className="flex items-center gap-2">
                    {[1, 2].map(s => (
                        <div key={s} className="transition-all duration-300"
                            style={{
                                width:        s === step ? '24px' : '8px',
                                height:       '8px',
                                borderRadius: '4px',
                                background:   s === step ? GOLD : s < step ? '#22C55E' : 'rgba(255,255,255,0.2)',
                            }} />
                    ))}
                </div>
            </div>

            {/* Barre de progression */}
            <div className="h-0.5 bg-white/8 rounded-full mb-6 overflow-hidden">
                <motion.div className="h-full rounded-full"
                    animate={{ width: step === 1 ? '50%' : '100%' }}
                    transition={{ duration: 0.4, ease: 'easeInOut' }}
                    style={{ background: `linear-gradient(to right, ${GOLD}, #E5A84B)` }} />
            </div>

            {/* ── Succès ─────────────────────────────── */}
            <AnimatePresence>
                {status === 'success' && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center text-center py-8 px-4">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                            style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.3)' }}>
                            <CheckCircle className="w-8 h-8 text-green-400" />
                        </div>
                        <h4 className="text-white font-bold text-lg mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                            Demande envoyée !
                        </h4>
                        <p className="text-white/50 text-sm leading-relaxed max-w-xs">
                            Un email de confirmation vous a été envoyé. Notre équipe vous contactera sous <strong className="text-white/70">24h</strong>.
                        </p>
                        <button onClick={() => setStatus(null)}
                            className="mt-6 px-5 py-2.5 rounded-full text-sm font-semibold text-white/60 border border-white/10 hover:border-white/20 transition-all"
                            style={{ fontFamily: "'DM Sans', sans-serif" }}>
                            Nouvelle demande
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Formulaire ─────────────────────────── */}
            {status !== 'success' && (
                <form onSubmit={handleSubmit}>
                    <AnimatePresence mode="wait">

                        {/* ÉTAPE 1 — Infos du bien */}
                        {step === 1 && (
                            <motion.div key="step1"
                                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}
                                className="space-y-4">

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Type */}
                                    <Field label="Type de bien" error={errors.typeBien} icon={Building2} required>
                                        <select value={form.typeBien} onChange={e => set('typeBien', e.target.value)}
                                            className={selectCls(errors.typeBien)} style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                            <option value="" className="text-gray-900">Sélectionner...</option>
                                            {TYPES_BIENS.map(t => <option key={t} value={t} className="text-gray-900">{t}</option>)}
                                        </select>
                                    </Field>

                                    {/* Objectif */}
                                    <Field label="Objectif" icon={null}>
                                        <select value={form.transaction} onChange={e => set('transaction', e.target.value)}
                                            className={selectCls()} style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                            <option value="vente"    className="text-gray-900">Je veux vendre</option>
                                            <option value="location" className="text-gray-900">Je veux louer</option>
                                        </select>
                                    </Field>

                                    {/* Adresse */}
                                    <div className="sm:col-span-2">
                                        <Field label="Adresse / Quartier" error={errors.adresse} icon={MapPin} required>
                                            <div className="relative">
                                                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                                                <input type="text" placeholder="Ex: Bacongo, Brazzaville"
                                                    value={form.adresse} onChange={e => set('adresse', e.target.value)}
                                                    className={`${inputCls(errors.adresse)} pl-10`}
                                                    style={{ fontFamily: "'DM Sans', sans-serif" }} />
                                            </div>
                                        </Field>
                                    </div>

                                    {/* Surface */}
                                    <Field label="Surface (m²)" error={errors.surface} icon={Maximize2} required>
                                        <input type="number" min="1" placeholder="Ex: 120"
                                            value={form.surface} onChange={e => set('surface', e.target.value)}
                                            className={inputCls(errors.surface)} style={{ fontFamily: "'DM Sans', sans-serif" }} />
                                    </Field>

                                    {/* Chambres */}
                                    <Field label="Nombre de chambres" icon={BedDouble}>
                                        <input type="number" min="0" placeholder="Ex: 3"
                                            value={form.chambres} onChange={e => set('chambres', e.target.value)}
                                            className={inputCls()} style={{ fontFamily: "'DM Sans', sans-serif" }} />
                                    </Field>

                                    {/* État */}
                                    <Field label="État du bien" icon={Wrench}>
                                        <select value={form.etat} onChange={e => set('etat', e.target.value)}
                                            className={selectCls()} style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                            <option value="" className="text-gray-900">Sélectionner...</option>
                                            {ETATS_BIEN.map(e => <option key={e} value={e} className="text-gray-900">{e}</option>)}
                                        </select>
                                    </Field>

                                    {/* Disponibilité */}
                                    <Field label="Disponibilité" icon={CalendarClock}>
                                        <select value={form.disponibilite} onChange={e => set('disponibilite', e.target.value)}
                                            className={selectCls()} style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                            <option value="" className="text-gray-900">Sélectionner...</option>
                                            {DISPONIBILITES.map(d => <option key={d} value={d} className="text-gray-900">{d}</option>)}
                                        </select>
                                    </Field>

                                    {/* Description */}
                                    <div className="sm:col-span-2">
                                        <Field label="Informations complémentaires" icon={null}>
                                            <textarea rows={3} maxLength={500}
                                                placeholder="Piscine, parking, vue, rénovations récentes..."
                                                value={form.description} onChange={e => set('description', e.target.value)}
                                                className={`${inputCls()} resize-none`}
                                                style={{ fontFamily: "'DM Sans', sans-serif" }} />
                                            <p className="text-right text-white/20 text-xs mt-1">{form.description.length}/500</p>
                                        </Field>
                                    </div>
                                </div>

                                {/* CTA étape 1 */}
                                <motion.button type="button" onClick={goToStep2}
                                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-white text-sm mt-2"
                                    style={{ background: `linear-gradient(135deg, ${GOLD}, #E5A84B)`, boxShadow: `0 4px 24px ${GOLD}40`, fontFamily: "'DM Sans', sans-serif" }}>
                                    Continuer — Mes coordonnées
                                    <ArrowRight className="w-4 h-4" />
                                </motion.button>

                                <p className="text-center text-white/25 text-xs">Étape suivante : vos coordonnées pour recevoir l'estimation</p>
                            </motion.div>
                        )}

                        {/* ÉTAPE 2 — Coordonnées */}
                        {step === 2 && (
                            <motion.div key="step2"
                                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }}
                                className="space-y-4">

                                {/* Récap bien */}
                                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-2"
                                    style={{ background: 'rgba(200,135,42,0.08)', border: '1px solid rgba(200,135,42,0.15)' }}>
                                    <Building2 className="w-4 h-4 flex-shrink-0" style={{ color: GOLD }} />
                                    <div className="text-xs text-white/60 min-w-0">
                                        <span className="font-semibold text-white/80">{form.typeBien}</span>
                                        {form.surface && <span> · {form.surface} m²</span>}
                                        {form.adresse && <span> · {form.adresse}</span>}
                                    </div>
                                    <button type="button" onClick={() => setStep(1)}
                                        className="ml-auto text-white/30 hover:text-white/60 transition-colors flex-shrink-0 text-xs underline"
                                        style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                        Modifier
                                    </button>
                                </div>

                                <p className="text-white/50 text-sm">
                                    Parfait ! Où devons-nous envoyer votre estimation ?
                                </p>

                                <div className="space-y-4">
                                    {/* Nom */}
                                    <Field label="Nom complet" error={errors.nom} icon={User} required>
                                        <div className="relative">
                                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                                            <input type="text" placeholder="Votre nom complet"
                                                value={form.nom} onChange={e => set('nom', e.target.value)}
                                                className={`${inputCls(errors.nom)} pl-10`}
                                                style={{ fontFamily: "'DM Sans', sans-serif" }} />
                                        </div>
                                    </Field>

                                    {/* Email */}
                                    <Field label="Adresse email" error={errors.email} icon={Mail} required>
                                        <div className="relative">
                                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                                            <input type="email" placeholder="votre@email.com"
                                                value={form.email} onChange={e => set('email', e.target.value)}
                                                className={`${inputCls(errors.email)} pl-10`}
                                                style={{ fontFamily: "'DM Sans', sans-serif" }} />
                                        </div>
                                    </Field>

                                    {/* Téléphone */}
                                    <Field label="Téléphone (optionnel)" icon={Phone}>
                                        <div className="relative">
                                            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                                            <input type="tel" placeholder="+242 06 000 00 00"
                                                value={form.telephone} onChange={e => set('telephone', e.target.value)}
                                                className={`${inputCls()} pl-10`}
                                                style={{ fontFamily: "'DM Sans', sans-serif" }} />
                                        </div>
                                    </Field>
                                </div>

                                {/* Boutons navigation */}
                                <div className="flex gap-3 mt-2">
                                    <button type="button" onClick={() => setStep(1)}
                                        className="flex items-center gap-2 px-5 py-4 rounded-2xl font-semibold text-white/60 text-sm border border-white/10 hover:border-white/20 transition-all"
                                        style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                        <ArrowLeft className="w-4 h-4" /> Retour
                                    </button>

                                    <motion.button type="submit" disabled={sending}
                                        whileHover={{ scale: sending ? 1 : 1.02 }} whileTap={{ scale: 0.98 }}
                                        className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-white text-sm transition-all"
                                        style={{
                                            background: sending ? '#374151' : `linear-gradient(135deg, ${BLUE}, ${BLUE_DARK})`,
                                            boxShadow:  sending ? 'none' : `0 4px 24px ${BLUE}40`,
                                            cursor:     sending ? 'not-allowed' : 'pointer',
                                            fontFamily: "'DM Sans', sans-serif",
                                        }}>
                                        {sending
                                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi...</>
                                            : <><Send className="w-4 h-4" /> Recevoir mon estimation</>
                                        }
                                    </motion.button>
                                </div>

                                <p className="text-center text-white/25 text-xs">Gratuit · Sans engagement · Réponse sous 24h</p>

                                {/* Erreur envoi */}
                                <AnimatePresence>
                                    {status === 'error' && (
                                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                            className="flex items-start gap-3 p-4 rounded-2xl"
                                            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-red-300 font-semibold text-sm">Erreur lors de l'envoi</p>
                                                <p className="text-red-400/70 text-xs mt-0.5">Veuillez réessayer ou nous appeler au +242 06 800 21 51.</p>
                                            </div>
                                            <button onClick={() => setStatus(null)} className="ml-auto text-red-400/50 hover:text-red-300"><X className="w-4 h-4" /></button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </form>
            )}
        </div>
    );
};

export default EstimationForm;