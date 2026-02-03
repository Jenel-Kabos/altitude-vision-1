// --- src/pages/Profile/userService.js ---
import api from "./api";

/**
 * 🔹 Met à jour les informations de profil utilisateur (nom, email, photo)
 * @param {FormData} data - FormData contenant { name, email, photo }
 * @returns {Promise<{ success: boolean, user?: Object, message?: string }>}
 */
export const updateMe = async (data) => {
  try {
    // PATCH avec FormData pour gérer l'upload
    const response = await api.patch("/users/updateMe", data, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    // On récupère directement l'utilisateur mis à jour
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
