import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import Spinner from '../../components/layout/Spinner';
import { FaTrash } from 'react-icons/fa';

const AdminProjectEditPage = () => {
  const { id: projectId } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ title: '', client: '', service: '', description: '' });
  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [newImagePreviews, setNewImagePreviews] = useState([]);
  const [imagesToDelete, setImagesToDelete] = useState([]);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const backendUrl = import.meta.env.VITE_API_URL.replace('/api', '') || 'http://localhost:5000';

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const { data } = await api.get(`/projects/${projectId}`);
        setFormData({
          title: data.title,
          client: data.client,
          service: data.service,
          description: data.description,
        });
        setExistingImages(data.images);
      } catch (err) {
        setError('Impossible de charger les données du projet.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProject();
  }, [projectId]);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({...prev, [id]: value }));
  };

  const handleNewImageChange = (e) => {
    const files = Array.from(e.target.files);
    setNewImages(files);
    const previews = files.map(file => URL.createObjectURL(file));
    setNewImagePreviews(previews);
  };

  const handleDeleteExistingImage = (imageUrl) => {
    setImagesToDelete(prev => [...prev, imageUrl]);
    setExistingImages(prev => prev.filter(img => img !== imageUrl));
  };

  const submitHandler = useCallback(async (e) => {
    e.preventDefault();
    setUploading(true);
    setError('');
    setSuccess('');

    const payload = new FormData();
    Object.keys(formData).forEach(key => payload.append(key, formData[key]));
    
    newImages.forEach(image => payload.append('images', image));

    if (imagesToDelete.length > 0) {
      payload.append('imagesToDelete', JSON.stringify(imagesToDelete));
    }

    try {
      await api.put(`/projects/${projectId}`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccess('Le projet a été mis à jour avec succès !');
      setTimeout(() => navigate('/admin/projets'), 2000);
    } catch (err) {
      const message = err.response?.data?.message || 'Une erreur est survenue.';
      setError(message);
    } finally {
      setUploading(false);
    }
  }, [formData, newImages, imagesToDelete, projectId, navigate]);

  if (loading) return <Spinner />;

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="bg-white p-8 shadow-lg rounded-lg">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-primary">Modifier le Projet</h1>
          <Link to="/admin/projets" className="text-primary hover:underline">← Retour à la liste</Link>
        </div>
        
        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
        {success && <div className="bg-green-100 text-green-700 p-3 rounded mb-4">{success}</div>}

        <form onSubmit={submitHandler} className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">Titre</label>
            <input id="title" type="text" value={formData.title} onChange={handleChange} required className="input-style"/>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="client" className="block text-sm font-medium text-gray-700">Client</label>
              <input id="client" type="text" value={formData.client} onChange={handleChange} required className="input-style"/>
            </div>
            <div>
              <label htmlFor="service" className="block text-sm font-medium text-gray-700">Service</label>
              <input id="service" type="text" value={formData.service} onChange={handleChange} required className="input-style"/>
            </div>
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
            <textarea id="description" rows="5" value={formData.description} onChange={handleChange} required className="input-style"></textarea>
          </div>

          {existingImages.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">Images Actuelles</h3>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                {existingImages.map((imageUrl, index) => (
                  <div key={index} className="relative group">
                    <img src={`${backendUrl}${imageUrl}`} alt={`Projet existant ${index + 1}`} className="w-full h-24 object-cover rounded-md"/>
                    <button type="button" onClick={() => handleDeleteExistingImage(imageUrl)} className="absolute top-1 right-1 bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      <FaTrash size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="newImages" className="block text-sm font-medium text-gray-700">Ajouter de nouvelles images</label>
            <input id="newImages" type="file" multiple accept="image/*" onChange={handleNewImageChange} className="file-input-style"/>
          </div>

          {newImagePreviews.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700">Nouveaux aperçus :</p>
              <div className="mt-2 grid grid-cols-3 md:grid-cols-5 gap-4">
                {newImagePreviews.map((preview, index) => (
                  <img key={index} src={preview} alt={`Aperçu ${index + 1}`} className="w-full h-24 object-cover rounded-md"/>
                ))}
              </div>
            </div>
          )}

          <button type="submit" disabled={uploading} className="w-full bg-primary text-white font-bold py-3 px-4 rounded-md hover:bg-blue-800 transition duration-300 disabled:bg-gray-400">
            {uploading ? 'Mise à jour en cours...' : 'Mettre à jour le Projet'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminProjectEditPage;