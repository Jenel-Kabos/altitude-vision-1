import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated } from '../services/authService';
import { FaCalculator, FaArrowRight, FaHome, FaKey } from 'react-icons/fa';

const CommissionCalculatorPage = () => {
  const [price, setPrice] = useState(20000000); // 20 millions FCFA par défaut
  const [transactionType, setTransactionType] = useState('vente'); // 'vente' ou 'location'
  const navigate = useNavigate();
  const isLoggedIn = isAuthenticated();

  // ✅ Règles de calcul pour VENTE
  const SALE_AGENCY_FEE_PERCENTAGE = 0.1; // 10% de commission pour l'agence
  const SALE_OWNER_SHARE_PERCENTAGE = 0.30; // 30% de cette commission pour l'apporteur

  // ✅ Règles de calcul pour LOCATION
  const RENT_AGENCY_FEE_PERCENTAGE = 0.80; // 80% du loyer mensuel
  const RENT_OWNER_SHARE_PERCENTAGE = 0.30; // 30% de cette commission pour l'apporteur

  // ✅ Calculs selon le type de transaction
  const agencyCommission = transactionType === 'vente' 
    ? price * SALE_AGENCY_FEE_PERCENTAGE 
    : price * RENT_AGENCY_FEE_PERCENTAGE;

  const ownerShare = transactionType === 'vente'
    ? agencyCommission * SALE_OWNER_SHARE_PERCENTAGE
    : agencyCommission * RENT_OWNER_SHARE_PERCENTAGE;

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
        className="bg-cover bg-center text-white py-24 relative"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1973&auto=format&fit=crop')" }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-60"></div>
        <div className="container mx-auto px-4 text-center relative z-10 py-12">
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-4">Devenez Apporteur d'Affaires Altimmo</h1>
          <p className="text-xl sm:text-2xl max-w-3xl mx-auto">
            Publiez un bien immobilier pour un propriétaire et recevez 30% de notre commission.
          </p>
        </div>
      </section>

      {/* Section Calculateur */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          
          {/* Colonne 1: Le Calculateur */}
          <div className="bg-gradient-to-br from-white to-gray-50 p-8 rounded-2xl shadow-2xl border border-gray-200">
            <div className="flex items-center text-blue-600 mb-6">
              <FaCalculator size={28} className="mr-3" />
              <h2 className="text-3xl font-bold text-gray-800">Estimez vos gains</h2>
            </div>
            
            {/* ✅ BOUTONS TYPE DE TRANSACTION */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Type de transaction</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setTransactionType('vente')}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-base transition-all duration-300 ${
                    transactionType === 'vente'
                      ? 'bg-blue-600 text-white shadow-lg scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <FaHome className="w-5 h-5" />
                  Vente
                </button>
                <button
                  onClick={() => setTransactionType('location')}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-base transition-all duration-300 ${
                    transactionType === 'location'
                      ? 'bg-green-600 text-white shadow-lg scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <FaKey className="w-5 h-5" />
                  Location
                </button>
              </div>
            </div>

            {/* ✅ CHAMP DE SAISIE DU PRIX */}
            <div className="mb-6">
              <label htmlFor="price" className="block text-lg font-medium text-gray-700 mb-2">
                {transactionType === 'vente' ? 'Prix de vente du bien' : 'Loyer mensuel'}
              </label>
              <input
                type="text"
                id="price"
                value={price.toLocaleString('fr-FR')} 
                onChange={handlePriceChange}
                className="w-full p-4 border-2 border-gray-300 rounded-xl text-3xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="Ex: 20 000 000"
              />
              <p className="text-sm text-gray-500 mt-2">
                {transactionType === 'vente' 
                  ? 'Saisissez le prix de vente total du bien' 
                  : 'Saisissez le montant du loyer mensuel'}
              </p>
            </div>
            
            {/* ✅ RÉSULTATS DES CALCULS */}
            <div className="space-y-4 mt-8">
              <div className="flex justify-between items-center p-4 bg-gray-100 rounded-xl">
                <div>
                  <span className="text-gray-600 text-sm block">Commission agence</span>
                  <span className="text-gray-500 text-xs">
                    {transactionType === 'vente' 
                      ? `${SALE_AGENCY_FEE_PERCENTAGE * 100}% du prix de vente` 
                      : `${RENT_AGENCY_FEE_PERCENTAGE * 100}% du loyer mensuel`}
                  </span>
                </div>
                <span className="font-bold text-gray-800 text-xl">{formatCurrency(agencyCommission)}</span>
              </div>

              <div className="flex justify-between items-center p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400 rounded-xl">
                <div>
                  <span className="text-green-800 font-bold text-xl block">Votre part</span>
                  <span className="text-green-700 text-sm">30% de la commission</span>
                </div>
                <span className="font-bold text-green-800 text-2xl">{formatCurrency(ownerShare)}</span>
              </div>

              {/* ✅ BADGE INFO SUPPLÉMENTAIRE */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4">
                <p className="text-sm text-blue-800 leading-relaxed">
                  <strong>💡 Comment ça marche ?</strong><br/>
                  {transactionType === 'vente' 
                    ? 'Pour chaque vente, vous recevez 30% de notre commission de 10%.'
                    : 'Pour chaque location, vous recevez 30% de notre commission équivalente à 80% du loyer mensuel.'}
                </p>
              </div>
            </div>
          </div>

          {/* Colonne 2: Appel à l'action */}
          <div className="text-left lg:sticky lg:top-8">
            <h3 className="text-4xl font-extrabold text-gray-900 mb-6">Prêt à commencer ?</h3>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              C'est simple : créez votre compte, publiez les informations du bien, et nous nous occupons du reste. Une fois la transaction réussie, vous touchez votre part.
            </p>

            {/* ✅ AVANTAGES */}
            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-green-600 font-bold">✓</span>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-1">Inscription gratuite</h4>
                  <p className="text-gray-600 text-sm">Aucun frais d'inscription ni d'abonnement</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-green-600 font-bold">✓</span>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-1">Paiement sécurisé</h4>
                  <p className="text-gray-600 text-sm">Recevez votre commission dès la transaction finalisée</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-green-600 font-bold">✓</span>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-1">Accompagnement complet</h4>
                  <p className="text-gray-600 text-sm">Notre équipe vous guide à chaque étape</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleCTAClick}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-4 px-10 rounded-xl text-xl hover:from-orange-600 hover:to-orange-700 transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center justify-center gap-3"
            >
              {isLoggedIn ? 'Accéder à mon espace' : "Créer mon compte"}
              <FaArrowRight />
            </button>

            <p className="text-sm text-gray-500 text-center mt-4">
              Déjà inscrit ? <a href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">Connectez-vous</a>
            </p>
          </div>
        </div>
      </section>

      {/* ✅ SECTION FAQ / EXEMPLES */}
      <section className="bg-gradient-to-b from-gray-50 to-white py-16">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Exemples concrets</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Exemple Vente */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <FaHome className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Vente d'une villa</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Prix de vente</span>
                  <span className="font-bold">50 000 000 FCFA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Commission agence (10%)</span>
                  <span className="font-semibold">5 000 000 FCFA</span>
                </div>
                <div className="h-px bg-gray-200"></div>
                <div className="flex justify-between text-lg">
                  <span className="text-green-700 font-bold">Votre gain (30%)</span>
                  <span className="font-bold text-green-700">1 500 000 FCFA</span>
                </div>
              </div>
            </div>

            {/* Exemple Location */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-green-100 rounded-xl">
                  <FaKey className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Location d'un appartement</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Loyer mensuel</span>
                  <span className="font-bold">500 000 FCFA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Commission agence (80%)</span>
                  <span className="font-semibold">400 000 FCFA</span>
                </div>
                <div className="h-px bg-gray-200"></div>
                <div className="flex justify-between text-lg">
                  <span className="text-green-700 font-bold">Votre gain (30%)</span>
                  <span className="font-bold text-green-700">120 000 FCFA</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CommissionCalculatorPage;