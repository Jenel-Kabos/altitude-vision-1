import React from 'react';
import { Link, Outlet } from 'react-router-dom';

const AltimmoHome = () => {
  return (
    <div>
      {/* Hero Section */}
      <div className="relative bg-gray-800 text-white text-center py-40">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=2070"
            alt="Maison moderne"
            className="w-full h-full object-cover opacity-40"
            loading="lazy"
          />
        </div>
        <div className="relative z-10">
          <h2 className="text-5xl font-bold">Trouvez la propriété de vos rêves</h2>
          <p className="text-xl mt-4 mb-8">Nous transformons votre recherche immobilière en une expérience unique.</p>
          <Link
            to="/altimmo/annonces"
            className="bg-primary text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 transition duration-300"
          >
            Nos biens
          </Link>
        </div>
      </div>

      {/* Présentation & Mission */}
      <div className="container mx-auto px-4 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <h3 className="text-3xl font-bold text-gray-800 mb-4">Qui sommes-nous ?</h3>
            <p className="text-gray-600 leading-relaxed mb-4">
              Altimmo est la branche immobilière du groupe Altitude-Vision, spécialisée dans la vente, l'achat, la location et la gestion de biens immobiliers à Brazzaville et ses environs. Notre expertise locale et notre engagement envers l'excellence font de nous le partenaire idéal pour tous vos projets immobiliers.
            </p>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-gray-800 mb-4">Notre Mission</h3>
            <p className="text-gray-600 leading-relaxed">
              Notre mission est de simplifier le marché immobilier pour nos clients en offrant des services transparents, professionnels et personnalisés. Nous aspirons à construire des relations de confiance durables en garantissant la satisfaction de chaque client, qu'il soit acheteur, vendeur, locataire ou investisseur.
            </p>
          </div>
        </div>
      </div>

      {/* Outlet pour les sous-pages (Services, Équipe, Contact) */}
      <Outlet />
    </div>
  );
};

export default AltimmoHome;
