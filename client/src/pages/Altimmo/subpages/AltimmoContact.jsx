import React from 'react';
import { FaMapMarkerAlt, FaEnvelope, FaPhoneAlt, FaFacebook, FaTwitter, FaInstagram } from 'react-icons/fa';

const AltimmoContact = () => {
  return (
    <div className="container mx-auto px-4 py-20">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold">Nous Contacter</h2>
        <p className="text-gray-600 mt-2">Prenez contact avec nos experts Altimmo dès aujourd'hui.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 bg-white p-8 rounded-lg shadow-lg">
        {/* Formulaire */}
        <form className="space-y-4">
          <input type="text" placeholder="Votre Nom" className="w-full p-3 border rounded-md" required />
          <input type="email" placeholder="Votre Email" className="w-full p-3 border rounded-md" required />
          <textarea placeholder="Votre Message" rows="6" className="w-full p-3 border rounded-md" required></textarea>
          <button type="submit" className="w-full bg-primary text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 transition focus:outline-none focus:ring">
            Envoyer le Message
          </button>
        </form>

        {/* Coordonnées */}
        <div className="space-y-6">
          <div className="flex items-start">
            <FaMapMarkerAlt className="text-primary text-xl mt-1 mr-4" />
            <p>Avenue des 3 Martyrs, Centre-ville<br />Brazzaville, Congo</p>
          </div>
          <div className="flex items-center">
            <FaPhoneAlt className="text-primary text-xl mr-4" />
            <p>(+242) 06 000 00 00</p>
          </div>
          <div className="flex items-center">
            <FaEnvelope className="text-primary text-xl mr-4" />
            <p>contact@altimmo.cg</p>
          </div>

          <div className="pt-6 border-t">
            <h3 className="font-semibold mb-3">Suivez-nous</h3>
            <div className="flex space-x-4 text-2xl">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-primary" aria-label="Facebook"><FaFacebook /></a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-primary" aria-label="Twitter"><FaTwitter /></a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-primary" aria-label="Instagram"><FaInstagram /></a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AltimmoContact;
