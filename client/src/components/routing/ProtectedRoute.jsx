import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Ce composant vérifie si un utilisateur est authentifié.
 * S'il l'est, il affiche les composants enfants (la page demandée).
 * Sinon, il redirige vers la page de connexion.
 */
const ProtectedRoute = ({ children }) => {
  const { userInfo } = useAuth();

  if (!userInfo) {
    // L'utilisateur n'est pas connecté.
    // On le redirige vers /login. L'option 'replace' évite que l'utilisateur
    // puisse revenir à la page précédente (la page protégée) avec le bouton "retour".
    return <Navigate to="/login" replace />;
  }

  // L'utilisateur est connecté, on peut afficher la page.
  return children;
};

export default ProtectedRoute;

