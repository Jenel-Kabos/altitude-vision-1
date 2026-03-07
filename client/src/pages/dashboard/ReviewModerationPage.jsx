import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star, MessageSquare, Reply, Trash2, Eye, Filter,
  Loader2, AlertCircle, X, Calendar, User, CheckCircle, Search,
} from 'lucide-react';
import api from '../../services/api';

const BLUE = '#2E7BB5';
const RED  = '#D42B2B';
const GOLD = '#C8872A';

const POLE_META = {
  Altimmo:   { color: BLUE, bg: `${BLUE}15`,  label: 'Altimmo' },
  MilaEvents:{ color: RED,  bg: `${RED}15`,   label: 'Mila Events' },
  Altcom:    { color: GOLD, bg: `${GOLD}15`,  label: 'Altcom' },
};

// ─── Toast ────────────────────────────────────────────────────
const Toast = ({ msg, type, onDone }) => {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  const bg = type === 'success' ? '#16A34A' : '#DC2626';
  return (
    <motion.div initial={{ opacity:0, y:-40 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-40 }}
      className="fixed top-5 right-5 z-[100] px-5 py-3.5 rounded-xl shadow-xl text-white text-sm font-medium"
      style={{ background: bg, fontFamily:"'Outfit', sans-serif" }}>
      {msg}
    </motion.div>
  );
};

// ─── ConfirmDialog ────────────────────────────────────────────
const ConfirmDialog = ({ message, onConfirm, onCancel, variant = 'red' }) => {
  const accent = variant === 'red' ? RED : BLUE;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity:0, scale:0.92 }} animate={{ opacity:1, scale:1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: `${accent}18` }}>
          <AlertCircle size={22} style={{ color: accent }} />
        </div>
        <p className="text-center text-gray-700 text-sm mb-6 leading-relaxed"
          style={{ fontFamily:"'Outfit', sans-serif" }}>{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition"
            style={{ fontFamily:"'Outfit', sans-serif" }}>
            Annuler
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition hover:opacity-90"
            style={{ background: accent, fontFamily:"'Outfit', sans-serif" }}>
            Confirmer
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Stars ────────────────────────────────────────────────────
const Stars = ({ rating, size = 14 }) => (
  <div className="flex gap-0.5">
    {[1,2,3,4,5].map(s => (
      <Star key={s} size={size}
        className={s <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
    ))}
  </div>
);

// ─── Avatar ───────────────────────────────────────────────────
const Avatar = ({ user, size = 40 }) => {
  const letter = user?.name?.charAt(0).toUpperCase() || 'U';
  return user?.photo
    ? <img src={user.photo} alt={user.name}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width:size, height:size }} />
    : <div className="rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold"
        style={{ width:size, height:size, background:`linear-gradient(135deg, ${BLUE}, ${GOLD})`,
          fontSize: size * 0.38, fontFamily:"'Outfit', sans-serif" }}>
        {letter}
      </div>;
};

// ─── Review Card ──────────────────────────────────────────────
const ReviewCard = ({ review, onClick }) => {
  const meta = POLE_META[review.pole] || POLE_META.Altimmo;
  return (
    <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}
      whileHover={{ y:-3 }} transition={{ duration:0.2 }}
      onClick={() => onClick(review)}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 cursor-pointer hover:shadow-md transition-all flex flex-col gap-3">

      <div className="flex items-center justify-between">
        <span className="text-xs font-bold px-3 py-1 rounded-full"
          style={{ background: meta.bg, color: meta.color, fontFamily:"'Outfit', sans-serif" }}>
          {meta.label}
        </span>
        <Stars rating={review.rating} />
      </div>

      <div className="flex items-center gap-2.5">
        <Avatar user={review.author} size={36} />
        <div className="min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate"
            style={{ fontFamily:"'Outfit', sans-serif" }}>
            {review.author?.name || 'Utilisateur'}
          </p>
          <p className="text-xs text-gray-400" style={{ fontFamily:"'Outfit', sans-serif" }}>
            {new Date(review.createdAt).toLocaleDateString('fr-FR')}
          </p>
        </div>
      </div>

      <p className="text-sm text-gray-600 line-clamp-3 italic leading-relaxed"
        style={{ fontFamily:"'Outfit', sans-serif" }}>
        « {review.comment} »
      </p>

      <div className="flex items-center gap-2 pt-2 border-t border-gray-50 mt-auto">
        {review.adminResponse && (
          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
            style={{ background:'#16A34A18', color:'#16A34A', fontFamily:"'Outfit', sans-serif" }}>
            <Reply size={10} /> Répondu
          </span>
        )}
        {review.rating === 5 && (
          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
            style={{ background:'#F59E0B18', color:'#D97706', fontFamily:"'Outfit', sans-serif" }}>
            <Star size={10} className="fill-current" /> Excellent
          </span>
        )}
        <span className="ml-auto text-xs font-semibold flex items-center gap-1"
          style={{ color: BLUE, fontFamily:"'Outfit', sans-serif" }}>
          <Eye size={12} /> Voir
        </span>
      </div>
    </motion.div>
  );
};

// ─── Detail Modal ─────────────────────────────────────────────
const DetailModal = ({ review, onClose, onDelete, onDeleteResponse, onSubmitResponse }) => {
  const [response, setResponse] = useState('');
  const [focused, setFocused] = useState(false);
  const meta = POLE_META[review.pole] || POLE_META.Altimmo;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity:0, scale:0.94 }} animate={{ opacity:1, scale:1 }}
        exit={{ opacity:0, scale:0.94 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold px-3 py-1 rounded-full"
              style={{ background: meta.bg, color: meta.color, fontFamily:"'Outfit', sans-serif" }}>
              {meta.label}
            </span>
            <Stars rating={review.rating} size={16} />
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Auteur */}
          <div className="flex items-center gap-4">
            <Avatar user={review.author} size={52} />
            <div>
              <p className="font-bold text-gray-900 text-base"
                style={{ fontFamily:"'Cormorant Garamond', serif" }}>
                {review.author?.name || 'Utilisateur'}
              </p>
              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"
                style={{ fontFamily:"'Outfit', sans-serif" }}>
                <Calendar size={11} />
                {new Date(review.createdAt).toLocaleDateString('fr-FR', {
                  day:'numeric', month:'long', year:'numeric'
                })}
              </p>
            </div>
          </div>

          {/* Commentaire */}
          <div className="rounded-xl p-4" style={{ background:`${BLUE}08` }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: BLUE, fontFamily:"'Outfit', sans-serif" }}>
              Commentaire
            </p>
            <p className="text-gray-700 text-sm leading-relaxed italic"
              style={{ fontFamily:"'Outfit', sans-serif" }}>
              « {review.comment} »
            </p>
          </div>

          {/* Réponse admin existante */}
          {review.adminResponse && (
            <div className="rounded-xl p-4 border-l-4" style={{ background:'#16A34A0A', borderColor:'#16A34A' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"
                  style={{ color:'#16A34A', fontFamily:"'Outfit', sans-serif" }}>
                  <Reply size={12} /> Réponse administration
                </p>
                <button onClick={() => onDeleteResponse(review._id)}
                  className="text-gray-400 hover:text-red-500 transition p-1 rounded">
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="text-gray-700 text-sm leading-relaxed"
                style={{ fontFamily:"'Outfit', sans-serif" }}>
                {review.adminResponse.text}
              </p>
              <p className="text-xs text-gray-400 mt-2" style={{ fontFamily:"'Outfit', sans-serif" }}>
                Par {review.adminResponse.respondedBy?.name || 'Admin'} ·{' '}
                {new Date(review.adminResponse.respondedAt).toLocaleDateString('fr-FR')}
              </p>
            </div>
          )}

          {/* Formulaire réponse */}
          {!review.adminResponse && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5"
                style={{ color: BLUE, fontFamily:"'Outfit', sans-serif" }}>
                <Reply size={12} /> Répondre à cet avis
              </p>
              <textarea
                value={response}
                onChange={e => setResponse(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                rows={3}
                placeholder="Votre réponse en tant qu'administrateur..."
                className="w-full rounded-xl border text-sm p-3 resize-none outline-none transition-all"
                style={{
                  fontFamily:"'Outfit', sans-serif",
                  borderColor: focused ? BLUE : '#E2E8F0',
                  boxShadow: focused ? `0 0 0 3px ${BLUE}20` : 'none',
                }} />
              <button
                onClick={() => { if (response.trim()) { onSubmitResponse(review._id, response); onClose(); } }}
                className="mt-2 flex items-center gap-2 text-white text-sm font-semibold px-5 py-2 rounded-xl transition hover:opacity-90"
                style={{ background:`linear-gradient(135deg, #1A5A8A, ${BLUE})`, fontFamily:"'Outfit', sans-serif" }}>
                <Reply size={14} /> Publier la réponse
              </button>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button onClick={() => onDelete(review._id)}
            className="flex items-center gap-2 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition hover:opacity-90"
            style={{ background:`linear-gradient(135deg, #991B1B, ${RED})`, fontFamily:"'Outfit', sans-serif" }}>
            <Trash2 size={15} /> Supprimer l'avis
          </button>
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-white transition"
            style={{ fontFamily:"'Outfit', sans-serif" }}>
            Fermer
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── MAIN ────────────────────────────────────────────────────
const ReviewModerationPage = () => {
  const [reviews, setReviews]         = useState([]);
  const [filtered, setFiltered]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [selectedReview, setSelected] = useState(null);
  const [selectedPole, setPole]       = useState('Tous');
  const [search, setSearch]           = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [stats, setStats]             = useState({ total:0, Altimmo:0, MilaEvents:0, Altcom:0 });
  const [confirm, setConfirm]         = useState(null);
  const [toast, setToast]             = useState(null);

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reviews', { params: { limit:1000, sort:'-createdAt' } });
      let data = [];
      if (Array.isArray(res.data))                                    data = res.data;
      else if (Array.isArray(res.data?.data))                         data = res.data.data;
      else if (Array.isArray(res.data?.data?.reviews))                data = res.data.data.reviews;
      else if (Array.isArray(res.data?.reviews))                      data = res.data.reviews;
      else {
        const found = Object.values(res.data?.data || res.data || {}).find(Array.isArray);
        if (found) data = found;
      }
      setReviews(data);
      setStats({
        total:      data.length,
        Altimmo:    data.filter(r => r.pole === 'Altimmo').length,
        MilaEvents: data.filter(r => r.pole === 'MilaEvents').length,
        Altcom:     data.filter(r => r.pole === 'Altcom').length,
      });
    } catch {
      setError('Impossible de charger les avis.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReviews(); }, []);

  useEffect(() => {
    let data = selectedPole === 'Tous' ? reviews : reviews.filter(r => r.pole === selectedPole);
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(r =>
        r.author?.name?.toLowerCase().includes(q) ||
        r.comment?.toLowerCase().includes(q)
      );
    }
    setFiltered(data);
  }, [selectedPole, search, reviews]);

  const handleDelete = (id) => {
    setConfirm({
      message: 'Supprimer cet avis ? Cette action est irréversible.',
      variant: 'red',
      onConfirm: async () => {
        setConfirm(null);
        try {
          await api.delete(`/reviews/${id}`);
          const updated = reviews.filter(r => r._id !== id);
          setReviews(updated);
          setSelected(null);
          showToast('Avis supprimé avec succès.');
        } catch {
          showToast('Erreur lors de la suppression.', 'error');
        }
      },
    });
  };

  const handleDeleteResponse = (reviewId) => {
    setConfirm({
      message: 'Supprimer votre réponse à cet avis ?',
      variant: 'red',
      onConfirm: async () => {
        setConfirm(null);
        try {
          await api.delete(`/reviews/${reviewId}/admin-response`);
          setReviews(reviews.map(r =>
            r._id === reviewId ? { ...r, adminResponse: undefined } : r
          ));
          setSelected(null);
          showToast('Réponse supprimée.');
        } catch {
          showToast('Erreur lors de la suppression.', 'error');
        }
      },
    });
  };

  const handleSubmitResponse = async (reviewId, text) => {
    if (!text.trim()) { showToast('La réponse ne peut pas être vide.', 'error'); return; }
    try {
      await api.patch(`/reviews/${reviewId}/admin-response`, { responseText: text });
      await fetchReviews();
      showToast('Réponse publiée avec succès.');
    } catch {
      showToast('Erreur lors de la publication.', 'error');
    }
  };

  const poles = ['Tous', 'Altimmo', 'MilaEvents', 'Altcom'];

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <Loader2 size={36} className="animate-spin" style={{ color: BLUE }} />
    </div>
  );

  if (error) return (
    <div className="p-6">
      <div className="flex items-center gap-3 p-4 rounded-xl border"
        style={{ background:`${RED}08`, borderColor:`${RED}30` }}>
        <AlertCircle size={20} style={{ color: RED }} />
        <p className="text-sm" style={{ color: RED, fontFamily:"'Outfit', sans-serif" }}>{error}</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <AnimatePresence>
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      </AnimatePresence>

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          variant={confirm.variant}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background:`${BLUE}18` }}>
          <MessageSquare size={22} style={{ color: BLUE }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900"
            style={{ fontFamily:"'Cormorant Garamond', serif" }}>
            Modération des Avis
          </h1>
          <p className="text-xs text-gray-400" style={{ fontFamily:"'Outfit', sans-serif" }}>
            {stats.total} avis au total
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Total',      value:stats.total,      color:'#7C3AED' },
          { label:'Altimmo',    value:stats.Altimmo,    color:BLUE      },
          { label:'Mila Events',value:stats.MilaEvents, color:RED       },
          { label:'Altcom',     value:stats.Altcom,     color:GOLD      },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold uppercase tracking-wide mb-1"
              style={{ color, fontFamily:"'Outfit', sans-serif" }}>{label}</p>
            <p className="text-3xl font-extrabold text-gray-900"
              style={{ fontFamily:"'Outfit', sans-serif" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filtres + Recherche */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter size={15} className="text-gray-400 flex-shrink-0" />
          {poles.map(pole => {
            const meta = POLE_META[pole];
            const isActive = selectedPole === pole;
            return (
              <button key={pole} onClick={() => setPole(pole)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
                style={{
                  background: isActive ? (meta?.color || BLUE) : '#F1F5F9',
                  color:      isActive ? '#fff'                 : '#64748B',
                  fontFamily:"'Outfit', sans-serif",
                }}>
                {pole === 'Tous' ? 'Tous' : meta?.label}
                {pole !== 'Tous' && (
                  <span className="ml-1.5 opacity-70">{stats[pole]}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative sm:ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Rechercher auteur, commentaire…"
            className="pl-8 pr-4 py-2 text-sm rounded-xl border outline-none transition-all w-64"
            style={{
              fontFamily:"'Outfit', sans-serif",
              borderColor: searchFocused ? BLUE : '#E2E8F0',
              boxShadow:   searchFocused ? `0 0 0 3px ${BLUE}20` : 'none',
            }} />
        </div>
      </div>

      {/* Grille */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-3xl border-2 border-dashed border-gray-200">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background:`${BLUE}12` }}>
            <MessageSquare size={26} style={{ color: BLUE }} />
          </div>
          <p className="text-gray-500 font-semibold" style={{ fontFamily:"'Outfit', sans-serif" }}>
            Aucun avis {selectedPole !== 'Tous' ? `pour ${selectedPole}` : ''}
          </p>
          {search && (
            <button onClick={() => setSearch('')}
              className="mt-3 text-xs font-semibold px-4 py-1.5 rounded-full"
              style={{ background:`${BLUE}15`, color:BLUE, fontFamily:"'Outfit', sans-serif" }}>
              Réinitialiser la recherche
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(review => (
            <ReviewCard key={review._id} review={review} onClick={setSelected} />
          ))}
        </div>
      )}

      {/* Modal détail */}
      <AnimatePresence>
        {selectedReview && (
          <DetailModal
            review={selectedReview}
            onClose={() => setSelected(null)}
            onDelete={handleDelete}
            onDeleteResponse={handleDeleteResponse}
            onSubmitResponse={handleSubmitResponse}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReviewModerationPage;