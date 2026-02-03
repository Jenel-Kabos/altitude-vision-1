import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { FaUpload, FaDollarSign, FaBed, FaBath, FaRulerCombined, FaBuilding } from 'react-icons/fa';

const availableAmenities = [
  'Climatisation', 'Piscine', 'Jardin', 'Garage', 'Sécurité 24/7', 
  'Balcon', 'Wi-Fi', 'Cuisine Équipée', 'Gardien', 'Groupe Électrogène'
];

const SubmitPropertyPage = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    listingType: 'Location',
    price: '',
    address: '',
    district: '',
    description: '',
    area: '',
    type: 'Maison',
    bedrooms: '',
    bathrooms: '',
    amenities: [],
  });
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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

  const submitHandler = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const data = new FormData();
    // On ajoute tous les champs du state formData
    for (const key in formData) {
      if (key === 'amenities') {
        data.append(key, JSON.stringify(formData[key]));
      } else {
        data.append(key, formData[key]);
      }
    }
    for (let i = 0; i < images.length; i++) {
      data.append('images', images[i]);
    }

    try {
      const response = await api.post('/properties', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      navigate(`/propriete/${response.data._id}`); // Redirige vers la nouvelle page de détails
    } catch (err) {
      setError(err.response?.data?.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-100 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="bg-white p-8 rounded-2xl shadow-xl">
          <h1 className="text-4xl font-bold text-primary mb-8 text-center">Soumettre un nouveau bien</h1>
          <form onSubmit={submitHandler} className="space-y-8">
            {/* Le reste du formulaire (JSX) reste identique, mais utilise `formData.title`, etc. */}
            <input name="title" value={formData.title} onChange={handleChange} />
            {/* ... etc pour tous les champs ... */}

            <button type="submit" disabled={loading} className="w-full bg-primary text-white font-bold text-lg py-4 px-4 rounded-lg hover:bg-blue-700 transition duration-300 disabled:bg-gray-400">
              {loading ? 'Soumission en cours...' : 'Soumettre le bien'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SubmitPropertyPage;
