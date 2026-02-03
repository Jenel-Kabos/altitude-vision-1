import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiLogIn, FiMail, FiLock, FiAlertTriangle } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
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
          user.role === 'Admin'
            ? '/dashboard'
            : user.role === 'Propriétaire'
            ? '/mes-biens'
            : '/';
        navigate(targetPath, { replace: true });
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
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
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
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-150"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600">
            Pas encore de compte ?{' '}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
              Inscrivez-vous
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;