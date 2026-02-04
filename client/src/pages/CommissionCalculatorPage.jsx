import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated } from '../services/authService';
import { FaCalculator, FaArrowRight } from 'react-icons/fa';

const CommissionCalculatorPage = () => {
  const [price, setPrice] = useState(20000000); // 20 millions FCFA par défaut
  const navigate = useNavigate();
  const isLoggedIn = isAuthenticated();

  // Définissons nos règles de calcul
  const AGENCY_FEE_PERCENTAGE = 0.1; // 10% de commission pour l'agence (exemple)
  const OWNER_SHARE_PERCENTAGE = 0.30; // 30% de cette commission pour l'apporteur d'affaires

  // Calculs
  const agencyCommission = price * AGENCY_FEE_PERCENTAGE;
  const ownerShare = agencyCommission * OWNER_SHARE_PERCENTAGE;

  const handlePriceChange = (e) => {
    // Permet de nettoyer les espaces pour le calcul
    const value = e.target.value.replace(/\s/g, '');
    setPrice(Number(value) || 0);
  };

  // Gère le clic sur le bouton d'action
  const handleCTAClick = () => {
    if (isLoggedIn) {
      navigate('/mes-biens'); // Si co, va à son espace
    } else {
      navigate('/register'); // Si non-co, va à l'inscription
    }
  };

  // Formatteur de devise
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: 'XAF', // Code pour le Franc CFA
      minimumFractionDigits: 0 
    }).format(value);
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Section Héros */}
      <section 
        className="bg-cover bg-center text-white py-24"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1973&auto=format&fit=crop')" }}
      >
        <div className="container mx-auto px-4 text-center bg-black bg-opacity-60 py-12 rounded-lg">
          <h1 className="text-5xl font-extrabold mb-4">Devenez Apporteur d'Affaires Altimmo</h1>
          <p className="text-2xl max-w-3xl mx-auto">
            Publiez un bien immobilier pour un propriétaire et recevez 30% de notre commission.
          </p>
        </div>
      </section>

      {/* Section Calculateur */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          
          {/* Colonne 1: Le Calculateur */}
          <div className="bg-gray-50 p-8 rounded-lg shadow-2xl border border-gray-200">
            <div className="flex items-center text-blue-600 mb-5">
              <FaCalculator size={28} className="mr-3" />
              <h2 className="text-3xl font-bold text-gray-800">Estimez vos gains</h2>
            </div>
            
            <div className="mb-6">
              <label htmlFor="price" className="block text-lg font-medium text-gray-700 mb-2">
                Prix de vente du bien
              </label>
              <input
                type="text"
                id="price"
                // Formatte le nombre avec des espaces pour la lisibilité
                value={price.toLocaleString('fr-FR')} 
                onChange={handlePriceChange}
                className="w-full p-4 border border-gray-300 rounded-md text-3xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="space-y-4 mt-8">
              <div className="flex justify-between items-center p-4 bg-gray-200 rounded-md">
                <span className="text-gray-600 text-lg">Commission agence (est. {AGENCY_FEE_PERCENTAGE * 100}%)</span>
                <span className="font-bold text-gray-800 text-xl">{formatCurrency(agencyCommission)}</span>
              </div>
              <div className="flex justify-between items-center p-6 bg-green-100 border-2 border-green-400 rounded-md">
                <span className="text-green-800 font-bold text-xl">Votre part (30%)</span>
                <span className="font-bold text-green-800 text-2xl">{formatCurrency(ownerShare)}</span>
              </div>
            </div>
          </div>

          {/* Colonne 2: Appel à l'action */}
          <div className="text-left">
            <h3 className="text-4xl font-extrabold text-gray-900 mb-6">Prêt à commencer ?</h3>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              C'est simple : créez votre compte, publiez les informations du bien, et nous nous occupons du reste. Une fois la transaction (vente ou location) réussie, vous touchez votre part.
            </p>
            <button
              onClick={handleCTAClick}
              className="bg-orange-500 text-white font-bold py-4 px-10 rounded-lg text-xl hover:bg-orange-600 transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center justify-center"
            >
              {isLoggedIn ? 'Accéder à mon espace' : "Créer mon compte"}
              <FaArrowRight className="ml-3" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CommissionCalculatorPage;