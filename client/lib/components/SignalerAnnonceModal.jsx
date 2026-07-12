"use client";
import { useState } from 'react';
import { Flag, X, Upload, AlertTriangle, Loader2, CheckCircle } from 'lucide-react';
import api from '../services/api';

const BLUE = '#2E7BB5';

const RAISONS_SIGNALEMENT = [
  { value: 'prix_incorrect',      label: 'Prix incorrect ou trompeur' },
  { value: 'annonce_expiree',     label: 'Annonce déjà vendue / louée' },
  { value: 'photos_trompeuses',   label: 'Photos trompeuses' },
  { value: 'fraude',              label: 'Fraude suspectée' },
  { value: 'contenu_inapproprie', label: 'Contenu inapproprié' },
  { value: 'autre',               label: 'Autre raison' },
];

export default function SignalerAnnonceModal({ propertyId, onClose }) {
  const [raison,  setRaison]  = useState('');
  const [details, setDetails] = useState('');
  const [files,   setFiles]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);

  const handleFiles = e => {
    const selected = Array.from(e.target.files || []);
    const valid    = selected.filter(f => f.size <= 10 * 1024 * 1024);
    if (valid.length < selected.length) setError('Certains fichiers dépassent 10 MB et ont été ignorés.');
    setFiles(prev => [...prev, ...valid].slice(0, 5));
  };

  const removeFile = idx => setFiles(f => f.filter((_, i) => i !== idx));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!raison) { setError('Veuillez sélectionner un motif.'); return; }
    setLoading(true); setError('');

    try {
      const fd = new FormData();
      fd.append('propertyId', propertyId);
      fd.append('raison', raison);
      if (details) fd.append('details', details);
      files.forEach(f => fd.append('preuves', f));

      await api.post('/signalements', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Une erreur est survenue. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ fontFamily: "'DM Sans', sans-serif" }}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-red-500" />
            <p className="font-bold text-gray-900 text-sm">Signaler cette annonce</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <p className="font-semibold text-gray-900 mb-1">Signalement envoyé</p>
            <p className="text-sm text-gray-500 mb-5">Merci, notre équipe va examiner cette annonce.</p>
            <button onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: `linear-gradient(135deg, #1A5A8A, ${BLUE})` }}>
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium"
                style={{ backgroundColor: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)', color: '#DC2626' }}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Motif <span className="text-red-400">*</span>
              </label>
              <select value={raison} onChange={e => setRaison(e.target.value)} required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 text-sm focus:outline-none">
                <option value="">Sélectionner...</option>
                {RAISONS_SIGNALEMENT.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Détails (optionnel)
              </label>
              <textarea placeholder="Décrivez le problème…" value={details} rows={4} maxLength={500}
                onChange={e => setDetails(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 text-sm focus:outline-none resize-none" />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Preuves (optionnel)
              </label>
              <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 transition-colors">
                <Upload className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">Choisir des fichiers (PDF, JPG, PNG — max 10 MB)</span>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple className="hidden" onChange={handleFiles} />
              </label>
              {files.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                      <span className="text-xs text-gray-600 flex-1 truncate">{f.name}</span>
                      <button type="button" onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-400 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-white text-sm transition-all"
              style={{
                background: loading ? '#9CA3AF' : 'linear-gradient(135deg, #B45309, #D97706)',
                boxShadow:  loading ? 'none' : '0 4px 20px rgba(180,83,9,0.3)',
              }}>
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi en cours...</>
                : 'Envoyer le signalement'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
