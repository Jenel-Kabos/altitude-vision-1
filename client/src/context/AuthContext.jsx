import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

// Créer le contexte
const AuthContext = createContext();

// Le "Provider" qui enveloppe votre application
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);

    // ⭐ CORRECTION : Initialisation synchrone du contexte
    useEffect(() => {
        let isMounted = true;
        
        const initializeAuth = () => {
            try {
                const storedUser = localStorage.getItem('user');
                const storedToken = localStorage.getItem('token');
                
                console.log("🔍 Vérification de la session existante...");
                console.log("   Token présent:", !!storedToken);
                console.log("   User présent:", !!storedUser);
                
                if (storedUser && storedToken) {
                    const parsedUser = JSON.parse(storedUser);
                    setUser(parsedUser);
                    console.log("✅ Session restaurée:", parsedUser.email);
                } else {
                    console.log("ℹ️ Aucune session existante");
                }
            } catch (error) {
                console.error("❌ Erreur lors de la restauration de la session:", error);
                // En cas d'erreur, nettoyer le localStorage corrompu
                localStorage.removeItem('user');
                localStorage.removeItem('token');
            } finally {
                if (isMounted) {
                    setLoading(false);
                    setIsInitialized(true);
                    console.log("✅ AuthContext initialisé");
                }
            }
        };

        // Exécuter immédiatement (pas de setTimeout)
        initializeAuth();

        return () => {
            isMounted = false;
        };
    }, []);

    // ⭐ Fonction login avec logs détaillés
    const login = useCallback((userData, token) => {
        console.log("🔓 Connexion en cours...");
        console.log("   Utilisateur:", userData.email);
        console.log("   Token reçu:", token ? "✓" : "✗");
        
        if (!token) {
            console.error("❌ Erreur: Token manquant lors de la connexion");
            throw new Error("Token manquant");
        }

        if (!userData) {
            console.error("❌ Erreur: Données utilisateur manquantes lors de la connexion");
            throw new Error("Données utilisateur manquantes");
        }

        // Sauvegarder dans localStorage
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', token);
        
        // Mettre à jour l'état
        setUser(userData);
        
        console.log("✅ Connexion réussie - Token et utilisateur sauvegardés");
        console.log("   localStorage token:", localStorage.getItem('token') ? "✓" : "✗");
    }, []);

    // ⭐ Fonction logout avec logs détaillés
    const logout = useCallback(() => {
        console.log("🚪 Déconnexion en cours...");
        
        // Nettoyer localStorage
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        
        // Nettoyer l'état
        setUser(null);
        
        console.log("✅ Déconnexion réussie - Session nettoyée");
    }, []);

    // ⭐ Fonction pour mettre à jour l'utilisateur
    const updateUser = useCallback((updatedData) => {
        console.log("🔄 Mise à jour des données utilisateur...");
        
        const updatedUser = { ...user, ...updatedData };
        
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        
        console.log("✅ Données utilisateur mises à jour");
    }, [user]);

    // Mémorisation de l'objet de valeur du contexte
    const value = useMemo(() => ({
        user,
        loading,
        isInitialized,
        isAuthenticated: !!user,
        login,
        logout,
        updateUser
    }), [user, loading, isInitialized, login, logout, updateUser]);

    // ⭐ Ne rendre les enfants que lorsque le contexte est initialisé
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Initialisation...</p>
                </div>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// Le "Hook" personnalisé pour utiliser le contexte facilement
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth doit être utilisé à l'intérieur d'un AuthProvider");
    }
    return context;
};