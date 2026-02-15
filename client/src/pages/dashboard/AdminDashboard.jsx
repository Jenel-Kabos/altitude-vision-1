// src/pages/AdminDashboard.jsx
import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { 
  Home, Calendar, Briefcase, LogOut, BarChart3, Globe, Users, CheckCircle2, ShieldCheck, Mail, Menu, X, Star
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleGoHome = () => {
    navigate("/");
  };

  const toggleMobileSidebar = () => {
    setShowMobileSidebar(!showMobileSidebar);
  };

  const closeMobileSidebar = () => {
    setShowMobileSidebar(false);
  };

  const navLinkClass = ({ isActive, colorClass, hoverClass = "hover:bg-gray-200" }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
      isActive ? colorClass : `text-gray-700 ${hoverClass}`
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
              <h1 className="text-2xl font-bold text-blue-700 text-center">
                Altitude-Vision
              </h1>
              <p className="text-xs text-center text-gray-400 mt-1">
                Panneau d'administration
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
            {/* Tableau de bord */}
            <NavLink
              to="/dashboard"
              end
              onClick={closeMobileSidebar}
              className={({ isActive }) =>
                navLinkClass({ isActive, colorClass: "bg-blue-600 text-white" })
              }
            >
              <BarChart3 size={18} /> Tableau de bord
            </NavLink>

            {/* Altimmo */}
            <NavLink
              to="/dashboard/properties"
              onClick={closeMobileSidebar}
              className={({ isActive }) =>
                navLinkClass({ isActive, colorClass: "bg-blue-600 text-white" })
              }
            >
              <Home size={18} /> Altimmo
            </NavLink>

            {/* Mila Events */}
            <NavLink
              to="/dashboard/events"
              onClick={closeMobileSidebar}
              className={({ isActive }) =>
                navLinkClass({ isActive, colorClass: "bg-blue-600 text-white" })
              }
            >
              <Calendar size={18} /> Mila Events
            </NavLink>

            {/* Altcom */}
            <NavLink
              to="/dashboard/altcom"
              onClick={closeMobileSidebar}
              className={({ isActive }) =>
                navLinkClass({ isActive, colorClass: "bg-blue-600 text-white" })
              }
            >
              <Briefcase size={18} /> Altcom
            </NavLink>

            {/* --- MODÉRATION --- */}
            <div className="border-t border-gray-200 pt-2 mt-2">
              <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Modération</p>

              {/* Modération des biens */}
              <NavLink
                to="/dashboard/moderation/properties"
                onClick={closeMobileSidebar}
                className={({ isActive }) =>
                  navLinkClass({ isActive, colorClass: "bg-purple-600 text-white" })
                }
              >
                <CheckCircle2 size={18} /> Modération Biens
              </NavLink>

              {/* Modération des avis */}
              <NavLink
                to="/dashboard/moderation/reviews"
                onClick={closeMobileSidebar}
                className={({ isActive }) =>
                  navLinkClass({ isActive, colorClass: "bg-indigo-600 text-white" })
                }
              >
                <Star size={18} /> Modération Avis
              </NavLink>
            </div>
            
            {/* --- ADMINISTRATION & SÉCURITÉ --- */}
            <div className="border-t border-gray-200 pt-2 mt-2">
                <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Administration & Sécurité</p>

                {/* Gestion des utilisateurs */}
                <NavLink
                    to="/dashboard/users"
                    onClick={closeMobileSidebar}
                    className={({ isActive }) =>
                        navLinkClass({ isActive, colorClass: "bg-teal-600 text-white" })
                    }
                >  
                    <Users size={18} /> Utilisateurs (Général)
                </NavLink>
                
                {/* Sessions Actives (Sécurité) */}
                <NavLink
                    to="/dashboard/active-sessions"
                    onClick={closeMobileSidebar}
                    className={({ isActive }) =>
                        navLinkClass({ isActive, colorClass: "bg-red-600 text-white", hoverClass: "hover:bg-red-100" })
                    }
                >  
                    <ShieldCheck size={18} /> Sessions Actives
                </NavLink>
            </div>

            {/* --- COMMUNICATIONS --- */}
            <div className="border-t border-gray-200 pt-2 mt-2">
              <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Communications</p>

                {/* Boîte de Réception Admin */}
                <NavLink
                  to="/dashboard/messages"
                  onClick={closeMobileSidebar}
                  className={({ isActive }) =>
                    navLinkClass({ isActive, colorClass: "bg-amber-600 text-white" })
                  }
                >
                  <Mail size={18} /> Boîte de Réception
                </NavLink>

              {/* Gestion des Emails */}
              <NavLink
                to="/dashboard/emails"
                onClick={closeMobileSidebar}
                className={({ isActive }) =>
                  navLinkClass({ isActive, colorClass: "bg-amber-400 text-white" })
                }
              >  
                <ShieldCheck size={18} /> Gestion des Emails
              </NavLink>
            </div>

            {/* Accueil public */}
            <button
              onClick={() => {
                handleGoHome();
                closeMobileSidebar();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-yellow-600 hover:bg-yellow-100 mt-4 transition-colors"
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
            <h2 className="text-lg font-bold text-gray-800">
              Dashboard Admin
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

export default AdminDashboard;