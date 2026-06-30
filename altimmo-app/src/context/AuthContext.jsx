import React, { createContext, useContext, useState, useEffect } from 'react';
import api, { saveToken, getToken, deleteToken } from '../services/api';
import { enregistrerNotifications } from '../services/notificationsService';

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
      console.log('Login attempt:', email);
      const response = await api.post('/auth/login', { email, password });
      console.log('Login response:', response.data);
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
      throw error;
    }
  };

  const logout = async () => {
    await deleteToken();
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

  const role = user?.role?.toLowerCase();

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
