const Contrat  = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const { uploadToCloudinary } = require('../config/cloudinary');
const zohoMailService        = require('../services/zohoMailService');
const pdfService             = require('../services/pdfService');

const MOIS_FR = [
  'janvier','février','mars','avril','mai','juin',
  'juillet','août','septembre','octobre','novembre','décembre',
];

// ── Helper : fetch contrat fully populated ────────────────────
const fetchContrat = (id) =>
  Contrat.findById(id)
    .populate('proprietaire', 'nom prenom email telephone adresse ville')
    .populate('locataire',    'nom prenom email telephone adresse ville');

// ── Helper : upload PDF buffer to Cloudinary ─────────────────
const uploadPdf = async (buffer, folder, filename) => {
  const result = await uploadToCloudinary(buffer, {
    folder,
    resource_type: 'raw',
    public_id: filename,
    format: 'pdf',
    quality: undefined,
    fetch_format: undefined,
    width: undefined,
    crop: undefined,
  });
  return result.secure_url;
};

// ── Helper : push document to contrat.documents[] ────────────
const saveDocToContrat = async (contratId, nom, url, type) => {
  const doc = { nom, url, type, dateGeneration: new Date() };
  await Contrat.findByIdAndUpdate(contratId, { $push: { documents: doc } });
  return doc;
};

// ═════════════════════════════════════════════════════════════
// GET /contrat/:contratId
// ═════════════════════════════════════════════════════════════
exports.getDocuments = async (req, res) => {
  try {
    const c = await Contrat.findById(req.params.contratId)
      .select('documents etatsDesLieux');
    if (!c) return res.status(404).json({ status:'error', message:'Contrat introuvable' });
    res.json({ status:'success', data:{ documents: c.documents, etatsDesLieux: c.etatsDesLieux } });
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
    const url     = await uploadPdf(buffer, folder, fname);
    const saved   = await saveDocToContrat(c._id, 'Contrat de bail', url, 'bail');

    res.json({ status:'success', data:{ document: saved } });
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
    const url       = await uploadPdf(buffer, folder, fname);
    const nom       = `Quittance ${moisLabel} ${p.annee}`;
    const saved     = await saveDocToContrat(c._id, nom, url, 'quittance');

    res.json({ status:'success', data:{ document: saved } });
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
    const url       = await uploadPdf(buffer, folder, fname);
    const nom       = `Mise en demeure — ${moisLabel} ${p.annee}`;
    const saved     = await saveDocToContrat(c._id, nom, url, 'mise_en_demeure');

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
           <p>Vous pouvez télécharger le document ici : <a href="${url}">Télécharger la mise en demeure</a></p>
           <p>Merci de régulariser votre situation dans les 8 jours.<br/>Altitude Vision — Altimmo</p>`,
        );
      } catch (emailErr) {
        console.error('❌ [PDF] Email mise en demeure:', emailErr.message);
      }
    }

    res.json({ status:'success', data:{ document: saved } });
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
    const url    = await uploadPdf(buffer, folder, fname);
    const saved  = await saveDocToContrat(
      c._id,
      `Préavis — initiateur ${typeInitiateur}`,
      url,
      'preavis',
    );

    res.json({ status:'success', data:{ document: saved } });
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
    const edlData = { type, date: new Date(), pieces };
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
    const url    = await uploadPdf(buffer, folder, fname);

    // Mettre à jour l'URL du document dans etatsDesLieux
    await Contrat.findOneAndUpdate(
      { _id: c._id, 'etatsDesLieux.type': type },
      { $set: { 'etatsDesLieux.$.documentUrl': url } },
    );

    const saved = await saveDocToContrat(
      c._id,
      `État des lieux d'${type === 'entree' ? 'entrée' : 'sortie'}`,
      url,
      `etat_${type}`,
    );

    res.json({ status:'success', data:{ document: saved } });
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
       <p><a href="${doc.url}" style="padding:10px 20px;background:#2E7BB5;color:#fff;text-decoration:none;border-radius:6px">
         📄 Télécharger ${doc.nom}
       </a></p>
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
  } catch (err) {
    console.error('❌ [PDF] envoyerDocument:', err.message);
    res.status(500).json({ status:'error', message: err.message });
  }
};
