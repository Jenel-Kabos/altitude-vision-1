"use client";

import React, { useRef, useMemo, useEffect } from "react";
import Image from 'next/image';
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Correction icônes Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

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

  // Carte interactive
  const LocationMarker = () => {
    useMapEvents({
      click(e) {
        setFormData((prev) => ({
          ...prev,
          latitude: e.latlng.lat,
          longitude: e.latlng.lng,
        }));
      },
    });
    return (
      <Marker
        position={[formData.latitude, formData.longitude]}
        draggable
        eventHandlers={{
          dragend: (e) => {
            const latlng = e.target.getLatLng();
            setFormData((prev) => ({
              ...prev,
              latitude: latlng.lat,
              longitude: latlng.lng,
            }));
          },
        }}
      />
    );
  };

  const handleChange = (e) => {
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
        <input
          name="type"
          value={formData.type}
          onChange={handleChange}
          placeholder="Ex: Appartement, Villa, Studio"
          aria-label="Type de bien"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
        />
      </div>

      {/* ------------------ SECTION ADRESSE ------------------ */}
      <div className="border-t pt-4 mt-4">
        <h3 className="text-lg font-semibold mb-3">Adresse</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quartier *</label>
            <input
              name="district"
              value={formData.address.district}
              onChange={handleAddressChange}
              placeholder="Ex: Moungali"
              aria-label="Quartier"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
              required
            />
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
            <input
              name="city"
              value={formData.address.city}
              onChange={handleAddressChange}
              placeholder="Brazzaville"
              aria-label="Ville"
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
              ? "Veuillez ajouter au moins une image"
              : `${formData.images.length} image(s) sélectionnée(s)`}
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
          <MapContainer
            center={[formData.latitude, formData.longitude]}
            zoom={16}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <LocationMarker />
          </MapContainer>
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
        disabled={loading || formData.images.length === 0}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition-colors"
      >
        {loading ? "Sauvegarde en cours..." : "Enregistrer le bien"}
      </button>

      {formData.images.length === 0 && (
        <p className="text-sm text-red-600 text-center -mt-2">
          ⚠️ Veuillez ajouter au moins une image avant de soumettre
        </p>
      )}
    </form>
  );
};

export default PropertyForm;