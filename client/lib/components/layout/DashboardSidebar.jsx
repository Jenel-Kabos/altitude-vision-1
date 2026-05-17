"use client";

'use client';

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const navClass = (path) =>
    `flex items-center gap-2 p-2 rounded-lg ${pathname?.startsWith(path) ? "bg-blue-600 text-white" : "hover:bg-gray-200"}`;

  const isAdminOrCollab = user?.role === "Admin" || user?.role === "Collaborateur";
  const isOwner = user?.role === "Propriétaire";

  return (
    <aside className="w-64 bg-white shadow-lg py-6 px-4 h-screen sticky top-0">
      <h2 className="text-2xl font-bold text-center mb-8">Tableau de Bord</h2>

      <nav className="flex flex-col gap-3">

        {/* Accueil Dashboard */}
        <Link
          href="/dashboard"
          className={navClass('/dashboard')}
        >
          <FaHome /> Accueil
        </Link>

        {/* --- LIENS ADMIN + COLLAB --- */}
        {isAdminOrCollab && (
          <>
            <Link
              href="/dashboard/properties"
              className={navClass('/dashboard/properties')}
            >
              <FaBuilding /> Gérer les biens
            </Link>

            <Link
              href="/dashboard/add-property"
              className={navClass('/dashboard/add-property')}
            >
              <FaPlus /> Ajouter un bien
            </Link>

            <Link
              href="/dashboard/events"
              className={navClass('/dashboard/events')}
            >
              <FaCalendarAlt /> Gérer les événements
            </Link>

            <Link
              href="/dashboard/services"
              className={navClass('/dashboard/services')}
            >
              <FaTools /> Gérer les services
            </Link>
          </>
        )}

        {/* --- LIENS PROPRIÉTAIRE --- */}
        {isOwner && (
          <>
            <Link
              href="/mes-biens"
              className={navClass('/mes-biens')}
            >
              <FaList /> Mes biens
            </Link>

            <Link
              href="/mes-biens/add"
              className={navClass('/mes-biens/add')}
            >
              <FaPlus /> Ajouter mon bien
            </Link>
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
