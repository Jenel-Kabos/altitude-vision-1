"use client";

// src/components/routing/ProtectedRoute.jsx
import React from "react";
import { useAuth } from '../context/AuthContext'; 
import { Loader2 } from "lucide-react"; // Pour l'icône de chargement

/**
 * Composant de route protégée (Authentification SEULEMENT)
 * - Redirige vers /login si l'utilisateur n'est pas connecté ou si le token est manquant.
 * - Affiche les composants enfants via <Outlet /> si l'utilisateur est connecté et le token est présent.
 */
const ProtectedRoute = ({ children }) => {
    // Récupère l'état d'authentification et de chargement
    const { user, loading } = useAuth();
    
    // Récupère le token pour une vérification de sécurité stricte
    const token = localStorage.getItem("token");

    // 1. ⏳ Gestion du chargement
    // Attendre que le contexte ait fini de vérifier la session (loading est à true)
    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <Loader2 className="animate-spin text-blue-500 w-12 h-12 mx-auto mb-4" />
                    <p className="text-lg text-gray-700 font-semibold">
                        Vérification de la session...
                    </p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default ProtectedRoute;