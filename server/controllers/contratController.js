const Contrat  = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const rentalSync = require('../services/rentalListingSyncService');
const { logAction, buildAuteur } = require('../services/actionLogService');
const { notify } = require('../services/notificationService');
const RealEstateReservation = require('../models/RealEstateReservation');
// GL-ARCH-1.1 : extrait dans un service partagé pour être réutilisé par le
// script de réconciliation historique (server/scripts/reconcileRentalManagement.js)
// — comportement strictement inchangé, voir rentalManagementLeaseSyncService.js.
const { ensureRentalManagementActive, syncLeaseOccupation } = require('../services/rentalManagementLeaseSyncService');
// GL-LIFE-1 — la machine d'état devient l'unique point d'entrée pour tout
// changement de `statut` sur un bail (comportement inchangé pour les
// contrats de vente, hors périmètre du cycle de vie locatif).
const leaseLifecycle = require('../services/rentalLeaseLifecycleService');
// SCL-2 — la machine d'état du cycle de vie du contrat de VENTE devient
// l'unique porte d'entrée pour toute progression de `saleCycle` — le
// controller n'écrit JAMAIS `saleCycle`/`saleCycleHistory` directement.
const saleLifecycle = require('../services/saleContractLifecycleService');
const { generatePaiements } = require('../services/rentalPaymentScheduleService');
const { assertResourceTenantOrUnattributed } = require('../services/platformTenant/tenantResourceAttributionService');
const { resolveTenantForUser } = require('../services/platformTenant/tenantContextService');
const { isModuleAvailable } = require('../middleware/tenantModuleGate');

// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.2.XIV — CONTRAT-DOMAIN-SPLIT.
// Sur la surface POLYMORPHIQUE legacy `/api/contrats/:id` (PUT/DELETE),
// la présence du module `location` est vérifiée à l'exécution en fonction
// du type persisté du contrat visé — les surfaces typées
// `/api/contrats/location/*` appliquent déjà cette garde en amont via
// `requireTenantModule('location')`. Sans cette garde inline, un tenant
// dépourvu du module `location` pourrait encore atteindre la mutation d'un
// contrat de location par la route polymorphique historique.
async function ensureModuleAvailableForContratType(req, contratType) {
  if (contratType !== 'location') return;
  const tenantId = req.platformTenant?._id;
  if (!tenantId) return; // requireTenantScope amont a déjà bloqué le cas
  const ok = await isModuleAvailable(tenantId, 'location');
  if (!ok) {
    const err = new Error('Module tenant indisponible (attendu : location).');
    err.statusCode = 403; err.code = 'TENANT_MODULE_UNAVAILABLE';
    throw err;
  }
}

// SECURITY-FINAL-CLOSURE-BLOCKERS-HOTFIX-1 (FCA1-01) — même frontière
// canonique que `router.param('id', …)` de contratRoutes.js (TENANT-CERT-2) :
// `POST /` créait un Contrat sur `req.body.bien` sans jamais vérifier que
// cette Property appartienne au tenant de l'acteur.
async function assertPropertyTenantAccess(req, property) {
  const explicitTenantId = req.get?.('X-Platform-Tenant-Id') || req.get?.('X-Tenant-Id') || null;
  const tenant = await resolveTenantForUser(req.user._id || req.user.id, explicitTenantId);
  await assertResourceTenantOrUnattributed({ resourceType: 'Property', resource: property, tenantId: tenant?._id });
}

// SECURITY-CLOSURE-P1-WAVE-1 (P1-A, finding RA-04) — même relation
// canonique que `paiementController.scopedContratIdsForTenant`
// (SECURITY-CLOSURE-P0-WAVE-1) : `Contrat.bien.owner → OrgMembership`, plus
// PROPERTY-DIRECT-TENANT — `Property.tenant` prend la précédence quand il
// est renseigné (canonique 2E.1.X), fallback historique via `owner`.
async function scopedContratFilterForTenant(req) {
  if (!req.platformTenant) return {};
  const propertyIds = await Property.find({
    $or: [
      { tenant: req.platformTenant._id },
      { tenant: null, owner: { $in: req.tenantScopeUserIds || [] } },
    ],
  }).distinct('_id');
  return { bien: { $in: propertyIds } };
}

// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.2.XIII (B2) — PUT allow-list schema-
// backed. Un `updates = { ...req.body }` sans allow-list permet à un membre
// tenant légitime de rebinder `bien`, `proprietaire`, `locataire`, `type`,
// `reservation`, … après le contrôle de frontière `router.param('id', …)`
// qui n'inspecte QUE la pré-image. Interdiction canonique (schema-driven) :
//  - `comment` est accepté dans le body en passthrough vers
//    rentalLeaseLifecycleService (contrat existant) mais JAMAIS persisté
//    directement par le controller.
//  - `cycleVie`/`cycleHistory` sont persistés UNIQUEMENT par la state
//    machine — écriture directe interdite.
const LOCATION_MUTABLE_FIELDS = new Set(['statut', 'dateEntree', 'dateFinBail', 'montantLoyer', 'montantCaution', 'notes', 'documents']);
const VENTE_MUTABLE_FIELDS = new Set(['statut', 'prixVente', 'dateSignatureCompromis', 'dateSignatureActe', 'commissionAgence', 'conditionsSuspensives', 'notes', 'documents']);
const PASSTHROUGH_FIELDS = new Set(['comment']);

function partitionUpdate(body, contratType) {
  const allowed = contratType === 'vente' ? VENTE_MUTABLE_FIELDS : LOCATION_MUTABLE_FIELDS;
  const rejected = [];
  const persisted = {};
  const passthrough = {};
  for (const key of Object.keys(body || {})) {
    if (allowed.has(key)) {
      persisted[key] = body[key];
    } else if (PASSTHROUGH_FIELDS.has(key)) {
      passthrough[key] = body[key];
    } else {
      rejected.push(key);
    }
  }
  return { persisted, passthrough, rejected };
}

exports.getAll = async (req, res) => {
  try {
    const filter = await scopedContratFilterForTenant(req);
    if (req.query.statut) filter.statut = req.query.statut;
    if (req.query.type)   filter.type   = req.query.type;

    const contrats = await Contrat.find(filter)
      .populate('proprietaire', 'nom prenom telephone')
      .populate('locataire',    'nom prenom telephone')
      .populate('bien',         'title address')
      .sort({ createdAt: -1 });

    res.json({ status: 'success', results: contrats.length, data: { contrats } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const c = await Contrat.findById(req.params.id)
      .populate('proprietaire', 'nom prenom telephone email')
      .populate('locataire',    'nom prenom telephone email')
      .populate('bien',         'title address city');
    if (!c) return res.status(404).json({ status: 'error', message: 'Contrat introuvable' });
    res.json({ status: 'success', data: { contrat: c } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    if (!req.body?.bien || !['location', 'vente'].includes(req.body?.type)) {
      return res.status(400).json({ status: 'fail', code: 'INVALID_CONTRACT_INPUT', message: 'Le bien et le type de contrat sont requis.' });
    }
    const property = await Property.findById(req.body.bien).select('status statusAdmin availability owner price reservationLock');
    if (!property) return res.status(404).json({ status: 'fail', code: 'PROPERTY_NOT_FOUND', message: 'Bien introuvable.' });
    try {
      await assertPropertyTenantAccess(req, property);
    } catch (error) {
      return res.status(error.statusCode || 404).json({ status: 'fail', message: error.statusCode ? error.message : 'Bien introuvable.' });
    }
    if (property.status !== req.body.type) {
      return res.status(409).json({ status: 'fail', code: 'CONTRACT_TYPE_MISMATCH', message: 'Le type de contrat ne correspond pas au bien.' });
    }
    // REG-GL-1 : deux parcours légitimes et distincts créent un Contrat via
    // cette même route. (1) Le parcours public candidature/réservation
    // (RealEstateApplicationsPage → acceptation → réservation active) doit
    // rester strictement verrouillé sur cette réservation (IM-1R/IM-2.2) —
    // une réservation publique n'existe que sur une annonce publiée, donc
    // `statusAdmin==='Validée'` y reste un invariant légitime, pas une
    // dépendance métier à la publication. (2) La création manuelle par le
    // staff depuis GestionLocativePage (« Ajouter un contrat ») n'a jamais
    // transmis de `reservation`.
    // GL-ARCH-1 : pour ce second parcours, la Gestion Locative est la source
    // de vérité — la publication (statusAdmin) n'est qu'une vitrine
    // commerciale et ne doit jamais conditionner la création d'un bail
    // (Admin/Gestionnaire Immobilier doivent pouvoir créer un bail sur
    // n'importe quel bien pris en gestion, publié ou non). Seule la
    // disponibilité réelle du bien (occupation) reste vérifiée ici.
    let reservation = null;
    if (req.body.reservation) {
      reservation = await RealEstateReservation.findById(req.body.reservation);
      const expectedReservationType = req.body.type === 'location' ? 'rental' : 'sale';
      if (!reservation || reservation.status !== 'active' || reservation.expiresAt <= new Date()
        || reservation.type !== expectedReservationType || String(reservation.property) !== String(property._id)) {
        return res.status(409).json({ status: 'fail', code: 'ACTIVE_RESERVATION_REQUIRED', message: 'Une réservation active et cohérente est requise.' });
      }
      if (property.statusAdmin !== 'Validée' || property.availability !== 'Réservé' || String(property.reservationLock?.reservation) !== String(reservation._id)) {
        return res.status(409).json({ status: 'fail', code: 'PROPERTY_NOT_AVAILABLE', message: 'Ce bien ne peut plus faire l’objet d’un nouveau contrat.' });
      }
    } else if (property.availability !== 'Disponible') {
      return res.status(409).json({ status: 'fail', code: 'PROPERTY_NOT_AVAILABLE', message: 'Ce bien ne peut plus faire l’objet d’un nouveau contrat.' });
    }
    // GL-RECON-1 — l'invariant Property → RentalManagement actif → Contrat
    // doit être vrai AVANT l'insertion du bail. La synchronisation complète
    // d'occupation reste ensuite déléguée au même service officiel.
    if (req.body.type === 'location') {
      const rental = await ensureRentalManagementActive({
        property,
        actor: req.user.id,
        monthlyRent: req.body.montantLoyer,
      });
      if (!rental?.active || !rental?.managementActivated) {
        return res.status(409).json({
          status: 'fail',
          code: 'RENTAL_MANAGEMENT_REQUIRED',
          message: 'Le bien doit être activé en Gestion locative avant la création du bail.',
        });
      }
    }

    const c = await Contrat.create(req.body);
    if (reservation) {
      await RealEstateReservation.updateOne({ _id: reservation._id, status: 'active', contract: null }, { $set: { contract: c._id }, $push: { history: { from: 'active', to: 'active', action: 'contract_created', actor: req.user._id } } });
    }

    if (c.type === 'location') {
      await generatePaiements(c._id, c.dateEntree, c.dateFinBail, c.montantLoyer);
      await syncLeaseOccupation(c, req.user.id);
      // GL-LIFE-1 — amorce le cycle de vie dès la création (sinon dérivé à
      // la première transition) ; n'écrase jamais une valeur déjà fournie.
      if (!c.cycleVie) {
        c.cycleVie = leaseLifecycle.deriveCycleVie(c);
        c.cycleHistory.push({ to: c.cycleVie, action: 'contrat_cree', actor: req.user.id });
        await c.save();
      }
    }

    const populated = await c.populate([
      { path: 'proprietaire', select: 'nom prenom telephone' },
      { path: 'locataire',    select: 'nom prenom telephone' },
      { path: 'bien',         select: 'title address' },
    ]);

    res.status(201).json({ status: 'success', data: { contrat: populated } });

    // Notifie locataire et propriétaire s'ils ont un userId
    const notifBase = {
      type:  'contrat_new',
      title: 'Nouveau contrat 📄',
      body:  `Un contrat de ${c.type || 'location'} pour "${populated.bien?.title || 'votre bien'}" a été établi.`,
      data:  { screen: 'Profil' },
    };
    [populated.proprietaire?.userId, populated.locataire?.userId]
      .filter(Boolean)
      .forEach((uid) => notify({ recipient: uid, ...notifBase }).catch(() => {}));

    logAction({
      action: 'Contrat créé',
      description: `Contrat de ${c.type || 'location'} créé`,
      module: 'GestionLocative',
      typeAction: 'CRÉATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(c._id), type: 'Contrat', nom: `Contrat ${c.type || ''} #${c._id}` },
      req,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ status: 'fail', code: 'PROPERTY_CONTRACT_ALREADY_OPEN', message: 'Un contrat en attente ou actif existe déjà pour ce bien.' });
    }
    res.status(400).json({ status: 'error', message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const existing = await Contrat.findById(req.params.id).select('type statut');
    if (!existing) return res.status(404).json({ status: 'error', message: 'Contrat introuvable' });

    try { await ensureModuleAvailableForContratType(req, existing.type); }
    catch (e) { return res.status(e.statusCode || 403).json({ status: 'fail', code: e.code, message: e.message }); }

    // USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.2.XIII (B2) — allow-list
    // schema-backed. Un champ hors allow-list (identité structurelle ou
    // inconnu) fait échouer la requête en 400 SANS écriture partielle.
    const { persisted, passthrough, rejected } = partitionUpdate(req.body, existing.type);
    if (rejected.length) {
      return res.status(400).json({
        status: 'fail',
        code: 'CONTRACT_FIELD_NOT_MUTABLE',
        message: `Champ(s) non modifiable(s) via PUT /api/contrats/:id : ${rejected.join(', ')}.`,
        fields: rejected,
      });
    }

    const updates = { ...persisted };
    if (existing.type === 'location' && updates.statut !== undefined && updates.statut !== existing.statut) {
      // GL-LIFE-1 : toute demande de changement de statut sur un bail passe
      // désormais par la machine d'état centralisée — rejetée (409) si la
      // transition est illégale, jamais un écrasement silencieux.
      await leaseLifecycle.requestStatutChange(existing._id, updates.statut, { actor: req.user.id, comment: passthrough.comment });
      delete updates.statut; // déjà appliqué et synchronisé par la state machine
    }

    // SCL-2 — pour un contrat de VENTE, toute progression légale
    // (dateSignatureCompromis / dateSignatureActe) et toute demande de
    // changement de `statut` passent par la machine d'état. Le controller
    // n'écrit JAMAIS ces champs directement.
    if (existing.type === 'vente') {
      try {
        const outcome = await saleLifecycle.applyPutMutation({
          contratId: existing._id,
          payload: { ...updates, ...(Object.prototype.hasOwnProperty.call(req.body, 'statut') ? { statut: req.body.statut } : {}) },
          actor: req.user.id,
          comment: passthrough.comment,
        });
        // Champs déjà persistés par la machine — ne pas les ré-écrire ici.
        for (const k of outcome.consumedFields) delete updates[k];
        // La machine gère `statut` de bout en bout pour la vente : jamais
        // écrit directement par le controller.
        delete updates.statut;
      } catch (err) {
        return res.status(err.statusCode || 409).json({
          status: 'fail',
          code: err.code || 'CONTRACT_LIFECYCLE_ERROR',
          message: err.message,
        });
      }
    }

    const c = await Contrat.findByIdAndUpdate(req.params.id, updates, {
      new: true, runValidators: true,
    })
      .populate('proprietaire', 'nom prenom telephone')
      .populate('locataire',    'nom prenom telephone')
      .populate('bien',         'title address');

    if (!c) return res.status(404).json({ status: 'error', message: 'Contrat introuvable' });
    await syncLeaseOccupation(c, req.user.id);
    res.json({ status: 'success', data: { contrat: c } });

    [c.proprietaire?.userId, c.locataire?.userId]
      .filter(Boolean)
      .forEach((uid) => notify({
        recipient: uid,
        type:  'contrat_updated',
        title: 'Contrat mis à jour',
        body:  `Votre contrat pour "${c.bien?.title || 'votre bien'}" a été modifié.`,
        data:  { screen: 'Profil' },
      }).catch(() => {}));

    logAction({
      action: 'Contrat modifié',
      description: `Contrat #${c._id} mis à jour`,
      module: 'GestionLocative',
      typeAction: 'MODIFICATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(c._id), type: 'Contrat', nom: `Contrat ${c.type || ''} #${c._id}` },
      req,
    });
  } catch (err) {
    res.status(err.statusCode || 400).json({ status: 'error', message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const c = await Contrat.findById(req.params.id);
    if (!c) return res.status(404).json({ status: 'error', message: 'Contrat introuvable' });
    try { await ensureModuleAvailableForContratType(req, c.type); }
    catch (e) { return res.status(e.statusCode || 403).json({ status: 'fail', code: e.code, message: e.message }); }
    const historicalPayment = await Paiement.findOne({
      contrat: c._id,
      $or: [
        { statut: { $in: ['payé', 'partiel'] } },
        { montantRecu: { $gt: 0 } },
        { datePaiement: { $ne: null } },
        { reference: { $nin: [null, ''] } },
      ],
    }).select('_id');
    if (historicalPayment || (c.documents?.length || 0) > 0) {
      return res.status(409).json({ status: 'fail', code: 'CONTRACT_HISTORY_IMMUTABLE', message: 'Ce contrat possède un historique financier ou documentaire et doit être archivé, pas supprimé.' });
    }
    if (c.type === 'location' && c.bien) {
      const rental = await RentalManagement.findOne({ property: c.bien?._id || c.bien });
      if (rental?.activeLease?.toString() === c._id.toString()) {
        await rentalSync.schedulePropertyExit(rental._id, {
          actor: req.user.id,
          source: 'contract',
          comment: 'Contrat supprimé : contrôle de sortie requis',
        });
      }
    }
    // Seules des échéances sans encaissement peuvent encore exister ici.
    await Paiement.deleteMany({ contrat: req.params.id });
    await Contrat.deleteOne({ _id: c._id });
    res.json({ status: 'success', message: 'Contrat et paiements supprimés' });
    logAction({
      action: 'Contrat supprimé',
      description: `Contrat #${c._id} et ses paiements supprimés`,
      module: 'GestionLocative',
      typeAction: 'SUPPRESSION',
      auteur: buildAuteur(req.user),
      cible: { id: String(c._id), type: 'Contrat', nom: `Contrat ${c.type || ''} #${c._id}` },
      req,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// GET /api/contrats/:id/paiements
exports.getPaiements = async (req, res) => {
  try {
    const filter = { contrat: req.params.id };
    if (req.query.annee) filter.annee = parseInt(req.query.annee, 10);

    const paiements = await Paiement.find(filter).sort({ annee: 1, mois: 1 });
    res.json({ status: 'success', data: { paiements } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// POST /api/contrats/:id/paiements — RETIRÉ (décision B3).
// Ancien comportement : `Paiement.create({...req.body, contrat: id})` — un
// chemin d'écriture parallèle sans idempotence, sans CAS, sans reçu, sans
// marker `paymentDomain`, sans discrimination location/vente. Aucun caller
// runtime (frontend/mobile/scripts) — voir audit lot PCCTA §17. La surface
// canonique d'écriture de paiement locatif reste `/api/paiements/location/*`
// (B.2). L'endpoint est conservé authentifié + tenant-frontière pour ne pas
// devenir un oracle non authentifié, puis répond 410 Gone.
exports.createPaiement = async (req, res) => {
  return res.status(410).json({
    status: 'fail',
    code: 'CONTRACT_PAYMENT_ENDPOINT_RETIRED',
    message: 'Point d\'entrée retiré. Utilisez la surface canonique /api/paiements/location/*.',
  });
};
