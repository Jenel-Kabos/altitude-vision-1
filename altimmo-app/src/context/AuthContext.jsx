import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStoredAuth(); }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
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
        setUser(response.data?.data?.user || response.data?.user || null);
      }
    } catch (error) {
      console.log('Auth load error:', error.message);
      await AsyncStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await api.post('/users/login', { email, password });
    const t = res.data?.token;
    const u = res.data?.data?.user || res.data?.user;
    await AsyncStorage.setItem('token', t);
    setToken(t);
    setUser(u);
    return u;
  };

  const register = async (userData) => {
    const res = await api.post('/users/signup', userData);
    return res.data;
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const updateUser = (data) => setUser((prev) => ({ ...prev, ...data }));

  const role = user?.role?.toLowerCase();

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, register, logout, updateUser,
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
