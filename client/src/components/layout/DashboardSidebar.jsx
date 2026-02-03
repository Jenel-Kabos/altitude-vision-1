import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { getCurrentUser, logout } from "../../services/authService";
import {
  FaHome,
  FaBuilding,
  FaPlus,
  FaList,
  FaCalendarAlt,
  FaTools,
  FaSignOutAlt,
} from "react-icons/fa";

const DashboardSidebar = () => {
  const user = getCurrentUser();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isAdminOrCollab = user?.role === "Admin" || user?.role === "Collaborateur";
  const isOwner = user?.role === "Propriétaire";

  return (
    <aside className="w-64 bg-white shadow-lg py-6 px-4 h-screen sticky top-0">
      <h2 className="text-2xl font-bold text-center mb-8">Tableau de Bord</h2>

      <nav className="flex flex-col gap-3">

        {/* Accueil Dashboard */}
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex items-center gap-2 p-2 rounded-lg ${
              isActive ? "bg-blue-600 text-white" : "hover:bg-gray-200"
            }`
          }
        >
          <FaHome /> Accueil
        </NavLink>

        {/* --- LIENS ADMIN + COLLAB --- */}
        {isAdminOrCollab && (
          <>
            <NavLink
              to="/dashboard/properties"
              className={({ isActive }) =>
                `flex items-center gap-2 p-2 rounded-lg ${
                  isActive ? "bg-blue-600 text-white" : "hover:bg-gray-200"
                }`
              }
            >
              <FaBuilding /> Gérer les biens
            </NavLink>

            <NavLink
              to="/dashboard/add-property"
              className={({ isActive }) =>
                `flex items-center gap-2 p-2 rounded-lg ${
                  isActive ? "bg-blue-600 text-white" : "hover:bg-gray-200"
                }`
              }
            >
              <FaPlus /> Ajouter un bien
            </NavLink>

            <NavLink
              to="/dashboard/events"
              className={({ isActive }) =>
                `flex items-center gap-2 p-2 rounded-lg ${
                  isActive ? "bg-blue-600 text-white" : "hover:bg-gray-200"
                }`
              }
            >
              <FaCalendarAlt /> Gérer les événements
            </NavLink>

            <NavLink
              to="/dashboard/services"
              className={({ isActive }) =>
                `flex items-center gap-2 p-2 rounded-lg ${
                  isActive ? "bg-blue-600 text-white" : "hover:bg-gray-200"
                }`
              }
            >
              <FaTools /> Gérer les services
            </NavLink>
          </>
        )}

        {/* --- LIENS PROPRIÉTAIRE --- */}
        {isOwner && (
          <>
            <NavLink
              to="/mes-biens"
              className={({ isActive }) =>
                `flex items-center gap-2 p-2 rounded-lg ${
                  isActive ? "bg-blue-600 text-white" : "hover:bg-gray-200"
                }`
              }
            >
              <FaList /> Mes biens
            </NavLink>

            <NavLink
              to="/mes-biens/add"
              className={({ isActive }) =>
                `flex items-center gap-2 p-2 rounded-lg ${
                  isActive ? "bg-blue-600 text-white" : "hover:bg-gray-200"
                }`
              }
            >
              <FaPlus /> Ajouter mon bien
            </NavLink>
          </>
        )}

        {/* --- LOGOUT --- */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 p-2 rounded-lg text-red-600 hover:bg-red-100 mt-6"
        >
          <FaSignOutAlt /> Déconnexion
        </button>
      </nav>
    </aside>
  );
};

export default DashboardSidebar;
