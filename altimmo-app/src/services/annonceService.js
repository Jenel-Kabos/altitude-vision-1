import axios from 'axios';
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

// DEV-only, jamais de contenu binaire : trace la forme de chaque partie du
// FormData pour diagnostiquer un rejet natif (ex. "Unsupported FormDataPart
// implementation") sans jamais logger le contenu du fichier lui-même.
function logFormDataPartDev(fieldName, value) {
  if (!__DEV__) return;
  if (value && typeof value === 'object' && 'uri' in value) {
    const scheme = typeof value.uri === 'string' ? value.uri.split(':')[0] : typeof value.uri;
    console.log('[FormData part]', {
      fieldName, kind: 'file', hasUri: Boolean(value.uri), uriScheme: scheme,
      type: value.type, name: value.name,
    });
  } else {
    console.log('[FormData part]', {
      fieldName, kind: 'primitive', jsType: typeof value, isString: typeof value === 'string',
    });
  }
}

// IMPORTANT : ne jamais utiliser fetch() global ici. Depuis Expo SDK 57,
// expo/fetch remplace fetch() par défaut (voir AGENTS.md) et son
// implémentation WinterCG ne reconnaît pas la forme classique RN
// `{uri, name, type}` pour un fichier — elle lève
// "Unsupported FormDataPart implementation". axios (utilisé partout ailleurs
// dans l'app pour l'upload de fichiers, ex. ProfilScreen.jsx) passe par
// XMLHttpRequest côté RN et supporte cette forme correctement.
//
// HOTFIX-MOB-PROPERTY-PUBLISH-FAILURE-2 — `{ index, total }` est une
// instrumentation DEV optionnelle (jamais de contenu binaire/JWT/secret
// loggé) permettant de distinguer, pour un lot de plusieurs photos, laquelle
// échoue réellement et à quelle étape (avant le fix, "Erreur lors de la
// publication" masquait entièrement si l'échec venait de Cloudinary ou du
// backend Property). Optionnel et rétrocompatible : les appelants qui ne le
// passent pas se contentent de logs sans index/total.
export async function uploadToCloudinary(uri, { index, total } = {}) {
  const { name, type } = getUploadMeta(uri);
  const filePart = { uri, name, type };
  const fd = new FormData();
  logFormDataPartDev('file', filePart);
  fd.append('file', filePart);
  logFormDataPartDev('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const uriScheme = typeof uri === 'string' ? uri.split(':')[0] : typeof uri;
  if (__DEV__) console.log('[Cloudinary upload start]', { index, total, uriScheme, mime: type, hasName: Boolean(name) });

  try {
    const res = await axios.post(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    if (__DEV__) console.log('[Cloudinary upload success]', {
      index, httpStatus: res.status,
      hasSecureUrl: Boolean(res.data?.secure_url),
      hasPublicId: Boolean(res.data?.public_id),
    });
    return res.data.secure_url;
  } catch (err) {
    if (__DEV__) console.log('[Cloudinary upload failure]', {
      index,
      errorName: err.name,
      errorCode: err.code,
      axiosStatus: err.response?.status,
      // Cloudinary renvoie {error: {message}} en cas de rejet (preset/format/
      // signature) — jamais de secret dans ce champ, seulement un message
      // métier. Tronqué par prudence, jamais loggé en entier ni en prod.
      responseDataSafe: typeof err.response?.data?.error?.message === 'string'
        ? err.response.data.error.message.slice(0, 300)
        : undefined,
    });
    throw new Error('Cloudinary upload failed');
  }
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
  const body = {
    ...payload,
    latitude: payload.latitude ?? -4.2661,
    longitude: payload.longitude ?? 15.2832,
  };
  // HOTFIX-MOB-PROPERTY-PUBLISH-FAILURE-2 — instrumentation DEV expurgée :
  // aucune valeur métier sensible (adresse complète, téléphone) ni JWT n'est
  // loggée, uniquement des présences booléennes et le type/catégorie déjà
  // affichés dans le récapitulatif de l'écran. `categorie` (vente/location/
  // hebergement) est un champ distinct de `type` (nature physique du bien) —
  // jamais dérivé l'un de l'autre dans ce payload (voir buildBasePropertyPayload).
  if (__DEV__) console.log('[Property publish request]', {
    type: body.type,
    statusOrListingType: body.categorie,
    imageCount: Array.isArray(body.photos) ? body.photos.length : 0,
    titlePresent: Boolean(body.titre),
    cityPresent: Boolean(body.ville),
    areaPresent: body.superficie !== undefined,
    pricePresent: body.prix !== undefined,
    bedroomsPresent: body.chambres !== undefined,
    bathroomsPresent: body.bathrooms !== undefined,
    payloadKeys: Object.keys(body),
  });
  try {
    const res = await api.post('/properties/mobile', body);
    const property = res.data?.data?.property || res.data?.property;
    if (__DEV__) console.log('[Property publish response]', {
      httpStatus: res.status,
      success: res.data?.status === 'success' || Boolean(property),
      propertyIdPresent: Boolean(property?._id || property?.id),
    });
    return property;
  } catch (err) {
    const backendMessageSafe = typeof (err.response?.data?.message || err.response?.data?.error) === 'string'
      ? (err.response.data.message || err.response.data.error).slice(0, 300)
      : undefined;
    if (__DEV__) console.log('[Property publish failure]', {
      errorName: err.name,
      errorCode: err.code,
      axiosStatus: err.response?.status,
      backendCode: err.response?.data?.code,
      backendMessageSafe,
    });
    throw new Error(backendMessageSafe || 'Erreur lors de la publication');
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
