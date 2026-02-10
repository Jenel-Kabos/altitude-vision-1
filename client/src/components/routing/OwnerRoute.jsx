// ✅ src/components/routing/OwnerRoute.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from "lucide-react"; // Ajout pour l'icône de chargement cohérente

/**
 * Route protégée réservée aux utilisateurs avec le rôle 'Propriétaire'.
 * - Si non connecté OU token manquant -> redirige vers /login.
 * - Si connecté mais rôle différent -> redirige vers /unauthorized.
 * - Sinon, affiche les composants enfants via <Outlet />.
 */
const OwnerRoute = ({ redirectTo = '/login', forbiddenRedirect = '/unauthorized' }) => {
    const { user, loading } = useAuth();
    // 🔑 Ajout de la vérification du token pour la sécurité et la cohérence
    const token = localStorage.getItem("token"); 

    const allowedRole = 'Proprietaire';

    // 1️⃣ Affichage pendant le chargement du contexte auth
    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center min-h-screen bg-gray-50">
                {/* Utilisation de Loader2 pour la cohérence avec les autres routes */}
                <Loader2 className="animate-spin text-green-500 w-12 h-12 mb-4" /> 
                <p className="mt-4 text-lg text-gray-700 font-semibold">
                    Vérification des accès...
                </p>
            </div>
        );
    }

    // 2️⃣ Redirection si non authentifié OU token manquant
    // Ce bloc est la clé pour éviter une boucle de redirection basée sur un état "utilisateur" incomplet.
    if (!user || !token) { 
        return <Navigate to={redirectTo} replace />;
    }

    // 3️⃣ Redirection si rôle non autorisé
    // Le user est garanti d'être non-null ici
    if (user.role !== allowedRole) {
        return <Navigate to={forbiddenRedirect} replace />;
    }

    // 4️⃣ Accès autorisé
    return <Outlet />;
};

export default OwnerRoute;