// src/pages/ModerationPage.jsx
import React, { useEffect, useState } from 'react';
// 1. On remplace axios par ton service API configuré
import api from '../services/api'; 
import { Filter, CheckCircle2, XCircle, Eye, MapPin, Tag } from 'lucide-react';

const ModerationPage = () => {
  const [properties, setProperties] = useState([]);
  const [filteredProperties, setFilteredProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedPole, setSelectedPole] = useState('Tous');
  const [stats, setStats] = useState({ total: 0, Altimmo: 0, MilaEvents: 0, Altcom: 0 });

  const poles = ['Tous', 'Altimmo', 'MilaEvents', 'Altcom'];

  // Récupération des propriétés en attente
  const fetchProperties = async () => {
    setLoading(true);
    try {
      // 2. Plus besoin de l'URL complète ni du header Authorization manuel
      // api.js s'occupe de tout (Render URL + Token)
      const res = await api.get('/properties/status/pending');
      
      const props = res.data.data.properties;
      setProperties(props);
      setFilteredProperties(props);
      
      // Calculer les statistiques
      const newStats = {
        total: props.length,
        Altimmo: props.filter(p => p.pole === 'Altimmo').length,
        MilaEvents: props.filter(p => p.pole === 'MilaEvents').length,
        Altcom: props.filter(p => p.pole === 'Altcom').length,
      };
      setStats(newStats);
      
      console.log('✅ [ModerationPage] Propriétés chargées:', newStats);
    } catch (err) {
      console.error('❌ [ModerationPage] Erreur:', err);
      // api.js gère déjà certaines erreurs, mais on garde l'affichage local
      setError(err.response?.data?.message || "Impossible de charger les annonces.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  // Filtrer par pôle
  useEffect(() => {
    if (selectedPole === 'Tous') {
      setFilteredProperties(properties);
    } else {
      setFilteredProperties(properties.filter(p => p.pole === selectedPole));
    }
  }, [selectedPole, properties]);

  // Valider ou rejeter une propriété
  const handleModeration = async (id, action) => {
    try {
      // 3. Appel simplifié via api.js
      await api.patch(`/properties/${id}/${action}`);

      // Supprimer la propriété de la liste
      const updatedProperties = properties.filter((p) => p._id !== id);
      setProperties(updatedProperties);
      
      // Mettre à jour les stats instantanément sans recharger
      const propertyToRemove = properties.find(p => p._id === id);
      if (propertyToRemove) {
        setStats(prev => ({
            ...prev,
            total: prev.total - 1,
            [propertyToRemove.pole]: prev[propertyToRemove.pole] - 1
        }));
      }

      setSelectedProperty(null);
      
      // Afficher un message de succès (tu pourrais utiliser toast ici plus tard)
      alert(`Annonce ${action === 'validate' ? 'validée' : 'rejetée'} avec succès !`);
    } catch (err) {
      console.error('❌ [ModerationPage] Erreur modération:', err);
      alert(err.response?.data?.message || "Une erreur est survenue.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Chargement des annonces en attente...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded">
          <p className="font-bold">Erreur</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded">
          <p className="font-bold flex items-center">
            <CheckCircle2 className="mr-2" />
            Aucune annonce en attente de validation
          </p>
          <p className="mt-2">Toutes les annonces ont été traitées !</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* En-tête avec statistiques */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Modération des Annonces</h1>
        
        {/* Statistiques */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 rounded-lg shadow">
            <p className="text-sm opacity-90">Total</p>
            <p className="text-3xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-4 rounded-lg shadow">
            <p className="text-sm opacity-90">Altimmo</p>
            <p className="text-3xl font-bold">{stats.Altimmo}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-4 rounded-lg shadow">
            <p className="text-sm opacity-90">MilaEvents</p>
            <p className="text-3xl font-bold">{stats.MilaEvents}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 rounded-lg shadow">
            <p className="text-sm opacity-90">Altcom</p>
            <p className="text-3xl font-bold">{stats.Altcom}</p>
          </div>
        </div>

        {/* Filtres par pôle */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="text-gray-600" size={20} />
          <span className="text-gray-600 font-medium">Filtrer par pôle :</span>
          {poles.map((pole) => (
            <button
              key={pole}
              onClick={() => setSelectedPole(pole)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedPole === pole
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {pole}
              {pole !== 'Tous' && (
                <span className="ml-2 bg-white bg-opacity-30 px-2 py-0.5 rounded-full text-xs">
                  {stats[pole]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Liste des propriétés */}
      {filteredProperties.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-lg">
            Aucune annonce {selectedPole !== 'Tous' && `pour ${selectedPole}`} en attente de validation.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProperties.map((property) => (
            <div
              key={property._id}
              className="border rounded-lg shadow-md p-4 flex flex-col cursor-pointer hover:shadow-xl transition-all duration-300 bg-white"
              onClick={() => setSelectedProperty(property)}
            >
              <div className="relative mb-3">
                <img
                  src={property.images?.[0] || '/placeholder.png'}
                  alt={property.title}
                  className="w-full h-48 object-cover rounded"
                />
                <span className={`absolute top-2 left-2 px-3 py-1 rounded-full text-xs font-bold text-white ${
                  property.pole === 'Altimmo' ? 'bg-green-500' :
                  property.pole === 'MilaEvents' ? 'bg-purple-500' :
                  'bg-orange-500'
                }`}>
                  {property.pole}
                </span>
              </div>
              
              <h2 className="text-lg font-semibold text-gray-800 mb-2">{property.title}</h2>
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{property.description}</p>
              
              <div className="space-y-1 text-sm">
                <p className="flex items-center text-gray-700">
                  <Tag className="w-4 h-4 mr-2 text-blue-500" />
                  <strong>Type :</strong> <span className="ml-1">{property.type}</span>
                </p>
                <p className="flex items-center text-gray-700">
                  <strong>Prix :</strong> <span className="ml-1">{property.price?.toLocaleString()} FCFA</span>
                </p>
              </div>

              <button className="mt-4 w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition">
                <Eye size={18} />
                Voir les détails
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal pour détails */}
      {selectedProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-4 right-4 text-gray-700 hover:text-red-600 text-2xl font-bold transition"
              onClick={() => setSelectedProperty(null)}
            >
              &times;
            </button>
            
            {/* Badge du pôle */}
            <span className={`inline-block mb-4 px-4 py-2 rounded-full text-sm font-bold text-white ${
              selectedProperty.pole === 'Altimmo' ? 'bg-green-500' :
              selectedProperty.pole === 'MilaEvents' ? 'bg-purple-500' :
              'bg-orange-500'
            }`}>
              {selectedProperty.pole}
            </span>

            <h2 className="text-2xl font-bold mb-4 text-gray-800">{selectedProperty.title}</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">{selectedProperty.description}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm">
              <div className="space-y-2">
                <p><strong>Type :</strong> {selectedProperty.type}</p>
                <p><strong>Status :</strong> {selectedProperty.status}</p>
                <p><strong>Prix :</strong> {selectedProperty.price?.toLocaleString()} FCFA</p>
                <p className="flex items-start">
                  <MapPin className="w-4 h-4 mr-2 mt-1 text-red-500 flex-shrink-0" />
                  <span>
                    <strong>Adresse :</strong><br />
                    {selectedProperty.address?.street}, {selectedProperty.address?.district}, {selectedProperty.address?.city}
                  </span>
                </p>
              </div>
              
              <div className="space-y-2">
                {selectedProperty.bedrooms && <p><strong>Chambres :</strong> {selectedProperty.bedrooms}</p>}
                {selectedProperty.bathrooms && <p><strong>Salles de bain :</strong> {selectedProperty.bathrooms}</p>}
                {selectedProperty.surface && <p><strong>Surface :</strong> {selectedProperty.surface} m²</p>}
                <p><strong>Commodités :</strong> {selectedProperty.amenities?.join(', ') || 'Aucune'}</p>
              </div>
            </div>

            {/* Galerie d'images */}
            <div className="mb-6">
              <h3 className="font-bold text-lg mb-3">Images ({selectedProperty.images?.length || 0})</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {selectedProperty.images?.map((img, idx) => (
                  <img
                    key={idx}
                    src={img}
                    alt={`${selectedProperty.title} ${idx + 1}`}
                    className="w-full h-32 object-cover rounded-lg shadow hover:shadow-xl transition"
                  />
                ))}
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex justify-end gap-3 flex-wrap border-t pt-4">
              <button
                onClick={() => handleModeration(selectedProperty._id, 'validate')}
                className="flex items-center gap-2 bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition font-medium shadow-lg"
              >
                <CheckCircle2 size={20} />
                Valider
              </button>
              <button
                onClick={() => handleModeration(selectedProperty._id, 'reject')}
                className="flex items-center gap-2 bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition font-medium shadow-lg"
              >
                <XCircle size={20} />
                Rejeter
              </button>
              <button
                onClick={() => setSelectedProperty(null)}
                className="bg-gray-300 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-400 transition font-medium"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModerationPage;