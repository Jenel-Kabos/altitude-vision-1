// server/controllers/litigeController.js
const Litige   = require('../models/Litige');
const User     = require('../models/User');
const Property = require('../models/Property');
const sendEmail = require('../utils/email');
const { uploadPrivateAsset, readPrivateAsset } = require('../services/storage/secureStorageService');
const { streamRemoteDocument } = require('../services/storage/documentStreamingService');
const { ROLES_LITIGES } = require('../utils/roles');
const { assertResourceTenantOrUnattributed } = require('../services/platformTenant/tenantResourceAttributionService');

// SECURITY-CLOSURE-P1-WAVE-1 (P1-C, finding RA-07) — `Litige` n'a aucun
// champ tenant direct ; `tenantResourceAttributionService` supporte déjà
// nativement `resourceType: 'Litige'` via `bienConcerné` (Property). Jamais
// utilisé jusqu'ici dans ce contrôleur (ni pour les listes, ni même pour les
// accès unitaires `getLitige`/`downloadProof`).
async function scopedPropertyIdsForTenant(req) {
  if (!req.platformTenant) return null;
  return Property.find({ owner: { $in: req.tenantScopeUserIds || [] } }).distinct('_id');
}

// Ce fichier n'utilise pas `asyncHandler` (chaque handler a son propre
// try/catch qui répond `500` sur toute exception) — cette fonction répond
// donc elle-même et retourne `false` plutôt que de lever une erreur, pour
// ne jamais laisser le catch générique du handler appelant écraser le 403/404
// voulu par un 500.
async function assertLitigeTenantAccess(req, res, litige) {
  if (!req.platformTenant) return true;
  try {
    await assertResourceTenantOrUnattributed({ resourceType: 'Litige', resource: litige, tenantId: req.platformTenant._id });
    return true;
  } catch (error) {
    res.status(error.statusCode || 404).json({ status: 'fail', message: 'Litige introuvable.' });
    return false;
  }
}

const ADMIN_EMAIL = process.env.ZOHO_FROM_EMAIL || 'contact@altitudevision.agency';

// ── helpers ───────────────────────────────────────────────────
const typeLabel = {
  Information_fausse:  'Information fausse',
  Bien_inexistant:     'Bien inexistant',
  'Prix_non_respecté': 'Prix non respecté',
  Arnaque:             'Arnaque',
  Mauvaise_foi:        'Mauvaise foi',
  'Problème_paiement': 'Problème de paiement',
  Autre:               'Autre',
};

const notifyParties = async ({ litige, subject, htmlFn }) => {
  const emails = [];
  if (litige.plaignant?.email) emails.push(litige.plaignant.email);
  if (litige.accusé?.userId) {
    const u = await User.findById(litige.accusé.userId).select('email');
    if (u?.email) emails.push(u.email);
  }
  await Promise.allSettled(
    emails.map(email => sendEmail({ email, subject, html: htmlFn(email) }))
  );
};

// ======================================================
// 1. CRÉER UN LITIGE  POST /api/litiges
// ======================================================
exports.createLitige = async (req, res) => {
  try {
    const {
      type, description,
      plaignantNom, plaignantEmail, plaignantTelephone, plaignantType,
      accuséUserId, accuséNom, accuséEmail, accuséType,
      bienConcerné,
    } = req.body;

    if (!type || !description || !plaignantNom || !plaignantEmail) {
      return res.status(400).json({ status: 'fail', message: 'Champs obligatoires manquants.' });
    }

    // Référence auto
    const count = await Litige.countDocuments();
    const ref   = `LIT-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    // Upload preuves
    const preuves = [];
    if (req.files?.length) {
      for (const file of req.files) {
        const asset = await uploadPrivateAsset(file.buffer, {
          purpose: 'administrative', ownerType: 'Litige', ownerId: ref,
          filename: file.originalname, mimeType: file.mimetype,
        });
        preuves.push({ asset, nom: file.originalname, type: file.mimetype });
      }
    }

    const plaignantId = req.user?._id || undefined;

    const litige = await Litige.create({
      reference:    ref,
      type,
      description,
      bienConcerné: bienConcerné || undefined,
      plaignant: {
        userId:    plaignantId,
        nom:       plaignantNom,
        email:     plaignantEmail,
        telephone: plaignantTelephone || '',
        type:      plaignantType || 'Client',
      },
      accusé: {
        userId: accuséUserId || undefined,
        nom:    accuséNom    || '',
        email:  accuséEmail  || '',
        type:   accuséType   || 'Propriétaire',
      },
      preuves,
      timeline: [{ action: `Litige ouvert par ${plaignantNom}`, auteur: plaignantNom, role: plaignantType || 'Client' }],
    });

    // Emails en arrière-plan
    Promise.allSettled([
      // Admin
      sendEmail({
        email:   ADMIN_EMAIL,
        subject: `⚠️ Nouveau litige #${ref}`,
        message: `Un nouveau litige a été ouvert.\n\nRéférence : ${ref}\nType : ${typeLabel[type] || type}\nPlaignant : ${plaignantNom} (${plaignantEmail})\nDescription : ${description}\n\nVoir : altitudevision.agency/dashboard/litiges`,
      }),
      // Accusé si userId fourni
      ...(accuséUserId
        ? [User.findById(accuséUserId).select('email name').then(u => u && sendEmail({
            email:   u.email,
            subject: `⚠️ Un litige vous concernant — Altitude Vision`,
            message: `Bonjour ${u.name},\n\nUn litige vous concernant a été ouvert.\nRéférence : ${ref}\n\nMerci de nous contacter sous 48 heures à contact@altitudevision.agency ou de vous connecter à votre espace pour répondre.\n\nAltitude Vision`,
          }))]
        : []),
      // Plaignant
      sendEmail({
        email:   plaignantEmail,
        subject: `✅ Votre signalement ${ref} a été enregistré — Altitude Vision`,
        message: `Bonjour ${plaignantNom},\n\nVotre litige a bien été enregistré.\nRéférence : ${ref}\nType : ${typeLabel[type] || type}\n\nNous vous répondrons sous 48 heures ouvrables.\n\nAltitude Vision\ncontact@altitudevision.agency`,
      }),
    ]);

    res.status(201).json({ status: 'success', data: { litige: { _id: litige._id, reference: ref } } });
  } catch (err) {
    console.error('❌ [Litige] createLitige:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ======================================================
// 2. LISTE  GET /api/litiges
// ======================================================
exports.getLitiges = async (req, res) => {
  try {
    const isStaff = ROLES_LITIGES.includes(req.user?.role);
    const { statut, priorité, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (!isStaff) {
      filter.$or = [
        { 'plaignant.userId': req.user._id },
        { 'accusé.userId':    req.user._id },
      ];
    } else {
      const scopedPropertyIds = await scopedPropertyIdsForTenant(req);
      if (scopedPropertyIds) filter.bienConcerné = { $in: scopedPropertyIds };
    }
    if (statut)   filter.statut   = statut;
    if (priorité) filter.priorité = priorité;

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Litige.countDocuments(filter);
    const items = await Litige.find(filter)
      .sort({ dateOuverture: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('bienConcerné', 'title');

    res.json({ status: 'success', results: total, data: { litiges: items } });
  } catch (err) {
    console.error('❌ [Litige] getLitiges:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ======================================================
// 3. STATS  GET /api/litiges/stats
// ======================================================
exports.getStats = async (req, res) => {
  try {
    const scopedPropertyIds = await scopedPropertyIdsForTenant(req);
    const matchStage = scopedPropertyIds ? [{ $match: { bienConcerné: { $in: scopedPropertyIds } } }] : [];
    const [byStatut, byType, byPriorité] = await Promise.all([
      Litige.aggregate([...matchStage, { $group: { _id: '$statut',   count: { $sum: 1 } } }]),
      Litige.aggregate([...matchStage, { $group: { _id: '$type',     count: { $sum: 1 } } }]),
      Litige.aggregate([...matchStage, { $group: { _id: '$priorité', count: { $sum: 1 } } }]),
    ]);
    const toMap = arr => arr.reduce((acc, v) => { acc[v._id] = v.count; return acc; }, {});
    res.json({ status: 'success', data: { byStatut: toMap(byStatut), byType: toMap(byType), byPriorité: toMap(byPriorité) } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ======================================================
// 4. COMPTEUR DES LITIGES NON CONSULTÉS PAR LE STAFF
// ======================================================
exports.getUnreadCount = async (req, res) => {
  const scopedPropertyIds = await scopedPropertyIdsForTenant(req);
  const unreadCount = await Litige.countDocuments({
    staffViewedAt: null,
    ...(scopedPropertyIds ? { bienConcerné: { $in: scopedPropertyIds } } : {}),
  });
  res.json({ status: 'success', data: { unreadCount } });
};

// ======================================================
// 5. DÉTAIL  GET /api/litiges/:id
// ======================================================
exports.getLitige = async (req, res) => {
  try {
    if (!require('mongoose').isValidObjectId(req.params.id)) {
      return res.status(404).json({ status: 'fail', message: 'Litige introuvable.' });
    }

    const litige = await Litige.findById(req.params.id).populate('bienConcerné', 'title images');
    if (!litige) return res.status(404).json({ status: 'fail', message: 'Litige introuvable.' });

    const isStaff = ROLES_LITIGES.includes(req.user?.role);
    const isPart  = litige.plaignant?.userId?.equals(req.user._id) || litige.accusé?.userId?.equals(req.user._id);
    if (!isStaff && !isPart) return res.status(403).json({ status: 'fail', message: 'Accès refusé.' });
    if (isStaff && !(await assertLitigeTenantAccess(req, res, litige))) return;

    if (isStaff && !litige.staffViewedAt) {
      litige.staffViewedAt = new Date();
      await litige.save();
    }

    res.json({ status: 'success', data: { litige } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.downloadProof = async (req, res) => {
  try {
    const litige = await Litige.findById(req.params.id)
      .select('+preuves.asset.publicId +preuves.asset.resourceType +preuves.asset.deliveryType +preuves.asset.version +preuves.asset.format');
    if (!litige) return res.status(404).json({ status: 'fail', message: 'Litige introuvable.' });

    const isStaff = ROLES_LITIGES.includes(req.user?.role);
    const isPart = litige.plaignant?.userId?.equals(req.user._id) || litige.accusé?.userId?.equals(req.user._id);
    if (!isStaff && !isPart) return res.status(403).json({ status: 'fail', message: 'Accès refusé.' });
    if (isStaff && !(await assertLitigeTenantAccess(req, res, litige))) return;

    const proof = litige.preuves?.[Number(req.params.proofIndex)];
    if (!proof) return res.status(404).json({ status: 'fail', message: 'Preuve introuvable.' });
    if (!proof.asset && proof.url) {
      return streamRemoteDocument({ url: proof.url, name: proof.nom, res, context: { litigeId: litige._id } });
    }
    if (!proof.asset) return res.status(404).json({ status: 'fail', message: 'Preuve introuvable.' });

    const buffer = await readPrivateAsset(proof.asset.toObject());
    const safeName = String(proof.nom || 'preuve').replace(/[\r\n"\\]/g, '_');
    res.set({
      'Content-Type': proof.asset.mimeType || proof.type || 'application/octet-stream',
      'Content-Disposition': `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${safeName}"`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    }).send(buffer);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ======================================================
// 6. CHANGER STATUT  PUT /api/litiges/:id/statut
// ======================================================
exports.updateStatut = async (req, res) => {
  try {
    const { statut, note } = req.body;
    if (!statut) return res.status(400).json({ status: 'fail', message: 'Statut requis.' });

    const existing = await Litige.findById(req.params.id);
    if (!existing) return res.status(404).json({ status: 'fail', message: 'Litige introuvable.' });
    if (!(await assertLitigeTenantAccess(req, res, existing))) return;

    const litige = await Litige.findByIdAndUpdate(
      req.params.id,
      {
        statut,
        dateDerniereMaj: new Date(),
        $push: {
          timeline: {
            action: `Statut changé → ${statut}`,
            auteur: req.user.name,
            role:   'Admin',
            note:   note || '',
          },
        },
      },
      { new: true }
    );
    if (!litige) return res.status(404).json({ status: 'fail', message: 'Litige introuvable.' });

    // Notifier les parties
    const html = () => `<p>Bonjour,<br><br>Le statut de votre litige <strong>${litige.reference}</strong> a été mis à jour : <strong>${statut}</strong>${note ? `<br>Note : ${note}` : ''}.<br><br>Altitude Vision</p>`;
    await notifyParties({ litige, subject: `Mise à jour litige ${litige.reference}`, htmlFn: html });

    res.json({ status: 'success', data: { litige } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ======================================================
// 7. AJOUTER MESSAGE  POST /api/litiges/:id/message
// ======================================================
exports.addMessage = async (req, res) => {
  try {
    const { note } = req.body;
    if (!note) return res.status(400).json({ status: 'fail', message: 'Message requis.' });

    const litige = await Litige.findById(req.params.id);
    if (!litige) return res.status(404).json({ status: 'fail', message: 'Litige introuvable.' });

    const isAdmin = req.user?.role === 'Admin';
    const isPart  = litige.plaignant?.userId?.equals(req.user._id) || litige.accusé?.userId?.equals(req.user._id);
    if (!isAdmin && !isPart) return res.status(403).json({ status: 'fail', message: 'Accès refusé.' });
    if (isAdmin && !(await assertLitigeTenantAccess(req, res, litige))) return;

    litige.timeline.push({ action: 'Message ajouté', auteur: req.user.name, role: req.user.role, note });
    litige.dateDerniereMaj = new Date();
    await litige.save();

    res.json({ status: 'success', data: { litige } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ======================================================
// 8. RÉSOUDRE  POST /api/litiges/:id/resolution
// ======================================================
exports.resolverLitige = async (req, res) => {
  try {
    const { decision } = req.body;
    if (!decision) return res.status(400).json({ status: 'fail', message: 'Décision requise.' });

    const existingLitige = await Litige.findById(req.params.id);
    if (!existingLitige) return res.status(404).json({ status: 'fail', message: 'Litige introuvable.' });
    if (!(await assertLitigeTenantAccess(req, res, existingLitige))) return;

    const litige = await Litige.findByIdAndUpdate(
      req.params.id,
      {
        statut:          'Résolu',
        dateDerniereMaj: new Date(),
        resolution: { decision, dateResolution: new Date(), resolvedBy: req.user._id },
        $push: {
          timeline: {
            action: 'Litige résolu',
            auteur: req.user.name,
            role:   'Admin',
            note:   decision,
          },
        },
      },
      { new: true }
    );
    if (!litige) return res.status(404).json({ status: 'fail', message: 'Litige introuvable.' });

    const html = () => `<p>Bonjour,<br><br>Le litige <strong>${litige.reference}</strong> a été clôturé.<br><br><strong>Décision :</strong> ${decision}<br><br>Altitude Vision</p>`;
    await notifyParties({ litige, subject: `Litige ${litige.reference} résolu`, htmlFn: html });

    res.json({ status: 'success', data: { litige } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
