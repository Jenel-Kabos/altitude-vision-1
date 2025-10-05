import React from 'react';
import { Link } from 'react-router-dom';
import { FaFacebook, FaInstagram, FaLinkedin } from 'react-icons/fa';

const Footer = () => {
  return (
    <footer className="bg-primary text-white">
      <div className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Section 1: À propos de l'entreprise */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Altitude-Vision</h2>
            <p className="text-gray-300">
              Votre partenaire unique pour l'immobilier, l'événementiel et la communication. Nous transformons vos visions en réalité.
            </p>
          </div>

          {/* Section 2: Liens de navigation */}
          <div>
            <h3 className="text-xl font-semibold mb-4">Liens Rapides</h3>
            <ul className="space-y-2">
              <li><Link to="/altimmo" className="hover:text-secondary transition-colors">Altimmo</Link></li>
              <li><Link to="/mila-events" className="hover:text-secondary transition-colors">Mila Events</Link></li>
              <li><Link to="/altcom" className="hover:text-secondary transition-colors">Altcom</Link></li>
              <li><Link to="/login" className="hover:text-secondary transition-colors">Connexion</Link></li>
            </ul>
          </div>

          {/* Section 3: Réseaux sociaux */}
          <div>
            <h3 className="text-xl font-semibold mb-4">Suivez-nous</h3>
            <div className="flex space-x-6">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-secondary transition-colors">
                <FaFacebook size={24} />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-secondary transition-colors">
                <FaInstagram size={24} />
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-secondary transition-colors">
                <FaLinkedin size={24} />
              </a>
            </div>
          </div>
        </div>
        
        {/* Ligne de copyright en bas */}
        <div className="mt-12 pt-8 border-t border-gray-700 text-center text-gray-400">
          <p>&copy; {new Date().getFullYear()} Altitude-Vision. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;