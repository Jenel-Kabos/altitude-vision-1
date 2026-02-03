// src/pages/UserManagementPage.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
// Importation de react-toastify
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css'; // N'oubliez pas d'importer le CSS

const UserManagementPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null); 
  const BASE_API_URL = 'http://localhost:5000/api/admin/owners'; 

  // Récupération des utilisateurs
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(BASE_API_URL, { 
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data.data.owners);
      setError(null);
    } catch (err) {
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
      let url = `${BASE_API_URL}/${userId}`; 
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

      const res = await axios({ url, method, data: {}, headers: { Authorization: `Bearer ${token}` } });

      if (action === 'delete') {
        setUsers(users.filter((u) => u._id !== userId));
      } else {
        // Mise à jour locale de l'utilisateur avec l'objet mis à jour renvoyé
        setUsers(users.map((u) => (u._id === userId ? res.data.data.user || res.data.data.owner : u)));
      }
      
      // Affichage du message de succès
      toast.success(successMessage);
      setSelectedUser(null);

    } catch (err) {
      // Affichage du message d'erreur spécifique ou par défaut
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
                  {/* Bouton VÉRIFIER */}
                  {!user.isVerified && (
                    <button
                      onClick={() => setSelectedUser({ ...user, actionType: 'verify' })} // Utilisation du modal pour uniformité
                      className="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 text-sm"
                    >
                      Vérifier
                    </button>
                  )}
                  {/* Bouton SUSPENDRE/RÉACTIVER */}
                  {user.isActive ? (
                    <button
                      onClick={() => setSelectedUser({ ...user, actionType: 'suspend' })} // Utilisation du modal
                      className="bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600 text-sm"
                    >
                      Suspendre
                    </button>
                  ) : (
                    <button
                      onClick={() => setSelectedUser({ ...user, actionType: 'activate' })} // Utilisation du modal
                      className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 text-sm"
                    >
                      Réactiver
                    </button>
                  )}
                  {/* Bouton SUPPRIMER */}
                  <button
                    onClick={() => setSelectedUser({ ...user, actionType: 'delete' })} // Utilisation du modal
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
      
      {/* Modal de confirmation unifié */}
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


// Composant Modal de Confirmation unifié (à placer dans un fichier séparé pour les projets plus grands)
const ConfirmationModal = ({ user, onConfirm, onClose }) => {
    const { name, actionType } = user;
    let title = '';
    let message = '';
    let confirmColor = 'bg-red-500 hover:bg-red-600';
    let confirmText = '';

    switch (actionType) {
        case 'verify':
            title = 'Confirmer la vérification';
            message = `Êtes-vous sûr de vouloir vérifier l'utilisateur ${name} ?`;
            confirmColor = 'bg-green-500 hover:bg-green-600';
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
            confirmColor = 'bg-blue-500 hover:bg-blue-600';
            confirmText = 'Réactiver';
            break;
        case 'delete':
        default:
            title = 'Confirmer la suppression';
            message = `Êtes-vous sûr de vouloir supprimer l'utilisateur ${name} ? Cette action est irréversible.`;
            confirmColor = 'bg-red-500 hover:bg-red-600';
            confirmText = 'Supprimer';
            break;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg p-6 w-11/12 md:w-1/3">
                <h2 className="text-lg font-bold mb-4">{title}</h2>
                <p>{message}</p>
                <div className="mt-4 flex justify-end gap-2 flex-wrap">
                    <button
                        onClick={() => onConfirm(user._id, actionType)}
                        className={`${confirmColor} text-white px-4 py-2 rounded`}
                    >
                        {confirmText}
                    </button>
                    <button
                        onClick={onClose}
                        className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
                    >
                        Annuler
                    </button>
                </div>
            </div>
        </div>
    );
};


export default UserManagementPage;