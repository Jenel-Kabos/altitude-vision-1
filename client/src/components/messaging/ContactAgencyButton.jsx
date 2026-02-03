// src/components/messaging/ContactAgencyButton.jsx
import React, { useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createOrGetConversation } from '../../services/conversationService';

/**
 * Bouton pour contacter l'agence depuis une annonce
 * @param {String} propertyId - ID de la propriété (optionnel)
 * @param {String} eventId - ID de l'événement (optionnel)
 * @param {String} adminId - ID de l'admin à contacter (par défaut cherche un admin)
 */
const ContactAgencyButton = ({ propertyId = null, eventId = null, adminId = null }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Message par défaut selon le contexte
  const getDefaultMessage = () => {
    if (propertyId) {
      return "Bonjour, je suis intéressé(e) par cette propriété. Pourriez-vous me donner plus d'informations ?";
    }
    if (eventId) {
      return "Bonjour, je souhaiterais obtenir plus d'informations sur cet événement.";
    }
    return "Bonjour, j'aimerais discuter avec vous.";
  };

  const handleClick = () => {
    if (!user) {
      alert('Vous devez être connecté pour contacter l\'agence');
      navigate('/login');
      return;
    }

    setMessage(getDefaultMessage());
    setShowModal(true);
  };

  const handleSendMessage = async () => {
    if (!message.trim()) {
      alert('Veuillez écrire un message');
      return;
    }

    setIsLoading(true);

    try {
      // Si pas d'adminId fourni, utiliser un ID par défaut ou faire une requête pour trouver un admin
      // Pour simplifier, vous pouvez stocker l'ID d'un admin principal dans les variables d'environnement
      const recipientId = adminId || import.meta.env.VITE_ADMIN_ID || '60d5ec49f1b2c72b8c8e4f1a'; // Remplacer par un vrai ID

      const conversation = await createOrGetConversation(
        recipientId,
        message,
        propertyId,
        eventId
      );

      console.log('✅ Conversation créée:', conversation);

      setShowModal(false);
      navigate('/messages');
    } catch (error) {
      console.error('❌ Erreur:', error);
      alert('Erreur lors de l\'envoi du message. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition font-semibold shadow-lg"
      >
        <MessageCircle size={20} />
        Contacter l'Agence
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">
              Contacter l'Agence
            </h3>

            <p className="text-gray-600 mb-4">
              Envoyez un message à notre équipe. Nous vous répondrons dans les plus brefs délais.
            </p>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows="6"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              placeholder="Votre message..."
              maxLength={2000}
            />

            <div className="flex items-center justify-between mt-2 mb-4">
              <span className="text-sm text-gray-500">{message.length}/2000</span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={isLoading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !message.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition disabled:bg-gray-400"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Envoi...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Envoyer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ContactAgencyButton;