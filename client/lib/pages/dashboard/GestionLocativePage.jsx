"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Building, Users, Home, FileText, CreditCard,
  Plus, Pencil, Trash2, X, ChevronRight, Check,
  AlertCircle, Loader2, Eye, RefreshCw, Camera,
} from "lucide-react";
import {
  getProprietaires, createProprietaire, updateProprietaire, deleteProprietaire,
  getLocataires,    createLocataire,    updateLocataire,    deleteLocataire,
  getContrats,      createContrat,      updateContrat,      deleteContrat,
  getPaiements,     updatePaiement,
  addBienPhotos,
} from "../../services/gestionLocativeService";
import { getAllProperties } from "../../services/propertyService";

// ── Palette ──────────────────────────────────────────────────
const BLUE   = '#2E7BB5';
const GOLD   = '#C8872A';
const GREEN  = '#16A34A';
const RED    = '#D42B2B';
const GRAY   = '#94A3B8';
const FONT   = "'Outfit', sans-serif";

const MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const BIEN_TYPES = ['Appartement','Maison','Villa','Terrain','Bureau','Commerce','Entrepôt'];
const BIEN_STATUTS = ['Disponible','Loué','Vendu','En travaux','Réservé'];
const STATUT_COLORS = {
  Disponible: GREEN, Loué: BLUE, Vendu: GRAY, 'En travaux': GOLD, Réservé: '#EAB308',
};

const fmt = (n) => n ? Number(n).toLocaleString('fr-FR') + ' FCFA' : '—';

// ── Toast ─────────────────────────────────────────────────────
const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);
  return { toasts, push };
};

const ToastContainer = ({ toasts }) => (
  <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
    {toasts.map(t => (
      <div key={t.id}
        className="px-4 py-3 rounded-xl shadow-xl text-white text-sm font-semibold flex items-center gap-2 pointer-events-auto"
        style={{ background: t.type === 'error' ? RED : t.type === 'warning' ? GOLD : GREEN, fontFamily: FONT }}>
        {t.type === 'error' ? <AlertCircle size={15}/> : <Check size={15}/>}
        {t.message}
      </div>
    ))}
  </div>
);

// ── Badges ────────────────────────────────────────────────────
const TypeBadge = ({ type }) => (
  <span className="text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
    style={{ color: type==='location'?BLUE:GREEN, background: type==='location'?`${BLUE}15`:`${GREEN}15`, fontFamily:FONT }}>
    {type === 'location' ? 'Location' : 'Vente'}
  </span>
);

const StatutBadge = ({ statut }) => {
  const map = { actif:{color:GREEN,label:'Actif'}, résilié:{color:GRAY,label:'Résilié'}, expiré:{color:RED,label:'Expiré'}, en_attente:{color:GOLD,label:'En attente'} };
  const { color, label } = map[statut] || { color:GRAY, label:statut };
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ color, background:`${color}15`, fontFamily:FONT }}>{label}</span>
  );
};

const PaiementBadge = ({ statut }) => {
  const map = { 'payé':{color:GREEN,emoji:'✅'}, 'en_retard':{color:GOLD,emoji:'⏰'}, 'impayé':{color:RED,emoji:'❌'}, 'partiel':{color:BLUE,emoji:'🔵'} };
  const { color, emoji } = map[statut] || { color:GRAY, emoji:'—' };
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ color, background:`${color}15`, fontFamily:FONT }}>{emoji} {statut}</span>
  );
};

// ── Modal wrapper ─────────────────────────────────────────────
const Modal = ({ title, onClose, children, wide = false }) => (
  <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 overflow-y-auto p-4 md:p-8">
    <div className={`bg-white rounded-2xl shadow-2xl w-full my-4 ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-bold text-gray-900" style={{ fontFamily:FONT }}>{title}</h2>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-all"><X size={18}/></button>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  </div>
);

// ── Primitives UI ─────────────────────────────────────────────
const Field = ({ label, required, children }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-600 mb-1" style={{fontFamily:FONT}}>
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent bg-gray-50 disabled:opacity-40";
const Input    = (props) => <input  {...props} className={`${inputCls} ${props.className||''}`} style={{fontFamily:FONT,...props.style}}/>;
const Select   = (props) => <select {...props} className={`${inputCls} ${props.className||''}`} style={{fontFamily:FONT,...props.style}}/>;
const Textarea = (props) => <textarea {...props} rows={3} className={`${inputCls} resize-none ${props.className||''}`} style={{fontFamily:FONT,...props.style}}/>;

const Toggle = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-3 cursor-pointer">
    <div onClick={() => onChange(!checked)}
      className="relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0"
      style={{ background: checked ? BLUE : '#E2E8F0' }}>
      <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
        style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}/>
    </div>
    <span className="text-sm text-gray-700" style={{fontFamily:FONT}}>{label}</span>
  </label>
);

const SectionTitle = ({ children }) => (
  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 pt-3 pb-1 border-b border-gray-100" style={{fontFamily:FONT}}>{children}</h3>
);

const Btn = ({ onClick, color=BLUE, children, small=false, outline=false, loading=false, type='button' }) => (
  <button type={type} onClick={onClick} disabled={loading}
    className={`flex items-center gap-1.5 font-semibold rounded-xl transition-all hover:opacity-90 disabled:opacity-50 ${
      small ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
    } ${outline ? 'border' : 'text-white'}`}
    style={{ fontFamily:FONT, background: outline?'transparent':color, color: outline?color:'white', borderColor: outline?color:undefined }}>
    {loading ? <Loader2 size={14} className="animate-spin"/> : children}
  </button>
);

const TRow = ({ children, onClick }) => (
  <tr onClick={onClick}
    className={`border-b border-gray-50 transition-colors ${onClick ? 'cursor-pointer hover:bg-blue-50/40' : 'hover:bg-gray-50'}`}>
    {children}
  </tr>
);
const TD = ({ children, bold=false }) => (
  <td className={`px-4 py-3 text-sm ${bold?'font-semibold text-gray-900':'text-gray-600'}`} style={{fontFamily:FONT}}>{children}</td>
);
const TH = ({ children }) => (
  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">{children}</th>
);

const Actions = ({ onView, onEdit, onDelete }) => (
  <td className="px-4 py-3">
    <div className="flex items-center gap-1">
      {onView && (
        <button onClick={e => { e.stopPropagation(); onView(); }}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all"><Eye size={14}/></button>
      )}
      <button onClick={e => { e.stopPropagation(); onEdit(); }}
        className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-all"><Pencil size={14}/></button>
      <button onClick={e => { e.stopPropagation(); onDelete(); }}
        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={14}/></button>
    </div>
  </td>
);

// ── PhotoGrid ─────────────────────────────────────────────────
// photos: [{ type:'existing', url } | { type:'new', file, preview }]
const PhotoGrid = ({ photos = [], onAdd, onRemove, onReorder }) => {
  const [dragIdx, setDragIdx]   = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const inputRef = useRef();

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo, i) => (
          <div key={i} draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={e => { e.preventDefault(); setDragOver(i); }}
            onDrop={() => { onReorder(dragIdx, i); setDragIdx(null); setDragOver(null); }}
            onDragEnd={() => { setDragIdx(null); setDragOver(null); }}
            className={`relative aspect-square rounded-xl overflow-hidden bg-gray-100 cursor-grab select-none border-2 transition-all ${
              dragOver === i ? 'border-blue-400 scale-[1.04]' : 'border-transparent'
            }`}>
            <img src={photo.type==='existing' ? photo.url : photo.preview}
              className="w-full h-full object-cover" alt={`Photo ${i+1}`}/>
            {i === 0 && (
              <span className="absolute top-1 left-1 text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-md font-bold" style={{fontFamily:FONT}}>
                Principal
              </span>
            )}
            <button type="button" onClick={() => onRemove(i)}
              className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs leading-none hover:bg-red-600 transition-all">
              ×
            </button>
          </div>
        ))}
        {/* Bouton ajout */}
        <label className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all">
          <input ref={inputRef} type="file" multiple accept="image/*" className="hidden"
            onChange={e => { onAdd(Array.from(e.target.files)); e.target.value = ''; }}/>
          <Camera size={22} className="text-gray-300 mb-1"/>
          <span className="text-xs text-gray-400" style={{fontFamily:FONT}}>Photo</span>
        </label>
      </div>
      {photos.length > 0 && (
        <p className="text-xs text-gray-400" style={{fontFamily:FONT}}>
          Glissez pour réordonner · Première photo = principale
        </p>
      )}
    </div>
  );
};

// ── BienCard (accordion) ──────────────────────────────────────
const emptyBien = {
  titre:'', type:'Appartement', adresse:'', ville:'Brazzaville', quartier:'',
  superficie:'', nombrePieces:'', nombreChambres:'', nombreSDB:'', etage:'',
  description:'', statut:'Disponible', prixLoyer:'', prixVente:'', charges:'',
  _photos:[],
};

const BienCard = ({ bien, index, expanded, onToggle, onChange, onRemove }) => {
  const set = (k, v) => onChange({ ...bien, [k]: v });

  const addPhotos = (files) => {
    const added = files.map(f => ({ type:'new', file:f, preview: URL.createObjectURL(f) }));
    onChange({ ...bien, _photos: [...(bien._photos||[]), ...added] });
  };

  const removePhoto = (i) => {
    const next = [...(bien._photos||[])];
    if (next[i]?.type === 'new') URL.revokeObjectURL(next[i].preview);
    next.splice(i, 1);
    onChange({ ...bien, _photos: next });
  };

  const reorderPhotos = (from, to) => {
    if (from === null || from === to) return;
    const next = [...(bien._photos||[])];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange({ ...bien, _photos: next });
  };

  const statutColor = STATUT_COLORS[bien.statut] || GRAY;

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {/* Header accordion */}
      <button type="button" onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-all text-left">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statutColor }}/>
          <span className="font-semibold text-gray-800 text-sm" style={{fontFamily:FONT}}>
            Bien {index+1}{bien.titre ? ` — ${bien.titre}` : ''}
            {bien.type ? <span className="ml-2 font-normal text-gray-400 text-xs">({bien.type})</span> : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ color: statutColor, background:`${statutColor}15`, fontFamily:FONT }}>
            {bien.statut}
          </span>
          {(bien._photos||[]).length > 0 && (
            <span className="text-xs text-gray-400">{(bien._photos||[]).length} photo{(bien._photos||[]).length>1?'s':''}</span>
          )}
          <ChevronRight size={16} className={`text-gray-400 transition-transform duration-200 ${expanded?'rotate-90':''}`}/>
        </div>
      </button>

      {/* Body accordion */}
      {expanded && (
        <div className="p-4 space-y-3 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Titre" required><Input value={bien.titre} onChange={e=>set('titre',e.target.value)} placeholder="Ex: Appartement Bacongo"/></Field>
            <Field label="Type">
              <Select value={bien.type} onChange={e=>set('type',e.target.value)}>
                {BIEN_TYPES.map(t=><option key={t}>{t}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Adresse" required><Input value={bien.adresse} onChange={e=>set('adresse',e.target.value)}/></Field>
            <Field label="Ville" required><Input value={bien.ville} onChange={e=>set('ville',e.target.value)}/></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quartier"><Input value={bien.quartier} onChange={e=>set('quartier',e.target.value)}/></Field>
            <Field label="Superficie (m²)"><Input type="number" min="0" value={bien.superficie} onChange={e=>set('superficie',e.target.value)}/></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Pièces"><Input type="number" min="0" value={bien.nombrePieces} onChange={e=>set('nombrePieces',e.target.value)}/></Field>
            <Field label="Chambres"><Input type="number" min="0" value={bien.nombreChambres} onChange={e=>set('nombreChambres',e.target.value)}/></Field>
            <Field label="SDB"><Input type="number" min="0" value={bien.nombreSDB} onChange={e=>set('nombreSDB',e.target.value)}/></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Étage"><Input type="number" value={bien.etage} onChange={e=>set('etage',e.target.value)}/></Field>
            <Field label="Statut">
              <Select value={bien.statut} onChange={e=>set('statut',e.target.value)}>
                {BIEN_STATUTS.map(s=><option key={s}>{s}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Loyer/mois (FCFA)">
              <Input type="number" min="0" value={bien.prixLoyer}
                onChange={e=>set('prixLoyer',e.target.value)}
                disabled={bien.statut==='Vendu'}
                placeholder={bien.statut==='Vendu'?'Non applicable':''}/>
            </Field>
            <Field label="Prix vente (FCFA)">
              <Input type="number" min="0" value={bien.prixVente}
                onChange={e=>set('prixVente',e.target.value)}
                disabled={bien.statut==='Loué'}
                placeholder={bien.statut==='Loué'?'Non applicable':''}/>
            </Field>
          </div>
          <Field label="Charges (FCFA)"><Input type="number" min="0" value={bien.charges} onChange={e=>set('charges',e.target.value)}/></Field>
          <Field label="Description"><Textarea value={bien.description} onChange={e=>set('description',e.target.value)}/></Field>

          {/* Photos */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2" style={{fontFamily:FONT}}>
              Photos du bien
            </p>
            <PhotoGrid
              photos={bien._photos||[]}
              onAdd={addPhotos}
              onRemove={removePhoto}
              onReorder={reorderPhotos}
            />
          </div>

          <button type="button" onClick={onRemove}
            className="flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-600 transition-colors pt-1"
            style={{fontFamily:FONT}}>
            <Trash2 size={13}/> Supprimer ce bien
          </button>
        </div>
      )}
    </div>
  );
};

// ── ProprietaireForm ──────────────────────────────────────────
const emptyProp = { nom:'', prenom:'', email:'', telephone:'', adresse:'', ville:'', notes:'', pieceIdentite:null };

const initBienFromDB = (b) => ({
  titre:          b.titre || '',
  type:           b.type || 'Appartement',
  adresse:        b.adresse || '',
  ville:          b.ville || 'Brazzaville',
  quartier:       b.quartier || '',
  superficie:     b.superficie ?? '',
  nombrePieces:   b.nombrePieces ?? '',
  nombreChambres: b.nombreChambres ?? '',
  nombreSDB:      b.nombreSDB ?? '',
  etage:          b.etage ?? '',
  description:    b.description || '',
  statut:         b.statut || 'Disponible',
  prixLoyer:      b.prixLoyer ?? '',
  prixVente:      b.prixVente ?? '',
  charges:        b.charges ?? '',
  _photos:        (b.photos||[]).map(url => ({ type:'existing', url })),
});

const ProprietaireForm = ({ init = emptyProp, initBiens = [], onSave, onCancel, loading }) => {
  const [f, setF]         = useState(init);
  const [biens, setBiens] = useState(initBiens.map(initBienFromDB));
  const [expanded, setExpanded] = useState(new Set(initBiens.length > 0 ? [0] : []));

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const toggleExpanded = (i) => {
    const next = new Set(expanded);
    next.has(i) ? next.delete(i) : next.add(i);
    setExpanded(next);
  };

  const addBien = () => {
    const idx = biens.length;
    setBiens(p => [...p, { ...emptyBien }]);
    setExpanded(p => new Set([...p, idx]));
  };

  const updateBien = (i, updated) => setBiens(p => p.map((b, idx) => idx===i ? updated : b));

  const removeBien = (i) => {
    setBiens(p => p.filter((_, idx) => idx!==i));
    const next = new Set([...expanded].filter(n => n !== i).map(n => n > i ? n-1 : n));
    setExpanded(next);
  };

  return (
    <div className="space-y-4">
      <SectionTitle>Informations personnelles</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nom" required><Input value={f.nom} onChange={e=>set('nom',e.target.value)}/></Field>
        <Field label="Prénom" required><Input value={f.prenom} onChange={e=>set('prenom',e.target.value)}/></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email"><Input type="email" value={f.email} onChange={e=>set('email',e.target.value)}/></Field>
        <Field label="Téléphone" required><Input value={f.telephone} onChange={e=>set('telephone',e.target.value)}/></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Adresse"><Input value={f.adresse} onChange={e=>set('adresse',e.target.value)}/></Field>
        <Field label="Ville"><Input value={f.ville} onChange={e=>set('ville',e.target.value)}/></Field>
      </div>
      <Field label="Pièce d'identité">
        <input type="file" accept="image/*,application/pdf"
          onChange={e=>set('pieceIdentite', e.target.files[0]||null)}
          className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 cursor-pointer"/>
      </Field>
      <Field label="Notes"><Textarea value={f.notes} onChange={e=>set('notes',e.target.value)}/></Field>

      {/* Biens */}
      <SectionTitle>Biens immobiliers ({biens.length})</SectionTitle>

      {biens.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-3" style={{fontFamily:FONT}}>
          Aucun bien ajouté. Cliquez sur "+ Ajouter un bien".
        </p>
      )}

      <div className="space-y-3">
        {biens.map((bien, i) => (
          <BienCard key={i} bien={bien} index={i}
            expanded={expanded.has(i)}
            onToggle={() => toggleExpanded(i)}
            onChange={updated => updateBien(i, updated)}
            onRemove={() => removeBien(i)}/>
        ))}
      </div>

      <button type="button" onClick={addBien}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm font-semibold text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-all"
        style={{fontFamily:FONT}}>
        <Plus size={16}/> Ajouter un bien
      </button>

      <div className="flex gap-3 pt-2">
        <Btn onClick={() => onSave(f, biens)} loading={loading}>Enregistrer</Btn>
        <Btn onClick={onCancel} outline color={GRAY}>Annuler</Btn>
      </div>
    </div>
  );
};

// ── LocataireForm ─────────────────────────────────────────────
const emptyLoc = { nom:'', prenom:'', email:'', telephone:'', adresse:'', ville:'', profession:'', revenuMensuel:'', notes:'', pieceIdentite:null };

const LocataireForm = ({ init = emptyLoc, onSave, onCancel, loading }) => {
  const [f, setF] = useState(init);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nom" required><Input value={f.nom} onChange={e=>set('nom',e.target.value)}/></Field>
        <Field label="Prénom" required><Input value={f.prenom} onChange={e=>set('prenom',e.target.value)}/></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email"><Input type="email" value={f.email} onChange={e=>set('email',e.target.value)}/></Field>
        <Field label="Téléphone" required><Input value={f.telephone} onChange={e=>set('telephone',e.target.value)}/></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Adresse"><Input value={f.adresse} onChange={e=>set('adresse',e.target.value)}/></Field>
        <Field label="Ville"><Input value={f.ville} onChange={e=>set('ville',e.target.value)}/></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Profession"><Input value={f.profession} onChange={e=>set('profession',e.target.value)}/></Field>
        <Field label="Revenu mensuel (FCFA)"><Input type="number" value={f.revenuMensuel} onChange={e=>set('revenuMensuel',e.target.value)}/></Field>
      </div>
      <Field label="Pièce d'identité">
        <input type="file" accept="image/*,application/pdf"
          onChange={e=>set('pieceIdentite',e.target.files[0]||null)}
          className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 cursor-pointer"/>
      </Field>
      <Field label="Notes"><Textarea value={f.notes} onChange={e=>set('notes',e.target.value)}/></Field>
      <div className="flex gap-3 pt-2">
        <Btn onClick={() => onSave(f)} loading={loading}>Enregistrer</Btn>
        <Btn onClick={onCancel} outline color={GRAY}>Annuler</Btn>
      </div>
    </div>
  );
};

// ── ContratForm ───────────────────────────────────────────────
const emptyContrat = {
  type:'location', bien:'', proprietaire:'', adresseBien:'', villeBien:'', statut:'en_attente',
  locataire:'', dateEntree:'', dateFinBail:'', dureePreavis:1,
  montantLoyer:'', montantCaution:'', cautionVersee:false, dateCautionVersee:'',
  indexationAnnuelle:false, chargesIncluses:false, montantCharges:'',
  acheteurNom:'', acheteurPrenom:'', acheteurEmail:'', acheteurTelephone:'',
  prixVente:'', commissionAgence:'',
  dateSignatureCompromis:'', dateSignatureActe:'',
  notaireNom:'', notaireTel:'', notaireEmail:'', conditionsSuspensives:'', notes:'',
};

const ContratForm = ({ init = emptyContrat, proprietaires, locataires, properties, onSave, onCancel, loading }) => {
  const [f, setF] = useState(init);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const commFCFA = f.prixVente && f.commissionAgence
    ? Math.round((parseFloat(f.prixVente) * parseFloat(f.commissionAgence)) / 100) : 0;

  // Biens du propriétaire sélectionné
  const propBiens = proprietaires.find(p => p._id === f.proprietaire)?.biensPropres || [];

  const handleBienChange = (val) => {
    if (val.startsWith('propre:')) {
      const idx = parseInt(val.split(':')[1], 10);
      const b = propBiens[idx];
      set('bien', '');
      set('adresseBien', b?.adresse || '');
      set('villeBien',   b?.ville   || '');
    } else {
      set('bien', val);
      const prop = properties.find(p => p._id === val);
      if (prop) {
        set('adresseBien', prop.address || prop.adresse || '');
        set('villeBien',   prop.city    || prop.ville   || '');
      }
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Type de contrat" required>
        <div className="grid grid-cols-2 gap-3">
          {['location','vente'].map(t => (
            <button key={t} type="button" onClick={() => set('type', t)}
              className="p-4 rounded-xl border-2 text-sm font-semibold transition-all"
              style={{
                borderColor: f.type===t ? (t==='location'?BLUE:GREEN) : '#E2E8F0',
                color:  f.type===t ? (t==='location'?BLUE:GREEN) : GRAY,
                background: f.type===t ? (t==='location'?`${BLUE}08`:`${GREEN}08`) : 'white',
                fontFamily: FONT,
              }}>
              {t==='location' ? '🏠 LOCATION' : '💰 VENTE'}
            </button>
          ))}
        </div>
      </Field>

      <SectionTitle>Bien &amp; Propriétaire</SectionTitle>
      <Field label="Propriétaire" required>
        <Select value={f.proprietaire} onChange={e => { set('proprietaire', e.target.value); set('bien',''); }}>
          <option value="">— Sélectionner —</option>
          {proprietaires.map(p => <option key={p._id} value={p._id}>{p.prenom} {p.nom}</option>)}
        </Select>
      </Field>
      <Field label="Bien immobilier">
        <Select value={f.bien.startsWith?.('propre:')?f.bien:f.bien} onChange={e => handleBienChange(e.target.value)}>
          <option value="">— Sélectionner un bien —</option>
          {properties.length > 0 && (
            <optgroup label="Portefeuille Altimmo">
              {properties.map(p => <option key={p._id} value={p._id}>{p.title || p.adresse}</option>)}
            </optgroup>
          )}
          {propBiens.length > 0 && (
            <optgroup label="Biens du propriétaire">
              {propBiens.map((b, i) => (
                <option key={`propre:${i}`} value={`propre:${i}`}>
                  {b.titre} — {b.adresse}
                </option>
              ))}
            </optgroup>
          )}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Adresse du bien"><Input value={f.adresseBien} onChange={e=>set('adresseBien',e.target.value)}/></Field>
        <Field label="Ville du bien"><Input value={f.villeBien} onChange={e=>set('villeBien',e.target.value)}/></Field>
      </div>
      <Field label="Statut">
        <Select value={f.statut} onChange={e=>set('statut',e.target.value)}>
          <option value="en_attente">En attente</option>
          <option value="actif">Actif</option>
          <option value="résilié">Résilié</option>
          <option value="expiré">Expiré</option>
        </Select>
      </Field>

      {f.type === 'location' && (
        <>
          <SectionTitle>Locataire</SectionTitle>
          <Field label="Locataire">
            <Select value={f.locataire} onChange={e=>set('locataire',e.target.value)}>
              <option value="">— Sélectionner —</option>
              {locataires.map(l => <option key={l._id} value={l._id}>{l.prenom} {l.nom}</option>)}
            </Select>
          </Field>
          <SectionTitle>Conditions du bail</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date d'entrée"><Input type="date" value={f.dateEntree} onChange={e=>set('dateEntree',e.target.value)}/></Field>
            <Field label="Date fin de bail"><Input type="date" value={f.dateFinBail} onChange={e=>set('dateFinBail',e.target.value)}/></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Loyer/mois (FCFA)" required><Input type="number" value={f.montantLoyer} onChange={e=>set('montantLoyer',e.target.value)}/></Field>
            <Field label="Caution (FCFA)"><Input type="number" value={f.montantCaution} onChange={e=>set('montantCaution',e.target.value)}/></Field>
          </div>
          <Field label="Durée préavis">
            <Select value={f.dureePreavis} onChange={e=>set('dureePreavis',e.target.value)}>
              {[1,2,3].map(n=><option key={n} value={n}>{n} mois</option>)}
            </Select>
          </Field>
          <div className="space-y-2.5 py-1">
            <Toggle checked={f.chargesIncluses} onChange={v=>set('chargesIncluses',v)} label="Charges incluses dans le loyer"/>
            {f.chargesIncluses && <Field label="Montant charges (FCFA)"><Input type="number" value={f.montantCharges} onChange={e=>set('montantCharges',e.target.value)}/></Field>}
            <Toggle checked={f.cautionVersee} onChange={v=>set('cautionVersee',v)} label="Caution versée"/>
            {f.cautionVersee && <Field label="Date versement"><Input type="date" value={f.dateCautionVersee} onChange={e=>set('dateCautionVersee',e.target.value)}/></Field>}
            <Toggle checked={f.indexationAnnuelle} onChange={v=>set('indexationAnnuelle',v)} label="Indexation annuelle du loyer"/>
          </div>
        </>
      )}

      {f.type === 'vente' && (
        <>
          <SectionTitle>Acheteur</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom"><Input value={f.acheteurNom} onChange={e=>set('acheteurNom',e.target.value)}/></Field>
            <Field label="Prénom"><Input value={f.acheteurPrenom} onChange={e=>set('acheteurPrenom',e.target.value)}/></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email"><Input type="email" value={f.acheteurEmail} onChange={e=>set('acheteurEmail',e.target.value)}/></Field>
            <Field label="Téléphone"><Input value={f.acheteurTelephone} onChange={e=>set('acheteurTelephone',e.target.value)}/></Field>
          </div>
          <SectionTitle>Transaction</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prix de vente (FCFA)" required><Input type="number" value={f.prixVente} onChange={e=>set('prixVente',e.target.value)}/></Field>
            <Field label="Commission agence (%)">
              <Input type="number" value={f.commissionAgence} onChange={e=>set('commissionAgence',e.target.value)}/>
              {commFCFA > 0 && <p className="text-xs text-blue-500 mt-1 font-medium">{commFCFA.toLocaleString('fr-FR')} FCFA</p>}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Signature compromis"><Input type="date" value={f.dateSignatureCompromis} onChange={e=>set('dateSignatureCompromis',e.target.value)}/></Field>
            <Field label="Signature acte définitif"><Input type="date" value={f.dateSignatureActe} onChange={e=>set('dateSignatureActe',e.target.value)}/></Field>
          </div>
          <SectionTitle>Notaire</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom"><Input value={f.notaireNom} onChange={e=>set('notaireNom',e.target.value)}/></Field>
            <Field label="Téléphone"><Input value={f.notaireTel} onChange={e=>set('notaireTel',e.target.value)}/></Field>
          </div>
          <Field label="Email notaire"><Input type="email" value={f.notaireEmail} onChange={e=>set('notaireEmail',e.target.value)}/></Field>
          <Field label="Conditions suspensives"><Textarea value={f.conditionsSuspensives} onChange={e=>set('conditionsSuspensives',e.target.value)}/></Field>
        </>
      )}

      <Field label="Notes"><Textarea value={f.notes} onChange={e=>set('notes',e.target.value)}/></Field>
      <div className="flex gap-3 pt-2">
        <Btn onClick={() => onSave(f)} loading={loading}>Enregistrer le contrat</Btn>
        <Btn onClick={onCancel} outline color={GRAY}>Annuler</Btn>
      </div>
    </div>
  );
};

// ── PropDetailModal ───────────────────────────────────────────
const PropDetailModal = ({ proprietaire: p, onClose }) => {
  const [selectedBien, setSelectedBien] = useState(null);
  const biens = p.biensPropres || [];

  return (
    <Modal title={`${p.prenom} ${p.nom}`} onClose={onClose} wide>
      {/* Info personnelles */}
      <div className="grid grid-cols-2 gap-3 text-sm mb-5 p-4 bg-gray-50 rounded-xl">
        {[['Téléphone', p.telephone], ['Email', p.email||'—'], ['Adresse', p.adresse||'—'], ['Ville', p.ville||'—']].map(([k,v]) => (
          <div key={k}><p className="text-xs text-gray-400 mb-0.5">{k}</p><p className="font-semibold text-gray-800">{v}</p></div>
        ))}
      </div>

      {/* Biens */}
      {biens.length > 0 ? (
        <>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3" style={{fontFamily:FONT}}>
            Ses biens ({biens.length})
          </p>
          <div className="grid grid-cols-3 gap-3">
            {biens.map((b, i) => {
              const color = STATUT_COLORS[b.statut] || GRAY;
              return (
                <button key={i} onClick={() => setSelectedBien(b)}
                  className="text-left rounded-xl overflow-hidden border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all">
                  <div className="aspect-video bg-gray-100 overflow-hidden">
                    {b.photos?.[0]
                      ? <img src={b.photos[0]} className="w-full h-full object-cover" alt={b.titre}/>
                      : <div className="w-full h-full flex items-center justify-center"><Building size={28} className="text-gray-300"/></div>}
                  </div>
                  <div className="p-2.5">
                    <p className="font-semibold text-sm text-gray-800 truncate">{b.titre}</p>
                    <p className="text-xs text-gray-400 truncate">{b.quartier||b.ville}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{background:color}}/>
                      <span className="text-xs font-semibold" style={{color}}>{b.statut}</span>
                    </div>
                    {b.prixLoyer > 0 && <p className="text-xs font-bold mt-1" style={{color:BLUE}}>{fmt(b.prixLoyer)}/mois</p>}
                    {b.prixVente > 0 && <p className="text-xs font-bold mt-1" style={{color:GREEN}}>{fmt(b.prixVente)}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-400 text-center py-8" style={{fontFamily:FONT}}>Aucun bien enregistré pour ce propriétaire.</p>
      )}

      {/* Modal bien detail */}
      {selectedBien && (
        <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedBien(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-y-auto max-h-[88vh]"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900" style={{fontFamily:FONT}}>{selectedBien.titre}</h3>
              <button onClick={() => setSelectedBien(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18}/></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Photos */}
              {selectedBien.photos?.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {selectedBien.photos.map((url, i) => (
                    <div key={i} className={`rounded-xl overflow-hidden ${i===0?'col-span-3 aspect-video':'aspect-square'}`}>
                      <img src={url} className="w-full h-full object-cover" alt={`Photo ${i+1}`}/>
                    </div>
                  ))}
                </div>
              )}
              {/* Infos */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Type', selectedBien.type],
                  ['Statut', <span key="s" className="text-xs font-bold px-2 py-0.5 rounded-full" style={{color:STATUT_COLORS[selectedBien.statut]||GRAY,background:`${STATUT_COLORS[selectedBien.statut]||GRAY}15`}}>{selectedBien.statut}</span>],
                  ['Adresse', selectedBien.adresse],
                  ['Ville', `${selectedBien.ville}${selectedBien.quartier?` — ${selectedBien.quartier}`:''}`],
                  selectedBien.superficie && ['Superficie', `${selectedBien.superficie} m²`],
                  selectedBien.nombrePieces && ['Pièces', selectedBien.nombrePieces],
                  selectedBien.nombreChambres && ['Chambres', selectedBien.nombreChambres],
                  selectedBien.nombreSDB && ['SDB', selectedBien.nombreSDB],
                  selectedBien.prixLoyer > 0 && ['Loyer', <span key="l" className="font-bold" style={{color:BLUE}}>{fmt(selectedBien.prixLoyer)}/mois</span>],
                  selectedBien.prixVente > 0 && ['Prix vente', <span key="v" className="font-bold" style={{color:GREEN}}>{fmt(selectedBien.prixVente)}</span>],
                  selectedBien.charges > 0 && ['Charges', fmt(selectedBien.charges)],
                ].filter(Boolean).map(([k, v]) => (
                  <div key={k}><p className="text-xs text-gray-400 mb-0.5">{k}</p><p className="font-semibold">{v}</p></div>
                ))}
              </div>
              {selectedBien.description && (
                <p className="text-sm text-gray-600 p-3 bg-gray-50 rounded-xl">{selectedBien.description}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

// ── ConfirmDelete ─────────────────────────────────────────────
const ConfirmDelete = ({ label, onConfirm, onCancel }) => (
  <Modal title="Confirmer la suppression" onClose={onCancel}>
    <p className="text-sm text-gray-600 mb-5" style={{fontFamily:FONT}}>
      Supprimer <strong>{label}</strong> ? Action irréversible.
    </p>
    <div className="flex gap-3">
      <Btn onClick={onConfirm} color={RED}>Supprimer</Btn>
      <Btn onClick={onCancel} outline color={GRAY}>Annuler</Btn>
    </div>
  </Modal>
);

// ═══════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════
const GestionLocativePage = () => {
  const { toasts, push: toast } = useToast();

  const [contrats,      setContrats]      = useState([]);
  const [proprietaires, setProprietaires] = useState([]);
  const [locataires,    setLocataires]    = useState([]);
  const [properties,    setProperties]    = useState([]);
  const [paiements,     setPaiements]     = useState([]);

  const [tab,     setTab]     = useState('contrats');
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  const [contratModal, setContratModal] = useState(false);
  const [editContrat,  setEditContrat]  = useState(null);
  const [propModal,    setPropModal]    = useState(false);
  const [editProp,     setEditProp]     = useState(null);
  const [viewProp,     setViewProp]     = useState(null);
  const [locModal,     setLocModal]     = useState(false);
  const [editLoc,      setEditLoc]      = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [filterContrat, setFilterContrat] = useState('');
  const [filterAnnee,   setFilterAnnee]   = useState(new Date().getFullYear());

  // ── Chargement ──────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, p, l, props] = await Promise.all([
        getContrats(), getProprietaires(), getLocataires(),
        getAllProperties().catch(() => []),
      ]);
      setContrats(Array.isArray(c)?c:[]);
      setProprietaires(Array.isArray(p)?p:[]);
      setLocataires(Array.isArray(l)?l:[]);
      setProperties(Array.isArray(props)?props:[]);
    } catch {
      toast('Impossible de charger les données', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!filterContrat || tab !== 'paiements') return;
    getPaiements(filterContrat, filterAnnee)
      .then(data => setPaiements(Array.isArray(data)?data:[]))
      .catch(() => toast('Impossible de charger les paiements', 'error'));
  }, [filterContrat, filterAnnee, tab]);

  // ── Contrats ────────────────────────────────────────────────
  const handleSaveContrat = async (f) => {
    if (!f.proprietaire) return toast('Propriétaire requis', 'error');
    setSaving(true);
    try {
      const payload = {
        type: f.type, bien: f.bien||undefined, proprietaire: f.proprietaire,
        statut: f.statut, adresseBien: f.adresseBien, villeBien: f.villeBien, notes: f.notes,
        ...(f.type==='location' ? {
          locataire: f.locataire||undefined, dateEntree: f.dateEntree||undefined,
          dateFinBail: f.dateFinBail||undefined,
          montantLoyer: f.montantLoyer?Number(f.montantLoyer):undefined,
          montantCaution: f.montantCaution?Number(f.montantCaution):undefined,
          cautionVersee: f.cautionVersee, dateCautionVersee: f.dateCautionVersee||undefined,
          dureePreavis: Number(f.dureePreavis), indexationAnnuelle: f.indexationAnnuelle,
          chargesIncluses: f.chargesIncluses, montantCharges: f.montantCharges?Number(f.montantCharges):undefined,
        } : {
          acheteur: { nom:f.acheteurNom, prenom:f.acheteurPrenom, email:f.acheteurEmail, telephone:f.acheteurTelephone },
          prixVente: f.prixVente?Number(f.prixVente):undefined,
          commissionAgence: f.commissionAgence?Number(f.commissionAgence):undefined,
          dateSignatureCompromis: f.dateSignatureCompromis||undefined,
          dateSignatureActe: f.dateSignatureActe||undefined,
          notaire: { nom:f.notaireNom, telephone:f.notaireTel, email:f.notaireEmail },
          conditionsSuspensives: f.conditionsSuspensives,
        }),
      };
      if (editContrat) {
        const up = await updateContrat(editContrat._id, payload);
        setContrats(prev => prev.map(c => c._id===editContrat._id ? up : c));
        toast('Contrat mis à jour');
      } else {
        const cr = await createContrat(payload);
        setContrats(prev => [cr, ...prev]);
        toast('Contrat créé' + (f.type==='location'&&f.dateFinBail?' + paiements générés':''));
      }
      setContratModal(false); setEditContrat(null);
    } catch (err) {
      toast(err.response?.data?.message||'Erreur', 'error');
    } finally { setSaving(false); }
  };

  const handleDeleteContrat = async () => {
    try {
      await deleteContrat(deleteTarget.id);
      setContrats(prev => prev.filter(c => c._id!==deleteTarget.id));
      toast('Contrat supprimé');
    } catch { toast('Erreur', 'error'); }
    finally { setDeleteTarget(null); }
  };

  // ── Propriétaires ───────────────────────────────────────────
  const handleSaveProp = async (personal, biens) => {
    if (!personal.nom || !personal.prenom || !personal.telephone)
      return toast('Nom, prénom et téléphone requis', 'error');

    setSaving(true);
    try {
      // Séparer photos existantes (URL) et nouvelles (File)
      const biensPropres = biens.map(b => ({
        titre: b.titre, type: b.type, adresse: b.adresse, ville: b.ville,
        quartier: b.quartier||undefined,
        superficie:     b.superficie     ? Number(b.superficie)     : undefined,
        nombrePieces:   b.nombrePieces   ? Number(b.nombrePieces)   : undefined,
        nombreChambres: b.nombreChambres ? Number(b.nombreChambres) : undefined,
        nombreSDB:      b.nombreSDB      ? Number(b.nombreSDB)      : undefined,
        etage:          b.etage !== ''   ? Number(b.etage)          : undefined,
        description: b.description||undefined,
        statut: b.statut,
        prixLoyer: b.prixLoyer ? Number(b.prixLoyer) : undefined,
        prixVente: b.prixVente ? Number(b.prixVente) : undefined,
        charges:   b.charges   ? Number(b.charges)   : undefined,
        photos:    (b._photos||[]).filter(p => p.type==='existing').map(p => p.url),
      }));

      let saved;
      if (editProp) {
        saved = await updateProprietaire(editProp._id, { ...personal, biensPropres });
      } else {
        saved = await createProprietaire({ ...personal, biensPropres });
      }

      // Upload nouvelles photos bien par bien
      for (let i = 0; i < biens.length; i++) {
        const newFiles = (biens[i]._photos||[]).filter(p => p.type==='new').map(p => p.file);
        if (newFiles.length > 0) {
          await addBienPhotos(saved._id, i, newFiles).catch(() => {});
        }
      }

      // Rafraîchir la liste (pour avoir les nouvelles URLs Cloudinary)
      const refreshed = await getProprietaires();
      setProprietaires(refreshed);
      toast(editProp ? 'Propriétaire mis à jour' : 'Propriétaire créé');
      setPropModal(false); setEditProp(null);
    } catch (err) {
      toast(err.response?.data?.message||'Erreur', 'error');
    } finally { setSaving(false); }
  };

  const handleDeleteProp = async () => {
    try {
      await deleteProprietaire(deleteTarget.id);
      setProprietaires(prev => prev.filter(p => p._id!==deleteTarget.id));
      toast('Propriétaire supprimé');
    } catch { toast('Erreur', 'error'); }
    finally { setDeleteTarget(null); }
  };

  // ── Locataires ──────────────────────────────────────────────
  const handleSaveLoc = async (f) => {
    if (!f.nom || !f.prenom || !f.telephone) return toast('Nom, prénom et téléphone requis', 'error');
    setSaving(true);
    try {
      if (editLoc) {
        const up = await updateLocataire(editLoc._id, f);
        setLocataires(prev => prev.map(l => l._id===editLoc._id ? up : l));
        toast('Locataire mis à jour');
      } else {
        const cr = await createLocataire(f);
        setLocataires(prev => [cr, ...prev]);
        toast('Locataire créé');
      }
      setLocModal(false); setEditLoc(null);
    } catch (err) {
      toast(err.response?.data?.message||'Erreur', 'error');
    } finally { setSaving(false); }
  };

  const handleDeleteLoc = async () => {
    try {
      await deleteLocataire(deleteTarget.id);
      setLocataires(prev => prev.filter(l => l._id!==deleteTarget.id));
      toast('Locataire supprimé');
    } catch { toast('Erreur', 'error'); }
    finally { setDeleteTarget(null); }
  };

  // ── Paiements ───────────────────────────────────────────────
  const handleMarkPaye = async (paiement) => {
    try {
      const up = await updatePaiement(paiement._id, { statut:'payé', datePaiement: new Date().toISOString() });
      setPaiements(prev => prev.map(p => p._id===paiement._id ? up : p));
      toast('Paiement marqué comme payé');
    } catch { toast('Erreur', 'error'); }
  };

  // ── Tabs ─────────────────────────────────────────────────────
  const TABS = [
    { id:'contrats',      label:'Contrats',     Icon:FileText,  count:contrats.length },
    { id:'proprietaires', label:'Propriétaires', Icon:Users,     count:proprietaires.length },
    { id:'locataires',    label:'Locataires',    Icon:Home,      count:locataires.length },
    { id:'paiements',     label:'Paiements',     Icon:CreditCard,count:null },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin w-8 h-8" style={{color:BLUE}}/>
    </div>
  );

  const contratsActifs    = contrats.filter(c => c.statut==='actif').length;
  const contratsEnAttente = contrats.filter(c => c.statut==='en_attente').length;
  const totalAttendu  = paiements.reduce((s,p) => s+(p.montant||0), 0);
  const totalEncaisse = paiements.filter(p => p.statut==='payé').reduce((s,p) => s+(p.montant||0), 0);

  return (
    <div className="space-y-5" style={{fontFamily:FONT}}>

      {/* En-tête */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:`${BLUE}15`}}>
              <Building size={20} style={{color:BLUE}}/>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Gestion Locative</h1>
              <p className="text-xs text-gray-400">Contrats · Propriétaires · Locataires · Paiements</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {[['Actifs',contratsActifs,GREEN],['En attente',contratsEnAttente,GOLD],['Propriétaires',proprietaires.length,BLUE]].map(([l,v,c])=>(
              <div key={l} className="text-center">
                <p className="text-xl font-extrabold" style={{color:c}}>{v}</p>
                <p className="text-xs text-gray-400">{l}</p>
              </div>
            ))}
            <button onClick={load} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-all"><RefreshCw size={16}/></button>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {TABS.map(({id, label, Icon, count}) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-all flex-1 justify-center border-b-2 ${
                tab===id ? 'text-blue-600 border-blue-500' : 'text-gray-400 border-transparent hover:text-gray-700'
              }`}>
              <Icon size={15}/>
              <span className="hidden sm:inline">{label}</span>
              {count !== null && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                  style={{background:tab===id?`${BLUE}15`:'#F1F5F9', color:tab===id?BLUE:GRAY}}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5">

          {/* ─── CONTRATS ─── */}
          {tab === 'contrats' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Btn onClick={() => { setEditContrat(null); setContratModal(true); }}><Plus size={15}/> Nouveau Contrat</Btn>
              </div>
              {contrats.length === 0
                ? <p className="text-center text-gray-400 py-12 text-sm">Aucun contrat. Créez le premier.</p>
                : (
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-left">
                      <thead><tr>{['Type','Bien / Adresse','Propriétaire','Locataire / Acheteur','Statut','Début',''].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
                      <tbody>
                        {contrats.map(c => (
                          <TRow key={c._id}>
                            <TD><TypeBadge type={c.type}/></TD>
                            <TD bold>{c.bien?.title||c.adresseBien||'—'}</TD>
                            <TD>{c.proprietaire?`${c.proprietaire.prenom} ${c.proprietaire.nom}`:'—'}</TD>
                            <TD>{c.type==='location'
                              ? (c.locataire?`${c.locataire.prenom} ${c.locataire.nom}`:'—')
                              : (c.acheteur?.nom?`${c.acheteur.prenom} ${c.acheteur.nom}`:'—')}</TD>
                            <TD><StatutBadge statut={c.statut}/></TD>
                            <TD>{c.dateEntree?new Date(c.dateEntree).toLocaleDateString('fr-FR'):c.dateSignatureCompromis?new Date(c.dateSignatureCompromis).toLocaleDateString('fr-FR'):'—'}</TD>
                            <Actions
                              onEdit={() => {
                                const init = {
                                  ...emptyContrat, type:c.type, bien:c.bien?._id||'',
                                  proprietaire:c.proprietaire?._id||'', adresseBien:c.adresseBien||'',
                                  villeBien:c.villeBien||'', statut:c.statut, notes:c.notes||'',
                                  locataire:c.locataire?._id||'',
                                  dateEntree:c.dateEntree?c.dateEntree.slice(0,10):'',
                                  dateFinBail:c.dateFinBail?c.dateFinBail.slice(0,10):'',
                                  montantLoyer:c.montantLoyer||'', montantCaution:c.montantCaution||'',
                                  cautionVersee:!!c.cautionVersee,
                                  dateCautionVersee:c.dateCautionVersee?c.dateCautionVersee.slice(0,10):'',
                                  dureePreavis:c.dureePreavis||1, indexationAnnuelle:!!c.indexationAnnuelle,
                                  chargesIncluses:!!c.chargesIncluses, montantCharges:c.montantCharges||'',
                                  acheteurNom:c.acheteur?.nom||'', acheteurPrenom:c.acheteur?.prenom||'',
                                  acheteurEmail:c.acheteur?.email||'', acheteurTelephone:c.acheteur?.telephone||'',
                                  prixVente:c.prixVente||'', commissionAgence:c.commissionAgence||'',
                                  dateSignatureCompromis:c.dateSignatureCompromis?c.dateSignatureCompromis.slice(0,10):'',
                                  dateSignatureActe:c.dateSignatureActe?c.dateSignatureActe.slice(0,10):'',
                                  notaireNom:c.notaire?.nom||'', notaireTel:c.notaire?.telephone||'',
                                  notaireEmail:c.notaire?.email||'', conditionsSuspensives:c.conditionsSuspensives||'',
                                };
                                setEditContrat({...c,...init}); setContratModal(true);
                              }}
                              onDelete={() => setDeleteTarget({id:c._id, label:c.adresseBien||`Contrat ${c.type}`, type:'contrat'})}
                            />
                          </TRow>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          )}

          {/* ─── PROPRIÉTAIRES ─── */}
          {tab === 'proprietaires' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Btn onClick={() => { setEditProp(null); setPropModal(true); }}><Plus size={15}/> Nouveau Propriétaire</Btn>
              </div>
              {proprietaires.length === 0
                ? <p className="text-center text-gray-400 py-12 text-sm">Aucun propriétaire enregistré.</p>
                : (
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-left">
                      <thead><tr>{['Nom complet','Téléphone','Email','Biens','Ville',''].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
                      <tbody>
                        {proprietaires.map(p => {
                          const nbBiens = (p.biensPropres||[]).length + contrats.filter(c=>c.proprietaire?._id===p._id||c.proprietaire===p._id).length;
                          return (
                            <TRow key={p._id}>
                              <TD bold>{p.prenom} {p.nom}</TD>
                              <TD>{p.telephone}</TD>
                              <TD>{p.email||'—'}</TD>
                              <TD>
                                <span className="font-bold" style={{color:BLUE}}>{(p.biensPropres||[]).length}</span>
                                <span className="text-gray-400 text-xs ml-1">propre{(p.biensPropres||[]).length>1?'s':''}</span>
                              </TD>
                              <TD>{p.ville||'—'}</TD>
                              <Actions
                                onView={() => setViewProp(p)}
                                onEdit={() => { setEditProp(p); setPropModal(true); }}
                                onDelete={() => setDeleteTarget({id:p._id, label:`${p.prenom} ${p.nom}`, type:'proprietaire'})}
                              />
                            </TRow>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          )}

          {/* ─── LOCATAIRES ─── */}
          {tab === 'locataires' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Btn onClick={() => { setEditLoc(null); setLocModal(true); }}><Plus size={15}/> Nouveau Locataire</Btn>
              </div>
              {locataires.length === 0
                ? <p className="text-center text-gray-400 py-12 text-sm">Aucun locataire enregistré.</p>
                : (
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-left">
                      <thead><tr>{['Nom complet','Téléphone','Email','Profession','Contrat actif',''].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
                      <tbody>
                        {locataires.map(l => {
                          const contrat = contrats.find(c=>(c.locataire?._id===l._id||c.locataire===l._id)&&c.statut==='actif');
                          return (
                            <TRow key={l._id}>
                              <TD bold>{l.prenom} {l.nom}</TD>
                              <TD>{l.telephone}</TD>
                              <TD>{l.email||'—'}</TD>
                              <TD>{l.profession||'—'}</TD>
                              <TD>{contrat
                                ? <span className="text-xs font-semibold" style={{color:GREEN}}>✓ {contrat.adresseBien||'Actif'}</span>
                                : <span className="text-xs text-gray-400">—</span>}</TD>
                              <Actions
                                onEdit={() => { setEditLoc(l); setLocModal(true); }}
                                onDelete={() => setDeleteTarget({id:l._id, label:`${l.prenom} ${l.nom}`, type:'locataire'})}
                              />
                            </TRow>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          )}

          {/* ─── PAIEMENTS ─── */}
          {tab === 'paiements' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3 items-end">
                <Field label="Contrat">
                  <Select value={filterContrat} onChange={e=>setFilterContrat(e.target.value)} style={{minWidth:220}}>
                    <option value="">— Sélectionner —</option>
                    {contrats.filter(c=>c.type==='location').map(c=>(
                      <option key={c._id} value={c._id}>
                        {c.proprietaire?`${c.proprietaire.prenom} ${c.proprietaire.nom}`:''} — {c.adresseBien||c.bien?.title||c._id.slice(-6)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Année">
                  <Select value={filterAnnee} onChange={e=>setFilterAnnee(Number(e.target.value))} style={{width:110}}>
                    {[2023,2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
                  </Select>
                </Field>
              </div>

              {!filterContrat
                ? <p className="text-center text-gray-400 py-12 text-sm">Sélectionnez un contrat pour voir les paiements.</p>
                : paiements.length === 0
                  ? <p className="text-center text-gray-400 py-12 text-sm">Aucun paiement pour ce contrat / cette année.</p>
                  : (
                    <>
                      <div className="overflow-x-auto rounded-xl border border-gray-100">
                        <table className="w-full text-left">
                          <thead><tr>{['Mois','Montant','Statut','Date paiement','Mode','Action'].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
                          <tbody>
                            {paiements.map(p => (
                              <TRow key={p._id}>
                                <TD bold>{MOIS[(p.mois||1)-1]} {p.annee}</TD>
                                <TD>{fmt(p.montant)}</TD>
                                <TD><PaiementBadge statut={p.statut}/></TD>
                                <TD>{p.datePaiement?new Date(p.datePaiement).toLocaleDateString('fr-FR'):'—'}</TD>
                                <TD>{p.modePaiement||'—'}</TD>
                                <td className="px-4 py-3">
                                  {p.statut!=='payé' && (
                                    <Btn small onClick={() => handleMarkPaye(p)} color={GREEN}><Check size={12}/> Payé</Btn>
                                  )}
                                </td>
                              </TRow>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex gap-6 justify-end pt-2 text-sm font-semibold">
                        <span className="text-gray-500">Attendu : <strong style={{color:BLUE}}>{fmt(totalAttendu)}</strong></span>
                        <span className="text-gray-500">Encaissé : <strong style={{color:GREEN}}>{fmt(totalEncaisse)}</strong></span>
                        <span className="text-gray-500">Solde : <strong style={{color:totalAttendu-totalEncaisse>0?RED:GREEN}}>{fmt(totalAttendu-totalEncaisse)}</strong></span>
                      </div>
                    </>
                  )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Modaux ─── */}

      {contratModal && (
        <Modal title={editContrat?'Modifier le contrat':'Nouveau contrat'} onClose={() => {setContratModal(false);setEditContrat(null);}} wide>
          <ContratForm
            init={editContrat||emptyContrat}
            proprietaires={proprietaires}
            locataires={locataires}
            properties={properties}
            onSave={handleSaveContrat}
            onCancel={() => {setContratModal(false);setEditContrat(null);}}
            loading={saving}
          />
        </Modal>
      )}

      {propModal && (
        <Modal title={editProp?'Modifier le propriétaire':'Nouveau propriétaire'} onClose={() => {setPropModal(false);setEditProp(null);}} wide>
          <ProprietaireForm
            init={editProp ? {
              nom:editProp.nom, prenom:editProp.prenom, email:editProp.email||'',
              telephone:editProp.telephone, adresse:editProp.adresse||'',
              ville:editProp.ville||'', notes:editProp.notes||'', pieceIdentite:null,
            } : emptyProp}
            initBiens={editProp?.biensPropres||[]}
            onSave={handleSaveProp}
            onCancel={() => {setPropModal(false);setEditProp(null);}}
            loading={saving}
          />
        </Modal>
      )}

      {locModal && (
        <Modal title={editLoc?'Modifier le locataire':'Nouveau locataire'} onClose={() => {setLocModal(false);setEditLoc(null);}}>
          <LocataireForm
            init={editLoc ? {
              nom:editLoc.nom, prenom:editLoc.prenom, email:editLoc.email||'',
              telephone:editLoc.telephone, adresse:editLoc.adresse||'',
              ville:editLoc.ville||'', profession:editLoc.profession||'',
              revenuMensuel:editLoc.revenuMensuel||'', notes:editLoc.notes||'', pieceIdentite:null,
            } : emptyLoc}
            onSave={handleSaveLoc}
            onCancel={() => {setLocModal(false);setEditLoc(null);}}
            loading={saving}
          />
        </Modal>
      )}

      {viewProp && (
        <PropDetailModal proprietaire={viewProp} onClose={() => setViewProp(null)}/>
      )}

      {deleteTarget && (
        <ConfirmDelete
          label={deleteTarget.label}
          onConfirm={deleteTarget.type==='contrat' ? handleDeleteContrat : deleteTarget.type==='proprietaire' ? handleDeleteProp : handleDeleteLoc}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <ToastContainer toasts={toasts}/>
    </div>
  );
};

export default GestionLocativePage;
