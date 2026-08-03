// DOC-EVO-1 — Recherche globale intelligente. Pure lecture, aucune nouvelle
// collection : interroge les modèles déjà existants (Document, Contrat via
// Property/Locataire/Proprietaire, FinancialDocument) et renvoie une liste
// unifiée de résultats, chacun pointant soit vers un dossier métier
// (server/services/dossier/), soit vers une route déjà existante. Réservé
// au staff — mêmes rôles que le reste du Centre documentaire (STAFF_DOC).
const Property = require('../../models/Property');
const Locataire = require('../../models/Locataire');
const Proprietaire = require('../../models/Proprietaire');
const Contrat = require('../../models/Contrat');
const Document = require('../../models/Document');
const FinancialDocument = require('../../models/FinancialDocument');

const MAX_RESULTS_PER_SOURCE = 10;
const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function searchDossiers(rawQuery) {
  const q = String(rawQuery || '').trim();
  // Une requête purement numérique (ex: "7") est une recherche de référence
  // exacte (docNumber, N° de facture) — toujours autorisée, même à un seul
  // chiffre. Le texte libre reste soumis à un minimum de 2 caractères pour
  // éviter un balayage trop large sur une seule lettre.
  const isNumericQuery = /^\d+$/.test(q);
  if (!isNumericQuery && q.length < 2) return [];
  const regex = new RegExp(escapeRegExp(q), 'i');
  const results = [];

  // ── Gestion locative (bail = dossier) — par bien, locataire, propriétaire ──
  const [properties, locataires, proprietaires] = await Promise.all([
    Property.find({ title: regex }).select('_id').limit(MAX_RESULTS_PER_SOURCE).lean(),
    Locataire.find({ $or: [{ nom: regex }, { prenom: regex }] }).select('_id').limit(MAX_RESULTS_PER_SOURCE).lean(),
    Proprietaire.find({ $or: [{ nom: regex }, { prenom: regex }] }).select('_id').limit(MAX_RESULTS_PER_SOURCE).lean(),
  ]);
  const propertyIds = properties.map((p) => p._id);
  const locataireIds = locataires.map((l) => l._id);
  const proprietaireIds = proprietaires.map((p) => p._id);

  if (propertyIds.length || locataireIds.length || proprietaireIds.length) {
    const contrats = await Contrat.find({
      $or: [
        propertyIds.length && { bien: { $in: propertyIds } },
        locataireIds.length && { locataire: { $in: locataireIds } },
        proprietaireIds.length && { proprietaire: { $in: proprietaireIds } },
      ].filter(Boolean),
    })
      .populate('bien', 'title').populate('locataire', 'nom prenom').populate('proprietaire', 'nom prenom')
      .limit(MAX_RESULTS_PER_SOURCE).lean();
    contrats.forEach((c) => {
      const locataireName = c.locataire ? `${c.locataire.prenom || ''} ${c.locataire.nom || ''}`.trim() : null;
      results.push({
        label: `Bail — ${c.bien?.title || 'Bien'}${locataireName ? ` (${locataireName})` : ''}`,
        kind: 'dossier', domain: 'gestion_locative', entityId: String(c._id),
      });
    });
  }

  // ── Document (devis/facture/contrat/EDL/pièce d'identité) ──
  const docs = await Document.find({ $or: [{ refNom: regex }, { notes: regex }] })
    .select('_id type refNom notes docNumber').limit(MAX_RESULTS_PER_SOURCE).lean();
  docs.forEach((d) => {
    results.push({ label: `${d.type}${d.docNumber ? ` #${d.docNumber}` : ''} — ${d.refNom || d.notes || ''}`.trim(), kind: 'document', documentId: String(d._id) });
  });
  if (isNumericQuery) {
    const byNumber = await Document.find({ docNumber: Number(q) }).select('_id type refNom docNumber').limit(MAX_RESULTS_PER_SOURCE).lean();
    byNumber.forEach((d) => results.push({ label: `${d.type} #${d.docNumber} — ${d.refNom || ''}`.trim(), kind: 'document', documentId: String(d._id) }));
  }

  // ── FinancialDocument (factures hôtel/hébergement/vente/location) ──
  const financialDocs = await FinancialDocument.find({
    $or: [{ documentNumber: regex }, { 'customer.name': regex }],
  }).select('_id domain establishmentType documentNumber customer subjectType subjectId').limit(MAX_RESULTS_PER_SOURCE).lean();
  const DOSSIER_DOMAIN_BY_ESTABLISHMENT = { Hotel: 'hotellerie', Accommodation: 'hebergement' };
  financialDocs.forEach((doc) => {
    const dossierDomain = DOSSIER_DOMAIN_BY_ESTABLISHMENT[doc.establishmentType];
    results.push({
      label: `Facture ${doc.documentNumber || '(brouillon)'} — ${doc.customer?.name || ''}`.trim(),
      kind: dossierDomain ? 'dossier' : 'financial_document',
      domain: dossierDomain, entityId: dossierDomain ? String(doc.subjectId) : undefined,
      financialDocumentId: String(doc._id),
    });
  });

  return results;
}

module.exports = { searchDossiers };
