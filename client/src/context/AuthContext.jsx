import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user,          setUser]          = useState(null);
    const [loading,       setLoading]       = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);

    // ── Initialisation depuis localStorage ───────────────────
    useEffect(() => {
        let isMounted = true;

        const initializeAuth = () => {
            try {
                const storedUser  = localStorage.getItem('user');
                const storedToken = localStorage.getItem('token');

                console.log("🔍 Vérification de la session existante...");
                console.log("   Token présent:", !!storedToken);
                console.log("   User présent:",  !!storedUser);

                if (storedUser && storedToken) {
                    const parsedUser = JSON.parse(storedUser);
                    setUser(parsedUser);
                    console.log("✅ Session restaurée:", parsedUser.email);
                } else {
                    console.log("ℹ️ Aucune session existante");
                }
            } catch (error) {
                console.error("❌ Erreur restauration session:", error);
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

        initializeAuth();
        return () => { isMounted = false; };
    }, []);

    // ── Login (connexion initiale ou après changement de mot de passe) ──
    // 🔧 Ne doit PAS être appelé après updateMe — utiliser updateUser à la place
    const login = useCallback((userData, token) => {
        console.log("🔓 Connexion en cours...", userData?.email);

        if (!token) {
            console.error("❌ Token manquant lors de la connexion");
            throw new Error("Token manquant");
        }
        if (!userData) {
            console.error("❌ Données utilisateur manquantes");
            throw new Error("Données utilisateur manquantes");
        }

        localStorage.setItem('user',  JSON.stringify(userData));
        localStorage.setItem('token', token);
        setUser(userData);

        console.log("✅ Connexion réussie");
    }, []);

    // ── Logout ────────────────────────────────────────────────
    const logout = useCallback(() => {
        console.log("🚪 Déconnexion...");
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setUser(null);
        console.log("✅ Session nettoyée");
    }, []);

    // ── updateUser : merge partiel des données ────────────────
    // 🔧 À utiliser après updateMe pour ne pas perdre les champs existants
    //    (notamment photo, phone, etc.)
    const updateUser = useCallback((updatedData) => {
        console.log("🔄 Mise à jour utilisateur:", Object.keys(updatedData).join(', '));

        setUser(prev => {
            // 🔧 Merge : on garde tout l'ancien user et on écrase seulement
            //    les champs retournés par le backend
            const merged = { ...prev, ...updatedData };

            // 🔧 Si le backend renvoie photo: null explicitement (removePhoto),
            //    on respecte ça — sinon on garde l'ancienne photo
            if (updatedData.photo === undefined) {
                merged.photo = prev?.photo ?? null;
            }

            localStorage.setItem('user', JSON.stringify(merged));
            console.log("✅ User mis à jour — photo:", merged.photo ?? 'aucune');
            return merged;
        });
    }, []);

    const value = useMemo(() => ({
        user,
        loading,
        isInitialized,
        isAuthenticated: !!user,
        login,
        logout,
        updateUser,
    }), [user, loading, isInitialized, login, logout, updateUser]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
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

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth doit être utilisé à l'intérieur d'un AuthProvider");
    }
    return context;
};