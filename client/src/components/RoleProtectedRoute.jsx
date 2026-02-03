import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext"; // Contexte d'authentification
import { getCurrentUser } from "../services/authService"; // Compatibilité localStorage

/**
 * Composant de protection par rôle
 * @param {Array|string} allowedRoles - Liste ou nom de rôle(s) autorisé(s)
 */
const RoleProtectedRoute = ({ allowedRoles }) => {
  const { user: contextUser, loading } = useAuth();
  const localUser = getCurrentUser();

  // Priorité : contexte puis localStorage
  const user = contextUser || localUser;

  // Affiche un écran de chargement pendant la récupération
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Chargement...</p>
      </div>
    );
  }

  // Si aucun utilisateur n'est connecté
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Normalise allowedRoles pour accepter string ou Array
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  // Vérifie le rôle
  if (!allowed.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Affiche la route protégée si tout est OK
  return <Outlet />;
};

export default RoleProtectedRoute;
