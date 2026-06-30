"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Upload, X, CheckCircle, Loader2, Scale } from "lucide-react";
import { createLitige } from "../services/litigeService";

const BLUE = '#2E7BB5';
const GOLD = '#C8960C';

const TYPE_OPTIONS = [
  { value: 'Information_fausse',  label: 'Information fausse' },
  { value: 'Bien_inexistant',     label: 'Bien inexistant' },
  { value: 'Prix_non_respecté',   label: 'Prix non respecté' },
  { value: 'Arnaque',             label: 'Arnaque' },
  { value: 'Mauvaise_foi',        label: 'Mauvaise foi' },
  { value: 'Problème_paiement',   label: 'Problème de paiement' },
  { value: 'Autre',               label: 'Autre' },
];

const inputCls = "w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 text-sm focus:outline-none transition-all placeholder-gray-400";
const labelCls = "block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5";

const focusIn  = e => { e.target.style.borderColor = BLUE; e.target.style.boxShadow = `0 0 0 3px ${BLUE}15`; e.target.style.backgroundColor = '#fff'; };
const focusOut = e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; e.target.style.backgroundColor = '#F9FAFB'; };

// ─────────────────────────────────────────────────────────────
const SignalerLitigePage = () => {
  const searchParams = useSearchParams();
  const bienId       = searchParams.get('bien') || '';

  const [form, setForm] = useState({
    type:             '',
    description:      '',
    plaignantNom:     '',
    plaignantEmail:   '',
    plaignantTelephone: '',
    plaignantType:    'Client',
    bienConcerné:     bienId,
  });
  const [files,   setFiles]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (bienId) setForm(f => ({ ...f, bienConcerné: bienId }));
  }, [bienId]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFiles = e => {
    const selected = Array.from(e.target.files || []);
    const valid    = selected.filter(f => f.size <= 10 * 1024 * 1024);
    if (valid.length < selected.length) setError('Certains fichiers dépassent 10 MB et ont été ignorés.');
    setFiles(prev => [...prev, ...valid].slice(0, 5));
  };

  const removeFile = idx => setFiles(f => f.filter((_, i) => i !== idx));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.type || !form.description || !form.plaignantNom || !form.plaignantEmail) {
      return setError('Veuillez remplir tous les champs obligatoires.');
    }
    setLoading(true); setError('');

    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      files.forEach(f => fd.append('preuves', f));

      const res = await createLitige(fd);
      setSuccess(res.data?.litige?.reference || 'Enregistré');
    } catch (err) {
      setError(err.response?.data?.message || 'Une erreur est survenue. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  // ── Succès ──────────────────────────────────────────────────
  if (success) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'linear-gradient(135deg, #059669, #10B981)' }}>
          <CheckCircle className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}>
          Signalement enregistré
        </h2>
        <p className="text-gray-500 text-sm mb-3">Votre dossier a été créé avec la référence :</p>
        <div className="inline-block px-5 py-2 rounded-xl font-bold text-white mb-5"
          style={{ background: `linear-gradient(135deg, #1A5A8A, ${BLUE})` }}>
          {success}
        </div>
        <p className="text-gray-500 text-sm mb-6">
          Vous recevrez un accusé de réception par email.<br />
          Notre équipe vous répondra <strong>sous 48 heures</strong>.
        </p>
        <Link href="/"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: `linear-gradient(135deg, #1A5A8A, ${BLUE})` }}>
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}>

      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, #B45309, #D97706)' }}>
            <Scale className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Signaler un problème
          </h1>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Vous avez rencontré un problème avec un bien ou une transaction ?
            Notre équipe intervient <strong>sous 48h</strong>.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">

          <div className="px-4 py-3 flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #FEF3C7, #FFFBEB)', borderBottom: '1px solid #FDE68A' }}>
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              Vous recevrez un accusé de réception par email avec votre numéro de dossier.
              Nous vous répondrons sous 48 heures.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-5">

            {error && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium"
                style={{ backgroundColor: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)', color: '#DC2626' }}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Type */}
            <div>
              <label className={labelCls}>Type de problème <span className="text-red-400">*</span></label>
              <select value={form.type} onChange={e => set('type', e.target.value)} required
                className={inputCls} onFocus={focusIn} onBlur={focusOut}>
                <option value="">Sélectionner...</option>
                {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Bien concerné */}
            <div>
              <label className={labelCls}>Bien concerné (optionnel)</label>
              <input type="text" placeholder="ID ou titre du bien" value={form.bienConcerné}
                onChange={e => set('bienConcerné', e.target.value)}
                className={inputCls} onFocus={focusIn} onBlur={focusOut} />
            </div>

            {/* Séparateur */}
            <div className="pt-1 pb-1">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Vos coordonnées</p>
              <div className="h-px bg-gray-100 mt-2" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Votre nom <span className="text-red-400">*</span></label>
                <input type="text" placeholder="Nom complet" value={form.plaignantNom} required
                  onChange={e => set('plaignantNom', e.target.value)}
                  className={inputCls} onFocus={focusIn} onBlur={focusOut} />
              </div>
              <div>
                <label className={labelCls}>Votre email <span className="text-red-400">*</span></label>
                <input type="email" placeholder="email@exemple.com" value={form.plaignantEmail} required
                  onChange={e => set('plaignantEmail', e.target.value)}
                  className={inputCls} onFocus={focusIn} onBlur={focusOut} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Téléphone</label>
                <input type="tel" placeholder="+242 06 000 00 00" value={form.plaignantTelephone}
                  onChange={e => set('plaignantTelephone', e.target.value)}
                  className={inputCls} onFocus={focusIn} onBlur={focusOut} />
              </div>
              <div>
                <label className={labelCls}>Vous êtes <span className="text-red-400">*</span></label>
                <select value={form.plaignantType} onChange={e => set('plaignantType', e.target.value)}
                  className={inputCls} onFocus={focusIn} onBlur={focusOut}>
                  <option value="Client">Client</option>
                  <option value="Propriétaire">Propriétaire</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className={labelCls}>Description du problème <span className="text-red-400">*</span></label>
              <textarea placeholder="Décrivez le problème en détail..." value={form.description} required
                onChange={e => set('description', e.target.value)} rows={5}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 text-sm focus:outline-none transition-all placeholder-gray-400 resize-none"
                onFocus={focusIn} onBlur={focusOut} />
            </div>

            {/* Preuves */}
            <div>
              <label className={labelCls}>Preuves (optionnel)</label>
              <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 transition-colors">
                <Upload className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">Choisir des fichiers (PDF, JPG, PNG — max 10 MB)</span>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple className="hidden"
                  onChange={handleFiles} />
              </label>
              {files.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                      <span className="text-xs text-gray-600 flex-1 truncate">{f.name}</span>
                      <button type="button" onClick={() => removeFile(i)}
                        className="text-gray-400 hover:text-red-400 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-white text-sm transition-all mt-2"
              style={{
                background: loading ? '#9CA3AF' : 'linear-gradient(135deg, #B45309, #D97706)',
                boxShadow:  loading ? 'none' : '0 4px 20px rgba(180,83,9,0.3)',
                fontFamily: "'DM Sans', sans-serif",
              }}>
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi en cours...</>
                : <><Scale className="w-4 h-4" /> Soumettre le signalement</>}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
};

export default SignalerLitigePage;
