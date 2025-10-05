import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Ce composant protège les routes qui ne doivent être accessibles qu'aux administrateurs.
 * @param {object} props - Les props du composant.
 * @param {React.ReactNode} props.children - Le composant de la page à afficher si l'utilisateur est un admin.
 */
const AdminRoute = ({ children }) => {
  // On récupère les informations de l'utilisateur depuis notre contexte d'authentification.
  const { userInfo } = useAuth();

  // On vérifie deux conditions :
  // 1. L'utilisateur est-il connecté ? (userInfo existe)
  // 2. L'utilisateur connecté a-t-il le rôle 'Admin' ?
  if (userInfo && userInfo.role === 'Admin') {
    // Si les deux conditions sont vraies, on affiche la page protégée.
    return children;
  }

  // Si l'une des conditions est fausse, on redirige l'utilisateur vers la page de connexion.
  // L'attribut 'replace' empêche l'utilisateur de revenir à la page admin avec le bouton "précédent" du navigateur.
  return <Navigate to="/login" replace />;
};

export default AdminRoute;