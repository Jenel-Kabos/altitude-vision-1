import React from "react";
import { Link, NavLink } from "react-router-dom";
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
  Monitor
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const DashboardSidebar = () => {
  const { logout, user } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <aside className="w-64 bg-gradient-to-b from-blue-900 to-blue-800 text-white min-h-screen flex flex-col shadow-2xl">
      {/* Logo */}
      <div className="p-6 border-b border-blue-700">
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
            <span className="text-blue-900 font-bold text-xl">AV</span>
          </div>
          <div>
            <h2 className="text-lg font-bold">Altitude Vision</h2>
            <p className="text-xs text-blue-200">Administration</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <NavLink
          to="/dashboard"
          end
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${
              isActive
                ? "bg-blue-700 text-white shadow-lg"
                : "text-blue-100 hover:bg-blue-700/50"
            }`
          }
        >
          <Home className="w-5 h-5" />
          <span>Tableau de bord</span>
        </NavLink>

        {/* Bloc Altimmo */}
        <div className="pt-4 mt-4 border-t border-blue-700">
          <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider px-4 mb-2">
            Altimmo
          </p>
          <NavLink
            to="/dashboard/properties"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${
                isActive
                  ? "bg-blue-700 text-white shadow-lg"
                  : "text-blue-100 hover:bg-blue-700/50"
              }`
            }
          >
            <Building2 className="w-5 h-5" />
            <span>Biens Immobiliers</span>
          </NavLink>
        </div>

        {/* Bloc Mila Events */}
        <div className="pt-4 mt-4 border-t border-blue-700">
          <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider px-4 mb-2">
            Mila Events
          </p>
          <NavLink
            to="/dashboard/events"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${
                isActive
                  ? "bg-blue-700 text-white shadow-lg"
                  : "text-blue-100 hover:bg-blue-700/50"
              }`
            }
          >
            <Calendar className="w-5 h-5" />
            <span>Événements</span>
          </NavLink>
        </div>

        {/* Bloc Altcom */}
        <div className="pt-4 mt-4 border-t border-blue-700">
          <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider px-4 mb-2">
            Altcom
          </p>
          <NavLink
            to="/dashboard/altcom"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${
                isActive
                  ? "bg-blue-700 text-white shadow-lg"
                  : "text-blue-100 hover:bg-blue-700/50"
              }`
            }
          >
            <Briefcase className="w-5 h-5" />
            <span>Gestion Altcom</span>
          </NavLink>
          
          <NavLink
            to="/dashboard/quotes"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${
                isActive
                  ? "bg-blue-700 text-white shadow-lg"
                  : "text-blue-100 hover:bg-blue-700/50"
              }`
            }
          >
            <FileText className="w-5 h-5" />
            <span>Devis & Projets</span>
          </NavLink>
        </div>

        {/* Section Communication */}
        <div className="pt-4 mt-4 border-t border-blue-700">
          <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider px-4 mb-2">
            Communication
          </p>
          
          <NavLink
            to="/dashboard/emails"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${
                isActive
                  ? "bg-blue-700 text-white shadow-lg"
                  : "text-blue-100 hover:bg-blue-700/50"
              }`
            }
          >
            <Mail className="w-5 h-5" />
            <span>Emails Pro</span>
          </NavLink>

          <NavLink
            to="/dashboard/messages"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${
                isActive
                  ? "bg-blue-700 text-white shadow-lg"
                  : "text-blue-100 hover:bg-blue-700/50"
              }`
            }
          >
            <MessageSquare className="w-5 h-5" />
            <span>Messagerie Interne</span>
          </NavLink>
        </div>

        {/* Section Administration */}
        {(user?.role === "Admin" || user?.role === "Administrateur") && (
          <div className="pt-4 mt-4 border-t border-blue-700">
            <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider px-4 mb-2">
              Administration
            </p>
            
            <NavLink
              to="/dashboard/moderation"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${
                  isActive
                    ? "bg-blue-700 text-white shadow-lg"
                    : "text-blue-100 hover:bg-blue-700/50"
                }`
              }
            >
              <Shield className="w-5 h-5" />
              <span>Modération</span>
            </NavLink>

            <NavLink
              to="/dashboard/users"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${
                  isActive
                    ? "bg-blue-700 text-white shadow-lg"
                    : "text-blue-100 hover:bg-blue-700/50"
                }`
              }
            >
              <Users className="w-5 h-5" />
              <span>Utilisateurs</span>
            </NavLink>

            <NavLink
              to="/dashboard/active-sessions"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${
                  isActive
                    ? "bg-blue-700 text-white shadow-lg"
                    : "text-blue-100 hover:bg-blue-700/50"
                }`
              }
            >
              <Monitor className="w-5 h-5" />
              <span>Sessions Actives</span>
            </NavLink>
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