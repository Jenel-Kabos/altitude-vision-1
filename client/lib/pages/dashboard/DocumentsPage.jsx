"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
  FileText, FilePlus, Trash2, ExternalLink, Search, Filter,
  ChevronLeft, ChevronRight, Loader2, AlertCircle, X, Check,
  FileCheck, Receipt, ScrollText, ClipboardCheck, FolderOpen,
  Calendar, User, DollarSign, Eye,
} from 'lucide-react';
import {
  getAllDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
} from '../../services/documentService';
import api from '../../services/api';

const GOLD     = '#C8960C';
const BLUE     = '#2E7BB5';
const INK      = '#111827';
const SURFACE  = '#F8F8F8';
const PER_PAGE = 12;

// ── Tab config ────────────────────────────────────────────────
const TABS = [
  { key: 'Tous',              label: 'Tous',               Icon: FolderOpen,      color: BLUE      },
  { key: 'Devis',             label: 'Devis',               Icon: FileText,        color: GOLD      },
  { key: 'Facture',           label: 'Factures',            Icon: Receipt,         color: '#0D9488' },
  { key: 'Contrat',           label: 'Contrats',            Icon: ScrollText,      color: '#7C3AED' },
  { key: 'Etat des Lieux',    label: 'États des Lieux',     Icon: ClipboardCheck,  color: '#DC2626' },
  { key: "Pièce d'identité",  label: "Pièces d'identité",   Icon: User,            color: '#EA580C' },
];

// ── Status config ─────────────────────────────────────────────
const STATUS_CFG = {
  'Brouillon': { label: 'Brouillon', bg: '#F3F4F6', text: '#6B7280',  dot: '#9CA3AF'  },
  'Envoyé':    { label: 'Envoyé',    bg: '#EFF6FF', text: BLUE,        dot: BLUE       },
  'Accepté':   { label: 'Accepté',   bg: '#F0FDF4', text: '#16A34A',   dot: '#16A34A'  },
  'Refusé':    { label: 'Refusé',    bg: '#FEF2F2', text: '#DC2626',   dot: '#DC2626'  },
  'Payé':      { label: 'Payé',      bg: '#F0FDF4', text: '#15803D',   dot: '#15803D'  },
  'En retard': { label: 'En retard', bg: '#FFF7ED', text: '#EA580C',   dot: '#EA580C'  },
};
const STATUSES = Object.keys(STATUS_CFG);

const TYPE_ICONS = {
  'Devis':             { Icon: FileText,       color: GOLD        },
  'Facture':           { Icon: Receipt,        color: '#0D9488'   },
  'Contrat':           { Icon: ScrollText,     color: '#7C3AED'   },
  'Etat des Lieux':    { Icon: ClipboardCheck, color: '#DC2626'   },
  "Pièce d'identité": { Icon: User,            color: '#EA580C'   },
};

// ── Helpers ───────────────────────────────────────────────────
const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

const fmtMoney = (n) => n != null
  ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(n)
  : null;

// ── Status badge ──────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CFG[status] || STATUS_CFG['Brouillon'];
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.text, fontFamily: "'DM Sans', sans-serif" }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
};

// ── Stat card ─────────────────────────────────────────────────
const StatCard = ({ label, value, Icon, color }) => (
  <div className="bg-white rounded-xl p-4 flex items-center gap-3"
    style={{ border: '1px solid rgba(17,24,39,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
      style={{ background: `${color}18` }}>
      <Icon size={17} style={{ color }} />
    </div>
    <div>
      <p className="text-2xl font-bold" style={{ color: INK, fontFamily: "'Cormorant Garamond', serif", lineHeight: 1 }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: '#6B7280', fontFamily: "'DM Sans', sans-serif" }}>{label}</p>
    </div>
  </div>
);

// ── Create / Edit modal ───────────────────────────────────────
const DocModal = ({ doc, clients, onClose, onSaved }) => {
  const isEdit = !!doc;
  const [form, setForm] = useState(doc || {
    type: 'Devis', status: 'Brouillon', client: '', notes: '',
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    items: [{ description: '', quantity: 1, unitPrice: 0, total: 0 }],
    content: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const needsItems   = form.type === 'Devis' || form.type === 'Facture';
  const needsContent = form.type === 'Contrat' || form.type === 'Etat des Lieux';

  const updateItem = (i, k, v) => {
    const items = [...(form.items || [])];
    items[i] = { ...items[i], [k]: v };
    if (k === 'quantity' || k === 'unitPrice') {
      items[i].total = (Number(items[i].quantity) || 0) * (Number(items[i].unitPrice) || 0);
    }
    set('items', items);
  };
  const addItem    = () => set('items', [...(form.items || []), { description: '', quantity: 1, unitPrice: 0, total: 0 }]);
  const removeItem = (i) => set('items', form.items.filter((_, idx) => idx !== i));

  const subTotal    = (form.items || []).reduce((s, it) => s + (Number(it.total) || 0), 0);
  const totalAmount = subTotal + (Number(form.tax) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.client) { toast.error('Veuillez sélectionner un client'); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      if (needsItems) {
        payload.subTotal    = subTotal;
        payload.totalAmount = totalAmount;
      }
      const saved = isEdit
        ? await updateDocument(doc._id, payload)
        : await createDocument(payload);
      toast.success(isEdit ? 'Document mis à jour' : 'Document créé');
      onSaved(saved);
    } catch {
      toast.error('Une erreur est survenue');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:border-blue-400 transition-colors";
  const labelCls = "block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            {isEdit ? 'Modifier le document' : 'Nouveau document'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Type + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} className={inputCls}>
                <option value="Devis">Devis</option>
                <option value="Facture">Facture</option>
                <option value="Contrat">Contrat</option>
                <option value="Etat des Lieux">État des Lieux</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Statut</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
              </select>
            </div>
          </div>

          {/* Client */}
          <div>
            <label className={labelCls}>Client</label>
            <select value={form.client?._id || form.client || ''} onChange={e => set('client', e.target.value)} className={inputCls} required>
              <option value="">Sélectionner un client…</option>
              {clients.map(c => <option key={c._id} value={c._id}>{c.name} — {c.email}</option>)}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Date d'émission</label>
              <input type="date" value={form.issueDate?.slice(0,10) || ''} onChange={e => set('issueDate', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Date d'échéance</label>
              <input type="date" value={form.dueDate?.slice(0,10) || ''} onChange={e => set('dueDate', e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Items (Devis / Facture) */}
          {needsItems && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelCls}>Lignes</label>
                <button type="button" onClick={addItem}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors"
                  style={{ color: BLUE, background: `${BLUE}12` }}>
                  + Ajouter
                </button>
              </div>
              <div className="space-y-2">
                {(form.items || []).map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input placeholder="Description" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)}
                      className={`${inputCls} col-span-5`} required />
                    <input type="number" min="1" placeholder="Qté" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)}
                      className={`${inputCls} col-span-2`} />
                    <input type="number" min="0" placeholder="P.U." value={item.unitPrice} onChange={e => updateItem(i, 'unitPrice', e.target.value)}
                      className={`${inputCls} col-span-3`} />
                    <span className="col-span-1 text-xs text-gray-500 text-right">{fmtMoney(item.total)?.replace('XAF','')}</span>
                    <button type="button" onClick={() => removeItem(i)} className="col-span-1 flex justify-center text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end gap-6">
                <div className="text-right">
                  <p className="text-xs text-gray-500">Sous-total</p>
                  <p className="text-sm font-semibold text-gray-800">{fmtMoney(subTotal)}</p>
                </div>
                <div className="text-right">
                  <label className="text-xs text-gray-500 block">TVA / Taxes</label>
                  <input type="number" min="0" value={form.tax || 0} onChange={e => set('tax', Number(e.target.value))}
                    className="w-24 px-2 py-1 text-xs border border-gray-200 rounded-lg bg-gray-50 text-right" />
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-base font-bold" style={{ color: GOLD }}>{fmtMoney(totalAmount)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Content (Contrat / EdL) */}
          {needsContent && (
            <div>
              <label className={labelCls}>Contenu / Clauses</label>
              <textarea rows={8} value={form.content || ''} onChange={e => set('content', e.target.value)}
                placeholder="Rédigez le contenu du document…"
                className={`${inputCls} resize-y`} />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes internes</label>
            <textarea rows={2} value={form.notes || ''} onChange={e => set('notes', e.target.value)}
              placeholder="Notes visibles uniquement par l'équipe…"
              className={`${inputCls} resize-none`} />
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white flex items-center gap-2 transition-opacity disabled:opacity-60"
            style={{ background: `linear-gradient(135deg, #A06820, ${GOLD})` }}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Confirm delete modal ───────────────────────────────────────
const DeleteModal = ({ doc, onClose, onDeleted }) => {
  const [loading, setLoading] = useState(false);
  const confirm = async () => {
    setLoading(true);
    try {
      await deleteDocument(doc._id);
      toast.success('Document supprimé');
      onDeleted(doc._id);
    } catch {
      toast.error('Erreur lors de la suppression');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: '#FEF2F2' }}>
          <Trash2 size={20} style={{ color: '#DC2626' }} />
        </div>
        <h3 className="text-base font-bold text-gray-900 mb-1">Supprimer ce document ?</h3>
        <p className="text-sm text-gray-500 mb-6">Cette action est irréversible.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onClose} className="px-5 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
            Annuler
          </button>
          <button onClick={confirm} disabled={loading}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-60"
            style={{ background: '#DC2626' }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Supprimer
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Document row ──────────────────────────────────────────────
const DocRow = ({ doc, onEdit, onDelete }) => {
  const { Icon, color } = TYPE_ICONS[doc.type] || { Icon: FileText, color: GOLD };
  const clientName = doc.refNom || doc.client?.name || '—';
  const hasAmount  = doc.totalAmount > 0;

  return (
    <motion.tr layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="border-b border-gray-100 hover:bg-gray-50 transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}15` }}>
            <Icon size={15} style={{ color }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate"
              style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {doc.type} #{doc.docNumber || doc._id?.slice(-4)}
            </p>
            <p className="text-xs text-gray-400 truncate">{doc.notes?.slice(0,40) || '—'}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <User size={13} className="text-gray-400 flex-shrink-0" />
          <span className="truncate max-w-[140px]">{clientName}</span>
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <Calendar size={13} className="text-gray-400" />
          {fmtDate(doc.issueDate)}
        </div>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        {hasAmount
          ? <span className="text-sm font-semibold" style={{ color: GOLD }}>{fmtMoney(doc.totalAmount)}</span>
          : <span className="text-sm text-gray-400">—</span>}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={doc.status} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {doc.content && doc.content.startsWith('http') && (
            <a href={doc.content} target="_blank" rel="noopener noreferrer" title="Voir le fichier"
              className="p-1.5 rounded-lg hover:bg-orange-50 text-gray-400 hover:text-orange-500 transition-colors">
              <ExternalLink size={15} />
            </a>
          )}
          <button onClick={() => onEdit(doc)} title="Détail / Modifier"
            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
            <Eye size={15} />
          </button>
          <button onClick={() => onDelete(doc)} title="Supprimer"
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </motion.tr>
  );
};

// ── Main page ─────────────────────────────────────────────────
const DocumentsPage = () => {
  const [docs,       setDocs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [clients,    setClients]    = useState([]);
  const [activeTab,  setActiveTab]  = useState('Tous');
  const [search,     setSearch]     = useState('');
  const [statusFil,  setStatusFil]  = useState('Tous');
  const [page,       setPage]       = useState(1);
  const [editDoc,    setEditDoc]    = useState(null);   // null = closed, false = new, obj = edit
  const [deleteDoc,  setDeleteDoc]  = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllDocuments();
      setDocs(data);
    } catch {
      setError('Impossible de charger les documents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/users').then(r => setClients(r.data?.data?.users || [])).catch(() => {});
  }, []);

  // ── Filtering ─────────────────────────────────────────────
  const filtered = docs.filter(d => {
    if (activeTab !== 'Tous' && d.type !== activeTab) return false;
    if (statusFil !== 'Tous' && d.status !== statusFil)  return false;
    if (search) {
      const q = search.toLowerCase();
      const name = (d.refNom || d.client?.name || '').toLowerCase();
      const num  = String(d.docNumber || '');
      const note = (d.notes || '').toLowerCase();
      if (!name.includes(q) && !num.includes(q) && !note.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [activeTab, search, statusFil]);

  // ── Stats ─────────────────────────────────────────────────
  const stats = {
    total:    docs.length,
    devis:    docs.filter(d => d.type === 'Devis').length,
    factures: docs.filter(d => d.type === 'Facture').length,
    contrats: docs.filter(d => d.type === 'Contrat').length,
  };

  const tabCounts = Object.fromEntries(
    TABS.map(t => [t.key, t.key === 'Tous' ? docs.length : docs.filter(d => d.type === t.key).length])
  );

  // ── Handlers ──────────────────────────────────────────────
  const handleSaved = (saved) => {
    setDocs(prev => {
      const idx = prev.findIndex(d => d._id === saved._id);
      return idx >= 0 ? prev.map(d => d._id === saved._id ? saved : d) : [saved, ...prev];
    });
    setEditDoc(null);
  };

  const handleDeleted = (id) => {
    setDocs(prev => prev.filter(d => d._id !== id));
    setDeleteDoc(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Documents
          </h1>
          <p className="text-sm text-gray-500 mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Contrats, factures, devis et états des lieux
          </p>
        </div>
        <button onClick={() => setEditDoc(false)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: `linear-gradient(135deg, #A06820, ${GOLD})`, fontFamily: "'DM Sans', sans-serif" }}>
          <FilePlus size={16} />
          Nouveau document
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total"    value={stats.total}    Icon={FolderOpen}      color={BLUE}      />
        <StatCard label="Devis"    value={stats.devis}    Icon={FileText}        color={GOLD}      />
        <StatCard label="Factures" value={stats.factures} Icon={Receipt}         color='#0D9488'   />
        <StatCard label="Contrats" value={stats.contrats} Icon={ScrollText}      color='#7C3AED'   />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(17,24,39,0.07)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div className="flex overflow-x-auto border-b border-gray-100">
          {TABS.map(({ key, label, Icon, color }) => {
            const active = activeTab === key;
            return (
              <button key={key} onClick={() => setActiveTab(key)}
                className="flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 flex-shrink-0"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  borderBottomColor: active ? color : 'transparent',
                  color: active ? color : '#6B7280',
                  background: active ? `${color}08` : 'transparent',
                }}>
                <Icon size={14} />
                {label}
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: active ? `${color}20` : '#F3F4F6', color: active ? color : '#9CA3AF' }}>
                  {tabCounts[key]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-gray-100">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par client, numéro, note…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-800 focus:outline-none focus:border-blue-300 transition-colors"
              style={{ fontFamily: "'DM Sans', sans-serif" }} />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400 flex-shrink-0" />
            <select value={statusFil} onChange={e => setStatusFil(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg bg-gray-50 px-3 py-2 text-gray-700 focus:outline-none"
              style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <option value="Tous">Tous les statuts</option>
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
            </select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
            <Loader2 size={22} className="animate-spin" />
            <span className="text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>Chargement…</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 gap-3">
            <AlertCircle size={20} className="text-red-400" />
            <span className="text-sm text-red-500">{error}</span>
            <button onClick={load} className="text-sm text-blue-500 underline">Réessayer</button>
          </div>
        ) : paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: `${GOLD}12` }}>
              <FileText size={24} style={{ color: GOLD }} />
            </div>
            <p className="text-sm font-semibold text-gray-600 mb-1">Aucun document trouvé</p>
            <p className="text-xs text-gray-400">
              {search || statusFil !== 'Tous' ? 'Modifiez vos filtres' : 'Créez votre premier document'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Document', 'Client', 'Date', 'Montant', 'Statut', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {paginated.map(doc => (
                    <DocRow key={doc._id} doc={doc}
                      onEdit={d => setEditDoc(d)}
                      onDelete={d => setDeleteDoc(d)} />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {filtered.length} document{filtered.length > 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors text-gray-600">
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className="w-7 h-7 rounded-lg text-xs font-semibold transition-colors"
                  style={{
                    background: p === page ? GOLD : 'transparent',
                    color: p === page ? '#fff' : '#6B7280',
                    fontFamily: "'DM Sans', sans-serif",
                  }}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors text-gray-600">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {editDoc !== null && (
          <DocModal
            doc={editDoc || null}
            clients={clients}
            onClose={() => setEditDoc(null)}
            onSaved={handleSaved} />
        )}
        {deleteDoc && (
          <DeleteModal
            doc={deleteDoc}
            onClose={() => setDeleteDoc(null)}
            onDeleted={handleDeleted} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default DocumentsPage;
