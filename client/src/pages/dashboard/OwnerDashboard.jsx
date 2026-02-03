// src/pages/dashboard/OwnerDashboard.jsx
import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { 
    Home, User, LogOut, Globe, ShieldCheck 
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useAuth } from "../../context/AuthContext"; // ✅ Import ajouté

const OwnerDashboard = () => {
  const navigate = useNavigate();
  const { logout } = useAuth(); // ✅ Récupération de la fonction logout

  const handleLogout = () => {
    console.log("🚪 [OwnerDashboard] Déconnexion en cours...");
    logout(); // ✅ Nettoie localStorage ET contexte
    toast.success("Déconnexion réussie.");
    navigate("/login", { replace: true }); // ✅ Ajout de replace
    console.log("✅ [OwnerDashboard] Redirection vers /login");
  };

  const handleGoHome = () => {
    console.log("🏠 [OwnerDashboard] Redirection vers l'accueil");
    navigate("/");
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* === SIDEBAR (Propriétaire) === */}
      <aside className="w-64 bg-white shadow-lg p-4 flex flex-col justify-between">
        <div>
          <h1 className="text-2xl font-bold text-green-700 mb-6 text-center">
            Espace Propriétaire
          </h1>
          <p className="text-xs text-center text-gray-400 mb-4">
            Gestion de vos annonces
          </p>

          <nav className="space-y-2">
            {/* Mes Biens */}
            <NavLink
              to="/mes-biens"
              end
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  isActive ? "bg-green-600 text-white" : "text-gray-700 hover:bg-gray-200"
                }`
              }
            >
              <Home size={18} /> Mes Biens
            </NavLink>

            {/* Mon Profil */}
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  isActive ? "bg-green-600 text-white" : "text-gray-700 hover:bg-gray-200"
                }`
              }
            >
              <User size={18} /> Mon Profil
            </NavLink>
            
            {/* Sécurité */}
            <NavLink
              to="/securite"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  isActive ? "bg-green-600 text-white" : "text-gray-700 hover:bg-gray-200"
                }`
              }
            >
              <ShieldCheck size={18} /> Sécurité
            </NavLink>

            {/* Accueil public */}
            <button
              onClick={handleGoHome}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-blue-600 hover:bg-blue-100 mt-4 transition-colors"
            >
              <Globe size={18} /> Accueil du site
            </button>
          </nav>
        </div>

        {/* Bouton Déconnexion */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 mt-6 px-3 py-2 rounded-lg text-red-600 hover:bg-red-100 transition-colors"
        >
          <LogOut size={18} /> Déconnexion
        </button>
      </aside>

      {/* === CONTENU PRINCIPAL === */}
      <main className="flex-1 p-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default OwnerDashboard;