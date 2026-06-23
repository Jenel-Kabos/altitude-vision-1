"use client";
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { getPropertyById, updateProperty } from '../../services/propertyService';
import LoadingSpinner from '../../components/UI/LoadingSpinner.jsx';
import Image from 'next/image';
import { VILLES, getArrondissementsFor } from '../../constants/locations';
import { PROPERTY_TYPES } from '../../constants/propertyTypes';

const EditPropertyPage = () => {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;

  // 🔑 CORRECTION : Structure alignée avec le modèle
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    pole: 'Altimmo',
    status: 'vente',
    type: 'Appartement',
    address: {
      street: '',
      arrondissement: '',
      city: 'Brazzaville'
    },
    surface: '',
    bedrooms: '',
    bathrooms: '',
    amenities: '',
    latitude: -4.266,
    longitude: 15.283,
    images: []
  });

  const [existingImages, setExistingImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const property = await getPropertyById(id);
        
        setFormData({
          title: property.title || '',
          description: property.description || '',
          price: property.price || '',
          pole: property.pole || 'Altimmo',
          status: property.status || 'vente',
          type: property.type || 'Appartement',
          address: {
            street: property.address?.street || '',
            arrondissement: property.address?.arrondissement || '',
            city: property.address?.city || 'Brazzaville'
          },
          surface: property.surface || '',
          bedrooms: property.bedrooms || '',
          bathrooms: property.bathrooms || '',
          amenities: property.amenities ? property.amenities.join(', ') : '',
          latitude: property.latitude || property.location?.coordinates[1] || -4.266,
          longitude: property.longitude || property.location?.coordinates[0] || 15.283,
          images: []
        });
        
        setExistingImages(property.images || []);
      } catch (err) {
        setError('Impossible de charger les données du bien.');
        toast.error('Erreur lors du chargement du bien');
      } finally {
        setLoading(false);
      }
    };
    fetchProperty();
  }, [id]);

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
    setError('');

    try {
      const data = new FormData();

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

      // Amenities
      const amenitiesArray = typeof amenities === 'string'
        ? amenities.split(",").map(a => a.trim()).filter(Boolean)
        : (Array.isArray(amenities) ? amenities : []);
      data.append("amenities", JSON.stringify(amenitiesArray));

      // Location
      data.append("location", JSON.stringify({ 
        type: "Point", 
        coordinates: [longitude, latitude] 
      }));

      // Images existantes
      existingImages.forEach(url => data.append("existingImages", url));

      // Nouvelles images
      images.forEach(file => data.append("images", file));

      await updateProperty(id, data);
      toast.success('Bien mis à jour avec succès !');
      router.push(`/propriete/${id}`);
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'La mise à jour a échoué.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !formData.title) return <LoadingSpinner />;

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-primary mb-6">Modifier le bien</h1>
        
        <form onSubmit={submitHandler} className="space-y-4">
          {error && <p className="bg-red-100 text-red-700 p-3 rounded">{error}</p>}

          <div>
            <label className="block text-sm font-medium mb-2">Titre *</label>
            <input 
              type="text" 
              name="title" 
              value={formData.title} 
              onChange={handleChange} 
              className="w-full p-3 border rounded-lg" 
              required 
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description *</label>
            <textarea 
              name="description" 
              value={formData.description} 
              onChange={handleChange} 
              className="w-full p-3 border rounded-lg" 
              rows="5" 
              required 
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Prix *</label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleChange}
              className="w-full p-3 border rounded-lg"
              required
            />
          </div>

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
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-2">Surface (m²)</label>
              <input
                type="number"
                name="surface"
                value={formData.surface || ''}
                onChange={handleChange}
                className="w-full p-3 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Chambres</label>
              <input
                type="number"
                name="bedrooms"
                value={formData.bedrooms || ''}
                onChange={handleChange}
                className="w-full p-3 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Salles de bain</label>
              <input
                type="number"
                name="bathrooms"
                value={formData.bathrooms || ''}
                onChange={handleChange}
                className="w-full p-3 border rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Équipements</label>
            <input
              type="text"
              name="amenities"
              value={formData.amenities || ''}
              onChange={handleChange}
              placeholder="Ex : Climatisation, Parking, Wifi (séparés par des virgules)"
              className="w-full p-3 border rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">Séparez les équipements par des virgules</p>
          </div>

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
              type="text"
              name="street"
              value={formData.address.street}
              onChange={handleAddressChange}
              className="w-full p-3 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Type de transaction</label>
            <select 
              name="status" 
              value={formData.status} 
              onChange={handleChange} 
              className="w-full p-3 border rounded-lg"
            >
              <option value="location">Location</option>
              <option value="vente">Vente</option>
            </select>
          </div>

          {/* Images existantes */}
          {existingImages.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Images actuelles</label>
              <div className="flex flex-wrap gap-3">
                {existingImages.map((img, i) => (
                  <div key={i} className="relative w-24 h-24">
                    <Image src={img} alt={`Image ${i}`} fill className="object-cover rounded" sizes="96px" />
                    <button 
                      type="button" 
                      onClick={() => setExistingImages(existingImages.filter((_, idx) => idx !== i))}
                      className="absolute top-0 right-0 bg-red-600 text-white text-xs rounded-full w-5 h-5"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nouvelles images */}
          <div>
            <label className="block text-sm font-medium mb-2">Ajouter de nouvelles images</label>
            <input 
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageChange}
              className="w-full p-3 border rounded-lg"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-secondary text-white font-bold py-3 px-6 rounded hover:bg-amber-600 transition duration-300 disabled:bg-gray-400"
          >
            {loading ? 'Mise à jour...' : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditPropertyPage;