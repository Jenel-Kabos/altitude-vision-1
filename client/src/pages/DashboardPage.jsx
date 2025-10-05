import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const DashboardPage = () => {
  const { userInfo } = useAuth();

  // userInfo est forcément défini ici, car ProtectedRoute fait déjà la vérification.
  return (
    <div className="container mx-auto px-6 py-12">
      <h1 className="text-4xl font-bold text-primary mb-2">
        Tableau de Bord
      </h1>
      <p className="text-xl text-gray-700 mb-8">
        Bienvenue, <span className="font-semibold">{userInfo.name}</span> !
      </p>

      <div className="bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4">Vos informations</h2>
        <div className="space-y-2">
            <p><strong>Email :</strong> {userInfo.email}</p>
            <p><strong>Rôle :</strong> <span className="bg-gray-200 text-gray-800 px-2 py-1 rounded-full text-sm">{userInfo.role}</span></p>
        </div>
        
        {/* On peut afficher des actions spécifiques au rôle de l'utilisateur */}
        {(userInfo.role === 'Propriétaire' || userInfo.role === 'Admin') && (
           <div className="mt-8 border-t pt-6">
               <h3 className="text-xl font-semibold mb-4">Actions rapides</h3>
               <Link 
                   to="/soumettre-propriete" 
                   className="inline-block bg-secondary text-white font-bold py-3 px-6 rounded hover:bg-amber-600 transition duration-300"
               >
                   + Proposer un nouveau bien
               </Link>
           </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;