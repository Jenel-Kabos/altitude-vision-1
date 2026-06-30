'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FaHome, FaBuilding, FaCalendarAlt, FaBriefcase, FaSignOutAlt } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';

const DashboardLayout = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const isActive = (path) => pathname?.startsWith(path) ? 'bg-gray-700' : '';

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-gray-800 text-white flex flex-col">
        <div className="p-4 text-2xl font-bold border-b border-gray-700">
          Altitude-Vision
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Link
            href="/dashboard"
            className={`flex items-center p-2 rounded hover:bg-gray-700 ${isActive('/dashboard')}`}
          >
            <FaHome className="mr-3" /> Dashboard
          </Link>

          <Link
            href="/dashboard/properties"
            className={`flex items-center p-2 rounded hover:bg-gray-700 ${isActive('/dashboard/properties')}`}
          >
            <FaBuilding className="mr-3" /> Propriétés
          </Link>

          <Link
            href="/dashboard/events"
            className={`flex items-center p-2 rounded hover:bg-gray-700 ${isActive('/dashboard/events')}`}
          >
            <FaCalendarAlt className="mr-3" /> Événements
          </Link>

          <Link
            href="/dashboard/services"
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

      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
