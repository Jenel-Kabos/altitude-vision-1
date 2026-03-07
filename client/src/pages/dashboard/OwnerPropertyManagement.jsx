import React, { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import {
  Building2, Plus, Edit2, Trash2, MapPin, Maximize2, Bed, Bath,
  Loader2, AlertCircle, Home, X,
} from "lucide-react";
import {
  getMyProperties, createProperty, updateProperty,
  deleteProperty, getPropertyById,
} from "../../services/propertyService";
import PropertyForm from "../../components/dashboard/PropertyForm";

const BLUE = '#2E7BB5';
const GOLD = '#C8872A';

// ─────────────────────────────────────────────────────────────
// État formulaire initial
// ─────────────────────────────────────────────────────────────
const emptyForm = () => ({
  title:'', description:'', price:'', pole:'Altimmo',
  status:'vente', availability:'Disponible', type:'Appartement',
  address:{ street:'', district:'', city:'Brazzaville' },
  surface:'', bedrooms:'', bathrooms:'', amenities:'',
  latitude:-4.266, longitude:15.283, images:[],
});

// ─────────────────────────────────────────────────────────────
// Formulaire (ajout / édition)
// ─────────────────────────────────────────────────────────────
const PropertyManagementForm = ({ propertyId, onSave, onCancel }) => {
  const isEditing = !!propertyId;
  const [formData, setFormData]         = useState(emptyForm());
  const [existingImages, setExistingImages] = useState([]);
  const [loading, setLoading]           = useState(false);

  useEffect(() => {
    if (!isEditing) { setFormData(emptyForm()); setExistingImages([]); return; }
    const load = async () => {
      setLoading(true);
      try {
        const p = await getPropertyById(propertyId);
        setFormData({
          ...emptyForm(), ...p,
          address: {
            district: p.address?.district || '',
            street:   p.address?.street   || '',
            city:     p.address?.city     || 'Brazzaville',
          },
          amenities: p.amenities?.join(', ') || '',
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
      const { address, amenities, images, ...rest } = formData;
      Object.entries(rest).forEach(([k,v]) => v !== '' && fd.append(k, v));
      fd.append("address[street]",   address.street);
      fd.append("address[district]", address.district);
      fd.append("address[city]",     address.city);
      amenities.split(',').map(a=>a.trim()).filter(Boolean).forEach(a=>fd.append("amenities",a));
      fd.append("location", JSON.stringify({ type:"Point", coordinates:[formData.longitude,formData.latitude] }));
      images.forEach(f => fd.append("images", f));
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
        <h3 className="font-bold text-gray-900 text-lg" style={{ fontFamily:"'Outfit', sans-serif" }}>
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
const PropertyCard = ({ property, onEdit, onDelete }) => {
  const img = property.images?.[0] || 'https://placehold.co/600x400/2E7BB5/FFFFFF?text=Altimmo';
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all group">
      <div className="relative h-44 overflow-hidden">
        <img src={img} alt={property.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={e => { e.target.src='https://placehold.co/600x400/2E7BB5/FFFFFF?text=Altimmo'; }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <span className="absolute top-3 left-3 text-white text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: `linear-gradient(135deg, #1A5A8A, ${BLUE})`, fontFamily:"'Outfit', sans-serif" }}>
          {property.type || 'Bien'}
        </span>
        <span className="absolute top-3 right-3 text-white text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: property.availability==='Disponible' ? 'linear-gradient(135deg,#15803D,#16A34A)' : 'linear-gradient(135deg,#B45309,#D97706)', fontFamily:"'Outfit', sans-serif" }}>
          {property.availability || property.status}
        </span>
        <div className="absolute bottom-3 left-3">
          <span className="text-white text-sm font-bold"
            style={{ fontFamily:"'Outfit', sans-serif", textShadow:'0 1px 4px rgba(0,0,0,0.5)' }}>
            {property.price ? `${Number(property.price).toLocaleString('fr-FR')} FCFA` : '—'}
          </span>
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-bold text-gray-900 mb-1 line-clamp-1"
          style={{ fontFamily:"'Outfit', sans-serif" }}>
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

        <div className="flex gap-2">
          <button onClick={() => onEdit(property)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
            style={{ background:`${BLUE}15`, color:BLUE, fontFamily:"'Outfit', sans-serif" }}>
            <Edit2 size={13} /> Modifier
          </button>
          <button onClick={() => onDelete(property._id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
            style={{ background:'#FEE2E2', color:'#DC2626', fontFamily:"'Outfit', sans-serif" }}>
            <Trash2 size={13} /> Supprimer
          </button>
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
      <h3 className="font-bold text-gray-900 mb-2" style={{ fontFamily:"'Outfit', sans-serif" }}>Confirmation</h3>
      <p className="text-sm text-gray-500 mb-6">{message}</p>
      <div className="flex gap-3">
        <button onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all"
          style={{ fontFamily:"'Outfit', sans-serif" }}>
          Annuler
        </button>
        <button onClick={onConfirm}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
          style={{ background:'linear-gradient(135deg,#B91C1C,#DC2626)', fontFamily:"'Outfit', sans-serif" }}>
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
  const [loadingList, setLoadingList] = useState(false);
  const [view, setView]               = useState("list");   // list | add | edit
  const [editingId, setEditingId]     = useState(null);
  const [confirm, setConfirm]         = useState(null);     // { id, message }

  const fetchProperties = useCallback(async () => {
    if (!user) return;
    setLoadingList(true);
    try {
      const res = await getMyProperties();
      setProperties(res);
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

  const handleEdit  = (property) => { setEditingId(property._id); setView("edit"); };
  const handleSave  = (saved, isUpdate) => {
    setProperties(prev =>
      isUpdate ? prev.map(p => p._id === saved._id ? saved : p) : [saved, ...prev]
    );
    setEditingId(null); setView("list");
  };
  const handleCancel = () => { setEditingId(null); setView("list"); };

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
            style={{ fontFamily:"'Outfit', sans-serif" }}>
            {view === 'list' ? 'Mes Biens Immobiliers' : view === 'add' ? 'Ajouter un bien' : 'Modifier le bien'}
          </h2>
          <p className="text-sm text-gray-400 mt-0.5" style={{ fontFamily:"'Outfit', sans-serif" }}>
            {properties.length} bien{properties.length!==1?'s':''} publiés
          </p>
        </div>
        {view === 'list' && (
          <button onClick={() => setView("add")}
            className="flex items-center gap-2 px-4 py-2.5 text-white text-sm font-semibold rounded-xl transition-all hover:scale-105"
            style={{ background:`linear-gradient(135deg, #1A5A8A, ${BLUE})`, boxShadow:`0 4px 16px ${BLUE}35`, fontFamily:"'Outfit', sans-serif" }}>
            <Plus size={16} /> Ajouter un bien
          </button>
        )}
      </div>

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
              <p className="font-bold text-gray-700 mb-1" style={{ fontFamily:"'Outfit', sans-serif" }}>Aucun bien publié</p>
              <p className="text-sm text-gray-400 mb-5" style={{ fontFamily:"'Outfit', sans-serif" }}>
                Commencez par ajouter votre premier bien immobilier.
              </p>
              <button onClick={() => setView("add")}
                className="flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-xl transition-all hover:scale-105"
                style={{ background:`linear-gradient(135deg, #1A5A8A, ${BLUE})`, fontFamily:"'Outfit', sans-serif" }}>
                <Plus size={16} /> Ajouter un bien
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {properties.map(p => (
                <PropertyCard key={p._id} property={p}
                  onEdit={handleEdit} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </>
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