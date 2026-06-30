'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, FileText, Loader2, User, Phone, AlertTriangle } from 'lucide-react';
import { contratHebergement } from '@/lib/data/contratHebergement';
import api from '@/lib/services/api';
import { useAuth } from '@/lib/context/AuthContext';

const BLUE      = '#2E7BB5';
const BLUE_DARK = '#1A5A8A';
const GOLD      = '#C8960C';

const CERTIFICATIONS_LIST = [
  { key: 'contratAccepte',       label: "J'ai lu et j'accepte intégralement le contrat d'hébergement d'Altitude Vision" },
  { key: 'informationsVraies',   label: 'Je certifie que toutes les informations fournies sont vraies, exactes et complètes' },
  { key: 'estProprietaireLegal', label: "Je certifie être le propriétaire légal ou l'apporteur d'affaires autorisé pour ces biens" },
  { key: 'engagementHonnetete',  label: "Je m'engage à être honnête et transparent dans toutes mes interactions avec la plateforme et les clients" },
  { key: 'commissionAcceptee',   label: "J'accepte les conditions de rémunération : je percevrai 30% de la commission reçue par Altitude Vision pour chaque location conclue via la plateforme" },
];

export default function CompleterProfil() {
  const { data: session, status } = useSession();
  const router  = useRouter();
  const { login } = useAuth();

  const [role, setRole] = useState('Client');
  const [form, setForm] = useState({ prenom: '', nom: '', telephone: '' });
  const [certifications, setCertifications] = useState({
    contratAccepte:       false,
    informationsVraies:   false,
    estProprietaireLegal: false,
    engagementHonnetete:  false,
    commissionAcceptee:   false,
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.name) {
      const parts = session.user.name.split(' ');
      setForm(prev => ({
        ...prev,
        prenom: parts[0] || '',
        nom:    parts.slice(1).join(' ') || '',
      }));
    }
  }, [session]);

  const isProprietaire = role === 'Proprietaire';
  const toutAccepte    = isProprietaire ? Object.values(certifications).every(Boolean) : true;
  const toggleC = key  => setCertifications(c => ({ ...c, [key]: !c[key] }));

  const handleSubmit = async () => {
    if (!form.prenom.trim() || !form.nom.trim() || !form.telephone.trim()) {
      return setError('Prénom, nom et téléphone sont requis.');
    }
    if (isProprietaire && !toutAccepte) {
      return setError('Veuillez cocher toutes les certifications.');
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.patch('/users/complete-profile', {
        prenom:    form.prenom.trim(),
        nom:       form.nom.trim(),
        telephone: form.telephone.trim(),
        role,
        ...(isProprietaire && { certifications }),
      });

      const updatedUser = res.data?.data?.user;
      if (updatedUser && session?.accessToken) {
        login(updatedUser, session.accessToken);
      }

      router.replace(isProprietaire ? '/mes-biens' : '/');
    } catch (err) {
      setError(err.response?.data?.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}>

      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-[140px]"
          style={{ background: BLUE, opacity: 0.07 }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-[120px]"
          style={{ background: GOLD, opacity: 0.05 }} />
      </div>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }} className="w-full max-w-lg relative z-10">

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">

          {/* En-tête */}
          <div className="px-8 pt-8 pb-6 text-center border-b border-gray-100">
            {session?.user?.image && (
              <img src={session.user.image} alt="avatar"
                className="w-16 h-16 rounded-full mx-auto mb-3 border-2 border-white shadow-md" />
            )}
            <h2 className="text-gray-900 mb-1"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.9rem', fontWeight: 700 }}>
              Bienvenue !
            </h2>
            <p className="text-sm text-gray-500">
              Complétez votre profil pour commencer.
            </p>
          </div>

          <div className="px-8 py-7 space-y-5">

            {/* Erreur */}
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2.5 px-4 py-3 rounded-2xl border text-sm font-medium overflow-hidden"
                  style={{ backgroundColor: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)', color: '#DC2626' }}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Prénom */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Prénom *</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input type="text" placeholder="Votre prénom" value={form.prenom}
                  onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-gray-900 text-sm focus:outline-none focus:border-blue-500 transition-all" />
              </div>
            </div>

            {/* Nom */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Nom *</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input type="text" placeholder="Votre nom de famille" value={form.nom}
                  onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-gray-900 text-sm focus:outline-none focus:border-blue-500 transition-all" />
              </div>
            </div>

            {/* Téléphone */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Téléphone *</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input type="tel" placeholder="+242 06 XXX XX XX" value={form.telephone}
                  onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-gray-900 text-sm focus:outline-none focus:border-blue-500 transition-all" />
              </div>
            </div>

            {/* Choix du rôle */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Je suis</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'Client',       label: '👤 Client',       desc: 'Recherche de bien' },
                  { value: 'Proprietaire', label: '🏠 Propriétaire', desc: 'Apporteur d\'affaires' },
                ].map(opt => (
                  <button key={opt.value} type="button" onClick={() => setRole(opt.value)}
                    className="rounded-2xl p-3 border-2 text-left transition-all"
                    style={{
                      borderColor:     role === opt.value ? BLUE : '#E5E7EB',
                      backgroundColor: role === opt.value ? `${BLUE}0D` : 'transparent',
                    }}>
                    <div className="text-sm font-semibold text-gray-800">{opt.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Contrat (Propriétaire) */}
            <AnimatePresence>
              {isProprietaire && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                  <div className="rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100"
                      style={{ background: `linear-gradient(135deg, ${BLUE_DARK}08, ${BLUE}06)` }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})` }}>
                        <FileText className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-800 uppercase tracking-wider">Contrat et certifications</p>
                        <p className="text-xs text-gray-400">Obligatoire pour les Propriétaires</p>
                      </div>
                    </div>
                    <div className="overflow-y-auto bg-gray-50 p-4 text-xs text-gray-600 leading-relaxed whitespace-pre-wrap border-b border-gray-100"
                      style={{ maxHeight: '250px', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                      {contratHebergement}
                    </div>
                    <div className="p-4 space-y-3 bg-white">
                      {CERTIFICATIONS_LIST.map(({ key, label }) => (
                        <label key={key} className="flex items-start gap-3 cursor-pointer">
                          <div onClick={() => toggleC(key)}
                            className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all cursor-pointer"
                            style={{
                              borderColor:     certifications[key] ? BLUE : '#D1D5DB',
                              backgroundColor: certifications[key] ? BLUE : 'transparent',
                            }}>
                            {certifications[key] && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                          </div>
                          <span className="text-xs text-gray-600 leading-relaxed select-none" onClick={() => toggleC(key)}>
                            {label} <span className="text-red-400">*</span>
                          </span>
                        </label>
                      ))}
                      <p className="text-xs text-gray-400 pt-1">* Tous les champs sont obligatoires</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bouton soumettre */}
            <motion.button
              onClick={handleSubmit}
              disabled={loading || !toutAccepte}
              whileHover={{ scale: (loading || !toutAccepte) ? 1 : 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-white text-sm transition-all"
              style={{
                background: (loading || !toutAccepte) ? '#9CA3AF' : `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})`,
                boxShadow:  (loading || !toutAccepte) ? 'none' : `0 4px 20px ${BLUE}35`,
                cursor:     !toutAccepte ? 'not-allowed' : 'pointer',
              }}>
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</>
                : 'Terminer mon inscription'}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
