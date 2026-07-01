"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiLogIn, FiMail, FiLock, FiAlertTriangle } from 'react-icons/fi';
import { signIn } from 'next-auth/react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api.js';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const auth = useAuth();

  // 🔴 LOGIQUE DE REDIRECTION À L'OUVERTURE SUPPRIMÉE : 
  // Elle est désormais gérée par PublicAuthRoute.jsx, ce qui corrige la boucle infinie.

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      };

      const response = await api.post('/users/login', payload);

      const user = response.data?.data?.user;
      const token = response.data?.token;

      if (user && token) {
        auth.login(user, token);

        // 🟢 Redirection APRES connexion réussie (action unique et sûre)
        const targetPath =
          user.role === 'Admin'        ? '/dashboard'
          : user.role === 'Collaborateur' ? '/dashboard'
          : user.role === 'Proprietaire'  ? '/mes-biens'
          : '/';
        router.replace(targetPath);
      } else {
        setError('Connexion réussie mais impossible de récupérer les informations utilisateur.');
      }
    } catch (err) {
      console.error(err.response?.data || err.message);
      setError(err.response?.data?.message || 'Email ou mot de passe incorrect.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <main className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md p-8 lg:p-10 space-y-8 bg-white rounded-2xl shadow-xl">
          <div className="text-center">
            <FiLogIn className="mx-auto h-12 w-auto text-blue-600" />
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
              Connectez-vous
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Accédez à votre espace personnel.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-3 bg-red-50 text-red-700 p-4 rounded-lg">
              <FiAlertTriangle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="email" className="sr-only">
                Adresse Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                  <FiMail className="h-5 w-5 text-gray-400" />
                </span>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Adresse Email"
                  required
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="sr-only">
                Mot de passe
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                  <FiLock className="h-5 w-5 text-gray-400" />
                </span>
                <input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Mot de passe"
                  required
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900"/>
              </div>
              <Link href="/forgot-password" className="text-xs text-blue-600 hover:underline">
                  Mot de passe oublié ?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-150"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          {/* Séparateur */}
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 text-gray-400 bg-white">ou continuer avec</span>
            </div>
          </div>

          {/* Bouton Google */}
          <button
            type="button"
            onClick={() => signIn('google', { callbackUrl: '/auth/google-redirect' })}
            className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-3 px-4 hover:bg-gray-50 transition-colors font-medium text-gray-700 text-sm"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuer avec Google
          </button>

          {/* Bouton téléphone (bientôt) */}
          <button
            type="button"
            disabled
            className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-lg py-3 px-4 text-gray-400 cursor-not-allowed text-sm mt-2"
          >
            📱 Continuer avec mon téléphone
            <span className="text-xs ml-1 bg-gray-100 px-2 py-0.5 rounded">Bientôt</span>
          </button>

          <p className="text-center text-sm text-gray-600">
            Pas encore de compte ?{' '}
            <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
              Inscrivez-vous
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;