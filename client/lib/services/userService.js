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
 *
 * ⚠️  IMPORTANT — Ne jamais forcer "Content-Type: multipart/form-data" manuellement.
 *     Quand on passe un FormData, le navigateur (et axios) génèrent automatiquement
 *     le header avec le boundary correct (ex: multipart/form-data; boundary=----XYZ).
 *     Si on le force manuellement, le boundary est absent → multer ne parse pas le body
 *     → req.file est undefined → la photo n'est pas uploadée.
 */
export const updateMe = async (data) => {
  try {
    // Pas de headers manuels : axios détecte FormData et gère le Content-Type tout seul
    const response = await api.patch("/users/updateMe", data);
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
 * 🔹 Changer le rôle d'un utilisateur (Admin uniquement)
 */
export const updateUserRole = async (userId, role) => {
  const response = await api.patch(`/users/${userId}/role`, { role });
  return {
    user:      response.data?.data?.user,
    emailSent: response.data?.emailSent ?? false,
  };
};

/**
 * 🔹 Créer un utilisateur depuis l'admin (Admin/Collaborateur uniquement)
 */
export const createUserByAdmin = async (data) => {
  const response = await api.post('/users/create-by-admin', data);
  return response.data?.data?.user;
};

/**
 * 🔹 Supprimer un utilisateur (Admin uniquement)
 */
export const deleteAdminUser = async (userId) => {
  await api.delete(`/users/${userId}`);
};

/**
 * 🔹 Met à jour le mot de passe de l'utilisateur connecté
 */
export const updateMyPassword = async (data) => {
  try {
    const response = await api.patch("/users/updateMyPassword", data);
    const updatedUser = response.data?.data?.user;
    const token       = response.data?.token;
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