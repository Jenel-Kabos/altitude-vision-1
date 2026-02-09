// src/pages/dashboard/OwnerDashboard.jsx
import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { 
    Home, User, LogOut, Globe, ShieldCheck, Menu, X 
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";

const OwnerDashboard = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  const handleLogout = () => {
    console.log("🚪 [OwnerDashboard] Déconnexion en cours...");
    logout();
    toast.success("Déconnexion réussie.");
    navigate("/login", { replace: true });
    console.log("✅ [OwnerDashboard] Redirection vers /login");
  };

  const handleGoHome = () => {
    console.log("🏠 [OwnerDashboard] Redirection vers l'accueil");
    navigate("/");
    closeMobileSidebar();
  };

  const toggleMobileSidebar = () => {
    setShowMobileSidebar(!showMobileSidebar);
  };

  const closeMobileSidebar = () => {
    setShowMobileSidebar(false);
  };

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
      isActive ? "bg-green-600 text-white" : "text-gray-700 hover:bg-gray-200"
    }`;

  return (
    <div className="flex min-h-screen bg-gray-100">
      
      {/* =======================================================
          OVERLAY pour fermer la sidebar sur mobile (clic en dehors)
      ======================================================== */}
      {showMobileSidebar && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeMobileSidebar}
        />
      )}

      {/* =======================================================
          SIDEBAR
          - Mobile : Slide-in depuis la gauche quand showMobileSidebar = true
          - Desktop : Toujours visible, largeur fixe (w-64)
      ======================================================== */}
      <aside className={`
        w-64 bg-white shadow-lg p-4 flex flex-col justify-between
        fixed md:relative h-full z-50 md:z-auto
        transition-transform duration-300 ease-in-out
        ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Header avec bouton fermeture (mobile only) */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-green-700 text-center">
                Espace Propriétaire
              </h1>
              <p className="text-xs text-center text-gray-400 mt-1">
                Gestion de vos annonces
              </p>
            </div>
            <button
              onClick={closeMobileSidebar}
              className="md:hidden p-2 -mr-2 rounded-lg hover:bg-gray-100 text-gray-600"
              aria-label="Fermer le menu"
            >
              <X size={24} />
            </button>
          </div>

          <nav className="space-y-2">
            {/* Mes Biens */}
            <NavLink
              to="/mes-biens"
              end
              onClick={closeMobileSidebar}
              className={navLinkClass}
            >
              <Home size={18} /> Mes Biens
            </NavLink>

            {/* Mon Profil */}
            <NavLink
              to="/profile"
              onClick={closeMobileSidebar}
              className={navLinkClass}
            >
              <User size={18} /> Mon Profil
            </NavLink>
            
            {/* Sécurité */}
            <NavLink
              to="/securite"
              onClick={closeMobileSidebar}
              className={navLinkClass}
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
          onClick={() => {
            handleLogout();
            closeMobileSidebar();
          }}
          className="flex items-center gap-2 mt-6 px-3 py-2 rounded-lg text-red-600 hover:bg-red-100 transition-colors"
        >
          <LogOut size={18} /> Déconnexion
        </button>
      </aside>

      {/* =======================================================
          CONTENU PRINCIPAL
          - Mobile : Prend toute la largeur
          - Desktop : Prend le reste de l'espace (flex-1)
      ======================================================== */}
      <main className="flex-1 flex flex-col min-h-screen">
        
        {/* Header Mobile avec bouton Menu */}
        <div className="md:hidden bg-white border-b shadow-sm sticky top-0 z-30">
          <div className="flex items-center justify-between p-4">
            <button
              onClick={toggleMobileSidebar}
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors"
              aria-label="Ouvrir le menu"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-lg font-bold text-green-700">
              Espace Propriétaire
            </h2>
            <div className="w-10" /> {/* Spacer pour centrer le titre */}
          </div>
        </div>

        {/* Contenu de la page */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default OwnerDashboard;