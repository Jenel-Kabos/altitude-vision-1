"use client";

// client/lib/components/dashboard/HotelPropertyForm.jsx — Sprint B2 (domaine
// Hôtellerie). Formulaire dédié à l'établissement hôtelier, self-contained
// (gère son propre état, comme SalePropertyForm/RentalPropertyForm — voir
// server/docs/PROPERTY_TRANSACTION_ARCHITECTURE.md) : aucune notion de
// chambre physique, aucune réservation. Les catégories de chambres et leurs
// tarifs se gèrent depuis ManageRoomCategoriesPage/ManageHotelRatesPage
// (liées une fois l'hôtel créé) — ce formulaire couvre uniquement
// Informations/Services/Galerie/Publication.

import React, { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { VILLES, getArrondissementsFor } from "../../constants/locations";
import { HOTEL_RATE_TYPES, HOTEL_SERVICES } from "../../constants/hotel";
import { ACCOMMODATION_TYPES, AMENITY_CATEGORIES } from "../../constants/accommodation";
import {
  ROOM_CATEGORY_TYPES, buildHotelPublicationPayload, createHotelRoomCategory,
  getHotelCategoryTotals, validateHotelCategories, validateHotelRates,
  validateHotelRoomCategories,
} from "../../utils/hotelPublication";
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
  accommodationType = "hotel",
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

  if (!hotelId) {
    return <HotelCreationWizard accommodationType={accommodationType} scope={scope} onSuccess={onSuccess} onCancel={onCancel} />;
  }

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
      data.append("accommodationType", accommodationType);

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
      <div className="rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 p-4 text-white shadow-sm">
        <div className="flex items-center gap-3"><span className="rounded-xl bg-white/20 p-2"><Building2 className="h-6 w-6" /></span><div><p className="text-xs font-semibold uppercase tracking-wider text-white/80">Modification · Établissement hôtelier</p><h2 className="text-xl font-bold">Modifier un hôtel</h2></div></div>
        <p className="mt-3 text-sm text-white/90">Vérifiez en priorité l’identité de l’établissement, les étoiles, les services, les horaires, les photos et les informations de contact.</p>
      </div>
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

const CREATION_STEPS = [
  'Informations générales', 'Localisation', 'Capacité générale', 'Catégories de chambres',
  'Tarifs', 'Services', 'Politiques', 'Photos', 'Vérification',
];

const newCreationForm = (accommodationType) => ({
  publicationRequestId: globalThis.crypto?.randomUUID?.() || `hotel-${Date.now()}`,
  accommodationType, name: '', description: '', starRating: '', phone: '', email: '', website: '',
  address: { city: 'Brazzaville', arrondissement: '', street: '' }, latitude: -4.266, longitude: 15.283,
  surface: 1, checkInTime: '14:00', checkOutTime: '11:00', houseRules: [], hotelServices: {},
  roomCategories: [], images: [],
});

function HotelCreationWizard({ accommodationType, scope, onSuccess, onCancel }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => newCreationForm(accommodationType));
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const totals = useMemo(() => getHotelCategoryTotals(form.roomCategories), [form.roomCategories]);
  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const updateCategory = (index, patchValue) => setForm((previous) => ({
    ...previous,
    roomCategories: previous.roomCategories.map((category, current) => current === index ? { ...category, ...patchValue } : category),
  }));
  const addCategory = () => setForm((previous) => ({ ...previous, roomCategories: [...previous.roomCategories, createHotelRoomCategory(previous.roomCategories.length)] }));
  const removeCategory = (index) => setForm((previous) => ({ ...previous, roomCategories: previous.roomCategories.filter((_, current) => current !== index) }));
  const duplicateCategory = (index) => setForm((previous) => {
    const source = previous.roomCategories[index];
    const clone = { ...source, clientKey: globalThis.crypto?.randomUUID?.() || `category-${Date.now()}`, name: `${source.name} (copie)`, code: `${source.code}2`, ratePlans: source.ratePlans.map((rate) => ({ ...rate })) };
    return { ...previous, roomCategories: [...previous.roomCategories.slice(0, index + 1), clone, ...previous.roomCategories.slice(index + 1)] };
  });
  const moveCategory = (index, direction) => setForm((previous) => {
    const target = index + direction;
    if (target < 0 || target >= previous.roomCategories.length) return previous;
    const roomCategories = [...previous.roomCategories];
    [roomCategories[index], roomCategories[target]] = [roomCategories[target], roomCategories[index]];
    return { ...previous, roomCategories };
  });
  const validateStep = () => {
    const next = {};
    if (step === 0) {
      if (!form.name.trim()) next.name = "Nom de l'établissement requis";
      if (!form.description.trim()) next.description = 'Description requise';
    }
    if (step === 1) {
      if (!form.address.city) next.city = 'Ville requise';
      if (!form.address.arrondissement) next.arrondissement = 'Arrondissement requis';
      if (!form.phone.trim()) next.phone = 'Téléphone requis';
    }
    if (step === 3) Object.assign(next, validateHotelRoomCategories(form.roomCategories));
    if (step === 4) Object.assign(next, validateHotelRates(form.roomCategories));
    if (step === 7 && !form.images.length) next.images = 'Ajoutez au moins une photo';
    if (step === 8) Object.assign(next, validateHotelCategories(form.roomCategories));
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  const next = () => { if (validateStep()) setStep((current) => Math.min(current + 1, CREATION_STEPS.length - 1)); };
  const submit = async () => {
    if (!validateStep() || loading) return;
    setLoading(true);
    try {
      const payload = buildHotelPublicationPayload(form);
      const data = new FormData();
      data.append('publicationRequestId', form.publicationRequestId);
      data.append('publicationPayload', JSON.stringify(payload));
      form.images.forEach((image) => data.append('images', image));
      const result = await (scope === 'owner' ? createMyHotel : createFullHotel)(data);
      toast.success('Hôtel complet créé et soumis avec ses catégories et tarifs.');
      onSuccess?.(result);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Impossible de créer l'établissement.");
    } finally { setLoading(false); }
  };

  return <div className="space-y-5">
    <ol aria-label="Étapes du formulaire" className="grid grid-cols-3 gap-1 text-xs text-gray-500">{CREATION_STEPS.map((label, index) => <li key={label} className={index === step ? 'font-semibold text-gray-900' : ''}>{label}</li>)}</ol>
    <div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-wide text-gray-500">Étape {step + 1}/9</p><h3 className="text-xl font-semibold">{CREATION_STEPS[step]}</h3></div><span className="text-sm text-gray-500">{totals.totalRooms} chambres · {totals.minNightlyRate.toLocaleString('fr-FR')} XAF min.</span></div>
    {step === 0 && <div className="grid grid-cols-2 gap-3">
      <select aria-label="Type d'établissement" className={inputClass} value={form.accommodationType} onChange={(event) => setField('accommodationType', event.target.value)}>{ACCOMMODATION_TYPES.filter((type) => ['hotel', 'residence_hoteliere', 'chambre_hotes', 'autre'].includes(type.value)).map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select>
      <select aria-label="Classement" className={inputClass} value={form.starRating} onChange={(event) => setField('starRating', event.target.value)}><option value="">Non classé</option>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value} étoile(s)</option>)}</select>
      <Field label="Nom de l'hôtel" value={form.name} onChange={(value) => setField('name', value)} error={errors.name} />
      <Field label="Téléphone" value={form.phone} onChange={(value) => setField('phone', value)} />
      <div className="col-span-2"><Field label="Description" value={form.description} onChange={(value) => setField('description', value)} textarea error={errors.description} /></div>
    </div>}
    {step === 1 && <div className="grid grid-cols-2 gap-3">
      <select aria-label="Ville" className={inputClass} value={form.address.city} onChange={(event) => setForm((previous) => ({ ...previous, address: { ...previous.address, city: event.target.value, arrondissement: '' } }))}>{VILLES.map((city) => <option key={city}>{city}</option>)}</select>
      <select aria-label="Arrondissement" className={inputClass} value={form.address.arrondissement} onChange={(event) => setForm((previous) => ({ ...previous, address: { ...previous.address, arrondissement: event.target.value } }))}><option value="">Sélectionner</option>{getArrondissementsFor(form.address.city).map((value) => <option key={value}>{value}</option>)}</select>
      <Field label="Adresse complète" value={form.address.street} onChange={(value) => setForm((previous) => ({ ...previous, address: { ...previous.address, street: value } }))} />
      <Field label="Téléphone principal" value={form.phone} onChange={(value) => setField('phone', value)} error={errors.phone} />
      <Field label="Email professionnel" value={form.email} onChange={(value) => setField('email', value)} /><Field label="Site web" value={form.website} onChange={(value) => setField('website', value)} />
      {(errors.city || errors.arrondissement) && <p className="col-span-2 text-sm text-red-600">{errors.city || errors.arrondissement}</p>}
    </div>}
    {step === 2 && <div className="rounded-lg border p-4"><p className="font-medium">Capacité calculée automatiquement</p><p className="text-sm text-gray-600">{totals.totalRooms} chambres · {totals.totalCapacity} personnes · {totals.totalBeds} lits. Ces valeurs proviennent des catégories et ne sont jamais saisies deux fois.</p></div>}
    {step === 3 && <div className="space-y-4">{form.roomCategories.map((category, index) => <CategoryEditor key={category.clientKey} category={category} index={index} errors={errors} update={updateCategory} remove={removeCategory} duplicate={duplicateCategory} move={moveCategory} />)}{errors.roomCategories && <p className="text-sm text-red-600">{errors.roomCategories}</p>}<button type="button" onClick={addCategory} className="rounded bg-blue-600 px-3 py-2 text-white">Ajouter une catégorie</button></div>}
    {step === 4 && <div className="space-y-4">{form.roomCategories.map((category, index) => <RateEditor key={category.clientKey} category={category} index={index} error={errors[`roomCategories.${index}.ratePlans`]} update={updateCategory} />)}</div>}
    {step === 5 && <div className="grid grid-cols-2 gap-2">{HOTEL_SERVICES.map((service) => <label key={service.key} className="flex gap-2 rounded border p-3"><input type="checkbox" checked={Boolean(form.hotelServices[service.key])} onChange={() => setField('hotelServices', { ...form.hotelServices, [service.key]: !form.hotelServices[service.key] })} />{service.label}</label>)}</div>}
    {step === 6 && <div className="grid grid-cols-2 gap-3"><Field label="Heure de check-in" value={form.checkInTime} onChange={(value) => setField('checkInTime', value)} /><Field label="Heure de check-out" value={form.checkOutTime} onChange={(value) => setField('checkOutTime', value)} /></div>}
    {step === 7 && <div><label className="block text-sm font-medium mb-1">Photos de l'hôtel</label><input aria-label="Photos de l'hôtel" type="file" multiple accept="image/*" onChange={(event) => setField('images', Array.from(event.target.files))} /><p className="text-sm text-gray-500 mt-2">{form.images.length} photo(s) sélectionnée(s)</p>{errors.images && <p className="text-sm text-red-600">{errors.images}</p>}</div>}
    {step === 8 && <div className="rounded-lg border p-4 space-y-2"><p><strong>{form.name}</strong> · {form.address.arrondissement}, {form.address.city}</p><p>{totals.totalRooms} chambres · {totals.totalCapacity} personnes · {totals.totalBeds} lits</p><p>{totals.minNightlyRate.toLocaleString('fr-FR')} à {totals.maxNightlyRate.toLocaleString('fr-FR')} XAF / nuit</p>{form.roomCategories.map((category) => <p key={category.clientKey}>{category.name} ({category.code}) — {category.quantity} unité(s) — {Number(category.ratePlans.find((rate) => rate.rateType === 'public')?.amount || 0).toLocaleString('fr-FR')} XAF</p>)}</div>}
    <div className="flex gap-2 border-t pt-4"><button type="button" onClick={() => step ? setStep(step - 1) : onCancel?.()} className="px-4 py-2 text-gray-600">Retour</button>{step < 8 ? <button type="button" onClick={next} className="rounded bg-gold px-4 py-2 text-white">Continuer</button> : <button type="button" disabled={loading} onClick={submit} className="rounded bg-gold px-4 py-2 text-white disabled:opacity-50">{loading ? 'Publication…' : "Publier l'hôtel"}</button>}</div>
  </div>;
}

function Field({ label, value, onChange, error, textarea = false }) {
  const Element = textarea ? 'textarea' : 'input';
  return <label className="block text-sm font-medium">{label}<Element aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className={`${inputClass} mt-1`} rows={textarea ? 4 : undefined} />{error && <span className="text-xs text-red-600">{error}</span>}</label>;
}

function CategoryEditor({ category, index, errors, update, remove, duplicate, move }) {
  const error = (field) => errors[`roomCategories.${index}.${field}`];
  return <div className="rounded-lg border p-4 space-y-3"><div className="flex justify-between"><strong>Catégorie {index + 1}</strong><div className="flex gap-2"><button type="button" onClick={() => move(index, -1)}>↑</button><button type="button" onClick={() => move(index, 1)}>↓</button><button type="button" onClick={() => duplicate(index)}>Dupliquer</button><button type="button" className="text-red-600" onClick={() => remove(index)}>Supprimer</button></div></div><div className="grid grid-cols-2 gap-3">
    <select aria-label={`Type catégorie ${index + 1}`} className={inputClass} value={category.categoryType} onChange={(event) => update(index, { categoryType: event.target.value })}>{ROOM_CATEGORY_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}</select>
    <Field label={`Nom catégorie ${index + 1}`} value={category.name} onChange={(value) => update(index, { name: value })} error={error('name')} /><Field label={`Code catégorie ${index + 1}`} value={category.code} onChange={(value) => update(index, { code: value.toUpperCase() })} error={error('code')} />
    {[['Nombre de chambres','quantity'],['Adultes par chambre','adultCapacity'],['Enfants par chambre','childCapacity'],['Lits par chambre','beds'],['Surface moyenne','surface']].map(([label,key]) => <Field key={key} label={`${label} ${index + 1}`} value={String(category[key])} onChange={(value) => update(index, { [key]: value })} error={error(key)} />)}
  </div>{AMENITY_CATEGORIES.slice(1,3).map((group) => <div key={group.key}><p className="text-sm font-medium">{group.label}</p><div className="flex flex-wrap gap-2">{group.options.map((option) => <label key={option} className="text-sm"><input type="checkbox" checked={(category.amenities[group.key] || []).includes(option)} onChange={() => { const values = category.amenities[group.key] || []; update(index, { amenities: { ...category.amenities, [group.key]: values.includes(option) ? values.filter((value) => value !== option) : [...values, option] } }); }} /> {option}</label>)}</div></div>)}</div>;
}

function RateEditor({ category, index, error, update }) {
  const rates = category.ratePlans || [];
  const updateRate = (rateIndex, patchValue) => update(index, { ratePlans: rates.map((rate, current) => current === rateIndex ? { ...rate, ...patchValue } : rate) });
  const addRate = () => { const type = HOTEL_RATE_TYPES.find((candidate) => !rates.some((rate) => rate.rateType === candidate.value)); if (type) update(index, { ratePlans: [...rates, { rateType: type.value, amount: '', currency: 'XAF' }] }); };
  return <div className="rounded-lg border p-4"><strong>{category.name}</strong>{rates.map((rate, rateIndex) => <div key={`${rate.rateType}-${rateIndex}`} className="mt-2 grid grid-cols-2 gap-3"><select aria-label={`Type tarif ${category.name} ${rateIndex + 1}`} className={inputClass} value={rate.rateType} onChange={(event) => updateRate(rateIndex, { rateType: event.target.value })}>{HOTEL_RATE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select><Field label={`Tarif ${category.name} ${rateIndex + 1}`} value={String(rate.amount)} onChange={(value) => updateRate(rateIndex, { amount: value })} /></div>)}{error && <p className="text-sm text-red-600">{error}</p>}<button type="button" className="mt-2 text-blue-600" onClick={addRate}>Ajouter un tarif</button></div>;
}

export default HotelPropertyForm;
