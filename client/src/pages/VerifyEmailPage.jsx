import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const VerifyEmailPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [status, setStatus] = useState('loading');
  const hasVerified = useRef(false); // ✅ Empêche le double appel

  useEffect(() => {
    if (hasVerified.current) return; // Si déjà appelé, on stoppe
    hasVerified.current = true;

    const verify = async () => {
      try {
        const { data } = await api.get(`/users/verify-email/${token}`);

        if (data.token && data.data?.user) {
          auth.login(data.data.user, data.token);
          setStatus('success');

          // Redirection selon le rôle
          setTimeout(() => {
            const role = data.data.user.role;
            const redirect =
              role === 'Admin' ? '/dashboard' :
              role === 'Proprietaire' ? '/dashboard' :
              '/';
            navigate(redirect);
          }, 3000);
        } else {
          setStatus('error');
        }
      } catch (error) {
        console.error('❌ [VerifyEmail] Erreur:', error);
        setStatus('error');
      }
    };

    verify();
  }, [token]); // ← Retiré auth et navigate des dépendances pour éviter re-render

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
      <div className="bg-white p-10 rounded-3xl shadow-2xl text-center max-w-md w-full">

        {status === 'loading' && (
          <>
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-100 border-t-blue-600"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Vérification en cours...</h2>
            <p className="text-gray-500 text-sm">Validation de votre adresse email</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Email vérifié ! 🎉</h2>
            <p className="text-gray-500 mb-6">
              Votre compte est activé. Vous allez être redirigé automatiquement...
            </p>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className="bg-green-500 h-1.5 rounded-full animate-pulse" style={{ width: '100%' }}></div>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Lien invalide</h2>
            <p className="text-gray-500 mb-6">
              Ce lien de vérification est invalide ou a expiré.<br />
              Connectez-vous pour en recevoir un nouveau.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => navigate('/login')}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition"
              >
                Se connecter
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition"
              >
                Accueil
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailPage;