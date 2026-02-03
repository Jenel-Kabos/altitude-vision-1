import React from 'react';
import { Link } from 'react-router-dom';
import { FaFacebook, FaInstagram, FaWhatsapp } from 'react-icons/fa';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-800 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Section A propos */}
          <div>
            <h3 className="text-lg font-bold mb-4">Altitude-Vision</h3>
            <p className="text-gray-400">
              Une agence multidisciplinaire au service de vos ambitions.
              Immobilier, Événementiel et Communication 360°.
            </p>
          </div>

          {/* Section Liens Rapides */}
          <div>
            <h3 className="text-lg font-bold mb-4">Liens Rapides</h3>
            <ul className="space-y-2">
              <li><Link to="/altimmo" className="hover:text-blue-400 transition-colors">Altimmo</Link></li>
              <li><Link to="/mila-events" className="hover:text-blue-400 transition-colors">Mila Events</Link></li>
              <li><Link to="/altcom" className="hover:text-blue-400 transition-colors">Altcom</Link></li>
              <li><Link to="/trouve-ta-commission" className="hover:text-blue-400 transition-colors">Calculer ma commission</Link></li>
              <li><Link to="/contact" className="hover:text-blue-400 transition-colors">Contactez-nous</Link></li>
            </ul>
          </div>

          {/* Section Contact */}
          <div>
            <h3 className="text-lg font-bold mb-4">Contact Info</h3>
            <address className="not-italic text-gray-400 space-y-2">
              <p>Rue Mfoa n°24, Poto-Poto</p>
              <p>Derrière Canal Olympia</p>
              <p>Brazzaville, Congo</p>
              <p>
                <a href="mailto:contact@altitudevision.cg" className="hover:text-blue-400">
                  contact@altitudevision.cg
                </a>
              </p>
            </address>
          </div>

          {/* Section Réseaux Sociaux */}
          <div>
            <h3 className="text-lg font-bold mb-4">Suivez-nous</h3>
            <div className="flex space-x-4">
              <a href="https://www.facebook.com/profile.php?id=61558493665509" className="text-2xl hover:text-blue-500 transition-colors" aria-label="Facebook"><FaFacebook /></a>
              <a href="https://www.instagram.com/immoaltitudevision/" className="text-2xl hover:text-pink-500 transition-colors" aria-label="Instagram"><FaInstagram /></a>
              <a href="https://wa.me/242068002151" className="text-2xl hover:text-green-500 transition-colors" aria-label="WhatsApp"><FaWhatsapp /></a>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-gray-900 py-4">
        <p className="text-center text-gray-500 text-sm">
          &copy; {currentYear} Altitude-Vision. Tous droits réservés.
        </p>
      </div>
    </footer>
  );
};

export default Footer;