// src/pages/AdminDashboard.jsx
import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { 
  Home, Calendar, Briefcase, LogOut, BarChart3, Globe, Users, CheckCircle2, ShieldCheck, Mail 
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleGoHome = () => {
    navigate("/");
  };

  const navLinkClass = ({ isActive, colorClass, hoverClass = "hover:bg-gray-200" }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg ${
      isActive ? colorClass : `text-gray-700 ${hoverClass}`
    }`;

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* === SIDEBAR === */}
      <aside className="w-64 bg-white shadow-lg p-4 flex flex-col justify-between">
        <div>
          <h1 className="text-2xl font-bold text-blue-700 mb-6 text-center">
            Altitude-Vision
          </h1>
          <p className="text-xs text-center text-gray-400 mb-4">
            Panneau d'administration
          </p>

          <nav className="space-y-2">
            {/* Tableau de bord */}
            <NavLink
              to="/dashboard"
              end
              className={({ isActive }) =>
                navLinkClass({ isActive, colorClass: "bg-blue-600 text-white" })
              }
            >
              <BarChart3 size={18} /> Tableau de bord
            </NavLink>

            {/* Altimmo */}
            <NavLink
              to="/dashboard/properties"
              className={({ isActive }) =>
                navLinkClass({ isActive, colorClass: "bg-blue-600 text-white" })
              }
            >
              <Home size={18} /> Altimmo
            </NavLink>

            {/* Mila Events */}
            <NavLink
              to="/dashboard/events"
              className={({ isActive }) =>
                navLinkClass({ isActive, colorClass: "bg-blue-600 text-white" })
              }
            >
              <Calendar size={18} /> Mila Events
            </NavLink>

            {/* Altcom */}
            <NavLink
              to="/dashboard/altcom"
              className={({ isActive }) =>
                navLinkClass({ isActive, colorClass: "bg-blue-600 text-white" })
              }
            >
              <Briefcase size={18} /> Altcom
            </NavLink>

            {/* Modération des biens */}
            <NavLink
              to="/dashboard/moderation"
              className={({ isActive }) =>
                navLinkClass({ isActive, colorClass: "bg-purple-600 text-white" })
              }
            >
              <CheckCircle2 size={18} /> Modération
            </NavLink>
            
            {/* --- ADMINISTRATION & SÉCURITÉ --- */}
            <div className="border-t border-gray-200 pt-2 mt-2">
                <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Administration & Sécurité</p>

                {/* Gestion des utilisateurs */}
                <NavLink
                    to="/dashboard/users"
                    className={({ isActive }) =>
                        navLinkClass({ isActive, colorClass: "bg-teal-600 text-white" })
                    }
                >  
                    <Users size={18} /> Utilisateurs (Général)
                </NavLink>
                
                {/* Sessions Actives (Sécurité) */}
                <NavLink
                    to="/dashboard/active-sessions" 
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
                  className={({ isActive }) =>
                    navLinkClass({ isActive, colorClass: "bg-amber-600 text-white" })
                  }
                >
                  <Mail size={18} /> Boîte de Réception
                </NavLink>

              {/* Gestion des Emails */}
              <NavLink
                to="/dashboard/emails"
                className={({ isActive }) =>
                  navLinkClass({ isActive, colorClass: "bg-amber-400 text-white" })
                }
              >  
                <ShieldCheck size={18} /> Gestion des Emails
              </NavLink>
            </div>

            {/* Accueil public */}
            <button
              onClick={handleGoHome}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-yellow-600 hover:bg-yellow-100 mt-4"
            >
              <Globe size={18} /> Accueil du site
            </button>
          </nav>
        </div>

        {/* Bouton Déconnexion */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 mt-6 px-3 py-2 rounded-lg text-red-600 hover:bg-red-100"
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

export default AdminDashboard;