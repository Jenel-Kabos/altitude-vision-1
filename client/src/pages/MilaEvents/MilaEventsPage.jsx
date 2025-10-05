import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

// Composant pour la carte d'un service
const ServiceCard = ({ service, onSelect, isSelected }) => (
  <div 
    className={`bg-white rounded-lg shadow-lg overflow-hidden cursor-pointer border-4 ${isSelected ? 'border-primary' : 'border-transparent'}`}
    onClick={() => onSelect(service)}
  >
    <img src={service.imageUrl || 'https://via.placeholder.com/400x250'} alt={service.name} className="w-full h-48 object-cover" />
    <div className="p-4">
      <h3 className="text-xl font-bold text-primary">{service.name}</h3>
      <p className="text-gray-600 text-sm mt-1">{service.description.substring(0, 100)}...</p>
      <div className="mt-4 font-semibold text-lg">
        À partir de {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF' }).format(service.basePrice)}
      </div>
    </div>
  </div>
);


const MilaEventsPage = () => {
  const [services, setServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [loading, setLoading] = useState(true);

  // États pour le formulaire de devis
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // Récupérer les services depuis l'API
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const { data } = await axios.get('http://localhost:5000/api/services');
        setServices(data);
        setLoading(false);
      } catch (error) {
        console.error("Erreur de chargement des services:", error);
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  // Gérer la sélection/désélection d'un service
  const handleSelectService = (service) => {
    setSelectedServices(prev => 
      prev.some(s => s._id === service._id)
        ? prev.filter(s => s._id !== service._id) // Désélectionner
        : [...prev, service] // Sélectionner
    );
  };

  // Calculer le total du devis (avec useMemo pour la performance)
  const totalPrice = useMemo(() => {
    return selectedServices.reduce((total, service) => total + service.basePrice, 0);
  }, [selectedServices]);

  // Gérer la soumission du devis
  const handleQuoteSubmit = async (e) => {
    e.preventDefault();
    const quoteData = {
      clientName: name,
      clientEmail: email,
      eventType: 'Devis personnalisé', // À améliorer
      services: selectedServices.map(s => ({ name: s.name, price: s.basePrice })),
      totalPrice,
    };
    try {
      await axios.post('http://localhost:5000/api/quotes', quoteData);
      alert('Votre demande de devis a été envoyée avec succès !');
      // Réinitialiser le formulaire
      setSelectedServices([]);
      setName('');
      setEmail('');
    } catch (error) {
      alert('Erreur lors de l\'envoi du devis.');
    }
  };


  if (loading) return <p className="text-center py-10">Chargement des services...</p>;

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-center text-primary mb-8">Créez votre événement inoubliable</h1>
      
      {/* Catalogue des services */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
        {services.map(service => (
          <ServiceCard 
            key={service._id} 
            service={service} 
            onSelect={handleSelectService}
            isSelected={selectedServices.some(s => s._id === service._id)}
          />
        ))}
      </div>

      {/* Section Devis */}
      {selectedServices.length > 0 && (
        <div className="bg-white p-8 rounded-lg shadow-xl sticky bottom-4">
          <h2 className="text-2xl font-bold mb-4">Votre Devis Préliminaire</h2>
          <ul>
            {selectedServices.map(s => (
              <li key={s._id} className="flex justify-between py-1">
                <span>{s.name}</span>
                <span>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF' }).format(s.basePrice)}</span>
              </li>
            ))}
          </ul>
          <div className="text-xl font-bold mt-4 pt-4 border-t flex justify-between">
            <span>TOTAL</span>
            <span>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF' }).format(totalPrice)}</span>
          </div>

          <form onSubmit={handleQuoteSubmit} className="mt-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" placeholder="Votre nom" value={name} onChange={e => setName(e.target.value)} className="px-3 py-2 border rounded" required/>
                <input type="email" placeholder="Votre email" value={email} onChange={e => setEmail(e.target.value)} className="px-3 py-2 border rounded" required/>
             </div>
             <button type="submit" className="w-full mt-4 bg-secondary text-white font-bold py-3 px-6 rounded hover:bg-amber-600 transition">
                Demander le devis
             </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default MilaEventsPage;