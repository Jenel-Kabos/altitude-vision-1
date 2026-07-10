import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Alert } from 'react-native';
import api, { saveToken, getToken, deleteToken } from '../services/api';
import { enregistrerNotifications } from '../services/notificationsService';
import { disconnectSocket } from '../services/socketService';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStoredAuth(); }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await getToken();
      if (storedToken) {
        setToken(storedToken);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 5000)
        );
        const response = await Promise.race([
          api.get('/users/me', {
            headers: { Authorization: `Bearer ${storedToken}` },
          }),
          timeoutPromise,
        ]);
        const loadedUser = response.data?.data?.user || response.data?.user || null;
        setUser(loadedUser);
        if (loadedUser?._id) {
          enregistrerNotifications(loadedUser._id).catch(() => {});
        }
      }
    } catch (error) {
      await deleteToken();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const token = response.data.token;
      const user = response.data.data?.user || response.data.user;
      await saveToken(token);
      setToken(token);
      setUser(user);
      enregistrerNotifications(user?._id).catch(() => {});
      return user;
    } catch (error) {
      throw error;
    }
  };

  const register = async (userData) => {
    const res = await api.post('/auth/signup', userData);
    return res.data;
  };

  const loginWithGoogle = async (googlePayload) => {
    try {
      const response = await api.post('/auth/google', googlePayload);
      const token = response.data.token;
      const user  = response.data.data?.user || response.data.user;
      if (!token) throw new Error('Token manquant dans la réponse /auth/google');
      await saveToken(token);
      setToken(token);
      setUser(user);
      enregistrerNotifications(user?._id).catch(() => {});
      return user;
    } catch (error) {
      const code = error?.code || error?.message || '';
      if (
        code.includes('SIGN_IN_CANCELLED') ||
        code === 'ERR_CANCELED' ||
        code.includes('cancel')
      ) {
        return; // Utilisateur a annulé — silencieux
      }
      if (code.includes('IN_PROGRESS')) {
        return; // Déjà en cours — silencieux
      }
      if (code.includes('PLAY_SERVICES_NOT_AVAILABLE')) {
        Alert.alert(
          'Google Play Services requis',
          'Veuillez mettre à jour Google Play Services sur votre appareil.'
        );
        return;
      }
      Alert.alert(
        'Connexion Google échouée',
        'Impossible de se connecter avec Google. Utilisez votre email et mot de passe.'
      );
    }
  };

  const logout = async () => {
    await deleteToken();
    disconnectSocket();
    setToken(null);
    setUser(null);
  };

  const updateUser = (data) => setUser((prev) => ({ ...prev, ...data }));

  const refreshSession = async (newToken, updatedUser) => {
    if (newToken) {
      await saveToken(newToken);
      setToken(newToken);
    }
    if (updatedUser) {
      setUser((prev) => ({ ...prev, ...updatedUser }));
    }
  };

  const role = useMemo(() => user?.role?.toLowerCase(), [user?.role]);

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, loginWithGoogle, register, logout, updateUser, refreshSession,
      isAdmin:         role === 'admin',
      isCollaborateur: role === 'collaborateur',
      isProprietaire:  role === 'proprietaire',
      canAdd:          ['admin', 'collaborateur', 'proprietaire'].includes(role),
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
