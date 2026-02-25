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
  const [actionLoading, setActionLoading] = useState(false);

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
    setActionLoading(true);
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

      await axios({
        url, method, data: {},
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success(successMessage);
      setSelectedUser(null);

      // ✅ Refetch complet pour avoir les données à jour
      await fetchUsers();

    } catch (err) {
      console.error('Erreur action:', err);
      toast.error(err.response?.data?.message || "Erreur lors de l'action.");
      setSelectedUser(null);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (user) => {
    const status = user.status || 'Actif';
    const styles = {
      'Actif':    'bg-green-100 text-green-800',
      'active':   'bg-green-100 text-green-800',
      'Suspendu': 'bg-yellow-100 text-yellow-800',
      'Banni':    'bg-red-100 text-red-800',
      'Supprimé': 'bg-gray-100 text-gray-500',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
        {status === 'active' ? 'Actif' : status}
      </span>
    );
  };

  const getVerifiedBadge = (user) => {
    return user.isVerified ? (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Vérifié
      </span>
    ) : (
      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
        Non vérifié
      </span>
    );
  };

  const getActionLabel = (action) => {
    const labels = {
      verify:   'Vérifier le KYC',
      suspend:  'Suspendre le compte',
      activate: 'Réactiver le compte',
      delete:   "Supprimer l'utilisateur",
    };
    return labels[action] || action;
  };

  const getActionColor = (action) => {
    const colors = {
      verify:   'bg-blue-600 hover:bg-blue-700',
      suspend:  'bg-yellow-500 hover:bg-yellow-600',
      activate: 'bg-green-600 hover:bg-green-700',
      delete:   'bg-red-600 hover:bg-red-700',
    };
    return colors[action] || 'bg-blue-600 hover:bg-blue-700';
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

      {/* Header */}
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

      {/* Table */}
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
            {users.map((user) => {
              const status = user.status || 'Actif';
              const isActive = status === 'Actif' || status === 'active';

              return (
                <tr key={user._id} className="hover:bg-gray-50 transition">

                  {/* Nom */}
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

                  {/* Email */}
                  <td className="px-5 py-4 text-sm text-gray-600">{user.email}</td>

                  {/* Statut */}
                  <td className="px-5 py-4">{getStatusBadge(user)}</td>

                  {/* KYC */}
                  <td className="px-5 py-4">{getVerifiedBadge(user)}</td>

                  {/* Actions */}
                  <td className="px-5 py-4">
                    <div className="flex gap-2 flex-wrap">

                      {/* Vérifier KYC */}
                      {!user.isVerified && (
                        <button
                          onClick={() => setSelectedUser({ ...user, actionType: 'verify' })}
                          className="text-blue-600 hover:bg-blue-50 px-3 py-1 rounded-lg text-xs font-semibold border border-blue-200 transition"
                        >
                          Vérifier
                        </button>
                      )}

                      {/* Suspendre / Réactiver */}
                      {isActive ? (
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

                      {/* Supprimer */}
                      <button
                        onClick={() => setSelectedUser({ ...user, actionType: 'delete' })}
                        className="text-red-600 hover:bg-red-50 px-3 py-1 rounded-lg text-xs font-semibold border border-red-200 transition"
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
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

            {/* Icône selon l'action */}
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
              selectedUser.actionType === 'delete'   ? 'bg-red-100' :
              selectedUser.actionType === 'suspend'  ? 'bg-yellow-100' :
              selectedUser.actionType === 'verify'   ? 'bg-blue-100' : 'bg-green-100'
            }`}>
              {selectedUser.actionType === 'delete' && (
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
              {selectedUser.actionType === 'suspend' && (
                <svg className="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
                </svg>
              )}
              {selectedUser.actionType === 'verify' && (
                <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {selectedUser.actionType === 'activate' && (
                <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>

            <h3 className="font-bold text-lg text-center mb-1 text-gray-900">Confirmer l'action</h3>
            <p className="text-center text-gray-700 mb-1 text-sm">
              <span className="font-semibold">{getActionLabel(selectedUser.actionType)}</span>
            </p>
            <p className="text-center text-gray-500 text-sm mb-6">
              Utilisateur : <span className="font-semibold text-gray-700">{selectedUser.name}</span>
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelectedUser(null)}
                disabled={actionLoading}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-semibold transition disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={() => handleAction(selectedUser._id, selectedUser.actionType)}
                disabled={actionLoading}
                className={`px-4 py-2 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center gap-2 ${getActionColor(selectedUser.actionType)}`}
              >
                {actionLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    En cours...
                  </>
                ) : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPanel;