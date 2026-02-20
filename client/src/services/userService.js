// --- src/services/userService.js ---
import api from "./api";

/**
 * 🔹 Récupérer tous les utilisateurs (pour le sélecteur de destinataires)
 * @returns {Promise<Array>} - Liste des utilisateurs
 */
export const getAllUsers = async () => {
  try {
    const response = await api.get("/users");
    // Adapter selon la structure de réponse de ton backend
    return response.data?.data?.users || response.data?.data || response.data || [];
  } catch (error) {
    console.error("Erreur getAllUsers:", error);
    return [];
  }
};

/**
 * 🔹 Met à jour les informations de profil utilisateur (nom, email, photo)
 * @param {FormData} data - FormData contenant { name, email, photo }
 * @returns {Promise<{ success: boolean, user?: Object, message?: string }>}
 */
export const updateMe = async (data) => {
  try {
    const response = await api.patch("/users/updateMe", data, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const updatedUser = response.data?.data?.user;
    return {
      success: true,
      user: updatedUser,
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
 * @param {Object} data - { passwordCurrent, password, passwordConfirm }
 * @returns {Promise<{ success: boolean, user?: Object, message?: string }>}
 */
export const updateMyPassword = async (data) => {
  try {
    const response = await api.patch("/users/updateMyPassword", data);
    const updatedUser = response.data?.data?.user;
    return {
      success: true,
      user: updatedUser,
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