"use client";

// client/lib/components/dashboard/HotelPropertyForm.jsx — Sprint B2 (domaine
// Hôtellerie). Formulaire dédié à l'établissement hôtelier, self-contained
// (gère son propre état, comme SalePropertyForm/RentalPropertyForm — voir
// server/docs/PROPERTY_TRANSACTION_ARCHITECTURE.md) : aucune notion de
// chambre physique, aucune réservation. Les catégories de chambres et leurs
// tarifs se gèrent depuis ManageRoomCategoriesPage/ManageHotelRatesPage
// (liées une fois l'hôtel créé) — ce formulaire couvre uniquement
// Informations/Services/Galerie/Publication.

import React, { useState } from "react";
import { toast } from "react-hot-toast";
import Link from "next/link";
import { VILLES, getArrondissementsFor } from "../../constants/locations";
import { HOTEL_SERVICES } from "../../constants/hotel";
import {
  createFullHotel, updateFullHotel, createMyHotel, updateMyHotel, submitHotel,
} from "../../services/hotelService";

const emptyForm = (initial = {}) => ({
  title: initial.title || "",
  description: initial.description || "",
  price: initial.price || "",
  address: initial.address || { street: "", arrondissement: "", city: "Brazzaville", neighborhood: "" },
  latitude: initial.latitude ?? -4.266,
  longitude: initial.longitude ?? 15.283,
  images: [],
  name: initial.name || "",
  brand: initial.brand || "",
  hotelDescription: initial.hotelDescription || "",
  starRating: initial.starRating ?? "",
  phone: initial.phone || "",
  email: initial.email || "",
  website: initial.website || "",
  contactResponsable: initial.contact?.responsable || "",
  contactHoraires: initial.contact?.horaires || "",
  hotelServicesStructured: initial.hotelServices || Object.fromEntries(HOTEL_SERVICES.map((s) => [s.key, false])),
});

const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400";

const HotelPropertyForm = ({
  hotelId = null,
  initialProperty = null,
  initialHotel = null,
  existingImages: initialExistingImages = [],
  completion = null,
  // "admin" (dashboard admin, ManagePropertiesPage) ou "owner" (Mes hôtels)
  // — mêmes contrôleurs serveur, endpoints distincts (voir hotelService.js).
  scope = "admin",
  onSuccess,
  onCancel,
}) => {
  const [formData, setFormData] = useState(() => emptyForm({ ...initialProperty, ...initialHotel }));
  const [existingImages, setExistingImages] = useState(initialExistingImages);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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

  const handleServiceToggle = (key) => {
    setFormData((prev) => ({
      ...prev,
      hotelServicesStructured: { ...prev.hotelServicesStructured, [key]: !prev.hotelServicesStructured[key] },
    }));
  };

  const validate = () => {
    const e = {};
    if (!formData.name) e.name = "Le nom de l'hôtel est requis.";
    if (!formData.title) e.title = "Le titre de l'annonce est requis.";
    if (!formData.description) e.description = "La description est requise.";
    if (!(Number(formData.price) > 0)) e.price = "Le prix indicatif doit être positif.";
    if (!formData.address.arrondissement) e.arrondissement = "L'arrondissement est requis.";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hotelId && formData.images.length === 0 && existingImages.length === 0) {
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
        address, images, latitude, longitude,
        name, brand, hotelDescription, starRating, phone, email, website,
        contactResponsable, contactHoraires, hotelServicesStructured,
        ...rest
      } = formData;

      const data = new FormData();
      Object.entries(rest).forEach(([k, v]) => {
        if (v !== "" && v !== null && v !== undefined) data.append(k, v);
      });
      data.append("latitude", latitude);
      data.append("longitude", longitude);
      data.append("address", JSON.stringify(address));
      data.append("location", JSON.stringify({ type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] }));
      images.forEach((file) => data.append("images", file));
      if (hotelId && existingImages.length > 0) data.append("existingImages", JSON.stringify(existingImages));

      data.append("name", name);
      if (brand) data.append("brand", brand);
      data.append("description", hotelDescription || formData.description);
      if (starRating !== "") data.append("starRating", starRating);
      if (phone) data.append("phone", phone);
      if (email) data.append("email", email);
      if (website) data.append("website", website);
      data.append("contact", JSON.stringify({ responsable: contactResponsable, horaires: contactHoraires, languesParlees: [] }));
      data.append("hotelServicesStructured", JSON.stringify(hotelServicesStructured));

      const create = scope === "owner" ? createMyHotel : createFullHotel;
      const update = scope === "owner" ? updateMyHotel : updateFullHotel;

      if (hotelId) {
        const result = await update(hotelId, data);
        toast.success("Hôtel modifié avec succès !");
        onSuccess?.(result);
      } else {
        const result = await create(data);
        toast.success("Hôtel créé avec succès ! Complétez ses catégories de chambres pour pouvoir le soumettre.");
        onSuccess?.(result);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Erreur lors de l'enregistrement de l'hôtel.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!hotelId) return;
    try {
      await submitHotel(hotelId);
      toast.success("Hôtel soumis pour validation.");
    } catch (err) {
      const comp = err.response?.data?.completion;
      toast.error(comp ? `Incomplet (${comp.score}%).` : (err.response?.data?.message || "Erreur lors de la soumission."));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* ------------------ SECTION INFORMATIONS ------------------ */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Informations</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'hôtel *</label>
            <input name="name" value={formData.name} onChange={handleChange} aria-label="Nom de l'hôtel" className={inputClass} />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Enseigne</label>
            <input name="brand" value={formData.brand} onChange={handleChange} aria-label="Enseigne" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie (étoiles)</label>
            <select name="starRating" value={formData.starRating} onChange={handleChange} aria-label="Catégorie (étoiles)" className={inputClass}>
              <option value="">Non classé</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} étoile{n > 1 ? 's' : ''}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre de l'annonce *</label>
            <input name="title" value={formData.title} onChange={handleChange} aria-label="Titre de l'annonce" className={inputClass} />
            {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title}</p>}
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea name="description" value={formData.description} onChange={handleChange} rows={3} aria-label="Description" className={inputClass} />
            {errors.description && <p className="text-xs text-red-600 mt-1">{errors.description}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prix indicatif (FCFA) *</label>
            <input type="number" min="0" name="price" value={formData.price} onChange={handleChange} aria-label="Prix indicatif" className={inputClass} />
            {errors.price && <p className="text-xs text-red-600 mt-1">{errors.price}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
            <input name="phone" value={formData.phone} onChange={handleChange} aria-label="Téléphone" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input name="email" value={formData.email} onChange={handleChange} aria-label="Email de l'hôtel" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Site web</label>
            <input name="website" value={formData.website} onChange={handleChange} aria-label="Site web" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
            <input name="contactResponsable" value={formData.contactResponsable} onChange={handleChange} aria-label="Responsable" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Horaires de réception</label>
            <input name="contactHoraires" value={formData.contactHoraires} onChange={handleChange} aria-label="Horaires de réception" className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
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
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Rue</label>
            <input name="street" value={formData.address.street} onChange={handleAddressChange} aria-label="Rue" className={inputClass} />
          </div>
        </div>
      </div>

      {/* ------------------ SECTION SERVICES ------------------ */}
      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold mb-3">Services</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {HOTEL_SERVICES.map((service) => (
            <label key={service.key} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={Boolean(formData.hotelServicesStructured[service.key])}
                onChange={() => handleServiceToggle(service.key)}
                aria-label={service.label}
              />
              {service.label}
            </label>
          ))}
        </div>
      </div>

      {/* ------------------ SECTION GALERIE ------------------ */}
      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold mb-3">Galerie *</h3>
        {existingImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {existingImages.map((url, i) => (
              <div key={i} className="relative w-24 h-24">
                <img src={url} alt="" className="w-full h-full object-cover rounded" />
                <button type="button" onClick={() => setExistingImages((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 text-xs">×</button>
              </div>
            ))}
          </div>
        )}
        <input type="file" multiple accept="image/*" onChange={handleImageChange} aria-label="Ajouter des photos" />
        {formData.images.length > 0 && <p className="text-xs text-gray-500 mt-1">{formData.images.length} nouvelle(s) photo(s) sélectionnée(s)</p>}
      </div>

      {/* ------------------ SECTION CATÉGORIES ------------------ */}
      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold mb-3">Catégories de chambres</h3>
        {hotelId ? (
          <Link href={`/dashboard/hotels/${hotelId}/room-categories`} className="text-sm text-blue-600 underline">
            Gérer les catégories de chambres de cet hôtel →
          </Link>
        ) : (
          <p className="text-sm text-gray-500">Enregistrez d'abord l'hôtel pour pouvoir créer ses catégories de chambres.</p>
        )}
      </div>

      {/* ------------------ SECTION PUBLICATION ------------------ */}
      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold mb-3">Publication</h3>
        {completion ? (
          <div className="mb-3">
            <span className={`text-xs font-semibold px-2 py-1 rounded ${completion.complete ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
              Complétude {completion.score}%
            </span>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-3">Le score de complétude sera calculé une fois l'hôtel enregistré.</p>
        )}
        {hotelId && (
          <button type="button" onClick={handleSubmitForReview} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">
            Soumettre pour validation
          </button>
        )}
      </div>

      <div className="flex gap-2 border-t pt-4">
        <button type="submit" disabled={loading} className="bg-gold text-white px-4 py-2 rounded font-medium disabled:opacity-50">
          {loading ? "Enregistrement..." : "Enregistrer l'hôtel"}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="text-gray-600 px-4 py-2">Annuler</button>}
      </div>
    </form>
  );
};

export default HotelPropertyForm;
