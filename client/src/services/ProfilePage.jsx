// --- src/pages/Profile/ProfilePage.jsx ---
import React, { useState, useEffect } from 'react';
import { updateMe, updateMyPassword } from './userService';
import { getCurrentUser, saveUser } from './authService';
import { FaUserCircle, FaLock, FaSave, FaUpload, FaPhone } from 'react-icons/fa';

const ProfilePage = () => {
  const [user, setUser] = useState(getCurrentUser());
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '', // 📞 numéro de téléphone
  });

  const [passwordData, setPasswordData] = useState({
    passwordCurrent: '',
    password: '',
    passwordConfirm: ''
  });

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Upload photo
  const [profilePhoto, setProfilePhoto] = useState(null); // fichier
  const [photoPreview, setPhotoPreview] = useState(user?.photo || null); // URL

  // Mettre à jour les champs si l'utilisateur change
  useEffect(() => {
    if (user) {
      setFormData({ name: user.name, email: user.email, phone: user.phone || '' });
      setPhotoPreview(user.photo || null);
    }
  }, [user]);

  // Handlers champs
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handlePasswordChange = (e) => setPasswordData({ ...passwordData, [e.target.name]: e.target.value });

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  // Mise à jour du profil
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('email', formData.email);
      data.append('phone', formData.phone); // ajout du numéro de téléphone
      if (profilePhoto) data.append('photo', profilePhoto);

      const response = await updateMe(data);

      if (response.success && response.user) {
        saveUser(response.user);
        setUser(response.user);
        setMessage('✅ Profil mis à jour avec succès !');
      } else {
        setMessage(`❌ ${response.message}`);
      }
    } catch (error) {
      setMessage(`❌ ${error.message || 'Erreur lors de la mise à jour du profil.'}`);
    } finally {
      setLoading(false);
    }
  };

  // Mise à jour du mot de passe
  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await updateMyPassword(passwordData);

      if (response.success && response.user) {
        saveUser(response.user);
        setMessage('🔐 Mot de passe mis à jour avec succès !');
        setPasswordData({ passwordCurrent: '', password: '', passwordConfirm: '' });
      } else {
        setMessage(`❌ ${response.message}`);
      }
    } catch (error) {
      setMessage(`❌ ${error.message || 'Erreur lors de la mise à jour du mot de passe.'}`);
    } finally {
      setLoading(false);
    }
  };

  // Redirection si utilisateur non connecté
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center">
        <FaUserCircle size={80} className="text-gray-400 mb-4" />
        <p className="text-lg font-semibold text-gray-700">
          Vous devez être connecté pour accéder à votre profil.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto mt-10 bg-white shadow-lg rounded-2xl p-8">
      <h1 className="text-2xl font-bold text-center text-orange-600 mb-8 flex items-center justify-center">
        <FaUserCircle className="mr-3 text-orange-500" /> Mon Profil
      </h1>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-center ${
            message.includes('❌') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}
        >
          {message}
        </div>
      )}

      {/* Formulaire infos */}
      <form onSubmit={handleProfileUpdate} className="mb-10">
        {/* Photo de profil */}
        <div className="mb-4 flex flex-col items-center">
          <div className="w-24 h-24 rounded-full overflow-hidden mb-2">
            {photoPreview ? (
              <img src={photoPreview} alt="Aperçu photo" className="w-full h-full object-cover" />
            ) : (
              <FaUserCircle className="w-full h-full text-gray-300" />
            )}
          </div>
          <label className="cursor-pointer inline-flex items-center px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded">
            <FaUpload className="mr-2" /> Changer la photo
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </label>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Nom complet</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="mt-1 w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Adresse email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="mt-1 w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 flex items-center">
            <FaPhone className="mr-2" /> Numéro de téléphone
          </label>
          <input
            type="text"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="mt-1 w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="+242 00 000 0000"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-6 rounded-lg flex items-center mx-auto"
        >
          <FaSave className="mr-2" /> {loading ? 'Mise à jour...' : 'Mettre à jour le profil'}
        </button>
      </form>

      {/* Formulaire mot de passe */}
      <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
        <FaLock className="mr-2 text-orange-500" /> Changer le mot de passe
      </h2>
      <form onSubmit={handlePasswordUpdate}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Mot de passe actuel</label>
          <input
            type="password"
            name="passwordCurrent"
            value={passwordData.passwordCurrent}
            onChange={handlePasswordChange}
            className="mt-1 w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Nouveau mot de passe</label>
          <input
            type="password"
            name="password"
            value={passwordData.password}
            onChange={handlePasswordChange}
            className="mt-1 w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            required
          />
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700">Confirmer le mot de passe</label>
          <input
            type="password"
            name="passwordConfirm"
            value={passwordData.passwordConfirm}
            onChange={handlePasswordChange}
            className="mt-1 w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg flex items-center mx-auto"
        >
          <FaSave className="mr-2" /> {loading ? 'Mise à jour...' : 'Changer le mot de passe'}
        </button>
      </form>
    </div>
  );
};

export default ProfilePage;
