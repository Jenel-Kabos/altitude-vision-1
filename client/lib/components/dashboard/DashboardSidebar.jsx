'use client';

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Home,
  Building2,
  Calendar,
  Briefcase,
  FileText,
  Users,
  Shield,
  LogOut,
  Mail,
  MessageSquare,
  Monitor,
  Key,
} from "lucide-react";
import { useAuth } from '../../context/AuthContext';

const DashboardSidebar = () => {
  const pathname = usePathname();
  const { logout, user } = useAuth();

  const activeClass = (path) =>
    pathname?.startsWith(path)
      ? "bg-blue-700 text-white shadow-lg"
      : "text-blue-100 hover:bg-blue-700/50";

  const handleLogout = () => {
    logout();
  };

  return (
    <aside className="w-64 bg-gradient-to-b from-blue-900 to-blue-800 text-white min-h-screen flex flex-col shadow-2xl">
      {/* Logo */}
      <div className="p-6 border-b border-blue-700">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
          <Image
            src="/images/Logo_Altitude1.png"
            alt="Altitude Vision"
            width={120}
            height={35}
            style={{ objectFit: 'contain' }}
          />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <Link
          href="/dashboard"
          className={`flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${activeClass('/dashboard')}`}
        >
          <Home className="w-5 h-5" />
          <span>Tableau de bord</span>
          </Link>
          <Link
            href="/dashboard/properties"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${activeClass('/dashboard/properties')}`}
          >
            <Building2 className="w-5 h-5" />
            <span>Biens Immobiliers</span>
          </Link>

        {/* Bloc Mila Events */}
        <div className="pt-4 mt-4 border-t border-blue-700">
          <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider px-4 mb-2">
            Mila Events
          </p>
          <Link
            href="/dashboard/events"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${activeClass('/dashboard/events')}`}
          >
            <Calendar className="w-5 h-5" />
            <span>Événements</span>
          </Link>
        </div>

        {/* Bloc Altcom */}
        <div className="pt-4 mt-4 border-t border-blue-700">
          <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider px-4 mb-2">
            Altcom
          </p>
          <Link
            href="/dashboard/altcom"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${activeClass('/dashboard/altcom')}`}
          >
            <Briefcase className="w-5 h-5" />
            <span>Gestion Altcom</span>
          </Link>
          
          <Link
            href="/dashboard/quotes"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${activeClass('/dashboard/quotes')}`}
          >
            <FileText className="w-5 h-5" />
            <span>Devis & Projets</span>
          </Link>
        </div>

        {/* Section Communication */}
        <div className="pt-4 mt-4 border-t border-blue-700">
          <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider px-4 mb-2">
            Communication
          </p>
          
          {user?.role === 'Admin' && (
            <Link
              href="/dashboard/emails"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${activeClass('/dashboard/emails')}`}
            >
              <Mail className="w-5 h-5" />
              <span>Emails Pro</span>
            </Link>
          )}

          <Link
            href="/dashboard/messages"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${activeClass('/dashboard/messages')}`}
          >
            <MessageSquare className="w-5 h-5" />
            <span>Messagerie Interne</span>
          </Link>
        </div>

        {/* Section Administration */}
        {user?.role === 'Admin' && (
          <div className="pt-4 mt-4 border-t border-blue-700">
            <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider px-4 mb-2">
              Administration
            </p>

            <Link
              href="/dashboard/moderation"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${activeClass('/dashboard/moderation')}`}
            >
              <Shield className="w-5 h-5" />
              <span>Modération</span>
            </Link>

            <Link
              href="/dashboard/users"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${activeClass('/dashboard/users')}`}
            >
              <Users className="w-5 h-5" />
              <span>Utilisateurs</span>
            </Link>

            <Link
              href="/dashboard/active-sessions"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${activeClass('/dashboard/active-sessions')}`}
            >
              <Monitor className="w-5 h-5" />
              <span>Sessions Actives</span>
            </Link>

            <Link
              href="/dashboard/gestion-locative"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${activeClass('/dashboard/gestion-locative')}`}
            >
              <Key className="w-5 h-5" />
              <span>Gestion Locative</span>
            </Link>
          </div>
        )}
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-blue-700">
        <div className="mb-4 px-4 py-3 bg-blue-800 rounded-lg">
          <p className="text-sm text-blue-200">Connecté en tant que</p>
          <p className="font-semibold truncate">{user?.name || "Utilisateur"}</p>
          <p className="text-xs text-blue-300">{user?.role || "Rôle"}</p>
        </div>
        
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 transition font-medium"
        >
          <LogOut className="w-5 h-5" />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;