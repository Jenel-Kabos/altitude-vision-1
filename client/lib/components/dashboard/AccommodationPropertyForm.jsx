"use client";

import React, { useState } from "react";
import { toast } from "react-hot-toast";
import PropertyForm from "./PropertyForm";
import { createFullAccommodation, updateFullAccommodation } from "../../services/accommodationService";

const defaults = {
  title: "", description: "", price: "", status: "hebergement", pole: "Altimmo",
  type: "Appartement", availability: "Disponible", address: { street: "", arrondissement: "", city: "Brazzaville" },
  surface: "", bedrooms: "", bathrooms: "", livingRooms: "", kitchens: "", constructionType: "Non spécifié",
  amenities: "", latitude: -4.266, longitude: 15.283, images: [], accommodationType: "",
  maxAdults: "", maxChildren: "", beds: "", checkInTime: "14:00", checkOutTime: "11:00",
  minimumStay: 1, maximumStay: "", cancellationPolicy: "moderee", houseRules: "",
  securityDeposit: 0, cleaningFee: 0, nightlyPrice: "",
  accommodationAmenities: { cuisine: [], salon: [], internet: [], exterieur: [], parking: [], securite: [] },
  rules: { petsAllowed: false, partiesAllowed: false, smokingAllowed: false, childrenAllowed: true, minimumAge: 0 },
  includedServices: { menage: false, petitDejeuner: false, blanchisserie: false, transfert: false, cuisine: false },
};

export const accommodationSaveMessage = ({ isEditing, publicationStatus }) => {
  if (isEditing) return "Hébergement modifié.";
  if (publicationStatus === 'soumis') return "Hébergement créé et envoyé en modération.";
  return "Brouillon d’hébergement enregistré. Complétez-le avant de l’envoyer en modération.";
};

const initialData = (accommodation) => {
  if (!accommodation) return defaults;
  const property = accommodation.property || {};
  const nightly = (accommodation.rates || []).find((rate) => rate.mode === "nightly");
  return {
    ...defaults, ...property, status: "hebergement", images: [],
    address: property.address || defaults.address,
    amenities: Array.isArray(property.amenities) ? property.amenities.join(", ") : (property.amenities || ""),
    accommodationType: accommodation.accommodationType || "",
    maxAdults: accommodation.capacity?.maxAdults ?? "", maxChildren: accommodation.capacity?.maxChildren ?? "",
    beds: accommodation.beds ?? "", checkInTime: accommodation.checkInTime || "14:00",
    checkOutTime: accommodation.checkOutTime || "11:00", minimumStay: accommodation.minimumStay ?? 1,
    maximumStay: accommodation.maximumStay ?? "", cancellationPolicy: accommodation.cancellationPolicy || "moderee",
    houseRules: Array.isArray(accommodation.houseRules) ? accommodation.houseRules.join(", ") : (accommodation.houseRules || ""),
    securityDeposit: accommodation.securityDeposit ?? 0, cleaningFee: accommodation.cleaningFee ?? 0,
    nightlyPrice: nightly?.amount ?? accommodation.nightlyPrice ?? "",
    accommodationAmenities: accommodation.amenities || defaults.accommodationAmenities,
    rules: accommodation.rules || defaults.rules, includedServices: accommodation.includedServices || defaults.includedServices,
  };
};

export default function AccommodationPropertyForm({ accommodation = null, onSuccess, onCancel }) {
  const [formData, setFormData] = useState(() => initialData(accommodation));
  const [existingImages, setExistingImages] = useState(accommodation?.property?.images || []);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!formData.accommodationType) nextErrors.accommodationType = "Le type d'hébergement est requis.";
    if (!(Number(formData.maxAdults) > 0)) nextErrors.maxAdults = "La capacité doit être supérieure à 0.";
    if (!accommodation && formData.images.length === 0) nextErrors.images = "Ajoutez au moins une image.";
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); toast.error("Veuillez corriger les champs indiqués."); return; }

    setLoading(true);
    try {
      const data = new FormData();
      const propertyKeys = ['title','description','price','status','pole','type','availability','surface','bedrooms','bathrooms','livingRooms','kitchens','constructionType'];
      propertyKeys.forEach((key) => { if (formData[key] !== "" && formData[key] != null) data.append(key, formData[key]); });
      data.append('address', JSON.stringify(formData.address));
      data.append('latitude', formData.latitude); data.append('longitude', formData.longitude);
      data.append('location', JSON.stringify({ type: 'Point', coordinates: [Number(formData.longitude), Number(formData.latitude)] }));
      data.append('amenities', JSON.stringify(String(formData.amenities || '').split(',').map((v) => v.trim()).filter(Boolean)));
      formData.images.forEach((file) => { if (file instanceof File) data.append('images', file); });
      if (existingImages.length) data.append('existingImages', JSON.stringify(existingImages));
      data.append('accommodationType', formData.accommodationType);
      data.append('capacity[maxAdults]', formData.maxAdults); data.append('capacity[maxChildren]', formData.maxChildren || 0);
      data.append('beds', formData.beds || 0); data.append('checkInTime', formData.checkInTime); data.append('checkOutTime', formData.checkOutTime);
      data.append('minimumStay', formData.minimumStay || 1);
      if (formData.maximumStay !== '') data.append('maximumStay', formData.maximumStay);
      data.append('cancellationPolicy', formData.cancellationPolicy); data.append('houseRules', formData.houseRules || '');
      data.append('securityDeposit', formData.securityDeposit || 0); data.append('cleaningFee', formData.cleaningFee || 0);
      if (formData.nightlyPrice !== '') data.append('nightlyPrice', formData.nightlyPrice);
      data.append('accommodationAmenities', JSON.stringify(formData.accommodationAmenities));
      data.append('rules', JSON.stringify(formData.rules)); data.append('includedServices', JSON.stringify(formData.includedServices));

      const result = accommodation
        ? await updateFullAccommodation(accommodation.property?._id || accommodation.property, data)
        : await createFullAccommodation(data);
      const publicationStatus = result?.lifecycle?.publicationStatus || result?.accommodation?.publicationStatus;
      const message = accommodationSaveMessage({ isEditing: Boolean(accommodation), publicationStatus });
      toast.success(message);
      onSuccess?.(result);
    } catch (error) {
      toast.error(error.response?.data?.message || "Impossible d'enregistrer l'hébergement.");
    } finally { setLoading(false); }
  };

  return <div><PropertyForm formData={formData} setFormData={setFormData} onSubmit={submit} loading={loading}
    enableHebergement excludeHotelAccommodationTypes isEditing={Boolean(accommodation)} existingImages={existingImages} setExistingImages={setExistingImages}
    errors={errors} />
    <button type="button" onClick={onCancel} className="mt-3 px-4 py-2 rounded border">Annuler</button>
  </div>;
}
