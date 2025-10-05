import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../../components/layout/Spinner';

const PropertyDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useAuth();

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`http://localhost:5000/api/properties/${id}`);
        setProperty(data);
        setLoading(false);
      } catch (err) {
        setError('Impossible de charger les détails du bien. Il est possible qu\'il n\'existe pas.');
        setLoading(false);
      }
    };

    fetchProperty();
  }, [id]);

  const deleteHandler = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce bien définitivement ?')) {
      try {
        const config = {
          headers: {
            Authorization: `Bearer ${userInfo.token}`,
          },
        };
        await axios.delete(`http://localhost:5000/api/properties/${id}`, config);
        navigate('/altimmo');
      } catch (err) {
        setError('La suppression a échoué. Veuillez réessayer.');
        console.error(err);
      }
    }
  };

  if (loading) {
    return <Spinner />;
  }

  if (error) {
    return <div className="text-center py-10 text-red-600 bg-red-100 container mx-auto my-8">{error}</div>;
  }

  if (!property) {
    return null;
  }

  return (
    <div className="bg-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          
          <div className="lg:col-span-3">
            <img 
              src={`http://localhost:5000/${property.images[0]}`} 
              alt={property.title}
              className="w-full h-auto max-h-[600px] object-cover rounded-lg shadow-lg"
            />
          </div>

          <div className="lg:col-span-2">
            <div className="bg-gray-50 p-6 rounded-lg shadow-inner flex flex-col h-full">
              <span className={`inline-block self-start px-3 py-1 text-sm font-semibold rounded-full mb-4 ${property.status === 'Vente' ? 'bg-red-200 text-red-800' : 'bg-blue-200 text-blue-800'}`}>
                À {property.status}
              </span>
              <h1 className="text-4xl font-bold text-primary mb-4">{property.title}</h1>
              <p className="text-lg text-gray-600 mb-6">{property.address}, {property.district}</p>
              
              <div className="text-5xl font-light text-secondary mb-8">
                {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF' }).format(property.price)}
              </div>

              <h2 className="text-xl font-semibold text-primary mb-2">Description</h2>
              <p className="text-gray-700 leading-relaxed mb-6 flex-grow">
                {property.description}
              </p>

              <button className="w-full bg-primary text-white font-bold py-3 px-6 rounded hover:bg-blue-800 transition duration-300 mt-auto">
                Contacter l'agence
              </button>
              
              {userInfo && property.owner && (userInfo._id === property.owner._id || userInfo.role === 'Admin') && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Gérer le bien</h3>
                    <div className="flex space-x-4">
                      <button 
                        onClick={() => navigate(`/altimmo/${id}/edit`)}
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
      </div>
    </div>
  );
};

export default PropertyDetailPage;