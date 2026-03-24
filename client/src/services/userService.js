// --- src/services/userService.js ---
import api from "./api";

/**
 * 🔹 Récupérer tous les utilisateurs
 */
export const getAllUsers = async () => {
  try {
    const response = await api.get("/users");
    return response.data?.data?.users || response.data?.data || response.data || [];
  } catch (error) {
    console.error("Erreur getAllUsers:", error);
    return [];
  }
};

/**
 * 🔹 Met à jour les informations de profil (nom, email, téléphone, photo)
 * Accepte un objet JSON ou un FormData (si photo jointe)
 */
export const updateMe = async (data) => {
  try {
    // 🔧 Content-Type automatique : multipart si FormData, json sinon
    const isFormData = data instanceof FormData;
    const response = await api.patch("/users/updateMe", data, {
      headers: isFormData ? { "Content-Type": "multipart/form-data" } : {},
    });
    const updatedUser = response.data?.data?.user;
    return {
      success: true,
      user:    updatedUser,
      message: "Profil mis à jour avec succès ✅",
    };
  } catch (error) {
    const message =
      error.response?.data?.message || "Erreur lors de la mise à jour du profil ❌";
    console.error("Erreur updateMe:", message);
    return { success: false, message };
  }
};

/**
 * 🔹 Met à jour le mot de passe de l'utilisateur connecté
 * 🔧 Retourne aussi le token frais renvoyé par le backend
 */
export const updateMyPassword = async (data) => {
  try {
    const response = await api.patch("/users/updateMyPassword", data);
    const updatedUser = response.data?.data?.user;
    const token       = response.data?.token;         // 🔧 token frais
    return {
      success: true,
      user:    updatedUser,
      token,
      message: "Mot de passe mis à jour avec succès 🔐",
    };
  } catch (error) {
    const message =
      error.response?.data?.message ||
      "Erreur lors de la mise à jour du mot de passe ❌";
    console.error("Erreur updateMyPassword:", message);
    return { success: false, message };
  }
};