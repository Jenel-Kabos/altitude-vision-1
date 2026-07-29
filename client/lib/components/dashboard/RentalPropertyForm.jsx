"use client";

// client/lib/components/dashboard/RentalPropertyForm.jsx — Sprint A
// (séparation Vente/Location). Formulaire spécialisé Location,
// self-contained — aucun tarif hôtelier, aucun type de chambre. Le loyer
// mensuel (`price` sur Property) et les champs de fiche RentalManagement
// (caution, avance, conditions du bail…) sont les seuls champs financiers.

import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { VILLES, getArrondissementsFor } from "../../constants/locations";
import { PROPERTY_TYPES } from "../../constants/propertyTypes";
import { TENANT_PROFILES, REQUIRED_DOCUMENTS } from "../../constants/rentalProperty";
import { createFullRentalProperty, updateFullRentalProperty } from "../../services/rentalPropertyService";
import { getPropertyFormConfig } from "../../utils/propertyFormConfig";

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
  // Fiche RentalManagement
  monthlyRent: initial.monthlyRent ?? "",
  charges: initial.charges ?? 0,
  chargesIncluded: initial.chargesIncluded ?? false,
  furnished: initial.furnished ?? false,
  depositAmount: initial.depositAmount ?? "",
  cautionMultiplicateur: initial.cautionMultiplicateur ?? 2,
  managementFee: initial.managementFee ?? "",
  minimumLeaseMonths: initial.minimumLeaseMonths ?? 12,
  availableFrom: initial.availableFrom ? String(initial.availableFrom).slice(0, 10) : "",
  petsAllowed: initial.petsAllowed ?? false,
  rentalConditions: initial.rentalConditions || "",
  profilsLocataireRecherches: initial.profilsLocataireRecherches || [],
  documentsRequis: initial.documentsRequis || [],
});

const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400";

const RentalPropertyForm = ({
  propertyId = null,
  initialProperty = null,
  initialRental = null,
  existingImages: initialExistingImages = [],
  onSuccess,
  onCancel,
}) => {
  const [formData, setFormData] = useState(() => emptyForm({ ...initialProperty, ...initialRental }));
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

  const handleCheckboxArrayChange = (field, value) => {
    setFormData((prev) => {
      const current = prev[field] || [];
      return {
        ...prev,
        [field]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
      };
    });
  };

  const validate = () => {
    const e = {};
    if (!formData.title) e.title = "Le titre est requis.";
    if (!formData.description) e.description = "La description est requise.";
    if (!(Number(formData.price) > 0)) e.price = "Le loyer mensuel doit être positif.";
    if (!formData.surface) e.surface = "La surface est requise.";
    if (!formData.address.arrondissement) e.arrondissement = "L'arrondissement est requis.";
    if (formData.cautionMultiplicateur !== "" && (Number(formData.cautionMultiplicateur) < 0 || Number(formData.cautionMultiplicateur) > 6)) {
      e.cautionMultiplicateur = "La caution doit être comprise entre 0 et 6 mois de loyer.";
    }
    if (!Number.isInteger(Number(formData.minimumLeaseMonths)) || Number(formData.minimumLeaseMonths) < 1) {
      e.minimumLeaseMonths = "La durée minimale du bail doit être un nombre entier de mois (≥ 1).";
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
        monthlyRent, charges, chargesIncluded, furnished, depositAmount,
        cautionMultiplicateur, managementFee, minimumLeaseMonths, availableFrom,
        petsAllowed, rentalConditions, profilsLocataireRecherches, documentsRequis,
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

      // `price` (Property, générique) porte déjà le loyer affiché — monthlyRent
      // (RentalManagement) est envoyé séparément pour rester la source de
      // vérité des règles métier location, cohérent même si l'un des deux
      // champs venait à diverger (ex: prix affiché arrondi).
      if (monthlyRent !== "") data.append("monthlyRent", monthlyRent);
      else data.append("monthlyRent", formData.price);
      if (charges !== "") data.append("charges", charges);
      data.append("chargesIncluded", chargesIncluded ? "true" : "false");
      data.append("furnished", furnished ? "true" : "false");
      if (depositAmount !== "") data.append("depositAmount", depositAmount);
      if (cautionMultiplicateur !== "") data.append("cautionMultiplicateur", cautionMultiplicateur);
      if (managementFee !== "") data.append("managementFee", managementFee);
      if (minimumLeaseMonths !== "") data.append("minimumLeaseMonths", minimumLeaseMonths);
      if (availableFrom) data.append("availableFrom", availableFrom);
      data.append("petsAllowed", petsAllowed ? "true" : "false");
      if (rentalConditions) data.append("rentalConditions", rentalConditions);
      data.append("profilsLocataireRecherches", JSON.stringify(profilsLocataireRecherches));
      data.append("documentsRequis", JSON.stringify(documentsRequis));

      if (propertyId) {
        const result = await updateFullRentalProperty(propertyId, data);
        toast.success("Annonce de location modifiée avec succès !");
        onSuccess?.(result);
      } else {
        const result = await createFullRentalProperty(data);
        toast.success("Annonce de location créée avec succès !");
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
      {(() => {
        const config = getPropertyFormConfig({ transactionType: 'location', propertyType: formData.type, mode: propertyId ? 'edit' : 'create' }); const TypeIcon = config.TypeIcon; const Icon = config.Icon;
        return <div className={`rounded-2xl bg-gradient-to-r ${config.tone} p-4 text-white shadow-sm`}>
          <div className="flex items-center gap-3"><span className="rounded-xl bg-white/20 p-2"><Icon className="h-6 w-6" /></span><div><p className="text-xs font-semibold uppercase tracking-wider text-white/80">{propertyId ? 'Modification' : 'Création'} · {formData.type}</p><h2 className="text-xl font-bold">{config.title}</h2></div><TypeIcon className="ml-auto h-7 w-7 text-white/70" /></div>
          <p className="mt-3 text-sm text-white/90">{config.contextHelp}</p>
        </div>;
      })()}
      {propertyId && (
        <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
          Type de transaction : <span className="font-semibold">Location</span> — non modifiable en édition.
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
      </div>

      {/* Caractéristiques */}
      <div className="border-t pt-4 mt-2">
        <h3 className="text-lg font-semibold mb-3">Caractéristiques</h3>
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
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="furnished" checked={formData.furnished} onChange={handleChange} aria-label="Meublé" />
          Meublé
        </label>
      </div>

      {/* Loyer et charges */}
      <div className="border-t pt-4 mt-2">
        <h3 className="text-lg font-semibold mb-3">Loyer et charges</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loyer mensuel (FCFA) *</label>
            <input type="number" name="price" value={formData.price} onChange={handleChange} aria-label="Loyer mensuel" className={inputClass} />
            {errors.price && <p className="text-xs text-red-600 mt-1">{errors.price}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Charges (FCFA)</label>
            <input type="number" name="charges" value={formData.charges} onChange={handleChange} aria-label="Charges" className={inputClass} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="chargesIncluded" checked={formData.chargesIncluded} onChange={handleChange} aria-label="Charges incluses" />
          Charges incluses dans le loyer
        </label>
      </div>

      {/* Caution et avance */}
      <div className="border-t pt-4 mt-2">
        <h3 className="text-lg font-semibold mb-3">Caution et avance</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Caution (× loyer mensuel)</label>
            <input type="number" name="cautionMultiplicateur" min="0" max="6" value={formData.cautionMultiplicateur} onChange={handleChange} aria-label="Multiplicateur de caution" className={inputClass} />
            {errors.cautionMultiplicateur && <p className="text-xs text-red-600 mt-1">{errors.cautionMultiplicateur}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Durée minimale du bail (mois) *</label>
            <input type="number" name="minimumLeaseMonths" min="1" step="1" value={formData.minimumLeaseMonths} onChange={handleChange} aria-label="Durée minimale du bail" className={inputClass} />
            {errors.minimumLeaseMonths && <p className="text-xs text-red-600 mt-1">{errors.minimumLeaseMonths}</p>}
          </div>
        </div>
      </div>

      {/* Conditions du bail */}
      <div className="border-t pt-4 mt-2">
        <h3 className="text-lg font-semibold mb-3">Conditions du bail</h3>
        <div className="mb-3">
          <p className="block text-sm font-medium text-gray-700 mb-2">Profils de locataires recherchés</p>
          <div className="grid grid-cols-2 gap-2">
            {TENANT_PROFILES.map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={formData.profilsLocataireRecherches.includes(p)} onChange={() => handleCheckboxArrayChange("profilsLocataireRecherches", p)} />
                {p}
              </label>
            ))}
          </div>
        </div>
        <div className="mb-3">
          <p className="block text-sm font-medium text-gray-700 mb-2">Documents requis</p>
          <div className="grid grid-cols-2 gap-2">
            {REQUIRED_DOCUMENTS.map((d) => (
              <label key={d} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={formData.documentsRequis.includes(d)} onChange={() => handleCheckboxArrayChange("documentsRequis", d)} />
                {d}
              </label>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 mb-3">
          <input type="checkbox" name="petsAllowed" checked={formData.petsAllowed} onChange={handleChange} aria-label="Animaux autorisés" />
          Animaux autorisés
        </label>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Conditions additionnelles</label>
          <textarea name="rentalConditions" value={formData.rentalConditions} onChange={handleChange} rows={2} aria-label="Conditions additionnelles" className={inputClass} />
        </div>
      </div>

      {/* Disponibilité */}
      <div className="border-t pt-4 mt-2">
        <h3 className="text-lg font-semibold mb-3">Disponibilité</h3>
        <label className="block text-sm font-medium text-gray-700 mb-1">Disponible à partir de</label>
        <input type="date" name="availableFrom" value={formData.availableFrom} onChange={handleChange} aria-label="Disponible à partir de" className={inputClass} />
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

export default RentalPropertyForm;
