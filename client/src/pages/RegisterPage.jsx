import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { FiUserPlus, FiUser, FiMail, FiLock, FiBriefcase, FiAlertTriangle } from 'react-icons/fi';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "Client",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const auth = useAuth();

  // Redirection si l'utilisateur est déjà connecté
  useEffect(() => {
    if (auth.user) {
      const redirect =
        auth.user.role === "Admin"
          ? "/admin"
          : auth.user.role === "Proprietaire" // ⭐ Correction: "Proprietaire" au lieu de "Propriétaire"
          ? "/mes-biens"
          : "/";
      navigate(redirect);
    }
  }, [navigate, auth.user]); 

  // Gestion des changements dans le formulaire
  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  // Gestion de l'inscription
  const handleRegister = async (e) => {
    e.preventDefault();
    
    // Validation côté client
    if (formData.password !== formData.confirmPassword) {
      return setError("Les mots de passe ne correspondent pas.");
    }
    
    if (formData.password.length < 8) {
      return setError("Le mot de passe doit contenir au moins 8 caractères.");
    }

    setLoading(true);
    setError("");

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
      };
      
      console.log("📤 [Register] Envoi des données:", { ...payload, password: '***' });

      const { data } = await api.post("/users/signup", payload);

      console.log("✅ [Register] Réponse reçue:", data);

      if (data?.data?.user && data?.token) {
        auth.login(data.data.user, data.token);
        
        // ⭐ Correction: Redirection basée sur le rôle Mongoose (avec accents supprimés)
        const redirect =
          data.data.user.role === "Admin"
            ? "/admin"
            : data.data.user.role === "Proprietaire" // ⭐ Sans accent
            ? "/mes-biens"
            : "/";
        
        console.log("🔄 [Register] Redirection vers:", redirect);
        navigate(redirect);
      } else {
        setError("Inscription réussie mais données utilisateur manquantes.");
      }
    } catch (err) {
      console.error("❌ [Register] Erreur:", err);
      setError(
        err.response?.data?.message ||
          "Erreur lors de l'inscription. Vérifiez vos informations."
      );
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <main className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md p-8 lg:p-10 space-y-6 bg-white rounded-2xl shadow-xl">
          
          {/* En-tête de la carte */}
          <div className="text-center">
            <FiUserPlus className="mx-auto h-12 w-auto text-blue-600" />
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
              Créez votre compte
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Rejoignez la plateforme en quelques clics.
            </p>
          </div>
          
          {/* Message d'erreur */}
          {error && (
            <div className="flex items-center gap-3 bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
              <FiAlertTriangle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-6">
            
            {/* Champ Nom */}
            <div className="relative">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Nom complet
              </label>
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none mt-6">
                <FiUser className="h-5 w-5 text-gray-400" />
              </span>
              <input
                id="name"
                type="text"
                placeholder="Entrez votre nom complet"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>
            
            {/* Champ Email */}
            <div className="relative">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Adresse email
              </label>
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none mt-6">
                <FiMail className="h-5 w-5 text-gray-400" />
              </span>
              <input
                id="email"
                type="email"
                placeholder="exemple@email.com"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>

            {/* Champ Mot de passe */}
            <div className="relative">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe
              </label>
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none mt-6">
                <FiLock className="h-5 w-5 text-gray-400" />
              </span>
              <input
                id="password"
                type="password"
                placeholder="Minimum 8 caractères"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={8}
                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>

            {/* Champ Confirmer Mot de passe */}
            <div className="relative">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirmer le mot de passe
              </label>
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none mt-6">
                <FiLock className="h-5 w-5 text-gray-400" />
              </span>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Répétez votre mot de passe"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                minLength={8}
                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>

            {/* Champ Rôle */}
            <div className="relative">
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                Je m'inscris en tant que
              </label>
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none mt-6">
                <FiBriefcase className="h-5 w-5 text-gray-400" />
              </span>
              <select
                id="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition appearance-none cursor-pointer"
              >
                <option value="Client">Client (recherche de bien)</option>
                <option value="Proprietaire">Propriétaire / Apporteur d'affaires</option>
                <option value="Prestataire">Prestataire de services</option>
              </select>
            </div>

            {/* Bouton d'inscription */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-150 ease-in-out"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Création en cours...
                </span>
              ) : (
                "Créer mon compte"
              )}
            </button>

            {/* Lien vers la page de connexion */}
            <p className="text-center text-sm text-gray-600 pt-4 border-t border-gray-200">
              Vous avez déjà un compte ?{" "}
              <Link
                to="/login"
                className="font-semibold text-blue-600 hover:text-blue-500 transition"
              >
                Connectez-vous
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
};

export default RegisterPage;