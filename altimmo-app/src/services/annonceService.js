import api from './api';

const CLOUDINARY_CLOUD_NAME = 'dop8vzm5z';
const CLOUDINARY_UPLOAD_PRESET = 'lqwel6X6';

export async function uploadToCloudinary(uri) {
  const fd = new FormData();
  fd.append('file', {
    uri,
    name: `upload_${Date.now()}.jpg`,
    type: 'image/jpeg',
  });
  fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: fd,
    },
  );

  if (!res.ok) {
    throw new Error('Cloudinary upload failed');
  }

  const data = await res.json();
  return data.secure_url;
}

export async function creerAnnonce(payload) {
  try {
    const res = await api.post('/properties/mobile', {
      ...payload,
      latitude: payload.latitude ?? -4.2661,
      longitude: payload.longitude ?? 15.2832,
    });
    return res.data?.data?.property || res.data?.property;
  } catch (err) {
    throw new Error(
      err.response?.data?.message ||
      err.response?.data?.error ||
      'Erreur lors de la publication'
    );
  }
}
