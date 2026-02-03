import React from 'react';
import { FaHandshake, FaSearch, FaTasks, FaChalkboardTeacher } from 'react-icons/fa';

const services = [
  { icon: FaHandshake, title: 'Vente', description: 'Nous maximisons la visibilité de votre bien et gérons tout le processus de vente pour une transaction rapide et au meilleur prix.' },
  { icon: FaSearch, title: 'Achat', description: 'Nous vous aidons à trouver le bien parfait qui correspond à vos critères et à votre budget, en vous accompagnant à chaque étape.' },
  { icon: FaTasks, title: 'Gestion Locative', description: 'Confiez-nous la gestion de vos biens locatifs. Nous nous occupons de tout : de la recherche de locataires à la maintenance.' },
  { icon: FaChalkboardTeacher, title: 'Conseil Immobilier', description: 'Profitez de notre expertise du marché local pour vos investissements, évaluations de biens et stratégies immobilières.' },
];

const AltimmoServices = () => {
  return (
    <div className="container mx-auto px-4 py-20">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold">Nos Services Immobiliers</h2>
        <p className="text-gray-600 mt-2">Une solution complète pour tous vos besoins.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {services.map(service => (
          <div key={service.title} className="bg-gray-50 p-8 rounded-lg shadow-md text-center hover:shadow-xl transition-shadow">
            <service.icon className="text-5xl text-primary mx-auto mb-6" aria-hidden="true" />
            <h3 className="text-xl font-bold mb-3">{service.title}</h3>
            <p className="text-gray-600">{service.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AltimmoServices;
