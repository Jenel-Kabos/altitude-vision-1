const Contrat  = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const mongoose = require('mongoose');
const { uploadPrivateAsset, safePrivateDescriptor } = require('../services/storage/secureStorageService');
const zohoMailService        = require('../services/zohoMailService');
const pdfService             = require('../services/pdfService');
const { logAction, buildAuteur } = require('../services/actionLogService');
const { notifyContractTenant } = require('../services/rentalTenantNotificationService');

const MOIS_FR = [
  'janvier','février','mars','avril','mai','juin',
  'juillet','août','septembre','octobre','novembre','décembre',
];

// ── Helper : fetch contrat fully populated ────────────────────
const fetchContrat = (id) =>
  Contrat.findById(id)
    .populate('proprietaire', 'nom prenom email telephone adresse ville')
    .populate('locataire',    'nom prenom email telephone adresse ville user');

const notifyVisibleDocument = (contract, saved, kind = 'document') => notifyContractTenant(contract, {
  type: kind === 'receipt' ? 'tenant_receipt_added' : 'tenant_document_added',
  title: kind === 'receipt' ? 'Nouvelle quittance disponible' : 'Nouveau document disponible',
  body: `« ${saved.nom} » est disponible dans votre espace locataire.`,
  entityType: 'Contrat', entityId: contract._id,
  dedupeKey: `tenant:${kind}:${contract._id}:${saved._id}`,
  metadata: { contractId: String(contract._id), documentType: saved.type },
}).catch(() => {});

// ── Helper : upload PDF buffer to Cloudinary ─────────────────
const uploadPdf = async (buffer, folder, filename) => {
  return uploadPrivateAsset(buffer, {
    purpose: 'lease', ownerType: 'Contrat', ownerId: folder.split('/').pop(),
    filename: `${filename}.pdf`, mimeType: 'application/pdf', folder,
  });
};

// ── Helper : push document to contrat.documents[] ────────────
// `extra` (GL-DEBT-1) reste optionnel — les 5 appels existants sans 4e
// argument continuent de produire exactement le même document qu'avant.
const saveDocToContrat = async (contratId, nom, asset, type, extra = {}) => {
  const doc = { _id: new mongoose.Types.ObjectId(), nom, asset, type, dateGeneration: new Date(), ...extra };
  await Contrat.findByIdAndUpdate(contratId, { $push: { documents: doc } });
  return { ...doc, ...safePrivateDescriptor(asset, {
    previewEndpoint: `/api/rental-documents/${doc._id}/download`,
    downloadEndpoint: `/api/rental-documents/${doc._id}/download?download=1`,
  }), asset: undefined };
};

// ═════════════════════════════════════════════════════════════
// GET /contrat/:contratId
// ═════════════════════════════════════════════════════════════
exports.getDocuments = async (req, res) => {
  try {
    const c = await Contrat.findById(req.params.contratId)
      .select('documents etatsDesLieux');
    if (!c) return res.status(404).json({ status:'error', message:'Contrat introuvable' });
    const documents = c.documents.map((doc) => ({ _id: doc._id, nom: doc.nom, type: doc.type, dateGeneration: doc.dateGeneration,
      invalidated: doc.invalidated, canPreview: Boolean(doc.asset || doc.url), canDownload: Boolean(doc.asset || doc.url),
      previewEndpoint: `/api/rental-documents/${doc._id}/download`, downloadEndpoint: `/api/rental-documents/${doc._id}/download?download=1`, legacy: !doc.asset }));
    const etatsDesLieux = c.etatsDesLieux.map(({ type, date, pieces, validatedByStaff, validatedAt, degradationReported, maintenanceRequired, blockingReason }) => ({ type, date, pieces, validatedByStaff, validatedAt, degradationReported, maintenanceRequired, blockingReason }));
    res.json({ status:'success', data:{ documents, etatsDesLieux } });
  } catch (err) {
    res.status(500).json({ status:'error', message: err.message });
  }
};

// ═════════════════════════════════════════════════════════════
// POST /bail/:contratId
// ═════════════════════════════════════════════════════════════
exports.generateBail = async (req, res) => {
  try {
    const c = await fetchContrat(req.params.contratId);
    if (!c) return res.status(404).json({ status:'error', message:'Contrat introuvable' });

    const buffer = await pdfService.generateContratBail({
      contrat: c, proprietaire: c.proprietaire, locataire: c.locataire,
    });

    const folder  = `altitude-vision/documents/bail/${c._id}`;
    const fname   = `bail_${Date.now()}`;
    const asset   = await uploadPdf(buffer, folder, fname);
    const saved   = await saveDocToContrat(c._id, 'Contrat de bail', asset, 'bail');
    await notifyVisibleDocument(c, saved);

    res.json({ status:'success', data:{ document: saved } });
    logAction({
      action: 'Contrat de bail généré',
      description: `PDF bail généré pour contrat #${c._id}`,
      module: 'GestionLocative',
      typeAction: 'GÉNÉRATION_PDF',
      auteur: buildAuteur(req.user),
      cible: { id: String(c._id), type: 'Contrat', nom: 'Contrat de bail' },
      req,
    });
  } catch (err) {
    console.error('❌ [PDF] generateBail:', err.message);
    res.status(500).json({ status:'error', message: err.message });
  }
};

// ═════════════════════════════════════════════════════════════
// POST /quittance/:paiementId
// ═════════════════════════════════════════════════════════════
exports.generateQuittance = async (req, res) => {
  try {
    const p = await Paiement.findById(req.params.paiementId).populate('contrat');
    if (!p) return res.status(404).json({ status:'error', message:'Paiement introuvable' });
    if (p.statut !== 'payé') {
      return res.status(400).json({ status:'error', message:'Ce paiement n\'est pas encore payé' });
    }

    const c = await fetchContrat(p.contrat._id);
    const buffer = await pdfService.generateQuittanceLoyer({
      paiement: p, contrat: c, proprietaire: c.proprietaire, locataire: c.locataire,
    });

    const moisLabel = p.mois ? MOIS_FR[p.mois - 1] : '';
    const folder    = `altitude-vision/documents/quittances/${c._id}`;
    const fname     = `quittance_${moisLabel}_${p.annee}_${Date.now()}`;
    const asset     = await uploadPdf(buffer, folder, fname);
    const nom       = `Quittance ${moisLabel} ${p.annee}`;
    const saved     = await saveDocToContrat(c._id, nom, asset, 'quittance', { sourcePaiement: p._id });
    await notifyVisibleDocument(c, saved, 'receipt');

    res.json({ status:'success', data:{ document: saved } });
    logAction({
      action: 'Quittance de loyer générée',
      description: `Quittance ${nom} générée`,
      module: 'GestionLocative',
      typeAction: 'GÉNÉRATION_PDF',
      auteur: buildAuteur(req.user),
      cible: { id: String(c._id), type: 'Paiement', nom },
      req,
    });
  } catch (err) {
    console.error('❌ [PDF] generateQuittance:', err.message);
    res.status(500).json({ status:'error', message: err.message });
  }
};

// ═════════════════════════════════════════════════════════════
// POST /mise-en-demeure/:paiementId
// ═════════════════════════════════════════════════════════════
exports.generateMiseEnDemeure = async (req, res) => {
  try {
    const p = await Paiement.findById(req.params.paiementId).populate('contrat');
    if (!p) return res.status(404).json({ status:'error', message:'Paiement introuvable' });

    const c = await fetchContrat(p.contrat._id);
    const buffer = await pdfService.generateMiseEnDemeure({
      paiement: p, contrat: c, locataire: c.locataire,
    });

    const moisLabel = p.mois ? MOIS_FR[p.mois - 1] : '';
    const folder    = `altitude-vision/documents/mises-en-demeure/${c._id}`;
    const fname     = `med_${moisLabel}_${p.annee}_${Date.now()}`;
    const asset     = await uploadPdf(buffer, folder, fname);
    const nom       = `Mise en demeure — ${moisLabel} ${p.annee}`;
    const saved     = await saveDocToContrat(c._id, nom, asset, 'mise_en_demeure');
    await notifyVisibleDocument(c, saved);

    // Envoi automatique par email si locataire a un email
    if (c.locataire?.email) {
      try {
        const fmt = (n) => n ? Number(n).toLocaleString('fr-FR') + ' FCFA' : '—';
        await zohoMailService.sendEmail(
          process.env.ZOHO_FROM || 'altimmo@altitudevision.agency',
          c.locataire.email,
          `⚠️ Mise en demeure — Loyer ${moisLabel} ${p.annee}`,
          `<p>Bonjour ${c.locataire.prenom} ${c.locataire.nom},</p>
           <p>Veuillez trouver ci-joint votre mise en demeure concernant le loyer du mois de <strong>${moisLabel} ${p.annee}</strong>.</p>
           <p>Montant total dû : <strong style="color:#D42B2B">${fmt(p.montantTotal || p.montant)}</strong></p>
           <p>Le document est disponible après connexion dans votre espace locataire sécurisé.</p>
           <p>Merci de régulariser votre situation dans les 8 jours.<br/>Altitude Vision — Altimmo</p>`,
        );
      } catch (emailErr) {
        console.error('❌ [PDF] Email mise en demeure:', emailErr.message);
      }
    }

    res.json({ status:'success', data:{ document: saved } });
    logAction({
      action: 'Mise en demeure générée',
      description: `Mise en demeure loyer ${moisLabel} ${p.annee} générée`,
      module: 'GestionLocative',
      typeAction: 'GÉNÉRATION_PDF',
      auteur: buildAuteur(req.user),
      cible: { id: String(c._id), type: 'Contrat', nom: `Mise en demeure ${moisLabel} ${p.annee}` },
      req,
    });
  } catch (err) {
    console.error('❌ [PDF] generateMiseEnDemeure:', err.message);
    res.status(500).json({ status:'error', message: err.message });
  }
};

// ═════════════════════════════════════════════════════════════
// POST /preavis/:contratId   body: { typeInitiateur }
// ═════════════════════════════════════════════════════════════
exports.generatePreavis = async (req, res) => {
  try {
    const { typeInitiateur = 'locataire' } = req.body;
    const c = await fetchContrat(req.params.contratId);
    if (!c) return res.status(404).json({ status:'error', message:'Contrat introuvable' });

    const buffer = await pdfService.generatePreavis(
      { contrat: c, proprietaire: c.proprietaire, locataire: c.locataire },
      typeInitiateur,
    );

    const folder = `altitude-vision/documents/preavis/${c._id}`;
    const fname  = `preavis_${typeInitiateur}_${Date.now()}`;
    const asset  = await uploadPdf(buffer, folder, fname);
    const saved  = await saveDocToContrat(
      c._id,
      `Préavis — initiateur ${typeInitiateur}`,
      asset,
      'preavis',
    );
    await notifyVisibleDocument(c, saved);

    res.json({ status:'success', data:{ document: saved } });
    logAction({
      action: 'Préavis généré',
      description: `Préavis (${typeInitiateur}) généré pour contrat #${c._id}`,
      module: 'GestionLocative',
      typeAction: 'GÉNÉRATION_PDF',
      auteur: buildAuteur(req.user),
      cible: { id: String(c._id), type: 'Contrat', nom: `Préavis — ${typeInitiateur}` },
      req,
    });
  } catch (err) {
    console.error('❌ [PDF] generatePreavis:', err.message);
    res.status(500).json({ status:'error', message: err.message });
  }
};

// ═════════════════════════════════════════════════════════════
// POST /etat-des-lieux/:contratId   body: { type, pieces }
// ═════════════════════════════════════════════════════════════
exports.generateEtatDesLieux = async (req, res) => {
  try {
    const { type = 'entree', pieces = [] } = req.body;
    const c = await fetchContrat(req.params.contratId);
    if (!c) return res.status(404).json({ status:'error', message:'Contrat introuvable' });

    // Sauvegarder l'état des lieux dans le contrat
    const edlData = { type, date: new Date(), pieces, createdBy: req.user.id, validatedByStaff: false };
    await Contrat.findByIdAndUpdate(c._id, { $push: { etatsDesLieux: edlData } });

    // Recharger pour avoir les etatsDesLieux à jour (pour comparaison)
    const cFresh = await fetchContrat(c._id);
    cFresh.etatsDesLieux = cFresh.etatsDesLieux || [];

    const buffer = await pdfService.generateEtatDesLieux(
      { contrat: cFresh, proprietaire: cFresh.proprietaire, locataire: cFresh.locataire },
      { ...edlData, pieces },
    );

    const folder = `altitude-vision/documents/etats-des-lieux/${c._id}`;
    const fname  = `edl_${type}_${Date.now()}`;
    const asset  = await uploadPdf(buffer, folder, fname);

    // Mettre à jour l'URL du document dans etatsDesLieux
    await Contrat.findOneAndUpdate(
      { _id: c._id, 'etatsDesLieux.type': type },
      { $set: { 'etatsDesLieux.$.documentAsset': asset } },
    );

    const saved = await saveDocToContrat(
      c._id,
      `État des lieux d'${type === 'entree' ? 'entrée' : 'sortie'}`,
      asset,
      `etat_${type}`,
    );
    await notifyVisibleDocument(c, saved);

    res.json({ status:'success', data:{ document: saved } });
    logAction({
      action: 'État des lieux généré',
      description: `État des lieux d'${type === 'entree' ? 'entrée' : 'sortie'} généré`,
      module: 'GestionLocative',
      typeAction: 'GÉNÉRATION_PDF',
      auteur: buildAuteur(req.user),
      cible: { id: String(c._id), type: 'Contrat', nom: `État des lieux d'${type === 'entree' ? 'entrée' : 'sortie'}` },
      req,
    });
  } catch (err) {
    console.error('❌ [PDF] generateEtatDesLieux:', err.message);
    res.status(500).json({ status:'error', message: err.message });
  }
};

// ═════════════════════════════════════════════════════════════
// POST /envoyer/:contratId/:docIndex   body: { email, sujet, message }
// ═════════════════════════════════════════════════════════════
exports.envoyerDocument = async (req, res) => {
  try {
    const { contratId, docIndex } = req.params;
    const { email, sujet, message } = req.body;

    const c = await Contrat.findById(contratId)
      .populate('locataire',    'nom prenom email')
      .populate('proprietaire', 'nom prenom email');
    if (!c) return res.status(404).json({ status:'error', message:'Contrat introuvable' });

    const doc = c.documents[parseInt(docIndex, 10)];
    if (!doc) return res.status(404).json({ status:'error', message:'Document introuvable' });

    const destinataire = email || c.locataire?.email;
    if (!destinataire) {
      return res.status(400).json({ status:'error', message:'Aucun email destinataire' });
    }

    const sujetFinal   = sujet || `Document — ${doc.nom}`;
    const messageFinal = message || `Veuillez trouver votre document "${doc.nom}" en cliquant sur le lien ci-dessous.`;

    await zohoMailService.sendEmail(
      process.env.ZOHO_FROM || 'altimmo@altitudevision.agency',
      destinataire,
      sujetFinal,
      `<p>${messageFinal}</p>
       <p>Le document est disponible après connexion dans votre espace sécurisé.</p>
       <br/><p>Cordialement,<br/>Altitude Vision — Altimmo</p>`,
    );

    // Marquer comme envoyé
    const idx = parseInt(docIndex, 10);
    await Contrat.findByIdAndUpdate(contratId, {
      $set: {
        [`documents.${idx}.envoiEmail`]: true,
        [`documents.${idx}.dateEnvoi`]:  new Date(),
      },
    });

    res.json({ status:'success', message:'Email envoyé avec succès' });
    logAction({
      action: 'Document envoyé par email',
      description: `"${doc.nom}" envoyé à ${destinataire}`,
      module: 'GestionLocative',
      typeAction: 'ENVOI_EMAIL',
      auteur: buildAuteur(req.user),
      cible: { id: contratId, type: 'Contrat', nom: doc.nom },
      req,
    });
  } catch (err) {
    console.error('❌ [PDF] envoyerDocument:', err.message);
    res.status(500).json({ status:'error', message: err.message });
  }
};
