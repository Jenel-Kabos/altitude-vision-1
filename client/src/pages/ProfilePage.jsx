import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Phone, Shield, ArrowLeft } from 'lucide-react';

const ProfilePage = () => {
    const { user } = useAuth();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-16 px-4">
            <div className="container mx-auto max-w-2xl">

                {/* Retour */}
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 transition mb-8 text-sm font-medium"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Retour à l'accueil
                </Link>

                {/* Card profil */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">

                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-8 py-10 text-white text-center">
                        <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-4 border-2 border-white/40">
                            <User className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold">
                            {user?.name || 'Mon Profil'}
                        </h1>
                        <p className="text-white/80 text-sm mt-1">
                            {user?.role === 'admin' ? 'Administrateur' : 'Membre'}
                        </p>
                    </div>

                    {/* Infos */}
                    <div className="p-8 space-y-5">
                        {user?.email && (
                            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                                <div className="p-2 bg-blue-100 rounded-xl">
                                    <Mail className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Email</p>
                                    <p className="font-semibold text-gray-800">{user.email}</p>
                                </div>
                            </div>
                        )}

                        {user?.phone && (
                            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                                <div className="p-2 bg-green-100 rounded-xl">
                                    <Phone className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Téléphone</p>
                                    <p className="font-semibold text-gray-800">{user.phone}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                            <div className="p-2 bg-purple-100 rounded-xl">
                                <Shield className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Rôle</p>
                                <p className="font-semibold text-gray-800 capitalize">
                                    {user?.role || 'Utilisateur'}
                                </p>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100 flex gap-3">
                            <Link
                                to="/mon-compte"
                                className="flex-1 text-center py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition text-sm"
                            >
                                Gérer mon compte
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;