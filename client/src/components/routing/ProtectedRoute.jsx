import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Loader2 } from "lucide-react";

/**
 * ✅ ProtectedRoute
 * Protège les routes accessibles uniquement aux utilisateurs connectés.
 * - Affiche un spinner pendant le chargement
 * - Redirige vers /login si non connecté
 * - Conserve la route d’origine pour redirection post-login
 */
const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // 🌀 Affichage pendant la vérification de session
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-3" />
        <p className="text-gray-600 text-lg">Vérification de votre session...</p>
      </div>
    );
  }

  // 🚫 Si non connecté → redirection vers /login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // ✅ Utilisateur connecté → autorisation d'accès
  return <Outlet />;
};

export default ProtectedRoute;
