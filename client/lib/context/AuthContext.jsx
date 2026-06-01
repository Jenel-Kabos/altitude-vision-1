"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

const DEFAULT_AUTH = {
    user: null,
    loading: true,
    isInitialized: false,
    isAuthenticated: false,
    login: () => {},
    logout: () => {},
    updateUser: () => {},
};

const AuthContext = createContext(undefined);

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


                if (storedUser && storedToken) {
                    const parsedUser = JSON.parse(storedUser);
                    setUser(parsedUser);
                } else {
                }
            } catch (error) {
                console.error("❌ Erreur restauration session:", error);
                localStorage.removeItem('user');
                localStorage.removeItem('token');
            } finally {
                if (isMounted) {
                    setLoading(false);
                    setIsInitialized(true);
                }
            }
        };

        initializeAuth();
        return () => { isMounted = false; };
    }, []);

    // ── Login (connexion initiale ou après changement de mot de passe) ──
    // 🔧 Ne doit PAS être appelé après updateMe — utiliser updateUser à la place
    const login = useCallback((userData, token) => {

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

    }, []);

    // ── Logout ────────────────────────────────────────────────
    const logout = useCallback(() => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setUser(null);
    }, []);

    // ── updateUser : merge partiel des données ────────────────
    // 🔧 À utiliser après updateMe pour ne pas perdre les champs existants
    //    (notamment photo, phone, etc.)
    const updateUser = useCallback((updatedData) => {

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
            return merged;
        });
    }, []);

    // Prevents hydration mismatch: Next.js RSC renders the layout in the HTML,
    // but loading=true would render a spinner client-side — causing a fatal mismatch.
    // The mounted flag defers the spinner until after hydration completes.
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const value = useMemo(() => ({
        user,
        loading,
        isInitialized,
        isAuthenticated: !!user,
        login,
        logout,
        updateUser,
    }), [user, loading, isInitialized, login, logout, updateUser]);

    return (
        <AuthContext.Provider value={value}>
            {mounted && loading ? (
                <div className="flex items-center justify-center min-h-screen bg-gray-50">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                        <p className="text-gray-600">Initialisation...</p>
                    </div>
                </div>
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        if (typeof window === 'undefined') {
            return DEFAULT_AUTH;
        }
        throw new Error("useAuth doit être utilisé à l'intérieur d'un AuthProvider");
    }
    return context;
};