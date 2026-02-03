import React from 'react';
import { ShieldCheck, UserCheck, Trash2, Globe } from 'lucide-react';
// NOTE: Firebase implementation for tracking/revoking sessions would be added here.
// For now, this is a placeholder UI.

const ActiveSessionsPage = () => {
  // Mock data representing active sessions for demonstration
  const mockSessions = [
    { id: 'sess_1', userId: 'user_admin_001', device: 'Desktop (Windows 10)', location: 'Paris, France', ip: '192.168.1.1', lastActive: 'Il y a 5 minutes', isCurrent: true },
    { id: 'sess_2', userId: 'user_admin_001', device: 'Mobile (Android)', location: 'Lyon, France', ip: '10.0.0.5', lastActive: 'Il y a 2 jours', isCurrent: false },
    { id: 'sess_3', userId: 'user_collaborator_123', device: 'Desktop (macOS)', location: 'Montréal, Canada', ip: '172.16.2.2', lastActive: 'Il y a 30 minutes', isCurrent: false },
  ];

  const handleRevokeSession = (sessionId) => {
    // Logic to revoke the session (e.g., call Firebase Admin SDK or a secure API endpoint)
    console.log(`Revoking session: ${sessionId}`);
    // In a real app, you would update the state or refresh data after the API call
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg h-full">
      <header className="mb-8 flex items-center gap-3 border-b pb-4">
        <ShieldCheck size={32} className="text-red-600" />
        <h1 className="text-3xl font-extrabold text-gray-800">Gestion des Sessions Actives</h1>
      </header>
      
      <p className="text-gray-600 mb-6">
        Affichez et gérez les sessions de connexion actives des utilisateurs et des administrateurs. Révoquez immédiatement tout accès suspect ou inutilisé.
      </p>

      <div className="space-y-4">
        {mockSessions.map((session) => (
          <div 
            key={session.id} 
            className={`flex justify-between items-center p-4 rounded-xl border ${
              session.isCurrent ? 'bg-red-50 border-red-300 shadow-md' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-center space-x-4">
              {session.isCurrent ? (
                <UserCheck size={24} className="text-red-600" />
              ) : (
                <Globe size={24} className="text-gray-500" />
              )}
              
              <div>
                <p className="font-semibold text-lg flex items-center">
                  {session.device} 
                  {session.isCurrent && (
                    <span className="ml-3 text-xs font-bold text-red-700 bg-red-200 px-2 py-0.5 rounded-full uppercase">
                      Session Actuelle
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">{session.location}</span> | {session.ip}
                </p>
                <p className="text-xs text-gray-400">
                  Dernière activité : {session.lastActive}
                </p>
              </div>
            </div>
            
            <button
              onClick={() => handleRevokeSession(session.id)}
              disabled={session.isCurrent}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition duration-200 ${
                session.isCurrent 
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              <Trash2 size={18} /> 
              {session.isCurrent ? "Ne peut être révoqué" : "Révoquer"}
            </button>
          </div>
        ))}
      </div>

      <footer className="mt-8 pt-4 border-t text-sm text-gray-500">
        <p>
          *La révocations de sessions nécessite généralement une intégration avec un service d'authentification avancé (ex: Firebase Admin SDK, gestion des JWT côté serveur) et ne peut être simulée uniquement côté client.
        </p>
      </footer>
    </div>
  );
};

export default ActiveSessionsPage;