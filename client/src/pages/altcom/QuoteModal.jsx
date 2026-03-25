// src/pages/altcom/QuoteModal.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, X, Send, Loader2 } from 'lucide-react';
import { GOLD, GOLD_DARK, PROJECT_TYPES, BUDGETS } from './altcomData';

const inputCls  = "w-full px-4 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-gray-900 text-sm transition-all focus:outline-none focus:bg-white placeholder-gray-400";
const focusGold = e => { e.target.style.borderColor = GOLD; e.target.style.boxShadow = `0 0 0 3px ${GOLD}15`; };
const blurGold  = e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; };

const QuoteModal = ({ serviceTitle, onClose, onSubmit }) => {
    const [form, setForm] = useState({
        name: '', email: '', phone: '', service: serviceTitle,
        projectType: 'Communication Digitale', budget: '', description: '',
        source: 'Altcom',
    });
    const [loading, setLoading] = useState(false);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name || !form.email || !form.description || !form.projectType) {
            alert('Veuillez remplir tous les champs obligatoires.');
            return;
        }
        setLoading(true);
        try { await onSubmit(form); onClose(); }
        catch (err) { alert(err.message || "Erreur lors de l'envoi."); }
        finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 40 }}
                className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl relative max-h-[92vh] overflow-y-auto"
            >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-100 px-7 py-5 flex items-center justify-between z-10 rounded-t-3xl">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{ background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})` }}>
                            <MessageSquare className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 text-lg leading-tight"
                                style={{ fontFamily: "'Outfit', sans-serif" }}>
                                Demander un devis
                            </h3>
                            <p className="text-xs text-gray-400" style={{ fontFamily: "'Outfit', sans-serif" }}>
                                {serviceTitle}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={loading}
                        className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-7 space-y-4">
                    {/* Type projet */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            Type de projet <span className="text-red-400">*</span>
                        </label>
                        <select value={form.projectType} onChange={e => set('projectType', e.target.value)}
                            className={inputCls} style={{ fontFamily: "'Outfit', sans-serif" }}
                            onFocus={focusGold} onBlur={blurGold}>
                            {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    {/* Nom + Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5"
                                style={{ fontFamily: "'Outfit', sans-serif" }}>
                                Nom complet <span className="text-red-400">*</span>
                            </label>
                            <input type="text" placeholder="Votre nom"
                                value={form.name} onChange={e => set('name', e.target.value)}
                                required className={inputCls} style={{ fontFamily: "'Outfit', sans-serif" }}
                                onFocus={focusGold} onBlur={blurGold} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5"
                                style={{ fontFamily: "'Outfit', sans-serif" }}>
                                Email <span className="text-red-400">*</span>
                            </label>
                            <input type="email" placeholder="votre@email.com"
                                value={form.email} onChange={e => set('email', e.target.value)}
                                required className={inputCls} style={{ fontFamily: "'Outfit', sans-serif" }}
                                onFocus={focusGold} onBlur={blurGold} />
                        </div>
                    </div>

                    {/* Téléphone + Budget */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5"
                                style={{ fontFamily: "'Outfit', sans-serif" }}>Téléphone</label>
                            <input type="tel" placeholder="+242 06 000 00 00"
                                value={form.phone} onChange={e => set('phone', e.target.value)}
                                className={inputCls} style={{ fontFamily: "'Outfit', sans-serif" }}
                                onFocus={focusGold} onBlur={blurGold} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5"
                                style={{ fontFamily: "'Outfit', sans-serif" }}>Budget estimé</label>
                            <select value={form.budget} onChange={e => set('budget', e.target.value)}
                                className={inputCls} style={{ fontFamily: "'Outfit', sans-serif" }}
                                onFocus={focusGold} onBlur={blurGold}>
                                {BUDGETS.map(b => <option key={b.v} value={b.v}>{b.l}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            Description du projet <span className="text-red-400">*</span>
                        </label>
                        <textarea rows={4} maxLength={1000} placeholder="Décrivez votre projet..."
                            value={form.description} onChange={e => set('description', e.target.value)}
                            required className={`${inputCls} resize-none`}
                            style={{ fontFamily: "'Outfit', sans-serif" }}
                            onFocus={focusGold} onBlur={blurGold} />
                        <p className="text-right text-xs text-gray-400 mt-1"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            {form.description.length}/1000
                        </p>
                    </div>

                    <motion.button type="submit" disabled={loading}
                        whileHover={{ scale: loading ? 1 : 1.02 }} whileTap={{ scale: 0.98 }}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-white text-sm transition-all"
                        style={{
                            background: loading ? '#9CA3AF' : `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`,
                            boxShadow:  loading ? 'none' : `0 4px 20px ${GOLD}40`,
                            fontFamily: "'Outfit', sans-serif",
                        }}>
                        {loading
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi...</>
                            : <><Send className="w-4 h-4" /> Envoyer ma demande</>
                        }
                    </motion.button>
                </form>
            </motion.div>
        </div>
    );
};

export default QuoteModal;