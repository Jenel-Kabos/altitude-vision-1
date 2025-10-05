import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

// Un composant simple pour le slider
const HeroSlider = () => (
  <div className="relative h-[60vh] bg-cover bg-center" style={{ backgroundImage: "url('/path/to/brazzaville-skyline.jpg')" }}>
    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center text-white"
      >
        <h1 className="text-5xl font-bold mb-4">Bienvenue chez Altitude-Vision</h1>
        <p className="text-xl mb-8">Votre partenaire pour l'immobilier, l'événementiel et la communication.</p>
        <div className="space-x-4">
          <Link to="/altimmo" className="bg-secondary text-white px-6 py-3 rounded font-semibold hover:bg-amber-600">Immobilier</Link>
          <Link to="/mila-events" className="bg-secondary text-white px-6 py-3 rounded font-semibold hover:bg-amber-600">Événementiel</Link>
          <Link to="/altcom" className="bg-secondary text-white px-6 py-3 rounded font-semibold hover:bg-amber-600">Communication</Link>
        </div>
      </motion.div>
    </div>
  </div>
);

const HomePage = () => {
  return (
    <div>
      <HeroSlider />
      {/* Section "Qui sommes-nous" */}
      <section className="py-16 bg-light">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-primary mb-4">Qui sommes-nous ?</h2>
          <p className="max-w-3xl mx-auto text-gray-600">
            Altitude-Vision est une agence multidisciplinaire située au cœur de Brazzaville,
            dédiée à transformer vos ambitions en réalité. Avec nos trois pôles d'expertise,
            nous offrons des solutions intégrées pour tous vos besoins.
          </p>
        </div>
      </section>
      {/* ... autres sections ... */}
    </div>
  );
};

export default HomePage;