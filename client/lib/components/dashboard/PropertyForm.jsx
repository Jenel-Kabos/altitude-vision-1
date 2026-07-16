"use client";

import React, { useRef, useMemo, useEffect } from "react";
import Image from 'next/image';
import dynamic from 'next/dynamic';

const MapLeaflet = dynamic(() => import('./MapLeaflet'), { ssr: false });
import { VILLES, getArrondissementsFor } from "../../constants/locations";
import { PROPERTY_TYPES } from "../../constants/propertyTypes";

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

const TENANT_PROFILES = ['Salarié', 'Étudiant', 'Indépendant/Affairiste', 'Fonctionnaire', 'Retraité'];
const REQUIRED_DOCUMENTS = [
  'CNI',
  'Justificatif de revenus',
  '2 derniers bulletins de salaire',
  'Caution bancaire',
  'Attestation de travail',
  'Quittance de loyer précédente',
];

const PropertyForm = ({
  formData,
  setFormData,
  onSubmit,
  loading,
  existingImages = [],
  setExistingImages = () => {},
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
    const rate = formData.status === 'location' ? 0.8 : 0.1;
    const calculated = Math.round(Number(formData.price) * rate);
    setFormData((prev) => ({ ...prev, honoraires: calculated }));
  }, [formData.price, formData.status, setFormData]);

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

      {/* ------------------ SECTION INFOS DE BASE ------------------ */}
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Prix (FCFA) *</label>
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
        <h3 className="text-lg font-semibold mb-3">Adresse</h3>

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
        <h3 className="text-lg font-semibold mb-3">Caractéristiques Détaillées</h3>

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
        {loading ? "Sauvegarde en cours..." : "Enregistrer le bien"}
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
