import React from 'react';
import { Link } from 'react-router-dom';
import { FaExclamationTriangle } from 'react-icons/fa';

const NotFoundPage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <FaExclamationTriangle className="text-yellow-500 text-6xl mb-4" />
      <h1 className="text-6xl md:text-9xl font-bold text-gray-800">404</h1>
      <h2 className="text-2xl md:text-3xl font-semibold text-gray-600 mt-2">
        Page Non Trouvée
      </h2>
      <p className="text-gray-500 mt-4 max-w-md">
        Désolé, la page que vous recherchez n'existe pas ou a été déplacée.
      </p>
      <Link
        to="/"
        className="mt-8 px-6 py-3 bg-primary text-white font-bold rounded-lg shadow-md hover:bg-blue-800 transition-colors duration-300"
      >
        Retour à l'accueil
      </Link>
    </div>
  );
};

export default NotFoundPage;