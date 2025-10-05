import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const RegisterPage = () => {
  // États pour les champs du formulaire
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('Client'); // Rôle par défaut

  // États pour la gestion de la soumission
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { userInfo, login } = useAuth();

  // Si l'utilisateur est déjà connecté, le rediriger vers le tableau de bord
  useEffect(() => {
    if (userInfo) {
      navigate('/dashboard');
    }
  }, [navigate, userInfo]);

  const submitHandler = async (e) => {
    e.preventDefault();
    
    // Validation côté client
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const config = {
        headers: { 'Content-Type': 'application/json' },
      };

      const { data } = await axios.post(
        'http://localhost:5000/api/users/register',
        { name, email, password, role },
        config
      );

      // Connecter automatiquement l'utilisateur après l'inscription
      login(data);
      setLoading(false);
      navigate('/dashboard'); // Rediriger vers le tableau de bord

    } catch (err) {
      setError(err.response?.data?.message || 'Une erreur est survenue lors de l\'inscription.');
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto flex justify-center items-center py-12 px-4">
      <div className="w-full max-w-md">
        <form onSubmit={submitHandler} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
          <h1 className="text-3xl font-bold text-center text-primary mb-6">Créer un Compte</h1>
          
          {error && <p className="bg-red-100 text-red-700 p-3 rounded mb-4 text-center">{error}</p>}
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
              Nom complet
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="name" type="text" placeholder="John Doe" value={name}
              onChange={(e) => setName(e.target.value)} required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
              Adresse Email
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="email" type="email" placeholder="email@exemple.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
              Mot de passe
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
              id="password" type="password" placeholder="******************" value={password}
              onChange={(e) => setPassword(e.target.value)} required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="confirmPassword">
              Confirmer le mot de passe
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
              id="confirmPassword" type="password" placeholder="******************" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="role">
              Je suis un
            </label>
            <select
              id="role"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="Client">Client</option>
              <option value="Propriétaire">Propriétaire</option>
              <option value="Prestataire">Prestataire</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <button
              className="bg-primary hover:bg-blue-800 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full disabled:bg-gray-400"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Inscription en cours...' : 'S\'inscrire'}
            </button>
          </div>
          
          <p className="text-center text-gray-600 text-sm mt-6">
            Vous avez déjà un compte ?{' '}
            <Link to="/login" className="font-bold text-primary hover:text-blue-800">
              Se connecter
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;