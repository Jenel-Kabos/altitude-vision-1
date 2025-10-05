import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const SubmitPropertyPage = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [status, setStatus] = useState('Location');
  const [image, setImage] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { userInfo } = useAuth();
  const navigate = useNavigate();

  const submitHandler = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('price', price);
    formData.append('address', address);
    formData.append('district', district);
    formData.append('status', status);
    formData.append('image', image); // C'est ici qu'on ajoute le fichier

    try {
      const config = {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${userInfo.token}`,
        },
      };

      await axios.post('http://localhost:5000/api/properties', formData, config);
      
      setLoading(false);
      navigate('/dashboard'); // Rediriger après succès
      
    } catch (err) {
      setError(err.response?.data?.message || 'Une erreur est survenue lors de la soumission.');
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-primary mb-6">Proposer un nouveau bien</h1>
        <form onSubmit={submitHandler}>
          {error && <p className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</p>}
          
          {/* ... Tous les champs du formulaire (Titre, Description, Prix etc.) ... */}
          {/* Exemple pour le champ Titre */}
          <div className="mb-4">
            <label htmlFor="title" className="block text-gray-700 font-bold mb-2">Titre de l'annonce</label>
            <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border rounded" required />
          </div>
          
          {/* ... Autres champs similaires pour description, price, address, district ... */}
          
          {/* Champ pour le statut (Vente/Location) */}
          <div className="mb-4">
            <label htmlFor="status" className="block text-gray-700 font-bold mb-2">Statut</label>
            <select id="status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 border rounded">
              <option value="Location">Location</option>
              <option value="Vente">Vente</option>
            </select>
          </div>
          
          {/* Champ pour l'image */}
          <div className="mb-6">
            <label htmlFor="image" className="block text-gray-700 font-bold mb-2">Image principale</label>
            <input type="file" id="image" onChange={(e) => setImage(e.target.files[0])} className="w-full" required />
          </div>
          
          <button type="submit" disabled={loading} className="w-full bg-primary text-white font-bold py-3 px-6 rounded hover:bg-blue-800 transition duration-300 disabled:bg-gray-400">
            {loading ? 'Soumission en cours...' : 'Soumettre le bien'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SubmitPropertyPage;