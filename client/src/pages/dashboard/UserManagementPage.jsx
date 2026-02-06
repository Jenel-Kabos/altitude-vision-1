// src/pages/dashboard/UserManagementPage.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const UserManagementPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null); 
  
  // 🚨 ICI : On met l'adresse REELLE de ton site (plus de localhost)
  const ENDPOINT = 'https://altitude-vision.onrender.com/api/admin/owners'; 

  // Récupération des utilisateurs
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(ENDPOINT, { 
        headers: { Authorization: `Bearer ${token}` },
      });
      // Adaptation selon la structure de réponse
      setUsers(res.data.data.owners || res.data.data.users || []);
      setError(null);
    } catch (err) {
      console.error("Erreur fetch users:", err);
      setError(err.response?.data?.message || err.message || 'Erreur lors du chargement des utilisateurs.');
      toast.error('Erreur lors du chargement des utilisateurs.');
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
      let url = `${ENDPOINT}/${userId}`; 
      let method = 'patch';
      let successMessage = '';

      switch (action) {
        case 'verify':
          url += '/verify';
          successMessage = 'Utilisateur vérifié avec succès.';
          break;
        case 'suspend':
          url += '/suspend';
          successMessage = 'Utilisateur suspendu avec succès.';
          break;
        case 'activate':
          url += '/activate';
          successMessage = 'Utilisateur réactivé avec succès.';
          break;
        case 'delete':
          method = 'delete';
          successMessage = 'Utilisateur supprimé avec succès.';
          break;
        default:
          return;
      }

      const res = await axios({ 
        url, 
        method, 
        data: {}, 
        headers: { Authorization: `Bearer ${token}` } 
      });

      if (action === 'delete') {
        setUsers(users.filter((u) => u._id !== userId));
      } else {
        // Mise à jour locale
        setUsers(users.map((u) => (u._id === userId ? res.data.data.user || res.data.data.owner : u)));
      }
      
      toast.success(successMessage);
      setSelectedUser(null);

    } catch (err) {
      console.error(`Erreur action ${action}:`, err);
      const errorMessage = err.response?.data?.message || `Erreur lors de l'action "${action}".`;
      toast.error(errorMessage);
      setSelectedUser(null);
    }
  };

  if (loading) return <p className="text-center py-4">Chargement des utilisateurs...</p>;
  if (error && users.length === 0) return <p className="text-center text-red-500 py-4">{error}</p>;

  return (
    <div className="p-6">
      <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="light"/>
      
      <h1 className="text-2xl font-bold mb-4">Gestion des utilisateurs</h1>

      <div className="overflow-x-auto">
        <table className="min-w-full table-auto border border-gray-200 bg-white shadow-sm rounded-lg">
          <thead>
            <tr className="bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <th className="px-4 py-3 border-b">Nom</th>
              <th className="px-4 py-3 border-b">Email</th>
              <th className="px-4 py-3 border-b">Rôle</th>
              <th className="px-4 py-3 border-b">Statut</th>
              <th className="px-4 py-3 border-b">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">{user.name}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.role === 'Admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                        {user.role}
                    </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                        {user.isActive ? 'Actif' : 'Suspendu'}
                    </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium flex gap-2">
                  {!user.isEmailVerified && (
                    <button
                      onClick={() => setSelectedUser({ ...user, actionType: 'verify' })}
                      className="text-green-600 hover:text-green-900 bg-green-50 px-2 py-1 rounded hover:bg-green-100"
                    >
                      Vérifier
                    </button>
                  )}
                  {user.isActive ? (
                    <button
                      onClick={() => setSelectedUser({ ...user, actionType: 'suspend' })}
                      className="text-yellow-600 hover:text-yellow-900 bg-yellow-50 px-2 py-1 rounded hover:bg-yellow-100"
                    >
                      Suspendre
                    </button>
                  ) : (
                    <button
                      onClick={() => setSelectedUser({ ...user, actionType: 'activate' })}
                      className="text-blue-600 hover:text-blue-900 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100"
                    >
                      Réactiver
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedUser({ ...user, actionType: 'delete' })}
                    className="text-red-600 hover:text-red-900 bg-red-50 px-2 py-1 rounded hover:bg-red-100"
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && !loading && (
            <div className="text-center py-10 text-gray-500">Aucun utilisateur trouvé.</div>
        )}
      </div>
      
      {selectedUser && (
        <ConfirmationModal 
          user={selectedUser} 
          onConfirm={handleAction} 
          onClose={() => setSelectedUser(null)} 
        />
      )}
    </div>
  );
};

// Composant Modal (inchangé)
const ConfirmationModal = ({ user, onConfirm, onClose }) => {
    const { name, actionType } = user;
    let title = '';
    let message = '';
    let confirmColor = 'bg-red-600 hover:bg-red-700';
    let confirmText = '';

    switch (actionType) {
        case 'verify':
            title = 'Confirmer la vérification';
            message = `Voulez-vous forcer la vérification de l'utilisateur ${name} ?`;
            confirmColor = 'bg-green-600 hover:bg-green-700';
            confirmText = 'Vérifier';
            break;
        case 'suspend':
            title = 'Confirmer la suspension';
            message = `Êtes-vous sûr de vouloir suspendre l'utilisateur ${name} ?`;
            confirmColor = 'bg-yellow-500 hover:bg-yellow-600';
            confirmText = 'Suspendre';
            break;
        case 'activate':
            title = 'Confirmer la réactivation';
            message = `Êtes-vous sûr de vouloir réactiver l'utilisateur ${name} ?`;
            confirmColor = 'bg-blue-600 hover:bg-blue-700';
            confirmText = 'Réactiver';
            break;
        case 'delete':
        default:
            title = 'Confirmer la suppression';
            message = `Êtes-vous sûr de vouloir supprimer définitivement ${name} ?`;
            confirmColor = 'bg-red-600 hover:bg-red-700';
            confirmText = 'Supprimer';
            break;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl p-6 w-11/12 md:w-1/3">
                <h2 className="text-xl font-bold mb-4 text-gray-800">{title}</h2>
                <p className="text-gray-600 mb-6">{message}</p>
                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200">Annuler</button>
                    <button onClick={() => onConfirm(user._id, actionType)} className={`px-4 py-2 rounded-lg text-white font-medium ${confirmColor}`}>{confirmText}</button>
                </div>
            </div>
        </div>
    );
};

export default UserManagementPage;