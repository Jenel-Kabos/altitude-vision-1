"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useWriteWindow } from '../hooks/useWriteWindow';

const DEFAULT_AUTH = {
    user: null,
    loading: true,
    isInitialized: false,
    isAuthenticated: false,
    login: () => {},
    logout: () => {},
    updateUser: () => {},
    isAdmin:         false,
    isCollaborateur: false,
    canAdd:          false,
    canEdit:         false,
    canDelete:       false,
    canValidate:     false,
    // Fenêtre d'écriture collaborateur (10 min)
    registerWrite:   () => {},
    canModify:       () => true,
    timeLeft:        () => 0,
    activeWrites:    {},
};

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
    const [user,          setUser]          = useState(null);
    const [loading,       setLoading]       = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);

    const COLLAB_ROLES = ['Collaborateur', 'Secretaire', 'GestionnaireImmobilier', 'CommunityManager', 'Communicant'];
    const isCollab = COLLAB_ROLES.includes(user?.role);
    const { registerWrite, canModify, timeLeft, activeWrites } = useWriteWindow(isCollab);

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

    // ── Expiration silencieuse du token (endpoints de polling) ───
    useEffect(() => {
        const handler = () => {
            tokenExpiredRef.current = true;
            setUser(null);
            setLoading(false);
        };
        window.addEventListener('altimmo:auth:expired', handler);
        return () => window.removeEventListener('altimmo:auth:expired', handler);
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
    // Vide le state local, révoque le cookie de session NextAuth (sinon
    // le bloc de sync Google ci-dessous re-hydrate `user` juste après),
    // et bloque cette re-sync via loggedOutRef.
    const logout = useCallback(async () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setUser(null);
        loggedOutRef.current = true;
        await signOut({ redirect: false });
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

    // ── Sync session Google → localStorage ───────────────────
    const { data: session } = useSession();
    // Flag: empêche la re-sync Google OAuth après expiration silencieuse du token
    const tokenExpiredRef = React.useRef(false);
    // Flag: empêche la re-sync Google OAuth juste après un logout() volontaire
    // (la session NextAuth met un instant à se fermer côté cookie)
    const loggedOutRef = React.useRef(false);

    useEffect(() => {
        if (loggedOutRef.current) return;
        if (session?.accessToken && !user && !tokenExpiredRef.current) {
            const googleUser = {
                _id:             session.user?.id,
                name:            session.user?.name,
                email:           session.user?.email,
                role:            session.user?.role || 'Client',
                photo:           session.user?.image || null,
                isEmailVerified: true,
            };
            localStorage.setItem('token', session.accessToken);
            localStorage.setItem('user',  JSON.stringify(googleUser));
            setUser(googleUser);
        }
    }, [session, user]);

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
        isAdmin:         user?.role === 'Admin',
        isCollaborateur: isCollab,
        canAdd:          ['Admin', ...COLLAB_ROLES].includes(user?.role),
        canEdit:         user?.role === 'Admin',
        canDelete:       user?.role === 'Admin',
        canValidate:     user?.role === 'Admin',
        // Fenêtre d'écriture : 10 min après une création/modification
        registerWrite,
        canModify,
        timeLeft,
        activeWrites,
    }), [user, loading, isInitialized, login, logout, updateUser, registerWrite, canModify, timeLeft, activeWrites]);

    return (
        <AuthContext.Provider value={value}>
            {mounted && loading && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} className="flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                        <p className="text-gray-600">Initialisation...</p>
                    </div>
                </div>
            )}
            {children}
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