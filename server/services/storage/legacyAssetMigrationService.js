// STORAGE-LEGACY-1 — moteur de migration des documents privés Cloudinary
// legacy (`type=upload` public → `type=authenticated`). Idempotent,
// résumable, réversible sans republication automatique. AUCUN appel
// d'écriture Cloudinary/Mongo n'est exécuté tant que `apply !== true` — et
// `apply: true` seul ne suffit pas (voir `assertApplyAuthorized`).
//
// Stratégie retenue (Option C, voir STORAGE_LEGACY_1_AUDIT.md §Preuve
// Cloudinary) : `cloudinary.uploader.rename(oldPublicId, newPublicId, {
// type: 'upload', to_type: 'authenticated', invalidate: true })`. Le SDK
// installé (`cloudinary@2.9.0`) expose bien `to_type` et `invalidate` sur
// `rename` (vérifié dans `node_modules/cloudinary/lib/uploader.js`). Cette
// option déplace la ressource existante sans re-upload ni duplication de
// stockage, et son changement de segment d'URL (`/upload/` →
// `/authenticated/`) rend l'ancienne URL structurellement invalide dès la
// bascule. `invalidate: true` demande en plus la purge du cache CDN, mais
// Cloudinary documente cette invalidation comme "best effort" (jusqu'à ~10
// minutes, non garantie à 100 % hors plan Advanced) — c'est pourquoi
// `verifyOldUrlInaccessible` doit être exécuté et consigné séparément
// plutôt que supposé instantané.
const PrivateAssetMigration = require('../../models/PrivateAssetMigration');
const { resolveResourceTenant } = require('../platformTenant/tenantResourceAttributionService');
const { classifyLegacyAsset, isMigratable, resourceTypeFromUrl } = require('./legacyAssetClassification');

const LOCK_TTL_MS = 5 * 60 * 1000; // un verrou plus vieux que ça est considéré abandonné (crash worker)

// ── Étapes 1-3 : résolution + classification, jamais d'écriture ──────────
async function planLegacyMigration({ resourceType, resource, field, url, publicId, isPublicMedia = false, alreadyAuthenticated = false }) {
  const attribution = await resolveResourceTenant({ resourceType, resource });
  const classificationResult = classifyLegacyAsset({
    isPublicMedia,
    alreadyAuthenticated,
    url,
    publicId,
    tenantResolution: attribution.status,
  });
  const decision = isMigratable(classificationResult.classification) && attribution.status === 'resolved'
    ? 'migratable'
    : 'stop';
  return {
    resourceType,
    field,
    attribution,
    ...classificationResult,
    decision,
    reason: decision === 'stop'
      ? `classification=${classificationResult.classification} tenantResolution=${attribution.status}`
      : 'classification_B_tenant_resolved',
  };
}

// ── Autorisation d'exécution réelle (§35) ─────────────────────────────────
// Toutes les conditions suivantes sont obligatoires. Absence de l'une
// d'elles → refus, jamais un comportement dégradé silencieux.
function assertApplyAuthorized({ apply, mongoUriExplicit, tenantIdExplicit, classification, confirmToken }) {
  if (!apply) return; // chemin dry-run, toujours autorisé
  const errors = [];
  if (process.env.ALLOW_PRIVATE_ASSET_MIGRATION_APPLY !== 'true') errors.push('ALLOW_PRIVATE_ASSET_MIGRATION_APPLY!=true');
  if (!mongoUriExplicit) errors.push('mongoUri_not_explicit');
  if (!tenantIdExplicit) errors.push('tenantId_not_explicit');
  if (classification !== 'B') errors.push('classification_not_B');
  if (confirmToken !== 'I_UNDERSTAND_THIS_MODIFIES_CLOUDINARY_AND_MONGODB') errors.push('confirmToken_invalid');
  if (errors.length) {
    const error = new Error(`APPLY_NOT_AUTHORIZED: ${errors.join(',')}`);
    error.code = 'APPLY_NOT_AUTHORIZED';
    throw error;
  }
}

async function acquireJournal({ resource, resourceId, field, tenant, oldPublicId, oldDeliveryType, actor }) {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - LOCK_TTL_MS);
  // Upsert + verrouillage en UNE seule opération atomique côté serveur
  // (§19/§20) : deux `findOneAndUpdate` séparés (upsert puis lock) laissent
  // une fenêtre où deux workers peuvent tous deux réussir l'upsert avant
  // qu'aucun n'ait posé son verrou. En une seule commande, si le filtre ne
  // matche aucun document existant modifiable (déjà verrouillé par un autre
  // worker, ou déjà `completed`), Mongo tente un insert et l'index unique
  // `{resource, resourceId, field}` le rejette avec E11000 — signal fiable
  // qu'une autre migration est déjà en cours ou terminée.
  try {
    const locked = await PrivateAssetMigration.findOneAndUpdate(
      {
        resource, resourceId, field,
        status: { $nin: ['completed'] },
        $or: [{ lockedAt: null }, { lockedAt: { $lt: staleBefore } }],
      },
      {
        $setOnInsert: {
          resource, resourceId, field, tenant, oldPublicId, oldDeliveryType, actor, status: 'pending', checkpoint: 'resolved',
        },
        $set: { lockedAt: now, lockOwner: `${process.pid}:${Math.random().toString(36).slice(2)}` },
        $inc: { attempt: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return { journal: locked, alreadyCompleted: false };
  } catch (error) {
    if (error?.code === 11000) {
      const fresh = await PrivateAssetMigration.findOne({ resource, resourceId, field });
      if (fresh?.status === 'completed') return { journal: fresh, alreadyCompleted: true };
      const lockedError = new Error('MIGRATION_LOCKED');
      lockedError.code = 'MIGRATION_LOCKED';
      throw lockedError;
    }
    throw error;
  }
}

async function releaseLock(journalId, patch) {
  return PrivateAssetMigration.findByIdAndUpdate(journalId, { $set: { ...patch, lockedAt: null, lockOwner: null } }, { new: true });
}

// ── Étapes 4-14 : protocole transactionnel logique ────────────────────────
// `deps` isole tout ce qui n'appartient pas génériquement au moteur :
//   - cloudinaryClient : { rename, resourceExists } (mockable en test)
//   - applyDbUpdate(journal) : bascule la référence Mongo propre au modèle
//     appelant (le moteur ne connaît pas le schéma de chaque collection)
//   - verifyDbUpdate(journal) : relit et confirme la bascule
//   - verifyOldUrlInaccessible(oldUrl) : requête HTTP, voir
//     `verifyOldUrlProof.js`
async function executeLegacyMigration({
  resource, resourceId, field, tenant, oldPublicId, oldDeliveryType = 'upload', newPublicId, resourceType, oldUrl,
  actor = null, apply = false, mongoUriExplicit = null, tenantIdExplicit = null, classification, confirmToken = null,
  deps = {},
}) {
  // STORAGE-LEGACY-CERT-1 (Phase 4) — les uploads legacy de ce dépôt
  // utilisent `resource_type: 'auto'` (jamais un type fixe), donc le type
  // Cloudinary réel (`image`/`video`/`raw`) ne peut être connu qu'en le
  // dérivant de l'URL legacy observée. Un défaut fixe (ex. toujours 'raw')
  // ferait échouer `rename` sur tout document `image`/`video` réel — ne
  // JAMAIS le supposer. `deps.resourceKind` reste un override explicite
  // pour les appelants qui connaissent déjà le type avec certitude.
  const derivedResourceKind = deps.resourceKind || resourceTypeFromUrl(oldUrl);
  assertApplyAuthorized({ apply, mongoUriExplicit, tenantIdExplicit, classification, confirmToken });

  const { journal, alreadyCompleted } = await acquireJournal({
    resource, resourceId, field, tenant, oldPublicId, oldDeliveryType, actor,
  });
  if (alreadyCompleted) return { status: 'no_op', reason: 'already_migrated', journal };
  if (!apply) {
    await releaseLock(journal._id, { checkpoint: 'plan_verified_dry_run' });
    return { status: 'dry_run', reason: 'apply_false', journal };
  }

  try {
    // 4. snapshot BEFORE
    await PrivateAssetMigration.findByIdAndUpdate(journal._id, {
      $set: {
        beforeSnapshot: { publicId: oldPublicId, deliveryType: oldDeliveryType, resourceType, field, capturedAt: new Date() },
        checkpoint: 'snapshot_before',
      },
    });

    // 5-7. localiser l'ancien asset, créer/basculer le nouvel asset privé, vérifier
    if (!derivedResourceKind) {
      throw Object.assign(new Error('CLOUDINARY_RESOURCE_KIND_UNKNOWN'), { code: 'CLOUDINARY_RESOURCE_KIND_UNKNOWN' });
    }
    const finalPublicId = newPublicId || oldPublicId;
    const renameResult = await deps.cloudinaryClient.rename(oldPublicId, finalPublicId, {
      type: oldDeliveryType, to_type: 'authenticated', invalidate: true, resource_type: derivedResourceKind,
    });
    if (!renameResult || renameResult.type !== 'authenticated') {
      throw Object.assign(new Error('NEW_PRIVATE_ASSET_VERIFICATION_FAILED'), { code: 'NEW_PRIVATE_ASSET_VERIFICATION_FAILED' });
    }
    await PrivateAssetMigration.findByIdAndUpdate(journal._id, {
      $set: { newPublicId: finalPublicId, status: 'private_asset_ready', checkpoint: 'new_asset_verified' },
    });

    // 8. vérifier accès backend autorisé (délégué à l'appelant — les routes
    // métier existantes de STORAGE-SECURITY-1 sont réutilisées, jamais
    // recréées) — exécuté par le harness de test appelant, pas ce moteur.

    // 9-10. bascule DB + vérification
    await deps.applyDbUpdate({ journal, newPublicId: finalPublicId });
    const dbVerified = await deps.verifyDbUpdate({ journal, newPublicId: finalPublicId });
    if (!dbVerified) {
      throw Object.assign(new Error('DB_SWITCH_VERIFICATION_FAILED'), { code: 'DB_SWITCH_VERIFICATION_FAILED' });
    }
    await PrivateAssetMigration.findByIdAndUpdate(journal._id, { $set: { status: 'db_switched', checkpoint: 'db_switched' } });

    // 11-12. l'ancien asset public n'existe déjà plus sous `type=upload`
    // (le rename l'a déplacé) — révocation effective par construction. On
    // vérifie malgré tout l'OLD URL explicitement plutôt que de le supposer.
    const oldUrlInaccessible = oldUrl ? await deps.verifyOldUrlInaccessible(oldUrl) : true;
    if (!oldUrlInaccessible) {
      throw Object.assign(new Error('OLD_URL_STILL_ACCESSIBLE'), { code: 'OLD_URL_STILL_ACCESSIBLE' });
    }
    await PrivateAssetMigration.findByIdAndUpdate(journal._id, {
      $set: { status: 'old_revoked', checkpoint: 'old_url_verified_inaccessible', oldUrlVerifiedInaccessible: true },
    });

    // 13-14. journal + complétion
    const completed = await releaseLock(journal._id, {
      status: 'completed',
      checkpoint: 'completed',
      completedAt: new Date(),
      afterSnapshot: { publicId: finalPublicId, deliveryType: 'authenticated', resourceType, field, capturedAt: new Date() },
    });
    return { status: 'completed', journal: completed };
  } catch (error) {
    await releaseLock(journal._id, { status: 'failed', errorCode: error.code || error.message });
    throw error;
  }
}

// ── Réversibilité contrôlée (§21) ─────────────────────────────────────────
// Ne restaure QUE la référence DB/metadata vers l'état précédent le run en
// échec ; ne recrée JAMAIS une exposition publique automatiquement. Un
// retour à `upload` public exige une action administrative explicite
// distincte, non exposée ici.
async function rollbackFailedMigration({ journalId, deps }) {
  const journal = await PrivateAssetMigration.findById(journalId);
  if (!journal) throw new Error('MIGRATION_JOURNAL_NOT_FOUND');
  if (journal.status === 'completed') {
    throw Object.assign(new Error('CANNOT_ROLLBACK_COMPLETED_MIGRATION'), { code: 'CANNOT_ROLLBACK_COMPLETED_MIGRATION' });
  }
  // La bascule DB effective se déduit du `checkpoint` atteint, jamais du
  // `status` final : un run en échec est toujours reclassé `failed`, ce qui
  // écraserait `db_switched` si on l'utilisait comme critère — perdant la
  // trace de ce qui a réellement été modifié avant l'échec (§20 reprise).
  const dbWasSwitched = ['db_switched', 'old_url_verified_inaccessible', 'completed'].includes(journal.checkpoint);
  if (dbWasSwitched && deps?.restoreDbReference) {
    await deps.restoreDbReference({ journal });
  }
  return releaseLock(journal._id, { status: 'rolled_back' });
}

module.exports = {
  planLegacyMigration,
  executeLegacyMigration,
  rollbackFailedMigration,
  assertApplyAuthorized,
  LOCK_TTL_MS,
};
