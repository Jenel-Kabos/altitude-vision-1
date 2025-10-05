import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const EditPropertyPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  // ... ajoutez d'autres états pour les champs que vous rendez modifiables

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState(false);

  // Étape 1 : Récupérer les données du bien pour pré-remplir le formulaire
  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const { data } = await axios.get(`http://localhost:5000/api/properties/${id}`);
        setTitle(data.title);
        setDescription(data.description);
        setPrice(data.price);
        // ... mettez à jour les autres états
        setLoading(false);
      } catch (err) {
        setError('Impossible de charger les données du bien.');
        setLoading(false);
      }
    };
    fetchProperty();
  }, [id]);

  // Étape 2 : Soumettre les modifications
  const submitHandler = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setUpdateSuccess(false);

    try {
      const config = {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userInfo.token}`,
        },
      };

      const { data } = await axios.put(
        `http://localhost:5000/api/properties/${id}`,
        { title, description, price /*, ... autres champs */ },
        config
      );
      
      setLoading(false);
      setUpdateSuccess(true);
      // Optionnel : rediriger après un court délai
      setTimeout(() => navigate(`/altimmo/${id}`), 1500);

    } catch (err) {
      setError(err.response?.data?.message || 'La mise à jour a échoué.');
      setLoading(false);
    }
  };

  if (loading && !title) { // Affiche le chargement initial
    return <div className="text-center py-10">Chargement du formulaire...</div>;
  }

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-primary mb-6">Modifier le bien</h1>
        <form onSubmit={submitHandler}>
          {error && <p className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</p>}
          {updateSuccess && <p className="bg-green-100 text-green-700 p-3 rounded mb-4">Mise à jour réussie !</p>}
          
          <div className="mb-4">
            <label htmlFor="title" className="block text-gray-700 font-bold mb-2">Titre de l'annonce</label>
            <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border rounded" required />
          </div>

          <div className="mb-4">
            <label htmlFor="description" className="block text-gray-700 font-bold mb-2">Description</label>
            <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 border rounded" rows="5" required></textarea>
          </div>

          <div className="mb-6">
            <label htmlFor="price" className="block text-gray-700 font-bold mb-2">Prix (FCFA)</label>
            <input type="number" id="price" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full px-3 py-2 border rounded" required />
          </div>
          
          <button type="submit" disabled={loading} className="w-full bg-secondary text-white font-bold py-3 px-6 rounded hover:bg-amber-600 transition duration-300 disabled:bg-gray-400">
            {loading ? 'Mise à jour en cours...' : 'Enregistrer les modifications'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditPropertyPage;