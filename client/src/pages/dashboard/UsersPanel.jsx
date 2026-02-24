// src/pages/dashboard/UsersPanel.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://altitude-vision.onrender.com/api';

const UsersPanel = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  const ENDPOINT = `${API_URL}/admin/owners`;

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(ENDPOINT, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data.data.owners || res.data.data.users || []);
      setError(null);
    } catch (err) {
      console.error('Erreur fetch users:', err);
      setError('Impossible de charger les utilisateurs.');
      toast.error('Erreur connexion serveur.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAction = async (userId, action) => {
    try {
      const token = localStorage.getItem('token');
      let url = `${ENDPOINT}/${userId}`;
      let method = 'patch';
      let successMessage = '';

      switch (action) {
        case 'verify':   url += '/verify';   successMessage = '✅ Propriétaire vérifié !'; break;
        case 'suspend':  url += '/suspend';  successMessage = '⚠️ Compte suspendu !'; break;
        case 'activate': url += '/activate'; successMessage = '✅ Compte réactivé !'; break;
        case 'delete':   method = 'delete';  successMessage = '🗑️ Utilisateur supprimé !'; break;
        default: return;
      }

      const res = await axios({
        url, method, data: {},
        headers: { Authorization: `Bearer ${token}` },
      });

      if (action === 'delete') {
        setUsers(users.filter((u) => u._id !== userId));
      } else {
        setUsers(users.map((u) => (u._id === userId ? res.data.data.user || res.data.data.owner : u)));
      }
      toast.success(successMessage);
      setSelectedUser(null);
    } catch (err) {
      console.error('Erreur action:', err);
      toast.error("Erreur lors de l'action.");
      setSelectedUser(null);
    }
  };

  const getStatusBadge = (user) => {
    const status = user.status || 'Actif';
    const styles = {
      'Actif':    'bg-green-100 text-green-800',
      'Suspendu': 'bg-yellow-100 text-yellow-800',
      'Banni':    'bg-red-100 text-red-800',
      'Supprimé': 'bg-gray-100 text-gray-500',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    );
  };

  const getVerifiedBadge = (user) => {
    return user.isVerified ? (
      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">✔ Vérifié</span>
    ) : (
      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">Non vérifié</span>
    );
  };

  if (loading) return (
    <div className="flex items-center justify-center p-16">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-gray-500">Chargement des utilisateurs...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="p-6 text-center text-red-500 bg-red-50 rounded-xl m-6">{error}</div>
  );

  return (
    <div className="p-6">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Propriétaires</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length} propriétaire(s) enregistré(s)</p>
        </div>
        <button
          onClick={fetchUsers}
          className="text-sm text-blue-600 hover:text-blue-700 font-semibold border border-blue-200 px-4 py-2 rounded-lg hover:bg-blue-50 transition"
        >
          🔄 Actualiser
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nom</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">KYC</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map((user) => (
              <tr key={user._id} className="hover:bg-gray-50 transition">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-700 text-sm font-bold">
                        {user.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="font-medium text-gray-900">{user.name}</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-sm text-gray-600">{user.email}</td>
                <td className="px-5 py-4">{getStatusBadge(user)}</td>
                <td className="px-5 py-4">{getVerifiedBadge(user)}</td>
                <td className="px-5 py-4">
                  <div className="flex gap-2 flex-wrap">
                    {/* ✅ Bouton Vérifier KYC — basé sur isVerified */}
                    {!user.isVerified && (
                      <button
                        onClick={() => setSelectedUser({ ...user, actionType: 'verify' })}
                        className="text-blue-600 hover:bg-blue-50 px-3 py-1 rounded-lg text-xs font-semibold border border-blue-200 transition"
                      >
                        Vérifier
                      </button>
                    )}

                    {/* ✅ Bouton Suspendre/Réactiver — basé sur status */}
                    {user.status === 'Actif' ? (
                      <button
                        onClick={() => setSelectedUser({ ...user, actionType: 'suspend' })}
                        className="text-yellow-600 hover:bg-yellow-50 px-3 py-1 rounded-lg text-xs font-semibold border border-yellow-200 transition"
                      >
                        Suspendre
                      </button>
                    ) : (
                      <button
                        onClick={() => setSelectedUser({ ...user, actionType: 'activate' })}
                        className="text-green-600 hover:bg-green-50 px-3 py-1 rounded-lg text-xs font-semibold border border-green-200 transition"
                      >
                        Réactiver
                      </button>
                    )}

                    {/* 🗑️ Bouton Supprimer */}
                    <button
                      onClick={() => setSelectedUser({ ...user, actionType: 'delete' })}
                      className="text-red-600 hover:bg-red-50 px-3 py-1 rounded-lg text-xs font-semibold border border-red-200 transition"
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="p-10 text-center text-gray-400">
            <p className="text-lg font-semibold">Aucun propriétaire trouvé</p>
            <p className="text-sm mt-1">Les propriétaires enregistrés apparaîtront ici</p>
          </div>
        )}
      </div>

      {/* Modal de confirmation */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-96 mx-4">
            <h3 className="font-bold text-lg mb-2 text-gray-900">Confirmer l'action</h3>
            <p className="mb-1 text-gray-600">
              Action : <span className="font-semibold capitalize">{selectedUser.actionType}</span>
            </p>
            <p className="mb-5 text-gray-600">
              Utilisateur : <span className="font-semibold">{selectedUser.name}</span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-semibold transition"
              >
                Annuler
              </button>
              <button
                onClick={() => handleAction(selectedUser._id, selectedUser.actionType)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPanel;