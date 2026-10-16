// F-U1.G / F-U1.H — Séparation des fonctions sur l'identité humaine réelle.
//
// Deux comptes distincts appartenant à la même personne ne doivent pas pouvoir
// cumuler des rôles incompatibles (initier puis approuver, approuver deux
// fois…). Signaux de MÊME personne (suffisent à refuser) : même compte, même
// téléphone normalisé, même identité attestée (HumanIdentityAttestation).
// Aucun rapprochement par nom (homonymies).
//
// Preuve d'INDÉPENDANCE (requise pour les actions critiques) : chaque compte
// doit porter une attestation d'identité vérifiée, et les identités doivent
// différer. Deux téléphones différents ne prouvent jamais l'indépendance.

const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../../../models/User');
const HumanIdentityAttestation = require('../../../models/HumanIdentityAttestation');
const { fail } = require('../financialError');
const { IDENTITY_DOCUMENT_KINDS } = require('../../../constants/contractualFinanceConstants');

// Empreinte HMAC d'un numéro de pièce. Clé : HUMAN_IDENTITY_FINGERPRINT_KEY
// (jamais journalisée), version : HUMAN_IDENTITY_FINGERPRINT_KEY_VERSION.
// Rotation : une nouvelle version n'est comparable qu'aux empreintes de même
// version ; les attestations antérieures restent valides et sont recalculées
// lors d'un renouvellement de dossier (le numéro n'est jamais conservé).
function computeIdentityFingerprint({ documentKind, documentNumber }) {
  const key = process.env.HUMAN_IDENTITY_FINGERPRINT_KEY;
  if (!key || key.length < 32) fail('IDENTITY_FINGERPRINT_KEY_MISSING', 'Configuration de sécurité des identités absente.', 500);
  if (!IDENTITY_DOCUMENT_KINDS.includes(documentKind)) fail('IDENTITY_DOCUMENT_INVALID', 'Type de pièce invalide.', 422);
  const normalized = String(documentNumber || '').replace(/[\s.-]/g, '').toUpperCase();
  if (normalized.length < 5 || normalized.length > 40 || !/^[A-Z0-9]+$/.test(normalized)) fail('IDENTITY_DOCUMENT_INVALID', 'Numéro de pièce invalide.', 422);
  return {
    identityKey: crypto.createHmac('sha256', key).update(`${documentKind}:${normalized}`).digest('hex'),
    keyVersion: process.env.HUMAN_IDENTITY_FINGERPRINT_KEY_VERSION || 'v1',
    hint: normalized.slice(-3),
  };
}

const idOf = (value) => {
  const raw = value?._id ?? value?.id ?? value;
  return raw == null ? null : String(raw);
};

const normalizePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 8 ? digits.slice(-9) : null;
};

async function identityKeys(userIds) {
  const ids = [...new Set(userIds.map(idOf).filter((id) => id && mongoose.isValidObjectId(id)))];
  const [users, attestations] = await Promise.all([
    User.find({ _id: { $in: ids } }).select('phone').lean(),
    // Toute attestation vivante (même suspendue ou expirée) reste un signal
    // fiable de MÊME personne ; seule la révocation l'efface.
    HumanIdentityAttestation.find({ user: { $in: ids }, status: { $in: ['verified', 'suspended'] } }).select('+identityKey +fingerprintKeyVersion user').lean(),
  ]);
  const phones = new Map(users.map((user) => [String(user._id), normalizePhone(user.phone)]));
  const identities = new Map(attestations.map((item) => [String(item.user), `${item.fingerprintKeyVersion || 'v1'}:${item.identityKey}`]));
  return new Map(ids.map((id) => [id, new Set([
    `user:${id}`,
    ...(phones.get(id) ? [`phone:${phones.get(id)}`] : []),
    ...(identities.get(id) ? [`identity:${identities.get(id)}`] : []),
  ])]));
}

// `parties` : { libellé: userId | userId[] }.
// - Sans `actor` : toutes les parties doivent être des personnes distinctes
//   (y compris à l'intérieur d'une liste, ex. approbateurs).
// - Avec `actor` : seule la personne qui agit est comparée à chacune des
//   autres ; les autres parties peuvent coïncider entre elles (ex. le
//   propriétaire qui a lui-même déclaré puis confirmé).
async function assertDistinctHumans(parties, { actor = null } = {}) {
  const entries = [];
  Object.entries(parties).forEach(([label, value]) => {
    (Array.isArray(value) ? value : [value]).forEach((userId) => { if (idOf(userId)) entries.push({ label, userId: idOf(userId) }); });
  });
  const keys = await identityKeys(entries.map((entry) => entry.userId));
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      if (actor && entries[i].label !== actor && entries[j].label !== actor) continue;
      const a = keys.get(entries[i].userId) || new Set([`user:${entries[i].userId}`]);
      const b = keys.get(entries[j].userId) || new Set([`user:${entries[j].userId}`]);
      if ([...a].some((key) => b.has(key))) {
        fail('FINANCIAL_SEGREGATION_OF_DUTIES', `Une même personne ne peut pas cumuler les fonctions « ${entries[i].label} » et « ${entries[j].label} ».`, 403);
      }
    }
  }
  return true;
}

// Indépendance établie seulement si chaque compte porte une attestation
// vérifiée et que les identités attestées sont toutes différentes.
// Seules les attestations UTILISABLES (vérifiées, non expirées) comptent ;
// `basis` liste celles sur lesquelles repose l'indépendance établie.
async function assessIndependence(userIds, { now = new Date() } = {}) {
  const ids = [...new Set(userIds.map(idOf).filter(Boolean))];
  const attestations = await HumanIdentityAttestation.find({ user: { $in: ids }, ...HumanIdentityAttestation.usableFilter(now) })
    .select('+identityKey +fingerprintKeyVersion user').lean();
  const byUser = new Map(attestations.map((item) => [String(item.user), item]));
  const unverified = ids.filter((id) => !byUser.has(id));
  const keys = ids.map((id) => byUser.get(id)).filter(Boolean).map((item) => `${item.fingerprintKeyVersion || 'v1'}:${item.identityKey}`);
  const duplicated = new Set(keys).size !== keys.length;
  return {
    established: unverified.length === 0 && !duplicated && ids.length === userIds.filter(Boolean).length,
    unverified,
    sameIdentity: duplicated,
    basis: ids.filter((id) => byUser.has(id)).map((id) => ({ user: id, attestation: byUser.get(id)._id })),
  };
}

// Toutes les attestations citées sont-elles encore utilisables ?
async function isIdentityBasisUsable(basis, { now = new Date() } = {}) {
  if (!basis?.length) return true;
  const count = await HumanIdentityAttestation.countDocuments({ _id: { $in: basis.map((item) => item.attestation) }, ...HumanIdentityAttestation.usableFilter(now) });
  return count === basis.length;
}

module.exports = { assertDistinctHumans, assessIndependence, isIdentityBasisUsable, computeIdentityFingerprint, normalizePhone };
