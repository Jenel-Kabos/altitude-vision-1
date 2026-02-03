import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import Spinner from '../../components/layout/Spinner';

const AdminProjectCreatePage = () => {
  const [formData, setFormData] = useState({ 
    title: '', 
    client: '', 
    service: '', 
    description: '' 
  });
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files).slice(0, 10);
    
    if (files.length === 0) {
      setImages([]);
      setImagePreviews([]);
      return;
    }

    setImages(files);
    
    // Créer les previews
    const previews = files.map(file => {
      try {
        return URL.createObjectURL(file);
      } catch (err) {
        console.error('Erreur lors de la création de l\'aperçu:', err);
        return null;
      }
    }).filter(Boolean); // Filtrer les valeurs null
    
    setImagePreviews(previews);
  };

  const submitHandler = useCallback(async (e) => {
    e.preventDefault();
    
    if (images.length === 0) {
      setError("Veuillez sélectionner au moins une image.");
      return;
    }

    setLoading(true);
    setError('');

    const payload = new FormData();
    Object.keys(formData).forEach(key => payload.append(key, formData[key]));
    images.forEach(image => payload.append('images', image));

    try {
      await api.post('/projects', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      navigate('/admin/projets');
    } catch (err) {
      const message = err.response?.data?.message || 'Une erreur est survenue.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [formData, images, navigate]);
  
  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      imagePreviews.forEach(url => {
        if (url) {
          try {
            URL.revokeObjectURL(url);
          } catch (err) {
            console.error('Erreur lors de la révocation de l\'URL:', err);
          }
        }
      });
    };
  }, [imagePreviews]);

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="bg-white p-8 shadow-lg rounded-lg">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-primary">Créer un Nouveau Projet</h1>
          <Link to="/admin/projets" className="text-primary hover:underline">
            &larr; Retour à la liste
          </Link>
        </div>
        
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={submitHandler} className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Titre du Projet
            </label>
            <input 
              id="title" 
              type="text" 
              value={formData.title} 
              onChange={handleChange} 
              required 
              className="input-style w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="client" className="block text-sm font-medium text-gray-700 mb-2">
                Client
              </label>
              <input 
                id="client" 
                type="text" 
                value={formData.client} 
                onChange={handleChange} 
                required 
                className="input-style w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label htmlFor="service" className="block text-sm font-medium text-gray-700 mb-2">
                Service
              </label>
              <input 
                id="service" 
                type="text" 
                placeholder="Ex: Branding, Développement Web" 
                value={formData.service} 
                onChange={handleChange} 
                required 
                className="input-style w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea 
              id="description" 
              rows="5" 
              value={formData.description} 
              onChange={handleChange} 
              required 
              className="input-style w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-y"
            />
          </div>

          <div>
            <label htmlFor="images" className="block text-sm font-medium text-gray-700 mb-2">
              Images (jusqu'à 10)
            </label>
            <input 
              id="images" 
              type="file" 
              multiple 
              accept="image/*" 
              onChange={handleImageChange} 
              required 
              className="file-input-style w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            />
            <p className="text-xs text-gray-500 mt-1">
              Formats acceptés: JPG, PNG, GIF. Max 10 images.
            </p>
          </div>

          {imagePreviews.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">
                Aperçus ({imagePreviews.length} image{imagePreviews.length > 1 ? 's' : ''}) :
              </p>
              <div className="mt-2 grid grid-cols-3 md:grid-cols-5 gap-4">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative group">
                    <img 
                      src={preview} 
                      alt={`Aperçu ${index + 1}`} 
                      className="w-full h-24 object-cover rounded-md border-2 border-gray-200 shadow-sm"
                      onError={(e) => {
                        console.error(`Erreur de chargement de l'image ${index + 1}`);
                        e.target.src = 'https://via.placeholder.com/150?text=Erreur';
                      }}
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-md flex items-center justify-center">
                      <span className="text-white text-xs font-semibold opacity-0 group-hover:opacity-100">
                        Image {index + 1}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-primary text-white font-bold py-3 px-4 rounded-md hover:bg-blue-800 transition duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <>
                <Spinner />
                <span className="ml-2">Création en cours...</span>
              </>
            ) : (
              'Créer le Projet'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminProjectCreatePage;