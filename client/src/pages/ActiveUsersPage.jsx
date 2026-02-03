// src/pages/ActiveUsersPage.jsx (NOUVEAU FICHIER)
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import { RotateCcw, Ban } from 'lucide-react'; 

const BASE_API_URL = 'http://localhost:5000/api/admin/owners'; 

const ActiveUsersPage = () => {
    const [activeUsers, setActiveUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchActiveUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${BASE_API_URL}/active-sessions`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setActiveUsers(res.data.data.activeUsers);
        } catch (err) {
            setError(err.response?.data?.message || 'Erreur lors du chargement des sessions actives.');
            toast.error('Erreur de chargement des sessions.');
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchActiveUsers();
    }, []);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchActiveUsers();
    };

    const handleBan = async (userId, userName) => {
        if (!window.confirm(`Êtes-vous sûr de vouloir BANNIR et déconnecter ${userName} ? Cette action invalide immédiatement tous ses tokens.`)) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            // Appel à la nouvelle route de bannissement
            await axios.patch(`${BASE_API_URL}/${userId}/ban`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });

            toast.success(`L'utilisateur ${userName} a été banni et déconnecté.`);
            
            // Recharger la liste pour refléter le changement de statut/déconnexion
            fetchActiveUsers(); 

        } catch (err) {
            toast.error(err.response?.data?.message || `Erreur lors du bannissement de ${userName}.`);
        }
    };

    const timeSince = (date) => {
        if (!date) return 'Jamais';
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        let interval = seconds / 31536000;
        
        if (interval > 1) return Math.floor(interval) + ' ans';
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + ' mois';
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + ' jours';
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + ' heures';
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + ' minutes';
        return Math.floor(seconds) + ' secondes';
    };


    if (loading) return <p className="text-center py-4">Chargement des sessions...</p>;
    if (error) return <p className="text-center text-red-500 py-4">{error}</p>;

    return (
        <div className="p-6 bg-white rounded-lg shadow">
            <ToastContainer />
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Sessions Actives ({activeUsers.length})</h1>
                <button
                    onClick={handleRefresh}
                    className={`flex items-center gap-2 bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isRefreshing}
                >
                    <RotateCcw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                    Rafraîchir
                </button>
            </div>

            {activeUsers.length === 0 ? (
                <p className="text-gray-500 italic">Aucune session active détectée (dernières 5 minutes).</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full table-auto border border-gray-200">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="px-4 py-2 border text-left">Utilisateur</th>
                                <th className="px-4 py-2 border text-left">Rôle</th>
                                <th className="px-4 py-2 border text-left">Dernière activité (il y a)</th>
                                <th className="px-4 py-2 border">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeUsers.map((user) => (
                                <tr key={user._id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 border">{user.name} ({user.email})</td>
                                    <td className="px-4 py-2 border">{user.role}</td>
                                    <td className="px-4 py-2 border">
                                        {timeSince(user.lastActivityAt)}
                                    </td>
                                    <td className="px-4 py-2 border text-center">
                                        <button
                                            onClick={() => handleBan(user._id, user.name)}
                                            className="flex items-center justify-center mx-auto bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm"
                                        >
                                            <Ban size={14} className="mr-1" /> Bannir & Déconnecter
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ActiveUsersPage;