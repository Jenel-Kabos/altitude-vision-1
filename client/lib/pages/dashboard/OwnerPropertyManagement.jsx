"use client";

import React, { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from '../../context/AuthContext';
import {
  Building2, Plus, Edit2, Trash2, MapPin, Maximize2, Bed, Bath,
  Loader2, AlertCircle, Home, X, CheckCircle2, Clock3, FileText,
} from "lucide-react";
import {
  getMyProperties, createProperty, updateProperty,
  deleteProperty, getPropertyById,
} from "../../services/propertyService";
import PropertyForm from "../../components/dashboard/PropertyForm";
import { getMyRentalManagement, requestRentalAction } from '../../services/gestionLocativeService';
import Image from 'next/image';
import Link from 'next/link';
import { Calendar } from 'lucide-react';
import PropertyAssetCockpitDrawer from "../../components/dashboard/propertyAsset/PropertyAssetCockpitDrawer";
import PropertyPortfolioDashboard from "../../components/dashboard/propertyAsset/PropertyPortfolioDashboard";

const BLUE = '#2E7BB5';
const GOLD = '#C8960C';

// ✅ Préfixe les URLs relatives avec l'URL du backend.
// Le controller sauvegarde les chemins sous la forme "/uploads/events/photo.jpg"
// (chemin relatif au serveur), pas une URL absolue — il faut donc ajouter le domaine.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://altitude-vision.onrender.com/api';

const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const normalized = url.replace(/\\/g, "/").replace(/^\//, "");
  return `${API_URL}/${normalized}`;
};

// ─────────────────────────────────────────────────────────────
// État formulaire initial
// ─────────────────────────────────────────────────────────────
const emptyForm = () => ({
  title:'', description:'', price:'', pole:'Altimmo',
  status:'vente', availability:'Disponible', type:'Appartement',
  address:{ street:'', neighborhood:'', arrondissement:'', city:'Brazzaville' },
  surface:'', bedrooms:'', bathrooms:'', amenities:'',
  livingRooms:'', kitchens:'', constructionType:'Non spécifié',
  cautionMultiplicateur:2, profilsLocataireRecherches:[], documentsRequis:[],
  latitude:-4.266, longitude:15.283, images:[],
});

// ─────────────────────────────────────────────────────────────
// Formulaire (ajout / édition)
// ─────────────────────────────────────────────────────────────
const PropertyManagementForm = ({ propertyId, onSave, onCancel }) => {
  const isEditing = !!propertyId;
  const [formData, setFormData]             = useState(emptyForm());
  const [existingImages, setExistingImages] = useState([]);
  const [loading, setLoading]               = useState(false);

  useEffect(() => {
    if (!isEditing) { setFormData(emptyForm()); setExistingImages([]); return; }
    const load = async () => {
      setLoading(true);
      try {
        const p = await getPropertyById(propertyId);
        setFormData({
          ...emptyForm(), ...p,
          address: {
            arrondissement: p.address?.arrondissement || '',
            neighborhood:   p.address?.neighborhood   || '',
            street:         p.address?.street         || '',
            city:           p.address?.city           || 'Brazzaville',
          },
          amenities: p.amenities?.join(', ') || '',
          profilsLocataireRecherches: p.profilsLocataireRecherches || [],
          documentsRequis: p.documentsRequis || [],
          latitude:  p.location?.coordinates[1] || -4.266,
          longitude: p.location?.coordinates[0] || 15.283,
          images: [],
        });
        setExistingImages(p.images || []);
      } catch {
        toast.error("Erreur lors du chargement du bien.");
        onCancel();
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [propertyId, isEditing, onCancel]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData();

      // ✅ Whitelist explicite — évite d'envoyer _id, owner, statusAdmin,
      // location (objet), updatedAt, etc. qui provoquent une erreur 500.
      const ALLOWED = ['title','description','price','pole','status','availability',
                       'type','surface','bedrooms','bathrooms','livingRooms','kitchens',
                       'constructionType','cautionMultiplicateur','latitude','longitude'];
      ALLOWED.forEach(k => {
        const v = formData[k];
        if (v !== '' && v !== undefined && v !== null) fd.append(k, v);
      });

      fd.append("address[street]",         formData.address.street         || '');
      fd.append("address[neighborhood]",   formData.address.neighborhood   || '');
      fd.append("address[arrondissement]", formData.address.arrondissement || '');
      fd.append("address[city]",           formData.address.city           || 'Brazzaville');

      const amenities = formData.amenities || '';
      amenities.split(',').map(a => a.trim()).filter(Boolean).forEach(a => fd.append("amenities", a));
      fd.append("profilsLocataireRecherches", JSON.stringify(formData.profilsLocataireRecherches || []));
      fd.append("documentsRequis", JSON.stringify(formData.documentsRequis || []));

      fd.append("location", JSON.stringify({ type:"Point", coordinates:[formData.longitude, formData.latitude] }));

      formData.images.forEach(f => fd.append("images", f));
      if (isEditing) existingImages.forEach(u => fd.append("existingImages", u));

      const result = isEditing
        ? await updateProperty(propertyId, fd)
        : await createProperty(fd);

      toast.success(isEditing ? "Bien mis à jour !" : "Bien ajouté avec succès !");
      onSave(result, isEditing);
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la sauvegarde.");
    } finally {
      setLoading(false);
    }
  };

  if (isEditing && loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: BLUE }} />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-gray-900 text-lg" style={{ fontFamily:"'DM Sans', sans-serif" }}>
          {isEditing ? "Modifier le bien" : "Ajouter un bien"}
        </h3>
        <button onClick={onCancel}
          className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
          <X size={18} />
        </button>
      </div>
      <PropertyForm
        formData={formData}
        setFormData={setFormData}
        existingImages={existingImages}
        setExistingImages={setExistingImages}
        onSubmit={handleSubmit}
        loading={loading}
        isEditing={isEditing}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Carte bien (liste)
// ─────────────────────────────────────────────────────────────
const ALTIMMO_FALLBACK = 'https://placehold.co/600x400/2E7BB5/FFFFFF?text=Altimmo';

const PropertyCard = ({ property, rental, onEdit, onDelete, onToggleAvailability, onRentalRequest, onOpenCockpit }) => {
  const [imgSrc, setImgSrc] = useState(
    getImageUrl(property.images?.[0]) || ALTIMMO_FALLBACK
  );
  const [plannedExitAt, setPlannedExitAt] = useState('');
  const nextAvailability = property.status === 'location'
    ? (property.availability === 'Disponible' ? 'Loué' : 'Disponible')
    : (property.availability === 'Disponible' ? 'Vendu' : 'Disponible');
  const availabilityLabel = property.status === 'location'
    ? (property.availability === 'Disponible' ? 'Marquer occupé' : 'Marquer disponible')
    : (property.availability === 'Disponible' ? 'Marquer vendu' : 'Marquer disponible');

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all group">
      <div className="relative h-44 overflow-hidden">
        <Image src={imgSrc} alt={property.title} fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          onError={() => setImgSrc(ALTIMMO_FALLBACK)} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <span className="absolute top-3 left-3 text-white text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: `linear-gradient(135deg, #1A5A8A, ${BLUE})`, fontFamily:"'DM Sans', sans-serif" }}>
          {property.type || 'Bien'}
        </span>
        <span className="absolute top-3 right-3 text-white text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: property.availability==='Disponible' ? 'linear-gradient(135deg,#15803D,#16A34A)' : 'linear-gradient(135deg,#B45309,#D97706)', fontFamily:"'DM Sans', sans-serif" }}>
          {property.availability || property.status}
        </span>
        <div className="absolute bottom-3 left-3">
          <span className="text-white text-sm font-bold"
            style={{ fontFamily:"'DM Sans', sans-serif", textShadow:'0 1px 4px rgba(0,0,0,0.5)' }}>
            {property.price ? `${Number(property.price).toLocaleString('fr-FR')} FCFA` : '—'}
          </span>
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-bold text-gray-900 mb-1 line-clamp-1"
          style={{ fontFamily:"'DM Sans', sans-serif" }}>
          {property.title}
        </h3>
        <p className="text-xs text-gray-400 line-clamp-2 mb-3">{property.description}</p>

        <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-4">
          {property.address?.city && (
            <span className="flex items-center gap-1">
              <MapPin size={11} className="text-red-400" />
              {property.address.city}
            </span>
          )}
          {property.surface && (
            <span className="flex items-center gap-1">
              <Maximize2 size={11} style={{ color:BLUE }} />
              {property.surface} m²
            </span>
          )}
          {property.bedrooms && (
            <span className="flex items-center gap-1">
              <Bed size={11} style={{ color:BLUE }} />
              {property.bedrooms}
            </span>
          )}
          {property.bathrooms && (
            <span className="flex items-center gap-1">
              <Bath size={11} style={{ color:BLUE }} />
              {property.bathrooms}
            </span>
          )}
        </div>

        {property.status === 'location' && (
          <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-2">
              <FileText size={13} style={{ color:BLUE }} /> Conditions de bail
            </div>
            <div className="grid grid-cols-1 gap-1 text-xs text-gray-500">
              <span>Caution : {property.cautionMultiplicateur ?? 2} mois</span>
              <span>Profils : {property.profilsLocataireRecherches?.length ? property.profilsLocataireRecherches.join(', ') : 'Non précisé'}</span>
              <span>Documents : {property.documentsRequis?.length ? property.documentsRequis.join(', ') : 'Non précisé'}</span>
            </div>
          </div>
        )}

        {!rental && <button onClick={() => onToggleAvailability(property, nextAvailability)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02] mb-2"
          style={{ background: property.availability==='Disponible' ? '#FEF3C7' : '#DCFCE7', color: property.availability==='Disponible' ? '#B45309' : '#15803D', fontFamily:"'DM Sans', sans-serif" }}>
          <CheckCircle2 size={13} /> {availabilityLabel}
        </button>}

        {rental && <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs text-gray-600">
          <div className="flex flex-wrap gap-2 font-semibold"><span>{rental.displayStatus}</span><span>·</span><span>{rental.publicationStatus}</span></div>
          {rental.activeLease && <p className="mt-1">Contrat : {rental.activeLease.statut} · fin {rental.activeLease.dateFinBail ? new Date(rental.activeLease.dateFinBail).toLocaleDateString('fr-FR') : 'non renseignée'}</p>}
          {rental.paymentSummary && <p className="mt-1">Attendu : {Number(rental.paymentSummary.expected || 0).toLocaleString('fr-FR')} · Payé : {Number(rental.paymentSummary.paid || 0).toLocaleString('fr-FR')} · Solde : {Number(rental.paymentSummary.remaining || 0).toLocaleString('fr-FR')} FCFA</p>}
          {rental.paymentSummary?.nextDueAt && <p className="mt-1">Prochaine échéance : {new Date(rental.paymentSummary.nextDueAt).toLocaleDateString('fr-FR')}</p>}
          {(rental.paymentSummary?.overdueCount > 0 || rental.paymentSummary?.partialCount > 0) && <p className="mt-1 font-semibold text-red-600">{rental.paymentSummary.overdueCount || 0} impayé(s) · {rental.paymentSummary.partialCount || 0} partiel(s)</p>}
          <div className="mt-2 flex flex-wrap gap-1">
            {rental.allowedActions?.includes('request_publish') && <button onClick={()=>onRentalRequest(rental,'request-publish')} className="rounded bg-green-100 px-2 py-1 font-semibold text-green-700">Demander publication</button>}
            {rental.allowedActions?.includes('request_suspension') && <button onClick={()=>onRentalRequest(rental,'request-suspension')} className="rounded bg-amber-100 px-2 py-1 font-semibold text-amber-700">Demander suspension</button>}
            {rental.allowedActions?.includes('report_maintenance') && <button onClick={()=>onRentalRequest(rental,'report-maintenance')} className="rounded bg-red-100 px-2 py-1 font-semibold text-red-700">Signaler maintenance</button>}
            {rental.allowedActions?.includes('declare_future_availability') && <div className="mt-1 flex w-full gap-1"><input type="date" min={new Date().toISOString().slice(0,10)} value={plannedExitAt} onChange={e=>setPlannedExitAt(e.target.value)} className="min-w-0 flex-1 rounded border border-gray-200 px-2 py-1"/><button disabled={!plannedExitAt} onClick={()=>onRentalRequest(rental,'declare-future-availability',{plannedAt:plannedExitAt})} className="rounded bg-blue-100 px-2 py-1 font-semibold text-blue-700 disabled:opacity-40">Déclarer sortie</button></div>}
          </div>
        </div>}

        <div className="flex gap-2">
          <button onClick={() => onOpenCockpit(property)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
            style={{ background:'#ECFDF5', color:'#047857', fontFamily:"'DM Sans', sans-serif" }}>
            <Building2 size={13} /> Patrimoine
          </button>
          <button onClick={() => onEdit(property)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
            style={{ background:`${BLUE}15`, color:BLUE, fontFamily:"'DM Sans', sans-serif" }}>
            <Edit2 size={13} /> Modifier
          </button>
          {!rental && <button onClick={() => onDelete(property._id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
            style={{ background:'#FEE2E2', color:'#DC2626', fontFamily:"'DM Sans', sans-serif" }}>
            <Trash2 size={13} /> Supprimer
          </button>}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Dialog de confirmation
// ─────────────────────────────────────────────────────────────
const ConfirmDialog = ({ message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
        style={{ background:'#FEE2E2' }}>
        <AlertCircle size={22} className="text-red-500" />
      </div>
      <h3 className="font-bold text-gray-900 mb-2" style={{ fontFamily:"'DM Sans', sans-serif" }}>Confirmation</h3>
      <p className="text-sm text-gray-500 mb-6">{message}</p>
      <div className="flex gap-3">
        <button onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all"
          style={{ fontFamily:"'DM Sans', sans-serif" }}>
          Annuler
        </button>
        <button onClick={onConfirm}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
          style={{ background:'linear-gradient(135deg,#B91C1C,#DC2626)', fontFamily:"'DM Sans', sans-serif" }}>
          Supprimer
        </button>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────
const OwnerPropertyManagement = () => {
  const { user, loading: authLoading } = useAuth();
  const [properties, setProperties]   = useState([]);
  const [rentals, setRentals]         = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [view, setView]               = useState("list");   // list | add | edit
  const [editingId, setEditingId]     = useState(null);
  const [confirm, setConfirm]         = useState(null);     // { id, message }
  const [cockpitProperty, setCockpitProperty] = useState(null); // GL-ASSET-UX-1

  const fetchProperties = useCallback(async () => {
    if (!user) return;
    setLoadingList(true);
    try {
      const [res, managed] = await Promise.all([getMyProperties(), getMyRentalManagement().catch(() => [])]);
      setProperties(res); setRentals(Array.isArray(managed) ? managed : []);
    } catch {
      toast.error("Erreur lors du chargement des biens.");
    } finally {
      setLoadingList(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user?._id && view === "list") fetchProperties();
  }, [view, user?._id, authLoading, fetchProperties]);

  const handleDelete = (id) => {
    setConfirm({ id, message:"Voulez-vous vraiment supprimer ce bien ? Cette action est irréversible." });
  };

  const confirmDelete = async () => {
    try {
      await deleteProperty(confirm.id);
      toast.success("Bien supprimé !");
      setProperties(prev => prev.filter(p => p._id !== confirm.id));
    } catch {
      toast.error("Erreur lors de la suppression.");
    } finally {
      setConfirm(null);
    }
  };

  const handleToggleAvailability = async (property, availability) => {
    try {
      const fd = new FormData();
      fd.append('availability', availability);
      if (property.images?.length) {
        property.images.forEach(image => fd.append('existingImages', image));
      }
      const updated = await updateProperty(property._id, fd);
      setProperties(prev => prev.map(p => p._id === property._id ? updated : p));
      toast.success(availability === 'Disponible' ? 'Bien marqué disponible.' : 'Disponibilité mise à jour.');
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la mise à jour de la disponibilité.");
    }
  };

  const handleRentalRequest = async (rental, action, extra = {}) => {
    try {
      const result = await requestRentalAction(rental._id, action, { reason: 'Demande depuis le dashboard propriétaire', ...extra });
      setRentals(prev => prev.map(item => item._id === rental._id ? result.rental : item));
      toast.success('Demande envoyée au gestionnaire.');
    } catch (error) { toast.error(error.response?.data?.message || 'Demande impossible.'); }
  };

  const handleEdit   = (property) => { setEditingId(property._id); setView("edit"); };
  const handleSave   = (saved, isUpdate) => {
    setProperties(prev =>
      isUpdate ? prev.map(p => p._id === saved._id ? saved : p) : [saved, ...prev]
    );
    setEditingId(null); setView("list");
  };
  const handleCancel = () => { setEditingId(null); setView("list"); };

  const availableCount = properties.filter(p => p.availability === 'Disponible').length;
  const occupiedCount = properties.filter(p => ['Loué', 'Vendu'].includes(p.availability)).length;
  const pendingCount = properties.filter(p => p.statusAdmin === 'En attente').length;

  if (authLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color:BLUE }} />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto">

      {/* ── En-tête ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900"
            style={{ fontFamily:"'DM Sans', sans-serif" }}>
            {view === 'list' ? 'Mes Biens Immobiliers' : view === 'add' ? 'Ajouter un bien' : 'Modifier le bien'}
          </h2>
          <p className="text-sm text-gray-400 mt-0.5" style={{ fontFamily:"'DM Sans', sans-serif" }}>
            {properties.length} bien{properties.length!==1?'s':''} publiés
          </p>
        </div>
        {view === 'list' && (
          <div className="flex flex-wrap justify-end gap-2">
            <Link href="/mes-biens/visites"
              className="flex min-h-11 items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border border-amber-200 bg-amber-50 text-amber-800 transition hover:bg-amber-100">
              <Calendar size={16} /> Rendez-vous
            </Link>
            <button onClick={() => setView("add")}
              className="flex min-h-11 items-center gap-2 px-4 py-2.5 text-white text-sm font-semibold rounded-xl transition-all hover:scale-105"
              style={{ background:`linear-gradient(135deg, #1A5A8A, ${BLUE})`, boxShadow:`0 4px 16px ${BLUE}35`, fontFamily:"'DM Sans', sans-serif" }}>
              <Plus size={16} /> Ajouter un bien
            </button>
          </div>
        )}
      </div>

      {view === 'list' && <PropertyPortfolioDashboard />}

      {view === 'list' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background:`${BLUE}12`, color:BLUE }}>
                <Building2 size={19} />
              </div>
              <div>
                <p className="text-xs text-gray-400">Biens publiés</p>
                <p className="text-xl font-bold text-gray-900">{properties.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-50 text-green-600">
                <CheckCircle2 size={19} />
              </div>
              <div>
                <p className="text-xs text-gray-400">Disponibles</p>
                <p className="text-xl font-bold text-gray-900">{availableCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600">
                <Clock3 size={19} />
              </div>
              <div>
                <p className="text-xs text-gray-400">Occupés / en attente</p>
                <p className="text-xl font-bold text-gray-900">{occupiedCount} / {pendingCount}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Formulaire ── */}
      {(view === 'add' || view === 'edit') && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <PropertyManagementForm
            propertyId={editingId}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </div>
      )}

      {/* ── Liste ── */}
      {view === 'list' && (
        <>
          {loadingList ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color:BLUE }} />
            </div>
          ) : properties.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background:`${BLUE}12` }}>
                <Home size={28} style={{ color:BLUE }} />
              </div>
              <p className="font-bold text-gray-700 mb-1" style={{ fontFamily:"'DM Sans', sans-serif" }}>Aucun bien publié</p>
              <p className="text-sm text-gray-400 mb-5" style={{ fontFamily:"'DM Sans', sans-serif" }}>
                Commencez par ajouter votre premier bien immobilier.
              </p>
              <button onClick={() => setView("add")}
                className="flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-xl transition-all hover:scale-105"
                style={{ background:`linear-gradient(135deg, #1A5A8A, ${BLUE})`, fontFamily:"'DM Sans', sans-serif" }}>
                <Plus size={16} /> Ajouter un bien
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {properties.map(p => (
                <PropertyCard key={p._id} property={p} rental={rentals.find(r=>String(r.property?._id||r.property)===String(p._id))}
                  onEdit={handleEdit} onDelete={handleDelete}
                  onToggleAvailability={handleToggleAvailability} onRentalRequest={handleRentalRequest}
                  onOpenCockpit={setCockpitProperty} />
              ))}
            </div>
          )}
        </>
      )}

      {/* GL-ASSET-UX-1 — cockpit patrimonial (Phase 2-3), même contenu que
          la page staff dédiée, réutilisé ici en modale pour le propriétaire. */}
      {cockpitProperty && (
        <PropertyAssetCockpitDrawer property={cockpitProperty} onClose={() => setCockpitProperty(null)} />
      )}

      {/* ── Dialog confirmation ── */}
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirmDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default OwnerPropertyManagement;
