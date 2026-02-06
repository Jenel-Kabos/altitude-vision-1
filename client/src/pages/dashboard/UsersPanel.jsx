// src/pages/dashboard/UsersPanel.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// ✅ URL PROPRE (Production)
const API_URL = import.meta.env.VITE_API_URL || 'https://altitude-vision.onrender.com/api';

const UsersPanel = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null); 
  
  // ✅ Endpoint dynamique
  const ENDPOINT = `${API_URL}/admin/owners`; 

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(ENDPOINT, { 
        headers: { Authorization: `Bearer ${token}` },
      });
      // Gestion robuste des données
      setUsers(res.data.data.owners || res.data.data.users || []);
      setError(null);
    } catch (err) {
      console.error("Erreur fetch users:", err);
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
        case 'verify': url += '/verify'; successMessage = 'Vérifié !'; break;
        case 'suspend': url += '/suspend'; successMessage = 'Suspendu !'; break;
        case 'activate': url += '/activate'; successMessage = 'Réactivé !'; break;
        case 'delete': method = 'delete'; successMessage = 'Supprimé !'; break;
        default: return;
      }

      const res = await axios({ 
        url, method, data: {}, 
        headers: { Authorization: `Bearer ${token}` } 
      });

      if (action === 'delete') {
        setUsers(users.filter((u) => u._id !== userId));
      } else {
        setUsers(users.map((u) => (u._id === userId ? res.data.data.user || res.data.data.owner : u)));
      }
      toast.success(successMessage);
      setSelectedUser(null);
    } catch (err) {
      toast.error("Erreur lors de l'action");
      setSelectedUser(null);
    }
  };

  if (loading) return <div className="text-center p-10">Chargement...</div>;

  return (
    <div className="p-6">
      <ToastContainer position="top-right" autoClose={3000} />
      <h1 className="text-2xl font-bold mb-4">Gestion des Utilisateurs (Admin)</h1>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left">Nom</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user._id}>
                <td className="px-4 py-3">{user.name}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {user.isActive ? 'Actif' : 'Suspendu'}
                    </span>
                </td>
                <td className="px-4 py-3 flex gap-2">
                  {!user.isEmailVerified && (
                    <button onClick={() => setSelectedUser({ ...user, actionType: 'verify' })} className="text-green-600 hover:bg-green-50 px-2 py-1 rounded text-sm border border-green-200">Vérifier</button>
                  )}
                  {user.isActive ? (
                    <button onClick={() => setSelectedUser({ ...user, actionType: 'suspend' })} className="text-yellow-600 hover:bg-yellow-50 px-2 py-1 rounded text-sm border border-yellow-200">Suspendre</button>
                  ) : (
                    <button onClick={() => setSelectedUser({ ...user, actionType: 'activate' })} className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-sm border border-blue-200">Réactiver</button>
                  )}
                  <button onClick={() => setSelectedUser({ ...user, actionType: 'delete' })} className="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-sm border border-red-200">Supprimer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <div className="p-4 text-center text-gray-500">Aucun utilisateur trouvé.</div>}
      </div>

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96">
                <h3 className="font-bold text-lg mb-2">Confirmer l'action</h3>
                <p className="mb-4 text-gray-600">Êtes-vous sûr de vouloir continuer ?</p>
                <div className="flex justify-end gap-2">
                    <button onClick={() => setSelectedUser(null)} className="px-4 py-2 bg-gray-200 rounded">Annuler</button>
                    <button onClick={() => handleAction(selectedUser._id, selectedUser.actionType)} className="px-4 py-2 bg-blue-600 text-white rounded">Confirmer</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default UsersPanel;