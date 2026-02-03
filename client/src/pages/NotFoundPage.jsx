import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

const NotFoundPage = () => {
  // Variants pour l'illustration flottante
  const floatVariant = {
    animate: {
      y: [0, -10, 0, 10, 0],
      transition: {
        duration: 4,
        repeat: Infinity,
        repeatType: "loop",
        ease: "easeInOut",
      },
    },
  };

  // Variants pour le bouton pulsant
  const pulseVariant = {
    animate: {
      scale: [1, 1.05, 1.1, 1.05, 1],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        repeatType: "loop",
        ease: "easeInOut",
      },
    },
  };

  // Variants pour les textes
  const textVariant = {
    hidden: { y: 20, opacity: 0 },
    visible: (delay = 0) => ({
      y: 0,
      opacity: 1,
      transition: { delay, duration: 0.6, ease: "easeOut" },
    }),
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-center px-6">
      {/* --- Illustration flottante --- */}
      <motion.img
        src="https://illustrations.popsy.co/gray/error-404.svg"
        alt="Page non trouvée"
        className="w-64 md:w-80 mb-8"
        variants={floatVariant}
        animate="animate"
      />

      {/* --- Titre 404 animé --- */}
      <motion.h1
        className="text-6xl font-extrabold text-gray-800 mb-2"
        initial="hidden"
        animate="visible"
        custom={0}
        variants={textVariant}
      >
        404
      </motion.h1>

      {/* --- Sous-titre animé --- */}
      <motion.h2
        className="text-2xl md:text-3xl font-semibold text-gray-700 mb-4"
        initial="hidden"
        animate="visible"
        custom={0.2}
        variants={textVariant}
      >
        Oups ! Cette page est introuvable.
      </motion.h2>

      {/* --- Description animée --- */}
      <motion.p
        className="text-gray-500 max-w-md mb-8"
        initial="hidden"
        animate="visible"
        custom={0.4}
        variants={textVariant}
      >
        Il semble que vous soyez perdu... La page que vous cherchez n’existe pas
        ou a été déplacée.
      </motion.p>

      {/* --- Bouton retour pulsant --- */}
      <motion.div
        variants={pulseVariant}
        animate="animate"
        className="inline-block"
      >
        <Link
          to="/"
          className="inline-flex items-center px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white text-lg font-medium rounded-full shadow-md transition-all"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Retour à l’accueil
        </Link>
      </motion.div>
    </div>
  );
};

export default NotFoundPage;
