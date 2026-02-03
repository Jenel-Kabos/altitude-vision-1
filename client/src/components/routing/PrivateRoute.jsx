import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const PrivateRoute = ({ allowedRoles }) => {
  const { user, loading } = useAuth();

  // ⏳ Affichage pendant la vérification de la session
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="animate-spin text-blue-500 w-12 h-12 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Vérification de la session...</p>
        </div>
      </div>
    );
  }

  // 🚫 Aucun utilisateur connecté → redirection vers /login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 🧩 Si la route est restreinte à certains rôles
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <ShieldAlert className="text-red-500 w-12 h-12 mb-4" />
        <h2 className="text-xl font-semibold text-gray-800">
          Accès refusé
        </h2>
        <p className="text-gray-600 mt-2">
          Vous n’avez pas les permissions nécessaires pour accéder à cette page.
        </p>
      </div>
    );
  }

  // ✅ Utilisateur autorisé → affiche la page protégée
  return <Outlet />;
};

export default PrivateRoute;
