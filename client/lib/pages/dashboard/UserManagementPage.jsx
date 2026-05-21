// src/pages/UserManagementPage.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from '@/lib/utils/toast';

const UserManagementPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null); // pour suppression
  const API_URL = `${process.env.NEXT_PUBLIC_API_URL || 'https://altitude-vision.onrender.com/api'}/admin/owners`;


  // Récupération des utilisateurs
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data.data.owners);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Actions utilisateurs : verify, suspend, activate, delete
  const handleAction = async (userId, action) => {
    try {
      const token = localStorage.getItem('token');
      let url = `/api/admin/owners/${userId}`;
      let method = 'patch';
      let data = {};

      switch (action) {
        case 'verify':
          url += '/verify';
          break;
        case 'suspend':
          url += '/suspend';
          break;
        case 'activate':
          url += '/activate';
          break;
        case 'delete':
          method = 'delete';
          break;
        default:
          return;
      }

      const res = await axios({ url, method, data, headers: { Authorization: `Bearer ${token}` } });

      if (action === 'delete') {
        setUsers(users.filter((u) => u._id !== userId));
      } else {
        // Mise à jour locale de l'utilisateur
        setUsers(users.map((u) => (u._id === userId ? res.data.data.user || res.data.data.owner : u)));
      }
      setSelectedUser(null);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
  };

  if (loading) return <p>Chargement des utilisateurs...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (users.length === 0) return <p>Aucun utilisateur trouvé.</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Gestion des utilisateurs</h1>

      <div className="overflow-x-auto">
        <table className="min-w-full table-auto border border-gray-200">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 border">Nom</th>
              <th className="px-4 py-2 border">Email</th>
              <th className="px-4 py-2 border">Rôle</th>
              <th className="px-4 py-2 border">Statut</th>
              <th className="px-4 py-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user._id} className="hover:bg-gray-50">
                <td className="px-4 py-2 border">{user.name}</td>
                <td className="px-4 py-2 border">{user.email}</td>
                <td className="px-4 py-2 border">{user.role}</td>
                <td className="px-4 py-2 border">{user.isActive ? 'Actif' : 'Suspendu'}</td>
                <td className="px-4 py-2 border flex gap-2 flex-wrap">
                  {!user.isVerified && (
                    <button
                      onClick={() => handleAction(user._id, 'verify')}
                      className="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 text-sm"
                    >
                      Vérifier
                    </button>
                  )}
                  {user.isActive ? (
                    <button
                      onClick={() => handleAction(user._id, 'suspend')}
                      className="bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600 text-sm"
                    >
                      Suspendre
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAction(user._id, 'activate')}
                      className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 text-sm"
                    >
                      Réactiver
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedUser(user)}
                    className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 text-sm"
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal confirmation suppression */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-11/12 md:w-1/3">
            <h2 className="text-lg font-bold mb-4">Confirmer la suppression</h2>
            <p>
              Êtes-vous sûr de vouloir supprimer l'utilisateur <strong>{selectedUser.name}</strong> ?
            </p>
            <div className="mt-4 flex justify-end gap-2 flex-wrap">
              <button
                onClick={() => handleAction(selectedUser._id, 'delete')}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              >
                Supprimer
              </button>
              <button
                onClick={() => setSelectedUser(null)}
                className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPage;
