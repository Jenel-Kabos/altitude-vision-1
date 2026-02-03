// ✅ src/components/routing/PublicAuthRoute.jsx
import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Loader2 } from "lucide-react";

const PublicAuthRoute = () => {
  const { user, loading } = useAuth();

  // 🔹 Affichage pendant la vérification de l'authentification
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-3" />
        <p className="text-gray-600 text-lg">Vérification de la session...</p>
      </div>
    );
  }

  // 🔹 Redirection si utilisateur déjà connecté
  if (user) {
    let redirectPath = "/";

    switch (user.role) {
      case "Admin":
        redirectPath = "/dashboard";
        break;
      case "Propriétaire":
        redirectPath = "/mes-biens";
        break;
      default:
        redirectPath = "/";
    }

    return <Navigate to={redirectPath} replace />;
  }

  // 🔹 Utilisateur non connecté → rendu normal des routes publiques
  return <Outlet />;
};

export default PublicAuthRoute;
