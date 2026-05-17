import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import { FaUpload } from 'react-icons/fa';
import Spinner from '../../components/layout/Spinner';

const AdminEventCreatePage = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ title: '', description: '', date: '', location: '' });
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleFileChange = (e) => {
    setImages([...e.target.files]);
  };

  const submitHandler = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const payload = new FormData();
    Object.keys(formData).forEach(key => payload.append(key, formData[key]));
    for (let i = 0; i < images.length; i++) {
      payload.append('images', images[i]);
    }

    try {
      await api.post('/events', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccess(true);
      setTimeout(() => navigate('/admin/evenements'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Une erreur est survenue.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Créer un Nouvel Événement</h1>
        <Link to="/admin/evenements" className="text-primary hover:underline">← Retour à la liste</Link>
      </div>

      <div className="bg-white p-8 rounded-lg shadow-md">
        <form onSubmit={submitHandler}>
          {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
          {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">Événement créé avec succès ! Redirection...</div>}

          <div className="mb-4">
            <label htmlFor="title" className="block text-gray-700 font-bold mb-2">Titre de l'événement</label>
            <input type="text" id="title" value={formData.title} onChange={handleChange} className="input-style" required />
          </div>

          <div className="mb-4">
            <label htmlFor="description" className="block text-gray-700 font-bold mb-2">Description</label>
            <textarea id="description" rows="5" value={formData.description} onChange={handleChange} className="input-style" required></textarea>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            <div>
              <label htmlFor="date" className="block text-gray-700 font-bold mb-2">Date</label>
              <input type="date" id="date" value={formData.date} onChange={handleChange} className="input-style" required />
            </div>
            <div>
              <label htmlFor="location" className="block text-gray-700 font-bold mb-2">Lieu</label>
              <input type="text" id="location" value={formData.location} onChange={handleChange} className="input-style" required />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 font-bold mb-2">Images</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <FaUpload className="mx-auto text-4xl text-gray-400 mb-2" />
              <input type="file" multiple onChange={handleFileChange} className="file-input-style" />
              <p className="text-xs text-gray-500 mt-2">PNG, JPG, GIF (jusqu'à 5)</p>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-primary text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition duration-300 disabled:bg-gray-400">
            {loading ? <Spinner /> : "Créer l'Événement"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminEventCreatePage;