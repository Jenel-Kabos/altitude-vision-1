import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../services/api'; // Utilisation de l'instance centralisée
import Spinner from '../../components/layout/Spinner'; // Import du Spinner

// Composant ServiceCard optimisé avec React.memo
const ServiceCard = React.memo(({ service, onSelect, isSelected }) => (
  <div
    className={`bg-white rounded-lg shadow-lg overflow-hidden cursor-pointer border-4 transition-all duration-200 ${
      isSelected ? 'border-primary scale-105' : 'border-transparent hover:shadow-xl'
    }`}
    onClick={() => onSelect(service)}
    role="button"
    aria-pressed={isSelected}
    tabIndex={0}
    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(service)}
  >
    <img
      src={service.imageUrl || 'https://via.placeholder.com/400x250'}
      alt={service.name}
      className="w-full h-48 object-cover"
      loading="lazy"
    />
    <div className="p-4">
      <h3 className="text-xl font-bold text-primary">{service.name}</h3>
      <p className="text-gray-600 text-sm mt-1 h-12">
        {`${service.description.substring(0, 80)}...`}
      </p>
      <div className="mt-4 font-semibold text-lg">
        À partir de {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF' }).format(service.basePrice)}
      </div>
    </div>
  </div>
));
ServiceCard.displayName = 'ServiceCard';


const MilaEventsPage = () => {
  const [services, setServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // États pour le formulaire de devis
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [quoteStatus, setQuoteStatus] = useState({ error: '', success: '', loading: false });

  // Récupérer les services depuis l'API
  useEffect(() => {
    const fetchServices = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/services');
        setServices(data);
      } catch (err) {
        setError("Erreur de chargement des services. Veuillez rafraîchir la page.");
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  // Gérer la sélection/désélection d'un service avec useCallback
  const handleSelectService = useCallback((service) => {
    setSelectedServices(prev =>
      prev.some(s => s._id === service._id)
        ? prev.filter(s => s._id !== service._id)
        : [...prev, service]
    );
  }, []);

  // Calculer le total du devis (useMemo est déjà bien utilisé)
  const totalPrice = useMemo(() => {
    return selectedServices.reduce((total, service) => total + service.basePrice, 0);
  }, [selectedServices]);

  // Gérer la soumission du devis
  const handleQuoteSubmit = async (e) => {
    e.preventDefault();
    setQuoteStatus({ error: '', success: '', loading: true });

    const quoteData = {
      clientName: name,
      clientEmail: email,
      eventType: 'Devis personnalisé',
      services: selectedServices.map(s => ({ service: s._id, name: s.name, price: s.basePrice })),
      totalPrice,
    };
    try {
      await api.post('/quotes', quoteData);
      setQuoteStatus({ success: 'Votre demande de devis a été envoyée avec succès !', error: '', loading: false });
      // Réinitialiser le formulaire
      setSelectedServices([]);
      setName('');
      setEmail('');
    } catch (err) {
      const message = err.response?.data?.message || "Erreur lors de l'envoi du devis.";
      setQuoteStatus({ error: message, success: '', loading: false });
    }
  };


  if (loading) return <Spinner />;
  if (error) return <p className="text-center py-10 text-red-500">{error}</p>;

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-center text-primary mb-8">Créez votre événement inoubliable</h1>

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

      {selectedServices.length > 0 && (
        <div className="bg-white p-8 rounded-lg shadow-xl sticky bottom-4 border-t-4 border-secondary">
          <h2 className="text-2xl font-bold mb-4">Votre Devis Préliminaire</h2>
          <ul>
            {selectedServices.map(s => (
              <li key={s._id} className="flex justify-between py-1 border-b last:border-b-0">
                <span>{s.name}</span>
                <span className="font-medium">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF' }).format(s.basePrice)}</span>
              </li>
            ))}
          </ul>
          <div className="text-xl font-bold mt-4 pt-4 border-t-2 border-dashed flex justify-between">
            <span>TOTAL</span>
            <span>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF' }).format(totalPrice)}</span>
          </div>

          <form onSubmit={handleQuoteSubmit} className="mt-6">
            {quoteStatus.error && <p className="text-red-600 bg-red-100 p-2 rounded mb-3 text-center">{quoteStatus.error}</p>}
            {quoteStatus.success && <p className="text-green-600 bg-green-100 p-2 rounded mb-3 text-center">{quoteStatus.success}</p>}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" placeholder="Votre nom" value={name} onChange={e => setName(e.target.value)} className="px-3 py-2 border rounded-md focus:ring-primary focus:border-primary" required />
              <input type="email" placeholder="Votre email" value={email} onChange={e => setEmail(e.target.value)} className="px-3 py-2 border rounded-md focus:ring-primary focus:border-primary" required />
            </div>
            <button type="submit" disabled={quoteStatus.loading} className="w-full mt-4 bg-secondary text-white font-bold py-3 px-6 rounded-md hover:bg-amber-600 transition disabled:bg-gray-400">
              {quoteStatus.loading ? 'Envoi en cours...' : 'Demander le devis'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default MilaEventsPage;