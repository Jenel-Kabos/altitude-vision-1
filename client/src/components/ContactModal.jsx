import React, { useState } from 'react';
import { FaTimes, FaEnvelopeOpenText, FaPaperPlane } from 'react-icons/fa';

/**
 * Composant Modal générique pour toutes les demandes de contact (Devis, Partenariat, Infos).
 * @param {object} props
 * @param {string} props.intention - Le type de demande ('Devis', 'Partenariat', 'Informations Générales').
 * @param {function} props.onClose - Fonction pour fermer le modal.
 * @param {string} [props.serviceTitle=null] - Le nom du service (si l'intention est 'Devis').
 */
const ContactModal = ({ intention, onClose, serviceTitle = null }) => {
  
  // État local pour gérer les données du formulaire
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
    intention: intention, // Intention prédéfinie
    serviceTitle: serviceTitle, // Service prédéfini (peut être null)
  });

  // Gère la mise à jour des champs de formulaire
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value,
    });
  };

  // Gère la soumission du formulaire
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // --- SIMULATION D'ENVOI AU BACKEND ---
    console.log("Données à envoyer au backend (simulées) :", formData);
    
    // Ici, vous feriez un appel API (ex: fetch, axios) à votre endpoint de contact.
    
    let confirmationMessage;
    if (serviceTitle) {
      confirmationMessage = `✅ Votre demande de devis pour le service "${serviceTitle}" a bien été envoyée. Nous vous contacterons par email (${formData.email}) dans les 48h.`;
    } else {
      confirmationMessage = `✅ Votre message pour la catégorie "${intention}" a bien été reçu. Merci de nous avoir contactés !`;
    }
    
    alert(confirmationMessage);
    onClose(); 
  };
  
  // Détermine le texte du bouton et du label pour le champ 'message'
  const isQuoteRequest = intention === 'Devis';
  const buttonText = isQuoteRequest ? 'Envoyer ma Demande de Devis' : 'Envoyer le Message';
  const messageLabel = isQuoteRequest 
    ? 'Détails de votre projet (dates, nombre d\'invités, budget, lieu...) *' 
    : 'Votre message ou question *';

  return (
    // Conteneur Modal (Arrière-plan fixe et sombre)
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      
      {/* Contenu du Modal */}
      <div className="bg-white p-8 rounded-xl shadow-2xl max-w-lg w-full relative transform transition-all duration-300 scale-100">
        
        {/* Bouton de Fermeture */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-500 hover:text-red-500 transition duration-200"
        >
          <FaTimes className="text-2xl" />
        </button>
        
        <div className="text-center mb-6">
            <FaEnvelopeOpenText className="text-5xl text-blue-600 mx-auto mb-2" />
            <h3 className="text-3xl font-extrabold text-gray-800">
                {isQuoteRequest ? 'Demande de Devis' : `Contact : ${intention}`}
            </h3>
        </div>
        
        {/* Affichage conditionnel du service sélectionné */}
        {serviceTitle && (
          <p className="text-md text-center text-gray-700 mb-4 bg-blue-100 p-2 rounded">
            Service sélectionné : <span className="font-semibold text-blue-800">{serviceTitle}</span>
          </p>
        )}

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Votre Nom Complet *</label>
            <input 
              type="text" 
              id="name" 
              value={formData.name}
              onChange={handleChange}
              required 
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Votre Email *</label>
            <input 
              type="email" 
              id="email" 
              value={formData.email}
              onChange={handleChange}
              required 
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700">
              {messageLabel}
            </label>
            <textarea 
              id="message" 
              rows="4" 
              value={formData.message}
              onChange={handleChange}
              required 
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500"
            ></textarea>
          </div>
          
          <button 
            type="submit" 
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg transition duration-300 flex items-center justify-center space-x-2"
          >
            <FaPaperPlane className="mr-2" />
            <span>{buttonText}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ContactModal;