import React, { createContext, useState, useContext, useEffect } from 'react';

// 1. Créer le contexte
const AuthContext = createContext();

// 2. Créer le Fournisseur (Provider)
export const AuthProvider = ({ children }) => {
  const [userInfo, setUserInfo] = useState(null);

  // Au chargement, vérifier si l'info utilisateur est dans le localStorage
  useEffect(() => {
    const storedUserInfo = localStorage.getItem('userInfo');
    if (storedUserInfo) {
      setUserInfo(JSON.parse(storedUserInfo));
    }
  }, []);

  // Fonction de connexion
  const login = (userData) => {
    setUserInfo(userData);
    localStorage.setItem('userInfo', JSON.stringify(userData));
  };

  // Fonction de déconnexion
  const logout = () => {
    setUserInfo(null);
    localStorage.removeItem('userInfo');
  };

  return (
    <AuthContext.Provider value={{ userInfo, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// 3. Créer un hook personnalisé pour utiliser le contexte facilement
export const useAuth = () => {
  return useContext(AuthContext);
};