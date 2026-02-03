import React from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { FaHome, FaBuilding, FaCalendarAlt, FaBriefcase, FaSignOutAlt } from 'react-icons/fa';
import { logout, getCurrentUser } from '../../services/authService';

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getCurrentUser();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Fonction pour mettre en surbrillance le lien actif
  const isActive = (path) => location.pathname.startsWith(path)
    ? 'bg-gray-700'
    : '';

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 text-white flex flex-col">
        <div className="p-4 text-2xl font-bold border-b border-gray-700">
          Altitude-Vision
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Link
            to="/dashboard"
            className={`flex items-center p-2 rounded hover:bg-gray-700 ${isActive('/dashboard')}`}
          >
            <FaHome className="mr-3" /> Dashboard
          </Link>

          <Link
            to="/dashboard/properties"
            className={`flex items-center p-2 rounded hover:bg-gray-700 ${isActive('/dashboard/properties')}`}
          >
            <FaBuilding className="mr-3" /> Propriétés
          </Link>

          <Link
            to="/dashboard/events"
            className={`flex items-center p-2 rounded hover:bg-gray-700 ${isActive('/dashboard/events')}`}
          >
            <FaCalendarAlt className="mr-3" /> Événements
          </Link>

          <Link
            to="/dashboard/services"
            className={`flex items-center p-2 rounded hover:bg-gray-700 ${isActive('/dashboard/services')}`}
          >
            <FaBriefcase className="mr-3" /> Services
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-700">
          <div className="mb-2 text-sm text-gray-300">
            Connecté en tant que <span className="font-medium">{user?.name}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center w-full p-2 rounded hover:bg-red-500 transition-colors"
          >
            <FaSignOutAlt className="mr-3" /> Déconnexion
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <Outlet /> {/* Les pages enfants du dashboard s'affichent ici */}
      </main>
    </div>
  );
};

export default DashboardLayout;
