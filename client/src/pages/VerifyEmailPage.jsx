import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const VerifyEmailPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [status, setStatus] = useState('loading'); // loading, success, error

  useEffect(() => {
    const verify = async () => {
      try {
        const { data } = await api.get(`/users/verify-email/${token}`);
        // Si succès, on connecte l'utilisateur
        if (data.token) {
           auth.login(data.data.user, data.token);
           setStatus('success');
           setTimeout(() => navigate('/dashboard'), 3000); // Redirection après 3s
        }
      } catch (error) {
        setStatus('error');
      }
    };
    verify();
  }, [token, navigate, auth]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-lg shadow-xl text-center max-w-md w-full">
        {status === 'loading' && (
           <>
             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
             <p>Vérification de votre email en cours...</p>
           </>
        )}
        
        {status === 'success' && (
           <>
             <div className="text-green-500 text-5xl mb-4">✅</div>
             <h2 className="text-2xl font-bold mb-2">Email vérifié !</h2>
             <p>Votre compte est activé. Redirection en cours...</p>
           </>
        )}

        {status === 'error' && (
           <>
             <div className="text-red-500 text-5xl mb-4">❌</div>
             <h2 className="text-2xl font-bold mb-2">Lien invalide</h2>
             <p>Ce lien est invalide ou a expiré.</p>
             <button onClick={() => navigate('/login')} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded">
               Retour à la connexion
             </button>
           </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailPage;