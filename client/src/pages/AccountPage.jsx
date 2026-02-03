import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { updateMe, updateMyPassword } from "../services/userService";
import { Toaster, toast } from "react-hot-toast";
import {
  FiUser,
  FiMail,
  FiLock,
  FiSave,
  FiAlertTriangle,
  FiCheckCircle,
  FiXCircle,
} from "react-icons/fi";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";

const AccountPage = () => {
  const { user, login } = useAuth();

  // --- État pour les informations du profil ---
  const [infoData, setInfoData] = useState({ name: "", email: "" });
  const [infoLoading, setInfoLoading] = useState(false);

  // --- État pour le mot de passe ---
  const [passData, setPassData] = useState({
    passwordCurrent: "",
    password: "",
    passwordConfirm: "",
  });
  const [passLoading, setPassLoading] = useState(false);

  // --- Gestion des erreurs locales ---
  const [errors, setErrors] = useState({});

  // --- Préremplir les infos utilisateur ---
  useEffect(() => {
    if (user) {
      setInfoData({
        name: user.name || "",
        email: user.email || "",
      });
    }
  }, [user]);

  // --- Gestion des changements ---
  const handleInfoChange = (e) => {
    setInfoData({ ...infoData, [e.target.name]: e.target.value });
  };

  const handlePassChange = (e) => {
    const { name, value } = e.target;
    setPassData({ ...passData, [name]: value });

    // Validation instantanée
    if (name === "passwordConfirm" || name === "password") {
      if (value && passData.password && passData.passwordConfirm) {
        if (name === "password" && passData.passwordConfirm && value !== passData.passwordConfirm) {
          setErrors({ ...errors, passwordConfirm: "Les mots de passe ne correspondent pas." });
        } else if (name === "passwordConfirm" && value !== passData.password) {
          setErrors({ ...errors, passwordConfirm: "Les mots de passe ne correspondent pas." });
        } else {
          setErrors({ ...errors, passwordConfirm: null });
        }
      }
    }
  };

  // --- Mise à jour du profil ---
  const handleSubmitInfo = async (e) => {
    e.preventDefault();
    setInfoLoading(true);
    const toastId = toast.loading("Mise à jour du profil...");

    try {
      const res = await updateMe(infoData);
      if (res?.data?.user) {
        const token = localStorage.getItem("token");
        login(res.data.user, token);
        toast.success("Profil mis à jour avec succès !");
      } else {
        toast.error("Impossible de mettre à jour le profil.");
      }
    } catch (err) {
      toast.error(err?.message || "Erreur de mise à jour du profil.");
    } finally {
      toast.dismiss(toastId);
      setInfoLoading(false);
    }
  };

  // --- Mise à jour du mot de passe ---
  const handleSubmitPassword = async (e) => {
    e.preventDefault();

    // Validation locale avant requête
    if (passData.password !== passData.passwordConfirm) {
      setErrors({ passwordConfirm: "Les mots de passe ne correspondent pas." });
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }

    if (passData.password.length < 8) {
      setErrors({ password: "Le mot de passe doit contenir au moins 8 caractères." });
      toast.error("Mot de passe trop court.");
      return;
    }

    setPassLoading(true);
    const toastId = toast.loading("Mise à jour du mot de passe...");

    try {
      const res = await updateMyPassword(passData);
      if (res?.token && res?.data?.user) {
        localStorage.setItem("token", res.token);
        login(res.data.user, res.token);
        toast.success("Mot de passe changé avec succès !");
        setPassData({ passwordCurrent: "", password: "", passwordConfirm: "" });
        setErrors({});
      } else {
        toast.error("Erreur inattendue lors du changement de mot de passe.");
      }
    } catch (err) {
      toast.error(err?.message || "Échec du changement de mot de passe.");
    } finally {
      toast.dismiss(toastId);
      setPassLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-gray-600 text-lg">Chargement du profil...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      <Header />

      <main className="flex-grow container mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-10 text-center">
          Mon Compte
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* --- INFORMATIONS DU PROFIL --- */}
          <div className="bg-white p-6 lg:p-8 rounded-2xl shadow-md border border-gray-100">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <FiUser className="text-blue-500" /> Informations du Profil
            </h2>

            <form onSubmit={handleSubmitInfo} className="space-y-5">
              <div className="relative">
                <FiUser className="absolute left-3 top-3.5 text-gray-400" />
                <input
                  type="text"
                  name="name"
                  value={infoData.name}
                  onChange={handleInfoChange}
                  required
                  placeholder="Nom complet"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="relative">
                <FiMail className="absolute left-3 top-3.5 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={infoData.email}
                  onChange={handleInfoChange}
                  required
                  placeholder="Adresse email"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={infoLoading}
                className="w-full flex justify-center items-center gap-2 py-3 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                <FiSave />
                {infoLoading ? "Mise à jour..." : "Sauvegarder les Infos"}
              </button>
            </form>
          </div>

          {/* --- CHANGEMENT MOT DE PASSE --- */}
          <div className="bg-white p-6 lg:p-8 rounded-2xl shadow-md border border-gray-100">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <FiLock className="text-gray-700" /> Changer le Mot de Passe
            </h2>

            <form onSubmit={handleSubmitPassword} className="space-y-5">
              {[
                { name: "passwordCurrent", placeholder: "Mot de passe actuel" },
                { name: "password", placeholder: "Nouveau mot de passe" },
                { name: "passwordConfirm", placeholder: "Confirmer le nouveau mot de passe" },
              ].map((field, i) => (
                <div key={i} className="relative">
                  <FiLock className="absolute left-3 top-3.5 text-gray-400" />
                  <input
                    type="password"
                    name={field.name}
                    value={passData[field.name]}
                    onChange={handlePassChange}
                    required
                    placeholder={field.placeholder}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-gray-600 focus:border-gray-600 ${
                      errors[field.name]
                        ? "border-red-500"
                        : "border-gray-300"
                    }`}
                  />
                  {errors[field.name] && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors[field.name]}
                    </p>
                  )}
                </div>
              ))}

              <button
                type="submit"
                disabled={
                  passLoading ||
                  !passData.passwordCurrent ||
                  !passData.password ||
                  !passData.passwordConfirm ||
                  errors.passwordConfirm
                }
                className="w-full flex justify-center items-center gap-2 py-3 rounded-lg text-sm font-medium text-white bg-gray-700 hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
              >
                <FiSave />
                {passLoading ? "Mise à jour..." : "Changer le Mot de Passe"}
              </button>
            </form>

            <div className="mt-4 text-sm text-gray-500 flex items-center gap-2">
              <FiAlertTriangle className="text-yellow-500" />
              Après le changement, vous serez reconnecté automatiquement.
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AccountPage;
