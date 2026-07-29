"use client";

import React, { useRef, useMemo, useEffect, useState } from "react";
import Image from 'next/image';
import dynamic from 'next/dynamic';

const MapLeaflet = dynamic(() => import('./MapLeaflet'), { ssr: false });
import { VILLES, getArrondissementsFor } from "../../constants/locations";
import { PROPERTY_TYPES } from "../../constants/propertyTypes";
import {
  ACCOMMODATION_TYPES, LEGACY_ACCOMMODATION_TYPES, CANCELLATION_POLICIES, HOTEL_ACCOMMODATION_TYPES,
  AMENITY_CATEGORIES, INCLUDED_SERVICES,
} from "../../constants/accommodation";
import { TENANT_PROFILES, REQUIRED_DOCUMENTS } from "../../constants/rentalProperty";
import { getHotels } from "../../services/accommodationService";
import { getPropertyFormConfig } from "../../utils/propertyFormConfig";

// ✅ Préfixe les URLs relatives avec l'URL du backend.
// file.path retourne "uploads/events/photo.jpg" (sans slash ni domaine),
// ce qui n'est pas une URL valide pour <img src="...">.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://altitude-vision.onrender.com/api';

const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  // Normalise les backslashes Windows et assure un slash initial
  const normalized = url.replace(/\\/g, "/").replace(/^\//, "");
  return `${API_URL}/${normalized}`;
};

const PropertyForm = ({
  formData,
  setFormData,
  onSubmit,
  loading,
  existingImages = [],
  setExistingImages = () => {},
  // Hors périmètre par défaut : seul ManagePropertiesPage.jsx (dashboard
  // admin) passe `enableHebergement`. Les formulaires propriétaire
  // (MyPropertiesPage.jsx, OwnerPropertyManagement.jsx) ne le passent pas et
  // ne voient donc jamais l'option "Hébergement" ni ses champs — la création
  // d'un hébergement en 2 étapes (Property puis /mes-hebergements) reste
  // inchangée pour eux.
  enableHebergement = false,
  errors = {},
  isEditing = false,
}) => {
  const fileInputRef = useRef(null);

  // ✅ CORRECTION : Créer les URLs une seule fois par liste de fichiers.
  // useMemo garantit que les URLs ne sont recréées que si formData.images change,
  // et non à chaque re-render causé par d'autres champs du formulaire.
  const previewUrls = useMemo(() => {
    return formData.images.map((file) => URL.createObjectURL(file));
  }, [formData.images]);

  // ✅ CORRECTION : Révoquer les URLs uniquement quand previewUrls change
  // (nouveaux fichiers ajoutés/supprimés) ou à la destruction du composant.
  // Avant : revokeObjectURL était appelé dans onLoad → l'URL était libérée
  // immédiatement après le 1er affichage, rendant les images vides au re-render.
  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  // Empêche l'auto-calcul d'écraser une valeur déjà présente au chargement
  // (édition d'un bien existant) ou saisie manuellement par l'admin.
  const honorairesTouchedRef = useRef(
    formData.honoraires !== null && formData.honoraires !== undefined && formData.honoraires !== ''
  );

  useEffect(() => {
    if (honorairesTouchedRef.current) return;
    if (!formData.price || !formData.status) return;
    // Hébergement n'a pas de règle d'honoraires liée à un mandat — pas
    // d'auto-calcul (même choix que EditPropertyPage.jsx, Sprint 2).
    if (formData.status === 'hebergement') return;
    const rate = formData.status === 'location' ? 0.8 : 0.1;
    const calculated = Math.round(Number(formData.price) * rate);
    setFormData((prev) => ({ ...prev, honoraires: calculated }));
  }, [formData.price, formData.status, setFormData]);

  // Liste des établissements pour le sélecteur "Établissement hôtelier" —
  // chargée une seule fois dès que le type Hôtel est sélectionné (jamais pour
  // les autres types, ni pour les formulaires propriétaire qui ne passent
  // pas enableHebergement).
  const [hotels, setHotels] = useState([]);
  const [hotelsLoading, setHotelsLoading] = useState(false);
  const isHotelType = enableHebergement && HOTEL_ACCOMMODATION_TYPES.includes(formData.accommodationType);
  const transactionProfile = getPropertyFormConfig({ transactionType: formData.status, propertyType: formData.type, accommodationType: formData.accommodationType, mode: isEditing ? 'edit' : 'create' });
  const { TypeIcon, Icon: TransactionIcon, isLand, isCommercial, propertyType } = transactionProfile;

  // Valeurs historiques (residence_meublee/bungalow) : jamais proposées à la
  // création, mais réinjectées si c'est la valeur déjà en base pour l'annonce
  // en cours d'édition — une sauvegarde sans changement ne doit jamais la
  // faire disparaître silencieusement du <select>.
  const accommodationTypeOptions = useMemo(() => {
    const currentLegacy = LEGACY_ACCOMMODATION_TYPES.find((t) => t.value === formData.accommodationType);
    return currentLegacy ? [...ACCOMMODATION_TYPES, currentLegacy] : ACCOMMODATION_TYPES;
  }, [formData.accommodationType]);

  useEffect(() => {
    if (!isHotelType) return;
    let cancelled = false;
    setHotelsLoading(true);
    getHotels()
      .then((list) => { if (!cancelled) setHotels(list || []); })
      .catch(() => { if (!cancelled) setHotels([]); })
      .finally(() => { if (!cancelled) setHotelsLoading(false); });
    return () => { cancelled = true; };
  }, [isHotelType]);

  const handleHotelCheckbox = (name) => (e) => {
    setFormData((prev) => ({ ...prev, [name]: e.target.checked }));
  };

  const handleChange = (e) => {
    if (e.target.name === 'honoraires') {
      honorairesTouchedRef.current = true;
    }
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      address: {
        ...prev.address,
        [name]: value,
      },
    }));
  };

  const handleCityChange = (e) => {
    const newCity = e.target.value;
    setFormData((prev) => ({
      ...prev,
      address: {
        ...prev.address,
        city: newCity,
        // Reset arrondissement si plus valide pour la nouvelle ville
        arrondissement: getArrondissementsFor(newCity).includes(prev.address.arrondissement)
          ? prev.address.arrondissement
          : '',
      },
    }));
  };

  const handleCheckboxArrayChange = (field, value) => {
    setFormData((prev) => {
      const currentValues = Array.isArray(prev[field]) ? prev[field] : [];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];

      return {
        ...prev,
        [field]: nextValues,
      };
    });
  };

  // Sprint B1 — équipements structurés par catégorie (formData.amenities =
  // { cuisine: [...], salon: [...], ... }, miroir de server/models/
  // Accommodation.js). Distinct de handleCheckboxArrayChange (tableau plat)
  // car chaque catégorie est indépendante des autres.
  const handleAmenityToggle = (category, value) => {
    setFormData((prev) => {
      const current = Array.isArray(prev.accommodationAmenities?.[category]) ? prev.accommodationAmenities[category] : [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, accommodationAmenities: { ...prev.accommodationAmenities, [category]: next } };
    });
  };

  // formData.rules = { petsAllowed, partiesAllowed, smokingAllowed, childrenAllowed, minimumAge }
  const handleRuleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, rules: { ...prev.rules, [name]: value } }));
  };

  // formData.includedServices = { menage, petitDejeuner, blanchisserie, transfert, cuisine }
  const handleServiceToggle = (key) => {
    setFormData((prev) => ({
      ...prev,
      includedServices: { ...prev.includedServices, [key]: !prev.includedServices?.[key] },
    }));
  };

  const handleImageChange = (e) => {
    const newFiles = Array.from(e.target.files);
    setFormData((prev) => ({
      ...prev,
      images: [...prev.images, ...newFiles],
    }));
    e.target.value = null;
  };

  const handleRemoveNewImage = (index) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleRemoveExistingImage = (url) => {
    setExistingImages(existingImages.filter((img) => img !== url));
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">

      <div className={`rounded-2xl bg-gradient-to-r ${transactionProfile.tone} p-4 text-white shadow-sm`}>
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-white/20 p-2"><TransactionIcon className="h-6 w-6" /></span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/80">{isEditing ? 'Modification' : 'Annonce'} · {propertyType}</p>
            <h2 className="text-xl font-bold">{transactionProfile.title}</h2>
          </div>
          <TypeIcon className="ml-auto h-7 w-7 text-white/70" aria-hidden="true" />
        </div>
        <p className="mt-3 text-sm text-white/90">
          {transactionProfile.contextHelp}
        </p>
      </div>

      {/* ------------------ SECTION INFOS DE BASE ------------------ */}
      <h3 className="text-lg font-semibold border-b pb-2">Informations générales</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
        <input
          name="title"
          value={formData.title}
          onChange={handleChange}
          placeholder="Ex: Appartement moderne à Moungali"
          aria-label="Titre du bien"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Décrivez le bien en détail..."
          aria-label="Description du bien"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
          rows={5}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{transactionProfile.priceLabel} *</label>
        <input
          name="price"
          type="number"
          value={formData.price}
          onChange={handleChange}
          placeholder="Ex: 150000"
          aria-label="Prix en FCFA"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
          required
        />
        <p className="text-xs text-gray-500 mt-1">{transactionProfile.priceHelp}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Honoraires d'agence (FCFA) *</label>
        <input
          type="number"
          name="honoraires"
          value={formData.honoraires || ''}
          onChange={handleChange}
          placeholder="Calculé automatiquement"
          aria-label="Honoraires d'agence en FCFA"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
        />
        <p className="text-xs text-gray-500">
          {formData.status === 'location'
            ? 'Pré-rempli à 80% du loyer mensuel'
            : formData.status === 'hebergement'
            ? "Sans lien avec un bail — à renseigner manuellement si applicable"
            : 'Pré-rempli à 10% du prix de vente'}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Frais de visite (FCFA)</label>
        <input
          type="number"
          name="fraisVisite"
          value={formData.fraisVisite ?? 0}
          onChange={handleChange}
          placeholder="0 = visite gratuite"
          aria-label="Frais de visite en FCFA"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
        />
        <p className="text-xs text-gray-500">
          Laisser à 0 si la visite est gratuite
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pôle *</label>
          <select
            name="pole"
            value={formData.pole}
            onChange={handleChange}
            aria-label="Pôle"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
            required
          >
            <option value="Altimmo">Altimmo</option>
            <option value="MilaEvents">MilaEvents</option>
            <option value="Altcom">Altcom</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Statut *</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            aria-label="Statut"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
          >
            <option value="vente">Vendre</option>
            <option value="location">Louer</option>
            {enableHebergement && <option value="hebergement">Hébergement</option>}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Disponibilité</label>
        <select
          name="availability"
          value={formData.availability}
          onChange={handleChange}
          aria-label="Disponibilité"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
        >
          <option>Disponible</option>
          <option>Vendu</option>
          <option>Loué</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
        <select
          name="type"
          value={formData.type || ''}
          onChange={handleChange}
          aria-label="Type de bien"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
        >
          <option value="">Sélectionner...</option>
          {PROPERTY_TYPES.map((t) => (
            <option key={t.value ?? t} value={t.value ?? t}>{t.label ?? t}</option>
          ))}
        </select>
      </div>

      {/* ------------------ SECTION ADRESSE ------------------ */}
      <div className="border-t pt-4 mt-4">
        <h3 className="text-lg font-semibold mb-1">Localisation</h3>
        <p className="text-xs text-gray-500 mb-3">Renseignez précisément la zone pour faciliter la recherche et les visites.</p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ville *</label>
            <select
              name="city"
              value={formData.address.city || ''}
              onChange={handleCityChange}
              aria-label="Ville"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              required
            >
              <option value="">Sélectionner...</option>
              {VILLES.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quartier *</label>
            <input
              name="neighborhood"
              value={formData.address.neighborhood || ''}
              onChange={handleAddressChange}
              placeholder="Ex: Plateau des 15 ans"
              aria-label="Quartier"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Arrondissement *</label>
            <select
              name="arrondissement"
              value={formData.address.arrondissement || ''}
              onChange={handleAddressChange}
              disabled={!formData.address.city}
              aria-label="Arrondissement"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
              required
            >
              <option value="">Sélectionner...</option>
              {getArrondissementsFor(formData.address.city).map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rue</label>
            <input
              name="street"
              value={formData.address.street}
              onChange={handleAddressChange}
              placeholder="Ex: Avenue de la Paix"
              aria-label="Rue"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
            />
          </div>
        </div>
      </div>

      {/* ------------------ SECTION CARACTÉRISTIQUES ------------------ */}
      <div className="border-t pt-4 mt-4">
        <h3 className="text-lg font-semibold mb-1">{isLand ? 'Caractéristiques du terrain' : isCommercial ? 'Caractéristiques professionnelles' : 'Caractéristiques du bien'}</h3>
        <p className="text-xs text-gray-500 mb-3">{isLand ? 'La superficie et le type de construction renseignent le potentiel du terrain.' : isCommercial ? 'Décrivez les volumes et aménagements utiles à une activité professionnelle.' : 'Décrivez les volumes et la configuration du logement.'}</p>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Surface (m²)</label>
            <input
              name="surface"
              type="number"
              value={formData.surface}
              onChange={handleChange}
              placeholder="Ex: 62"
              aria-label="Surface en m²"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chambres</label>
            <input
              name="bedrooms"
              type="number"
              value={formData.bedrooms}
              onChange={handleChange}
              placeholder="Ex: 3"
              aria-label="Nombre de chambres"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Salles de bain</label>
            <input
              name="bathrooms"
              type="number"
              value={formData.bathrooms}
              onChange={handleChange}
              placeholder="Ex: 2"
              aria-label="Nombre de salles de bain"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Salons</label>
            <input
              name="livingRooms"
              type="number"
              value={formData.livingRooms}
              onChange={handleChange}
              placeholder="Ex: 1"
              aria-label="Nombre de salons"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cuisines</label>
            <input
              name="kitchens"
              type="number"
              value={formData.kitchens}
              onChange={handleChange}
              placeholder="Ex: 1"
              aria-label="Nombre de cuisines"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type de construction</label>
            <select
              name="constructionType"
              value={formData.constructionType}
              onChange={handleChange}
              aria-label="Type de construction"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
            >
              <option value="Non spécifié">Non spécifié</option>
              <option value="Béton armé">Béton armé</option>
              <option value="Briques/Parpaings">Briques/Parpaings</option>
              <option value="Bois">Bois</option>
              <option value="Autre">Autre</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Équipements</label>
        <input
          name="amenities"
          value={formData.amenities}
          onChange={handleChange}
          placeholder="Ex: Climatisation, Parking, Wifi (séparés par des virgules)"
          aria-label="Équipements"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
        />
        <p className="text-xs text-gray-500 mt-1">Séparez les équipements par des virgules</p>
      </div>

      {formData.status === 'location' && (
        <div className="border-t pt-4 mt-4">
          <h3 className="text-lg font-semibold mb-3">Conditions de bail</h3>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Caution demandée
            </label>
            <select
              name="cautionMultiplicateur"
              value={formData.cautionMultiplicateur ?? 2}
              onChange={handleChange}
              aria-label="Caution demandée"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            >
              <option value="0">Aucune caution</option>
              <option value="1">1 mois de loyer</option>
              <option value="2">2 mois de loyer</option>
              <option value="3">3 mois de loyer</option>
              <option value="4">4 mois de loyer</option>
              <option value="5">5 mois de loyer</option>
              <option value="6">6 mois de loyer</option>
            </select>
          </div>

          <div className="mb-4">
            <p className="block text-sm font-medium text-gray-700 mb-2">
              Profils de locataires recherchés
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TENANT_PROFILES.map((profile) => (
                <label key={profile} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={(formData.profilsLocataireRecherches || []).includes(profile)}
                    onChange={() => handleCheckboxArrayChange('profilsLocataireRecherches', profile)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {profile}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="block text-sm font-medium text-gray-700 mb-2">
              Documents requis
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {REQUIRED_DOCUMENTS.map((document) => (
                <label key={document} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={(formData.documentsRequis || []).includes(document)}
                    onChange={() => handleCheckboxArrayChange('documentsRequis', document)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {document}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {enableHebergement && formData.status === 'hebergement' && (
        <>
          {/* ------------------ SECTION INFOS D'HÉBERGEMENT ------------------ */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-lg font-semibold mb-3">Informations d'hébergement</h3>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type d'hébergement *</label>
                <select
                  name="accommodationType"
                  value={formData.accommodationType || ''}
                  onChange={handleChange}
                  aria-label="Type d'hébergement"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                >
                  <option value="">Sélectionner...</option>
                  {accommodationTypeOptions.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {errors.accommodationType && (
                  <p className="text-xs text-red-600 mt-1">{errors.accommodationType}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Politique d'annulation</label>
                <select
                  name="cancellationPolicy"
                  value={formData.cancellationPolicy || 'moderee'}
                  onChange={handleChange}
                  aria-label="Politique d'annulation"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                >
                  {CANCELLATION_POLICIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {isHotelType && (
              <div className="border rounded-md p-3 mb-3 bg-gray-50">
                <h4 className="text-sm font-semibold mb-2">Établissement hôtelier</h4>
                <p className="text-xs text-gray-500 mb-2">
                  L'adresse, la ville, le quartier, les coordonnées GPS et les photos restent
                  ceux du bien ci-dessus — ne pas les ressaisir ici.
                </p>

                <div className="flex gap-4 mb-3">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="hotelMode"
                      value="existing"
                      checked={formData.hotelMode === 'existing'}
                      onChange={handleChange}
                    />
                    Sélectionner un établissement existant
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="hotelMode"
                      value="create"
                      checked={formData.hotelMode === 'create'}
                      onChange={handleChange}
                    />
                    Créer un nouvel établissement
                  </label>
                </div>
                {errors.hotelMode && <p className="text-xs text-red-600 mb-2">{errors.hotelMode}</p>}

                {formData.hotelMode === 'existing' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Établissement *</label>
                    <select
                      name="hotelId"
                      value={formData.hotelId || ''}
                      onChange={handleChange}
                      aria-label="Établissement hôtelier"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    >
                      <option value="">
                        {hotelsLoading ? 'Chargement…' : 'Sélectionner...'}
                      </option>
                      {hotels.map((h) => (
                        <option key={h._id} value={h._id}>{h.name}</option>
                      ))}
                    </select>
                    {errors.hotelId && <p className="text-xs text-red-600 mt-1">{errors.hotelId}</p>}
                  </div>
                )}

                {formData.hotelMode === 'create' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'hôtel *</label>
                      <input
                        name="hotelName"
                        value={formData.hotelName || ''}
                        onChange={handleChange}
                        placeholder="Ex: Hôtel Le Panorama"
                        aria-label="Nom de l'hôtel"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
                      />
                      {errors.hotelName && <p className="text-xs text-red-600 mt-1">{errors.hotelName}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        name="hotelDescription"
                        value={formData.hotelDescription || ''}
                        onChange={handleChange}
                        rows={2}
                        aria-label="Description de l'hôtel"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre d'étoiles</label>
                        <select
                          name="hotelStarRating"
                          value={formData.hotelStarRating || ''}
                          onChange={handleChange}
                          aria-label="Nombre d'étoiles"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        >
                          <option value="">Non renseigné</option>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                        {errors.hotelStarRating && <p className="text-xs text-red-600 mt-1">{errors.hotelStarRating}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                        <input
                          name="hotelPhone"
                          value={formData.hotelPhone || ''}
                          onChange={handleChange}
                          aria-label="Téléphone de l'hôtel"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                          name="hotelEmail"
                          type="email"
                          value={formData.hotelEmail || ''}
                          onChange={handleChange}
                          aria-label="Email de l'hôtel"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                        {errors.hotelEmail && <p className="text-xs text-red-600 mt-1">{errors.hotelEmail}</p>}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Site web</label>
                      <input
                        name="hotelWebsite"
                        value={formData.hotelWebsite || ''}
                        onChange={handleChange}
                        aria-label="Site web de l'hôtel"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Services proposés</label>
                      <input
                        name="hotelServices"
                        value={formData.hotelServices || ''}
                        onChange={handleChange}
                        placeholder="Ex: Piscine, Wifi, Climatisation (séparés par des virgules)"
                        aria-label="Services de l'hôtel"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
                      />
                    </div>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={Boolean(formData.hotelHasRestaurant)}
                          onChange={handleHotelCheckbox('hotelHasRestaurant')}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        Restaurant sur place
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={Boolean(formData.hotelHasReception)}
                          onChange={handleHotelCheckbox('hotelHasReception')}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        Réception 24h/24
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capacité maximale (adultes) *</label>
                <input
                  name="maxAdults"
                  type="number"
                  min="1"
                  value={formData.maxAdults ?? ''}
                  onChange={handleChange}
                  placeholder="Ex: 4"
                  aria-label="Capacité maximale en adultes"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
                />
                {errors.maxAdults && <p className="text-xs text-red-600 mt-1">{errors.maxAdults}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capacité (enfants)</label>
                <input
                  name="maxChildren"
                  type="number"
                  min="0"
                  value={formData.maxChildren ?? ''}
                  onChange={handleChange}
                  placeholder="Ex: 2"
                  aria-label="Capacité maximale en enfants"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de lits</label>
                <input
                  name="beds"
                  type="number"
                  min="0"
                  value={formData.beds ?? ''}
                  onChange={handleChange}
                  placeholder="Ex: 3"
                  aria-label="Nombre de lits"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check-in *</label>
                <input
                  name="checkInTime"
                  type="time"
                  value={formData.checkInTime || '14:00'}
                  onChange={handleChange}
                  aria-label="Heure de check-in"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
                {errors.checkInTime && <p className="text-xs text-red-600 mt-1">{errors.checkInTime}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check-out *</label>
                <input
                  name="checkOutTime"
                  type="time"
                  value={formData.checkOutTime || '11:00'}
                  onChange={handleChange}
                  aria-label="Heure de check-out"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
                {errors.checkOutTime && <p className="text-xs text-red-600 mt-1">{errors.checkOutTime}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Durée minimale du séjour (nuits)</label>
                <input
                  name="minimumStay"
                  type="number"
                  min="1"
                  value={formData.minimumStay ?? 1}
                  onChange={handleChange}
                  aria-label="Durée minimale du séjour"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Durée maximale du séjour (nuits)</label>
                <input
                  name="maximumStay"
                  type="number"
                  min="1"
                  value={formData.maximumStay ?? ''}
                  onChange={handleChange}
                  placeholder="Illimitée si vide"
                  aria-label="Durée maximale du séjour"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
                />
                {errors.maximumStay && <p className="text-xs text-red-600 mt-1">{errors.maximumStay}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Caution de séjour (FCFA)</label>
                <input
                  name="securityDeposit"
                  type="number"
                  min="0"
                  value={formData.securityDeposit ?? 0}
                  onChange={handleChange}
                  aria-label="Caution de séjour"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frais de ménage (FCFA)</label>
                <input
                  name="cleaningFee"
                  type="number"
                  min="0"
                  value={formData.cleaningFee ?? 0}
                  onChange={handleChange}
                  aria-label="Frais de ménage"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Règles de la maison</label>
              <input
                name="houseRules"
                value={formData.houseRules || ''}
                onChange={handleChange}
                placeholder="Ex: Non fumeur, Pas d'animaux, Pas de fête (séparées par des virgules)"
                aria-label="Règles de la maison"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
              />
              <p className="text-xs text-gray-500 mt-1">Séparez les règles par des virgules</p>
            </div>
          </div>

          {/* ------------------ SECTION ÉQUIPEMENTS ------------------ */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-lg font-semibold mb-3">Équipements</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {AMENITY_CATEGORIES.map((category) => (
                <div key={category.key}>
                  <p className="text-sm font-medium text-gray-700 mb-2">{category.label}</p>
                  <div className="space-y-1">
                    {category.options.map((option) => (
                      <label key={option} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={(formData.accommodationAmenities?.[category.key] || []).includes(option)}
                          onChange={() => handleAmenityToggle(category.key, option)}
                          aria-label={`${category.label} — ${option}`}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ------------------ SECTION SERVICES INCLUS ------------------ */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-lg font-semibold mb-3">Services inclus</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {INCLUDED_SERVICES.map((service) => (
                <label key={service.key} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.includedServices?.[service.key])}
                    onChange={() => handleServiceToggle(service.key)}
                    aria-label={service.label}
                  />
                  {service.label}
                </label>
              ))}
            </div>
          </div>

          {/* ------------------ SECTION RÈGLES ------------------ */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-lg font-semibold mb-3">Règles</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              {[
                ['petsAllowed', 'Animaux acceptés'],
                ['partiesAllowed', 'Fêtes autorisées'],
                ['smokingAllowed', 'Fumeur autorisé'],
                ['childrenAllowed', 'Enfants acceptés'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={key === 'childrenAllowed' ? formData.rules?.childrenAllowed !== false : Boolean(formData.rules?.[key])}
                    onChange={(e) => handleRuleChange(key, e.target.checked)}
                    aria-label={label}
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="w-1/2 pr-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Âge minimum</label>
              <input
                type="number"
                min="0"
                value={formData.rules?.minimumAge ?? 0}
                onChange={(e) => handleRuleChange('minimumAge', Number(e.target.value))}
                aria-label="Âge minimum"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
          </div>

          {/* ------------------ SECTION TARIFICATION ------------------ */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-lg font-semibold mb-3">Tarification</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prix par nuit (FCFA)</label>
                <input
                  name="nightlyPrice"
                  type="number"
                  min="0"
                  value={formData.nightlyPrice ?? ''}
                  onChange={handleChange}
                  placeholder="Ex: 35000"
                  aria-label="Prix par nuit"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
                />
                {errors.nightlyPrice && <p className="text-xs text-red-600 mt-1">{errors.nightlyPrice}</p>}
                <p className="text-xs text-gray-500 mt-1">Laisser vide pour ne pas créer de tarif pour l'instant</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Devise</label>
                <input
                  value="XAF"
                  readOnly
                  aria-label="Devise"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* ------------------ SECTION IMAGES ------------------ */}
      <div className="border-t pt-4 mt-4">
        <h3 className="text-lg font-semibold mb-3">Images *</h3>

        {/* Images existantes (mode édition) */}
        {existingImages.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Images existantes :</p>
            <div className="flex flex-wrap gap-3">
              {existingImages.map((img, i) => (
                <div key={i} className="relative w-24 h-24">
                  <Image src={getImageUrl(img)} alt={`Image existante ${i}`} fill
                    className="object-cover rounded border-2 border-gray-300" sizes="96px" />
                  <button
                    type="button"
                    onClick={() => handleRemoveExistingImage(img)}
                    className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-700 shadow-md"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input pour nouvelles images */}
        <div className="mb-4">
          <label className="block">
            <span className="sr-only">Choisir des images</span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                cursor-pointer"
            />
          </label>
          <p className="text-xs text-gray-500 mt-1">
            {formData.images.length === 0
              ? existingImages.length > 0
                ? "Ajouter d'autres images (optionnel)"
                : "Veuillez ajouter au moins une image"
              : `${formData.images.length} nouvelle(s) image(s) sélectionnée(s)`}
          </p>
        </div>

        {/* ✅ Prévisualisation corrigée : utilise previewUrls (stable) et non
            URL.createObjectURL() inline qui créait une nouvelle URL révoquée
            immédiatement après chaque render. */}
        {previewUrls.length > 0 && (
          <div>
            <p className="text-sm text-gray-600 mb-2">Nouvelles images à ajouter :</p>
            <div className="flex flex-wrap gap-3">
              {previewUrls.map((url, i) => (
                <div key={i} className="relative w-24 h-24">
                  <Image src={url} alt={`Nouvelle image ${i}`} fill unoptimized
                    className="object-cover rounded border-2 border-green-300" sizes="96px" />
                  <button
                    type="button"
                    onClick={() => handleRemoveNewImage(i)}
                    className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-700 shadow-md"
                  >
                    ×
                  </button>
                  <p className="text-xs text-center mt-1 truncate w-24">
                    {formData.images[i]?.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ------------------ SECTION CARTE ------------------ */}
      <div className="border-t pt-4 mt-4">
        <h3 className="text-lg font-semibold mb-3">Localisation</h3>
        <p className="text-sm text-gray-600 mb-2">
          Cliquez sur la carte ou déplacez le marqueur pour définir la position
        </p>
        <div className="h-64 rounded-lg overflow-hidden border-2 border-gray-300">
          <MapLeaflet
            latitude={formData.latitude}
            longitude={formData.longitude}
            onMove={(latlng) => setFormData(prev => ({ ...prev, latitude: latlng.lat, longitude: latlng.lng }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-xs text-gray-700">Latitude</label>
            <input
              type="number"
              value={formData.latitude}
              readOnly
              aria-label="Latitude"
              className="w-full px-2 py-1 text-sm border rounded bg-gray-50 text-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-700">Longitude</label>
            <input
              type="number"
              value={formData.longitude}
              readOnly
              aria-label="Longitude"
              className="w-full px-2 py-1 text-sm border rounded bg-gray-50 text-gray-900"
            />
          </div>
        </div>
      </div>

      {/* Bouton Submit */}
      <button
        type="submit"
        disabled={loading || (formData.images.length === 0 && existingImages.length === 0)}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition-colors"
      >
        {loading ? "Sauvegarde en cours..." : isEditing ? "Enregistrer les modifications" : "Ajouter le bien"}
      </button>

      {formData.images.length === 0 && existingImages.length === 0 && (
        <p className="text-sm text-red-600 text-center -mt-2">
          ⚠️ Veuillez ajouter au moins une image avant de soumettre
        </p>
      )}
    </form>
  );
};

export default PropertyForm;
