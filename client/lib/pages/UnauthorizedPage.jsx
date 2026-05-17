"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { motion } from "framer-motion";

const UnauthorizedPage = () => {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 to-gray-200 text-gray-800 px-6 text-center">
      <div className="bg-white shadow-2xl rounded-3xl p-10 max-w-md w-full border border-gray-100">
        {/* Icône animée */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-6"
        >
          <div className="bg-red-100 p-4 rounded-full shadow-md">
            <Lock className="text-red-500 w-10 h-10" />
          </div>
        </motion.div>

        <h1 className="text-3xl font-bold mb-2 text-gray-900">Accès Refusé</h1>
        <p className="text-gray-600 mb-6">
          😕 Désolé, vous n’avez pas les autorisations nécessaires pour accéder à cette page.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => router.back()}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-6 rounded-lg transition-all"
          >
            ← Retour
          </button>

          <button
            onClick={() => router.push("/")}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-all"
          >
            🏠 Accueil
          </button>
        </div>
      </div>

      <footer className="mt-10 text-gray-500 text-sm">
        © {new Date().getFullYear()} Altitude-Vision — Tous droits réservés
      </footer>
    </div>
  );
};

export default UnauthorizedPage;
