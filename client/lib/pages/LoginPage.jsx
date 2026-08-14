"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiMail, FiLock, FiAlertTriangle, FiEye, FiEyeOff } from 'react-icons/fi';
import { signIn } from 'next-auth/react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api.js';
import { getPostAuthDestination } from '../navigation/postAuthDestination';

const LoginPage = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const router = useRouter();
  const auth   = useAuth();
  const requestedRedirect = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('redirect') : null;
  const safeRedirect = requestedRedirect?.startsWith('/') && !requestedRedirect.startsWith('//') ? requestedRedirect : null;

  // 🔴 Redirection à l'ouverture gérée par PublicAuthRoute.jsx

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
        email:    formData.email.trim().toLowerCase(),
        password: formData.password,
      };
      const response = await api.post('/users/login', payload);
      const user  = response.data?.data?.user;
      const token = response.data?.token;
      if (user && token) {
        auth.login(user, token);
        const targetPath = safeRedirect || getPostAuthDestination(user);
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
    <div
      className="min-h-screen flex"
      style={{
        backgroundImage: "linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.72) 52%), url('https://images.unsplash.com/photo-1643818657367-491080baeece?auto=format&fit=crop&w=1920&q=80')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* ─── Panneau gauche : appel à l'action ─── */}
      <div className="hidden lg:flex flex-col justify-center px-14 xl:px-20 lg:w-[48%] flex-shrink-0">
        <img src="/images/Logo_Altitude1.png" alt="Altimmo" className="w-16 h-16 object-contain mb-8" />
        <span className="text-sm font-semibold tracking-widest uppercase mb-4"
              style={{ color: '#C8960C' }}>Altimmo — Altitude Vision</span>
        <h1 className="text-white text-4xl xl:text-5xl font-bold mb-5 leading-tight"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
          Trouvez votre<br/>bien idéal<br/>au Congo
        </h1>
        <p className="text-white/95 text-base mb-10 leading-relaxed max-w-sm">
          La plateforme immobilière de référence à Brazzaville.
          Des biens vérifiés, des propriétaires sérieux.
        </p>
        <div className="space-y-4">
          {['Annonces vérifiées et certifiées', 'Propriétaires et locataires vérifiés', 'Recherche avancée par quartier et budget'].map(item => (
            <div key={item} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                   style={{ background: '#C8960C' }}>
                <span className="text-white text-xs font-bold">✓</span>
              </div>
              <span className="text-sm" style={{ color: 'rgba(255,255,255,1)' }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Panneau droit : formulaire ─── */}
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">

        {/* Logo mobile (visible < lg) */}
        <div className="lg:hidden flex items-center gap-3 px-6 pt-8 pb-4">
          <img src="/images/Logo_Altitude1.png" alt="Altimmo" className="w-10 h-10 object-contain" />
          <span className="text-white text-xl font-bold"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
            Altimmo
          </span>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-12 sm:px-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="w-full max-w-md"
          >
            {/* Carte verre dépoli */}
            <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-white/30 px-8 py-8">

              {/* En-tête */}
              <div className="mb-7">
                <h1 className="text-3xl font-bold text-gray-900 mb-1.5"
                    style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                  Bon retour
                </h1>
                <p className="text-gray-600 text-sm">
                  Connectez-vous à votre espace Altimmo.
                </p>
              </div>

              {/* Erreur */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 bg-red-50 text-red-700 px-4 py-3 rounded-xl mb-6 border border-red-100"
                >
                  <FiAlertTriangle className="flex-shrink-0 w-4 h-4" />
                  <p className="text-sm font-medium">{error}</p>
                </motion.div>
              )}

              {/* Formulaire */}
              <form className="space-y-5" onSubmit={handleLogin}>
                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Adresse email
                  </label>
                  <div className="relative">
                    <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      id="email" type="email" value={formData.email}
                      onChange={handleChange} placeholder="vous@exemple.com" required
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-white/70
                                 text-gray-900 text-sm focus:outline-none focus:border-yellow-500
                                 focus:ring-2 focus:ring-yellow-500/20 transition-all placeholder-gray-400"
                    />
                  </div>
                </div>

                {/* Mot de passe */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                      Mot de passe
                    </label>
                    <Link href="/forgot-password"
                      className="text-xs text-yellow-600 hover:text-yellow-700 transition-colors">
                      Oublié ?
                    </Link>
                  </div>
                  <div className="relative">
                    <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      id="password" type={showPass ? 'text' : 'password'}
                      value={formData.password} onChange={handleChange}
                      placeholder="Votre mot de passe" required
                      className="w-full pl-10 pr-11 py-3 border border-gray-200 rounded-xl bg-white/70
                                 text-gray-900 text-sm focus:outline-none focus:border-yellow-500
                                 focus:ring-2 focus:ring-yellow-500/20 transition-all placeholder-gray-400"
                    />
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                      {showPass ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* CTA */}
                <button type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-xl font-medium text-sm text-white transition-all
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background:  loading ? '#9CA3AF' : 'linear-gradient(135deg,#A07A0A,#C8960C)',
                    boxShadow:   loading ? 'none'    : '0 4px 20px rgba(200,150,12,0.35)',
                  }}
                >
                  {loading ? 'Connexion en cours…' : 'Se connecter'}
                </button>
              </form>

              {/* Séparateur */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-4 text-gray-500 bg-white">ou continuer avec</span>
                </div>
              </div>

              {/* Google */}
              <button type="button"
                onClick={() => signIn('google', { callbackUrl: safeRedirect || '/auth/google-redirect' })}
                className="w-full flex items-center justify-center gap-3 border border-gray-200
                           rounded-xl py-3 px-4 hover:bg-gray-50 bg-white transition-colors
                           font-medium text-gray-600 text-sm mb-3"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continuer avec Google
              </button>

              <button type="button" disabled
                className="w-full flex items-center justify-center gap-3 border border-gray-100
                           rounded-xl py-3 px-4 text-gray-400 cursor-not-allowed text-sm bg-gray-50"
              >
                📱 Continuer avec mon téléphone
                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded ml-1">Bientôt</span>
              </button>

              {/* Lien inscription */}
              <p className="text-center text-sm text-gray-700 mt-6">
                Pas encore de compte ?{' '}
                <Link href="/register"
                  className="font-semibold text-yellow-600 hover:text-yellow-700 transition-colors">
                  S&apos;inscrire
                </Link>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
