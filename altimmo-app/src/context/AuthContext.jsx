import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Alert } from 'react-native';
import api, { saveToken, getToken, deleteToken, setSessionInvalidatedHandler, clearValidatedPlatformTenant } from '../services/api';
import { enregistrerNotifications, dissocierNotifications } from '../services/notificationsService';
import { disconnectSocket } from '../services/socketService';
import { getEffectiveProfiles } from '../services/userBusinessProfileService';
import { cache } from '../services/cacheService';

const AuthContext = createContext({});

export async function restoreStoredSession({
  getStoredToken = getToken,
  removeStoredToken = deleteToken,
  apiClient = api,
  timeoutMs = 5000,
} = {}) {
  const storedToken = await getStoredToken();
  if (!storedToken) return null;

  let timeoutId;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    });
    const response = await Promise.race([
      apiClient.get('/users/me', {
        headers: { Authorization: `Bearer ${storedToken}` },
      }),
      timeoutPromise,
    ]);
    const user = response.data?.data?.user || response.data?.user || null;
    if (!user) throw new Error('invalid session response');
    return { token: storedToken, user };
  } catch (error) {
    await removeStoredToken();
    // Au redémarrage à froid, une 401 (tokenVersion révoqué) ou 403 (compte
    // suspendu/banni/inactif) sont deux motifs légitimes de refus — dans les
    // deux cas la session locale ne doit jamais être restaurée. Le message
    // serveur est remonté pour affichage, jamais fabriqué côté client.
    return { revoked: true, message: error?.response?.data?.message || null };
  } finally {
    clearTimeout(timeoutId);
  }
}

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true);
  // true entre la création d'un nouveau compte Google et la soumission
  // de CompleterProfilScreen (téléphone, rôle définitif, certifications)
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  // USER-ARCH-UX-1 — même contrat que le contexte web : null = pas encore
  // chargé, [] = chargé sans profil.
  const [businessProfiles, setBusinessProfiles] = useState(null);
  // SYNC-2A — message serveur (ex. « votre compte est suspendu ») affiché
  // une fois par l'écran racine puis effacé ; jamais un logout silencieux.
  const [accountStatusMessage, setAccountStatusMessage] = useState(null);

  useEffect(() => { loadStoredAuth(); }, []);

  useEffect(() => {
    const userId = user?._id || user?.id;
    if (!userId) { setBusinessProfiles(user ? [] : null); return; }
    let cancelled = false;
    getEffectiveProfiles(userId)
      .then((profiles) => { if (!cancelled) setBusinessProfiles(profiles); })
      .catch(() => { if (!cancelled) setBusinessProfiles([]); });
    return () => { cancelled = true; };
  }, [user?._id, user?.id]);
  useEffect(() => {
    setSessionInvalidatedHandler((serverMessage) => {
      disconnectSocket();
      clearValidatedPlatformTenant();
      cache.clear();
      setToken(null);
      setUser(null);
      setNeedsProfileCompletion(false);
      setBusinessProfiles(null);
      if (serverMessage) setAccountStatusMessage(serverMessage);
    });
    return () => setSessionInvalidatedHandler(null);
  }, []);

  const loadStoredAuth = async () => {
    try {
      const session = await restoreStoredSession();
      if (session?.token) {
        setToken(session.token);
        setUser(session.user);
        if (session.user?._id) {
          enregistrerNotifications(session.user._id).catch(() => {});
        }
      } else if (session?.revoked && session.message) {
        setAccountStatusMessage(session.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const token = response.data.token;
      const user = response.data.data?.user || response.data.user;
      cache.clear();
      await saveToken(token);
      setToken(token);
      setUser(user);
      setAccountStatusMessage(null);
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
      const response = await api.post('/auth/google', {
        ...googlePayload, // contient idToken
        role:  googlePayload.role || 'Client',
        phone: googlePayload.phone || null,
      });
      const token     = response.data.token;
      const user      = response.data.data?.user || response.data.user;
      const isNewUser = response.data?.isNewUser ?? false;
      if (!token) throw new Error('Token manquant dans la réponse /auth/google');
      cache.clear();
      await saveToken(token);
      setToken(token);
      setUser(user);
      if (isNewUser) setNeedsProfileCompletion(true);
      enregistrerNotifications(user?._id).catch(() => {});
      return { user, isNewUser };
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
    await dissocierNotifications().catch(() => {});
    await deleteToken();
    disconnectSocket();
    clearValidatedPlatformTenant();
    cache.clear();
    setToken(null);
    setUser(null);
    setNeedsProfileCompletion(false);
    setBusinessProfiles(null);
    setAccountStatusMessage(null);
  };

  const updateUser = (data) => setUser((prev) => ({ ...prev, ...data }));

  // Appelé par CompleterProfilScreen après un PATCH /users/complete-profile
  // réussi — referme l'écran de complétion (AppNavigator bascule sur Main).
  const markProfileCompleted = (updatedUser) => {
    if (updatedUser) updateUser(updatedUser);
    setNeedsProfileCompletion(false);
  };

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
  const hasBusinessProfile = (profileType) => Boolean(businessProfiles?.includes(profileType));

  return (
    <AuthContext.Provider value={{
      user, token, loading, needsProfileCompletion,
      login, loginWithGoogle, register, logout, updateUser, refreshSession, markProfileCompleted,
      accountStatusMessage,
      clearAccountStatusMessage: () => setAccountStatusMessage(null),
      isAdmin:         role === 'admin',
      isCollaborateur: role === 'collaborateur',
      isProprietaire:  role === 'proprietaire',
      canAdd:          ['admin', 'collaborateur', 'proprietaire'].includes(role),
      // USER-ARCH-UX-1 — profils métiers (indépendants de user.role)
      businessProfiles,
      hasBusinessProfile,
      isProprietaireImmobilier:  hasBusinessProfile('proprietaire_immobilier'),
      isExploitantEtablissement: hasBusinessProfile('exploitant_etablissement'),
      isLocataireProfile:        hasBusinessProfile('locataire'),
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
