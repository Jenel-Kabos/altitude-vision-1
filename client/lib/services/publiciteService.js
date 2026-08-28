import api from './api';

export const getAllPublicites = async () => {
  const res = await api.get('/publicites');
  return res.data?.data?.publicites || [];
};

export const createPublicite = async (data) => {
  const res = await api.post('/publicites', data);
  return res.data?.data?.publicite;
};

export const updatePublicite = async (id, data) => {
  const res = await api.patch(`/publicites/${id}`, data);
  return res.data?.data?.publicite;
};

export const deletePublicite = async (id) => {
  await api.delete(`/publicites/${id}`);
};

export const uploadToCloudinary = async (file) => {
  // HOTFIX-WEB-PUBLICITES-CLOUDINARY-1 — garde-fou fail-fast : sans ceci,
  // un cloud_name/upload_preset absent (variable Netlify manquante, jamais
  // un secret) envoyait quand même la requête vers
  // `/v1_1/undefined/image/upload`, provoquant un 401 Cloudinary confus
  // plutôt qu'une erreur exploitable. Ne corrige pas la cause racine
  // (configuration d'environnement, hors du code) — l'empêche seulement de
  // se manifester comme un appel réseau silencieusement cassé.
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) {
    throw new Error("Configuration d'upload indisponible. Contactez un administrateur.");
  }

  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', uploadPreset);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: fd },
  );
  const data = await res.json();
  if (!data.secure_url) throw new Error('Échec upload Cloudinary');
  return data.secure_url;
};
