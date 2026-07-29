"use client";

// client/lib/components/dashboard/SalePropertyForm.jsx — Sprint A (séparation
// Vente/Location). Formulaire spécialisé Vente, self-contained (gère son
// propre état, contrairement à PropertyForm.jsx qui reçoit formData/setFormData
// de son parent) — aucun champ de loyer, de tarif par nuit, de type de
// chambre ni de règle de check-in : uniquement ce qui a un sens pour une
// vente. Voir server/docs/PROPERTY_TRANSACTION_ARCHITECTURE.md.

import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { VILLES, getArrondissementsFor } from "../../constants/locations";
import { PROPERTY_TYPES } from "../../constants/propertyTypes";
import { LEGAL_STATUSES } from "../../constants/saleProperty";
import { createFullSaleProperty, updateFullSaleProperty } from "../../services/salePropertyService";
import { Home, Map, ShoppingBag, Tag } from "lucide-react";

const emptyForm = (initial = {}) => ({
  title: initial.title || "",
  description: initial.description || "",
  price: initial.price || "",
  honoraires: initial.honoraires ?? "",
  fraisVisite: initial.fraisVisite ?? 0,
  type: initial.type || "Appartement",
  availability: initial.availability || "Disponible",
  address: initial.address || { street: "", arrondissement: "", city: "Brazzaville", neighborhood: "" },
  surface: initial.surface || "",
  bedrooms: initial.bedrooms || "",
  bathrooms: initial.bathrooms || "",
  livingRooms: initial.livingRooms || "",
  kitchens: initial.kitchens || "",
  constructionType: initial.constructionType || "Non spécifié",
  amenities: Array.isArray(initial.amenities) ? initial.amenities.join(", ") : "",
  latitude: initial.latitude ?? -4.266,
  longitude: initial.longitude ?? 15.283,
  images: [],
  // Situation juridique / négociation (SaleManagement)
  negotiable: initial.negotiable ?? false,
  ownershipDocumentType: initial.ownershipDocumentType || "",
  ownershipDocumentAvailable: initial.ownershipDocumentAvailable ?? false,
  legalStatus: initial.legalStatus || "non_renseigne",
  financingAccepted: initial.financingAccepted ?? false,
  agencyCommission: initial.agencyCommission ?? "",
  sellerConditions: initial.sellerConditions || "",
});

const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400";

const SalePropertyForm = ({
  propertyId = null,
  initialProperty = null,
  initialSale = null,
  existingImages: initialExistingImages = [],
  onSuccess,
  onCancel,
}) => {
  const [formData, setFormData] = useState(() => emptyForm({ ...initialProperty, ...initialSale }));
  const [existingImages, setExistingImages] = useState(initialExistingImages);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleCityChange = (e) => {
    const city = e.target.value;
    setFormData((prev) => ({
      ...prev,
      address: {
        ...prev.address,
        city,
        arrondissement: getArrondissementsFor(city).includes(prev.address.arrondissement) ? prev.address.arrondissement : "",
      },
    }));
  };

  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, address: { ...prev.address, [name]: value } }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setFormData((prev) => ({ ...prev, images: [...prev.images, ...files] }));
    e.target.value = null;
  };

  const validate = () => {
    const e = {};
    if (!formData.title) e.title = "Le titre est requis.";
    if (!formData.description) e.description = "La description est requise.";
    if (!(Number(formData.price) > 0)) e.price = "Le prix de vente doit être positif.";
    if (!formData.surface) e.surface = "La surface est requise.";
    if (!formData.address.arrondissement) e.arrondissement = "L'arrondissement est requis.";
    if (formData.agencyCommission !== "" && (Number(formData.agencyCommission) < 0 || Number(formData.agencyCommission) > 100)) {
      e.agencyCommission = "La commission doit être comprise entre 0 et 100.";
    }
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!propertyId && formData.images.length === 0 && existingImages.length === 0) {
      toast.error("Veuillez ajouter au moins une image");
      return;
    }
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error("Veuillez corriger les champs indiqués.");
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const {
        address, amenities, images, latitude, longitude,
        negotiable, ownershipDocumentType, ownershipDocumentAvailable,
        legalStatus, financingAccepted, agencyCommission, sellerConditions,
        ...rest
      } = formData;

      const data = new FormData();
      Object.entries(rest).forEach(([k, v]) => {
        if (v !== "" && v !== null && v !== undefined) data.append(k, v);
      });
      data.append("latitude", latitude);
      data.append("longitude", longitude);
      data.append("address", JSON.stringify(address));
      const amenitiesArray = amenities.split(",").map((a) => a.trim()).filter(Boolean);
      data.append("amenities", JSON.stringify(amenitiesArray));
      images.forEach((file) => data.append("images", file));
      if (propertyId && existingImages.length > 0) data.append("existingImages", JSON.stringify(existingImages));
      data.append("location", JSON.stringify({ type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] }));

      data.append("negotiable", negotiable ? "true" : "false");
      if (ownershipDocumentType) data.append("ownershipDocumentType", ownershipDocumentType);
      data.append("ownershipDocumentAvailable", ownershipDocumentAvailable ? "true" : "false");
      data.append("legalStatus", legalStatus);
      data.append("financingAccepted", financingAccepted ? "true" : "false");
      if (agencyCommission !== "") data.append("agencyCommission", agencyCommission);
      if (sellerConditions) data.append("sellerConditions", sellerConditions);

      if (propertyId) {
        const result = await updateFullSaleProperty(propertyId, data);
        toast.success("Annonce de vente modifiée avec succès !");
        onSuccess?.(result);
      } else {
        const result = await createFullSaleProperty(data);
        toast.success("Annonce de vente créée avec succès !");
        onSuccess?.(result);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Erreur lors de l'enregistrement de l'annonce.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {propertyId && (() => {
        const TypeIcon = formData.type === 'Terrain' ? Map : ['Commerce', 'Bureau', 'Entrepôt'].includes(formData.type) ? ShoppingBag : Home;
        return <div className="rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 p-4 text-white shadow-sm">
          <div className="flex items-center gap-3"><span className="rounded-xl bg-white/20 p-2"><Tag className="h-6 w-6" /></span><div><p className="text-xs font-semibold uppercase tracking-wider text-white/80">Modification · {formData.type}</p><h2 className="text-xl font-bold">Modifier une vente</h2></div><TypeIcon className="ml-auto h-7 w-7 text-white/70" /></div>
          <p className="mt-3 text-sm text-white/90">{formData.type === 'Terrain' ? 'Mettez en avant la superficie, la situation juridique et le potentiel du terrain.' : 'Vérifiez en priorité le prix de vente, la négociation, la situation juridique et la disponibilité.'}</p>
        </div>;
      })()}
      {propertyId && (
        <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
          Type de transaction : <span className="font-semibold">Vente</span> — non modifiable en édition.
          Pour changer de type de transaction, supprimez cette annonce et créez-en une nouvelle.
        </p>
      )}
      {/* Informations générales */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
        <input name="title" value={formData.title} onChange={handleChange} aria-label="Titre de l'annonce" className={inputClass} />
        {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
        <textarea name="description" value={formData.description} onChange={handleChange} rows={4} aria-label="Description de l'annonce" className={inputClass} />
        {errors.description && <p className="text-xs text-red-600 mt-1">{errors.description}</p>}
      </div>

      {/* Localisation */}
      <div className="border-t pt-4 mt-2">
        <h3 className="text-lg font-semibold mb-3">Localisation</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ville *</label>
            <select value={formData.address.city} onChange={handleCityChange} aria-label="Ville" className={inputClass}>
              {VILLES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Arrondissement *</label>
            <select name="arrondissement" value={formData.address.arrondissement} onChange={handleAddressChange} aria-label="Arrondissement" className={inputClass}>
              <option value="">Sélectionner...</option>
              {getArrondissementsFor(formData.address.city).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            {errors.arrondissement && <p className="text-xs text-red-600 mt-1">{errors.arrondissement}</p>}
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Quartier</label>
          <input name="neighborhood" value={formData.address.neighborhood} onChange={handleAddressChange} aria-label="Quartier" className={inputClass} />
        </div>
      </div>

      {/* Caractéristiques physiques */}
      <div className="border-t pt-4 mt-2">
        <h3 className="text-lg font-semibold mb-3">Caractéristiques physiques</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select name="type" value={formData.type} onChange={handleChange} aria-label="Type de bien" className={inputClass}>
              {PROPERTY_TYPES.map((t) => <option key={t.value ?? t} value={t.value ?? t}>{t.label ?? t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Surface (m²) *</label>
            <input type="number" name="surface" value={formData.surface} onChange={handleChange} aria-label="Surface en m²" className={inputClass} />
            {errors.surface && <p className="text-xs text-red-600 mt-1">{errors.surface}</p>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chambres</label>
            <input type="number" name="bedrooms" value={formData.bedrooms} onChange={handleChange} aria-label="Chambres" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Salles de bain</label>
            <input type="number" name="bathrooms" value={formData.bathrooms} onChange={handleChange} aria-label="Salles de bain" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Séjours</label>
            <input type="number" name="livingRooms" value={formData.livingRooms} onChange={handleChange} aria-label="Séjours" className={inputClass} />
          </div>
        </div>
      </div>

      {/* Situation juridique */}
      <div className="border-t pt-4 mt-2">
        <h3 className="text-lg font-semibold mb-3">Situation juridique</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut juridique</label>
            <select name="legalStatus" value={formData.legalStatus} onChange={handleChange} aria-label="Statut juridique" className={inputClass}>
              {LEGAL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type de document de propriété</label>
            <input name="ownershipDocumentType" value={formData.ownershipDocumentType} onChange={handleChange} placeholder="Ex: Titre foncier" aria-label="Type de document de propriété" className={inputClass} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
          <input type="checkbox" name="ownershipDocumentAvailable" checked={formData.ownershipDocumentAvailable} onChange={handleChange} aria-label="Document de propriété disponible" />
          Document de propriété disponible
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="financingAccepted" checked={formData.financingAccepted} onChange={handleChange} aria-label="Financement accepté" />
          Financement accepté
        </label>
      </div>

      {/* Prix et négociation */}
      <div className="border-t pt-4 mt-2">
        <h3 className="text-lg font-semibold mb-3">Prix et négociation</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prix de vente (FCFA) *</label>
            <input type="number" name="price" value={formData.price} onChange={handleChange} aria-label="Prix de vente" className={inputClass} />
            {errors.price && <p className="text-xs text-red-600 mt-1">{errors.price}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Commission d'agence (%)</label>
            <input type="number" name="agencyCommission" value={formData.agencyCommission} onChange={handleChange} aria-label="Commission d'agence" className={inputClass} />
            {errors.agencyCommission && <p className="text-xs text-red-600 mt-1">{errors.agencyCommission}</p>}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 mb-3">
          <input type="checkbox" name="negotiable" checked={formData.negotiable} onChange={handleChange} aria-label="Prix négociable" />
          Prix négociable
        </label>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Conditions du vendeur</label>
          <textarea name="sellerConditions" value={formData.sellerConditions} onChange={handleChange} rows={2} aria-label="Conditions du vendeur" className={inputClass} />
        </div>
      </div>

      {/* Médias */}
      <div className="border-t pt-4 mt-2">
        <h3 className="text-lg font-semibold mb-3">Médias</h3>
        {existingImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {existingImages.map((url) => (
              <div key={url} className="relative w-20 h-20">
                <img src={url} alt="" className="w-full h-full object-cover rounded-md" />
                <button
                  type="button"
                  aria-label={`Supprimer l'image ${url}`}
                  onClick={() => setExistingImages((prev) => prev.filter((u) => u !== url))}
                  className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 text-xs leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <input type="file" multiple accept="image/*" onChange={handleImageChange} aria-label="Ajouter des images" />
        <p className="text-xs text-gray-500 mt-1">
          {formData.images.length === 0 ? "Aucune nouvelle image" : `${formData.images.length} nouvelle(s) image(s) sélectionnée(s)`}
        </p>
      </div>

      {/* Publication */}
      <div className="border-t pt-4 mt-2">
        <h3 className="text-lg font-semibold mb-3">Publication</h3>
        <label className="block text-sm font-medium text-gray-700 mb-1">Disponibilité</label>
        <select name="availability" value={formData.availability} onChange={handleChange} aria-label="Disponibilité" className={inputClass}>
          <option>Disponible</option>
          <option>Réservé</option>
          <option>Vendu</option>
          <option>Retiré</option>
        </select>
      </div>

      <div className="flex gap-3 mt-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200">
            Annuler
          </button>
        )}
        <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60">
          {loading ? "Enregistrement..." : "Enregistrer l'annonce"}
        </button>
      </div>
    </form>
  );
};

export default SalePropertyForm;
