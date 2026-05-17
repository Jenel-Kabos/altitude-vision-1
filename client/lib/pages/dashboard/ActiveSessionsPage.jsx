"use client";

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ShieldCheck, User, Trash2, Globe, Clock, Mail } from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// ✅ URL de l'API (Prod ou Dev)
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://altitude-vision.onrender.com/api';

const ActiveSessionsPage = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 🔄 Récupérer les utilisateurs actifs
  const fetchActiveSessions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      // Appel à la route que nous avons créée dans adminRoutes.js
      const res = await axios.get(`${API_URL}/admin/owners/active-sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Le backend renvoie { data: { activeUsers: [...] } }
      setSessions(res.data.data.activeUsers || []);
      setError(null);
    } catch (err) {
      console.error("Erreur fetch sessions:", err);
      setError("Impossible de charger les sessions actives.");
      toast.error("Erreur lors du chargement des utilisateurs connectés.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveSessions();
    
    // Optionnel : Rafraîchir toutes les 30 secondes pour voir le temps réel
    const interval = setInterval(fetchActiveSessions, 30000);
    return () => clearInterval(interval);
  }, []);

  // 🚫 Révoquer (Forcer la déconnexion)
  const handleRevokeSession = async (userId, userName) => {
    if (!window.confirm(`Voulez-vous vraiment déconnecter de force ${userName} ?`)) return;

    try {
      const token = localStorage.getItem('token');
      // On utilise la route "ban" ou "suspend" pour invalider le token de l'utilisateur
      await axios.patch(`${API_URL}/admin/owners/${userId}/suspend`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(`${userName} a été déconnecté avec succès.`);
      // Mise à jour locale de la liste
      setSessions(sessions.filter(s => s._id !== userId));

    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la révocation de la session.");
    }
  };

  // 🕒 Formattage de la date (ex: "Il y a 5 min")
  const formatLastActive = (dateString) => {
    if (!dateString) return 'Inconnu';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    const diffHours = Math.round(diffMins / 60);
    return `Il y a ${diffHours} h`;
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg h-full min-h-[80vh]">
      <header className="mb-8 flex items-center gap-3 border-b pb-4">
        <ShieldCheck size={32} className="text-green-600" />
        <div>
          <h1 className="text-3xl font-extrabold text-gray-800">Utilisateurs Actifs</h1>
          <p className="text-sm text-gray-500">Temps réel (Activité &lt; 5 min)</p>
        </div>
      </header>
      
      <p className="text-gray-600 mb-6">
        Voici la liste des utilisateurs connectés sur la plateforme en ce moment. Vous pouvez révoquer leur accès immédiatement en cas d'activité suspecte.
      </p>

      {loading ? (
        <div className="text-center py-10 text-gray-500 animate-pulse">Chargement des sessions...</div>
      ) : error ? (
        <div className="text-center py-10 text-red-500">{error}</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <Globe className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p className="text-gray-500 font-medium">Aucun autre utilisateur actif pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <div 
              key={session._id} 
              className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 rounded-xl border bg-white hover:shadow-md transition-shadow border-gray-200"
            >
              <div className="flex items-center space-x-4">
                <div className="bg-blue-100 p-3 rounded-full">
                    <User size={24} className="text-blue-600" />
                </div>
                
                <div>
                  <p className="font-semibold text-lg flex items-center gap-2">
                    {session.name}
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        session.role === 'Admin' ? 'bg-purple-100 text-purple-700 border-purple-200' : 
                        session.role === 'Propriétaire' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                        'bg-gray-100 text-gray-700 border-gray-200'
                    }`}>
                        {session.role}
                    </span>
                  </p>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center text-sm text-gray-600 gap-y-1 sm:gap-x-4 mt-1">
                    <span className="flex items-center gap-1">
                        <Mail size={14} /> {session.email}
                    </span>
                    <span className="flex items-center gap-1 text-green-600 font-medium">
                        <Clock size={14} /> Actif: {formatLastActive(session.lastActivityAt)}
                    </span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => handleRevokeSession(session._id, session.name)}
                className="mt-4 md:mt-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition duration-200 text-sm font-medium"
              >
                <Trash2 size={16} /> 
                Déconnecter
              </button>
            </div>
          ))}
        </div>
      )}

      <footer className="mt-8 pt-4 border-t text-xs text-gray-400 italic">
        <p>
          * Cette vue affiche les utilisateurs ayant effectué une action sur le serveur lors des 5 dernières minutes. La révocation invalide leur session immédiatement.
        </p>
      </footer>
    </div>
  );
};

export default ActiveSessionsPage;