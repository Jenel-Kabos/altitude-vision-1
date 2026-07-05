"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { addProperty } from '../../services/propertyService';
import { FaUpload, FaDollarSign, FaBed, FaBath, FaRulerCombined, FaBuilding } from 'react-icons/fa';
import { VILLES, getArrondissementsFor } from '../../constants/locations';
import { PROPERTY_TYPES } from '../../constants/propertyTypes';

const availableAmenities = [
  'Climatisation', 'Piscine', 'Jardin', 'Garage', 'Sécurité 24/7', 
  'Balcon', 'Wi-Fi', 'Cuisine Équipée', 'Gardien', 'Groupe Électrogène'
];

const SubmitPropertyPage = () => {

  // 🔑 CORRECTION CRITIQUE : Structure de formData alignée avec le modèle
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    pole: 'Altimmo',
    status: 'vente',
    type: 'Appartement',
    availability: 'Disponible',
    address: {
      street: '',
      arrondissement: '',
      city: 'Brazzaville'
    },
    surface: '',
    bedrooms: '',
    bathrooms: '',
    amenities: [],
    latitude: -4.266,
    longitude: 15.283,
    images: [],
  });

  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 🔑 CORRECTION : Gestion de l'adresse imbriquée
  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      address: {
        ...prev.address,
        [name]: value
      }
    }));
  };

  const handleCityChange = (e) => {
    const newCity = e.target.value;
    setFormData(prev => ({
      ...prev,
      address: {
        ...prev.address,
        city: newCity,
        arrondissement: getArrondissementsFor(newCity).includes(prev.address.arrondissement)
          ? prev.address.arrondissement
          : ''
      }
    }));
  };
  
  const handleAmenitiesChange = (e) => {
    const { value, checked } = e.target;
    setFormData(prev => ({
        ...prev,
        amenities: checked 
            ? [...prev.amenities, value]
            : prev.amenities.filter(a => a !== value)
    }));
  };

  const handleImageChange = (e) => {
    const newFiles = Array.from(e.target.files);
    setFormData(prev => ({
      ...prev,
      images: [...prev.images, ...newFiles]
    }));
  };

  const submitHandler = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = new FormData();

      // 🔑 CORRECTION : Envoi correct des champs
      const { images, latitude, longitude, address, amenities, ...otherFields } = formData;
      
      // Champs principaux
      Object.entries(otherFields).forEach(([k, v]) => {
        if (v !== "" && v !== null && v !== undefined) {
          data.append(k, v);
        }
      });

      // Coordonnées
      data.append('latitude', latitude);
      data.append('longitude', longitude);

      // Adresse en JSON
      data.append("address", JSON.stringify(address));

      // Amenities en JSON
      data.append("amenities", JSON.stringify(amenities));

      // Location en JSON
      data.append("location", JSON.stringify({ 
        type: "Point", 
        coordinates: [longitude, latitude] 
      }));

      // Images
      images.forEach(file => data.append("images", file));

      const response = await addProperty(data);
      toast.success("Bien ajouté avec succès !");
      router.push(`/propriete/${response._id}`);
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Une erreur est survenue.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-100 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="bg-white p-8 rounded-2xl shadow-xl">
          <h1 className="text-4xl font-bold text-primary mb-8 text-center">Soumettre un nouveau bien</h1>
          
          <form onSubmit={submitHandler} className="space-y-6">
            {/* Titre */}
            <div>
              <label className="block text-sm font-medium mb-2">Titre *</label>
              <input 
                name="title" 
                value={formData.title} 
                onChange={handleChange} 
                className="w-full p-3 border rounded-lg"
                required 
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-2">Description *</label>
              <textarea 
                name="description" 
                value={formData.description} 
                onChange={handleChange}
                className="w-full p-3 border rounded-lg"
                rows={5}
                required 
              />
            </div>

            {/* Prix */}
            <div>
              <label className="block text-sm font-medium mb-2">Prix (FCFA) *</label>
              <input 
                name="price"
                type="number"
                value={formData.price} 
                onChange={handleChange}
                className="w-full p-3 border rounded-lg"
                required 
              />
            </div>

            {/* Pôle */}
            <div>
              <label className="block text-sm font-medium mb-2">Pôle *</label>
              <select 
                name="pole" 
                value={formData.pole} 
                onChange={handleChange}
                className="w-full p-3 border rounded-lg"
              >
                <option value="Altimmo">Altimmo</option>
                <option value="MilaEvents">MilaEvents</option>
                <option value="Altcom">Altcom</option>
              </select>
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium mb-2">Type *</label>
              <select
                name="type"
                value={formData.type || ''}
                onChange={handleChange}
                className="w-full p-3 border rounded-lg"
                required
              >
                <option value="">Sélectionner...</option>
                {PROPERTY_TYPES.map((t) => (
                  <option key={t.value ?? t} value={t.value ?? t}>{t.label ?? t}</option>
                ))}
              </select>
            </div>

            {/* Adresse */}
            <div>
              <label className="block text-sm font-medium mb-2">Ville *</label>
              <select
                name="city"
                value={formData.address.city || ''}
                onChange={handleCityChange}
                className="w-full p-3 border rounded-lg"
                required
              >
                <option value="">Sélectionner...</option>
                {VILLES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Arrondissement *</label>
              <select
                name="arrondissement"
                value={formData.address.arrondissement || ''}
                onChange={handleAddressChange}
                disabled={!formData.address.city}
                className="w-full p-3 border rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                required
              >
                <option value="">Sélectionner...</option>
                {getArrondissementsFor(formData.address.city).map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Rue</label>
              <input
                name="street"
                value={formData.address.street}
                onChange={handleAddressChange}
                className="w-full p-3 border rounded-lg"
              />
            </div>

            {/* Surface, Chambres, Salles de bain */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Surface (m²)</label>
                <input 
                  name="surface"
                  type="number"
                  value={formData.surface} 
                  onChange={handleChange}
                  className="w-full p-3 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Chambres</label>
                <input 
                  name="bedrooms"
                  type="number"
                  value={formData.bedrooms} 
                  onChange={handleChange}
                  className="w-full p-3 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Salles de bain</label>
                <input 
                  name="bathrooms"
                  type="number"
                  value={formData.bathrooms} 
                  onChange={handleChange}
                  className="w-full p-3 border rounded-lg"
                />
              </div>
            </div>

            {/* Équipements */}
            <div>
              <label className="block text-sm font-medium mb-2">Équipements</label>
              <div className="grid grid-cols-2 gap-2">
                {availableAmenities.map(amenity => (
                  <label key={amenity} className="flex items-center space-x-2">
                    <input 
                      type="checkbox"
                      value={amenity}
                      checked={formData.amenities.includes(amenity)}
                      onChange={handleAmenitiesChange}
                    />
                    <span>{amenity}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Images */}
            <div>
              <label className="block text-sm font-medium mb-2">Images *</label>
              <input 
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageChange}
                className="w-full p-3 border rounded-lg"
              />
              {formData.images.length > 0 && (
                <p className="text-sm text-gray-600 mt-2">
                  {formData.images.length} image(s) sélectionnée(s)
                </p>
              )}
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-primary text-white font-bold text-lg py-4 px-4 rounded-lg hover:bg-blue-700 transition duration-300 disabled:bg-gray-400"
            >
              {loading ? 'Soumission en cours...' : 'Soumettre le bien'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SubmitPropertyPage;