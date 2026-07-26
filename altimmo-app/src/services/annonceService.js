import api from './api';
import { cache } from './cacheService';

const CLOUDINARY_CLOUD_NAME = 'dop8vzm5z';
const CLOUDINARY_UPLOAD_PRESET = 'lqwel6X6';

const VIDEO_EXTENSIONS = /\.(mp4|mov|avi|mkv|webm)$/i;

function getUploadMeta(uri) {
  if (VIDEO_EXTENSIONS.test(uri)) {
    const ext = uri.split('.').pop().toLowerCase();
    const mime = ext === 'mov' ? 'video/quicktime'
      : ext === 'avi' ? 'video/x-msvideo'
      : ext === 'webm' ? 'video/webm'
      : 'video/mp4';
    return { name: `upload_${Date.now()}.${ext}`, type: mime };
  }
  return { name: `upload_${Date.now()}.jpg`, type: 'image/jpeg' };
}

export async function uploadToCloudinary(uri) {
  const { name, type } = getUploadMeta(uri);
  const fd = new FormData();
  fd.append('file', { uri, name, type });
  fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
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

export async function getRecommendedProperties() {
  const KEY = 'recommended:properties';
  const hit = cache.get(KEY);
  if (hit) return hit;
  const res = await api.get('/properties/recommended');
  const data = res.data?.data?.properties || res.data?.properties || [];
  // Mise en cache 10 minutes — les recommandés changent rarement
  cache.set(KEY, data, 10 * 60 * 1000);
  return data;
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

// ─────────────────────────────────────────────────────────────────────────
// Hébergement (Accommodation) — correctif robustesse 2026-07. L'ancien parcours
// enchaînait 4 appels HTTP indépendants (Property → Accommodation → RatePlan →
// submit) depuis le mobile ; un échec en cours de route pouvait laisser des
// données partielles en base sans reprise fiable. Remplacé par un appel unique
// vers une route backend atomique (transaction Mongo) et idempotente :
// POST /accommodations/mobile/full. Le mobile ne fait plus d'orchestration
// métier — il envoie tout le payload en une fois et laisse le backend garantir
// l'atomicité et l'unicité (voir mobileAccommodationPublicationService.js).
//
// `publicationRequestId` doit être généré une seule fois par tentative de
// publication (côté écran) et réutilisé à l'identique pour chaque retry — voir
// AddAccommodationScreen.jsx. Une nouvelle valeur ne doit être générée que pour
// une toute nouvelle publication (jamais pour rejouer un échec).
// ─────────────────────────────────────────────────────────────────────────

export async function createFullAccommodationMobile({ publicationRequestId, publicationKind, property, accommodation, ratePlan, roomCategories }) {
  try {
    const res = await api.post('/accommodations/mobile/full', {
      publicationRequestId,
      publicationKind,
      property,
      accommodation,
      ratePlan,
      roomCategories,
    });
    const data = res.data?.data || {};
    return {
      property: data.property, accommodation: data.accommodation, rate: data.rate,
      hotel: data.hotel, roomCategories: data.roomCategories, categoryRates: data.categoryRates,
    };
  } catch (err) {
    const message = err.response?.data?.message
      || err.response?.data?.error
      || 'Erreur lors de la publication de l\'hébergement';
    const wrapped = new Error(message);
    wrapped.code = err.response?.data?.code;
    wrapped.isNetworkError = !err.response;
    throw wrapped;
  }
}
