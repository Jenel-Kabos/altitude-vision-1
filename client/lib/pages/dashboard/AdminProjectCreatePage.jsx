import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import Spinner from '../../components/layout/Spinner';
import Image from 'next/image';

const AdminProjectCreatePage = () => {
  const [formData, setFormData] = useState({ title: '', client: '', service: '', description: '' });
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
    setImages(files);
    const previews = files.map(file => URL.createObjectURL(file));
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
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [imagePreviews]);

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="bg-white p-8 shadow-lg rounded-lg">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-primary">Créer un Nouveau Projet</h1>
          <Link to="/admin/projets" className="text-primary hover:underline">&larr; Retour à la liste</Link>
        </div>
        
        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

        <form onSubmit={submitHandler} className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">Titre du Projet</label>
            <input id="title" type="text" value={formData.title} onChange={handleChange} required className="input-style"/>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="client" className="block text-sm font-medium text-gray-700">Client</label>
              <input id="client" type="text" value={formData.client} onChange={handleChange} required className="input-style"/>
            </div>
            <div>
              <label htmlFor="service" className="block text-sm font-medium text-gray-700">Service</label>
              <input id="service" type="text" placeholder="Ex: Branding, Développement Web" value={formData.service} onChange={handleChange} required className="input-style"/>
            </div>
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
            <textarea id="description" rows="5" value={formData.description} onChange={handleChange} required className="input-style"></textarea>
          </div>
          <div>
            <label htmlFor="images" className="block text-sm font-medium text-gray-700">Images (jusqu'à 10)</label>
            <input id="images" type="file" multiple accept="image/*" onChange={handleImageChange} required className="file-input-style" />
          </div>

          {imagePreviews.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700">Aperçus :</p>
              <div className="mt-2 grid grid-cols-3 md:grid-cols-5 gap-4">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative w-full h-24">
                    <Image src={preview} alt={`Aperçu ${index + 1}`} fill unoptimized className="object-cover rounded-md" sizes="20vw" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full bg-primary text-white font-bold py-3 px-4 rounded-md hover:bg-blue-800 transition duration-300 disabled:bg-gray-400">
            {loading ? <Spinner /> : 'Créer le Projet'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminProjectCreatePage;