import React from 'react';
import { Link } from 'react-router-dom';
import { FaCalculator, FaArrowRight } from 'react-icons/fa';

const CtaCommission = () => {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg shadow-xl p-8 md:p-12 overflow-hidden relative">
      <div className="relative z-10 md:flex md:items-center md:justify-between">
        <div className="md:w-2/3">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-3">
            Devenez Apporteur d'Affaires !
          </h2>
          <p className="text-lg md:text-xl text-blue-100 max-w-2xl">
            Vous connaissez quelqu'un qui veut vendre ou louer un bien ? Référez-le-nous, publiez son bien et <strong>touchez 30% de notre commission</strong> sur la transaction.
          </p>
        </div>
        <div className="mt-8 md:mt-0 md:w-1/3 text-center md:text-right">
          <Link
            to="/trouve-ta-commission"
            className="inline-block bg-white text-blue-700 font-bold py-4 px-8 rounded-lg text-lg hover:bg-gray-200 transition-all duration-300 transform hover:scale-105 shadow-lg"
          >
            Estimer mes gains
            <FaArrowRight className="inline-block ml-3" />
          </Link>
        </div>
      </div>
      <FaCalculator className="absolute text-blue-500 opacity-10 h-48 w-48 right-0 top-0 transform translate-x-1/4 -translate-y-1/4 z-0" />
    </div>
  );
};

export default CtaCommission;
