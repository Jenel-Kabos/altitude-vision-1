import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from "lucide-react"; 

/**
 * Route protégée réservée aux administrateurs et collaborateurs.
 */
const AdminRoute = ({ redirectTo = '/login', forbiddenRedirect = '/unauthorized' }) => {
    // Ligne 9 : point de rupture de la boucle si l'état est instable
    const { user, loading } = useAuth(); 
    
    // Le token est lu à chaque rendu pour une double vérification immédiate
    const token = localStorage.getItem("token"); 
    const allowedRoles = ['Admin', 'Collaborateur'];

    // 1️⃣ Gestion du chargement
    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center min-h-screen bg-gray-50">
                <Loader2 className="animate-spin text-blue-500 w-12 h-12 mb-4" />
                <p className="text-lg text-gray-700 font-semibold">
                    Vérification des accès...
                </p>
            </div>
        );
    }

    // 2️⃣ Redirection si non authentifié OU token manquant
    // Si l'utilisateur est nul OU si le token a été retiré (ex: déconnexion)
    // Le 'return' est crucial pour stopper le rendu ici.
    if (!user || !token) {
        return <Navigate to={redirectTo} replace />;
    }

    // 3️⃣ Redirection si rôle non autorisé
    // Si l'utilisateur est défini mais son rôle n'est pas permis
    // Le 'return' est crucial pour stopper le rendu ici.
    if (!allowedRoles.includes(user.role)) {
        return <Navigate to={forbiddenRedirect} replace />;
    }

    // 4️⃣ Accès autorisé
    // Si loading est false, user est défini, et le rôle est correct.
    return <Outlet />;
};

export default AdminRoute;
