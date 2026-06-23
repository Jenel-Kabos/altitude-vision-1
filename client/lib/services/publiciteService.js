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
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: fd },
  );
  const data = await res.json();
  if (!data.secure_url) throw new Error('Échec upload Cloudinary');
  return data.secure_url;
};
