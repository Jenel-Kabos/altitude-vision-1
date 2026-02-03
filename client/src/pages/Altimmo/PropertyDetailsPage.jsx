import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../../components/layout/Spinner';
import { FaBed, FaBath, FaRulerCombined, FaHome, FaCheckCircle } from 'react-icons/fa';

const SERVER_BASE_URL = 'http://localhost:5000';

const getFullImageUrl = (path) => {
    if (!path) return '/default-placeholder.jpg';
    const cleanPath = path.replace(/\\/g, '/');
    return cleanPath.startsWith('http') ? cleanPath : `${SERVER_BASE_URL}/${cleanPath}`;
};

const PropertyDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth(); // On utilise 'user' pour la cohérence

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mainImage, setMainImage] = useState('');
  
  useEffect(() => {
    const fetchProperty = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/properties/${id}`);
        setProperty(data);
        if (data.images?.length > 0) setMainImage(data.images[0]);
      } catch (err) {
        setError("Impossible de charger les détails du bien.");
      } finally {
        setLoading(false);
      }
    };
    fetchProperty();
  }, [id]);

  const deleteHandler = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce bien ?')) {
      try {
        await api.delete(`/properties/${id}`);
        navigate('/altimmo/annonces');
      } catch (err) {
        setError('La suppression a échoué.');
      }
    }
  };

  if (loading) return <Spinner />;
  if (error) return <div className="text-center py-10 text-red-600">{error}</div>;
  if (!property) return null;

  const canManage = user && property.user && (user._id === property.user || user.role === 'Admin');

  return (
    <div className="bg-white">
      <div className="container mx-auto px-4 py-12 grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* --- Galerie d’images --- */}
        <div className="lg:col-span-3">
          <div className="mb-4 bg-gray-200 rounded-lg overflow-hidden shadow-lg">
            <img
              src={getFullImageUrl(mainImage)}
              alt="Vue principale du bien"
              className="w-full h-auto max-h-[600px] object-cover"
            />
          </div>
          <div className="grid grid-cols-5 gap-3">
            {property.images?.map((imagePath, index) => (
              <div
                key={index}
                onClick={() => setMainImage(imagePath)}
                className={`cursor-pointer rounded-md overflow-hidden transition-all duration-200 ${
                  mainImage === imagePath ? 'ring-2 ring-primary ring-offset-2' : 'hover:opacity-80'
                }`}
              >
                <img
                  src={getFullImageUrl(imagePath)}
                  alt={`Miniature ${index + 1}`}
                  className="w-full h-24 object-cover"
                />
              </div>
            ))}
          </div>
        </div>

        {/* --- Détails du bien --- */}
        <div className="lg:col-span-2 bg-gray-50 p-6 rounded-lg shadow-inner flex flex-col h-full">
            {/* ... Contenu des détails (titre, prix, etc.) ... */}
            <h1 className="text-4xl font-bold text-gray-800 mb-4">{property.title}</h1>

            {/* --- Gestion du bien (Admin ou Propriétaire) --- */}
            {canManage && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Gérer le bien</h3>
                <div className="flex space-x-4">
                  <button
                    onClick={() => navigate(`/propriete/${id}/edit`)} // Lien corrigé
                    className="flex-1 bg-yellow-500 text-white font-bold py-2 px-4 rounded hover:bg-yellow-600 transition"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={deleteHandler}
                    className="flex-1 bg-red-600 text-white font-bold py-2 px-4 rounded hover:bg-red-700 transition"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default PropertyDetailPage;
