import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api'; // Utilisation de l'instance API centralisée

const CompleteTransactionModal = ({ property, onClose, onSuccess }) => {
  const [finalPrice, setFinalPrice] = useState(property.price || '');
  const [commission, setCommission] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Utilisation de l'instance `api` qui gère déjà le token et l'URL de base
      await api.put(
        `/properties/${property._id}/complete-transaction`,
        {
          finalTransactionPrice: parseFloat(finalPrice),
          agencyCommissionAmount: parseFloat(commission)
        }
      );
      onSuccess(); // Fonction pour rafraîchir la liste et fermer le modal
    } catch (err) {
      setError(err.response?.data?.message || "Une erreur est survenue.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"
        onClick={onClose} // Fermer en cliquant sur l'arrière-plan
      >
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="bg-white rounded-lg p-8 shadow-xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()} // Empêcher la fermeture en cliquant sur le modal
        >
          <h2 className="text-2xl font-bold mb-4">Finaliser la transaction</h2>
          <p className="text-gray-700 mb-6 font-semibold">{property.title}</p>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="finalPrice" className="block text-sm font-medium text-gray-700">Prix de transaction final (XAF)</label>
              <input
                type="number"
                id="finalPrice"
                value={finalPrice}
                onChange={(e) => setFinalPrice(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                required
              />
            </div>

            <div className="mb-6">
              <label htmlFor="commission" className="block text-sm font-medium text-gray-700">Commission totale de l'agence (XAF)</label>
              <input
                type="number"
                id="commission"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                required
              />
            </div>
            
            {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={onClose}
                className="py-2 px-4 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:bg-green-300"
              >
                {isLoading ? 'Validation...' : 'Valider la transaction'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CompleteTransactionModal;