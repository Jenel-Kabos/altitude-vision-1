#!/usr/bin/env node
/*
 * Audit non destructif des anciens Proprietaire.bi ensPropres.
 * Aucune écriture : les rapprochements par titre/ville ne sont jamais assez sûrs
 * pour fusionner automatiquement deux biens physiques.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Proprietaire = require('../models/Proprietaire');
const Property = require('../models/Property');

const normalize = (value) => String(value || '').trim().toLocaleLowerCase('fr');
const args = process.argv.slice(2);
const exportIndex = args.indexOf('--export-report');
const exportPath = exportIndex >= 0
  ? path.resolve(args[exportIndex + 1] || `rental-migration-report-${Date.now()}.json`)
  : null;

const scoreCandidate = (legacy, property) => {
  let score = 0;
  if (normalize(property.title) === normalize(legacy.titre)) score += 40;
  if (normalize(property.address?.city) === normalize(legacy.ville)) score += 20;
  if (legacy.adresse && normalize(property.address?.street) === normalize(legacy.adresse)) score += 20;
  if (normalize(property.type) === normalize(legacy.type)) score += 10;
  const legacySurface = Number(legacy.superficie); const propertySurface = Number(property.surface);
  if (legacySurface > 0 && propertySurface > 0 && Math.abs(legacySurface - propertySurface) / legacySurface <= 0.05) score += 10;
  return score;
};

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI absent.');
  await mongoose.connect(process.env.MONGO_URI);
  const proprietaires = await Proprietaire.find({ 'biensPropres.0': { $exists: true } }).lean();
  const properties = await Property.find({ pole: 'Altimmo' }).select('_id title address owner status type surface price').lean();
  const report = [];

  for (const owner of proprietaires) {
    for (const legacy of owner.biensPropres || []) {
      const candidates = properties
        .map((property) => ({ propertyId: property._id, score: scoreCandidate(legacy, property) }))
        .filter((candidate) => candidate.score >= 40)
        .sort((a, b) => b.score - a.score);
      const topScore = candidates[0]?.score || 0;
      const ambiguous = candidates.length > 1 && candidates[1].score === topScore;
      report.push({
        proprietaireId: owner._id,
        proprietaire: { nom: owner.nom, prenom: owner.prenom, email: owner.email || null },
        legacyBienId: legacy._id,
        title: legacy.titre,
        city: legacy.ville,
        address: legacy.adresse || null,
        surface: legacy.superficie || null,
        type: legacy.type || null,
        price: legacy.typeBien === 'location' ? legacy.prixLoyer || null : legacy.prixVente || null,
        candidateCount: candidates.length,
        candidates,
        topScore,
        ambiguous,
        recommendedAction: candidates.length === 0 ? 'CREATE_PROPERTY_AFTER_REVIEW' : ambiguous ? 'MANUAL_DISAMBIGUATION' : topScore >= 80 ? 'REVIEW_AND_LINK' : 'DETAILED_MANUAL_REVIEW',
      });
    }
  }

  const output = { mode: exportPath ? 'EXPORT_REPORT' : 'DRY_RUN', writes: 0, generatedAt: new Date().toISOString(), legacyCount: report.length, report };
  if (exportPath) fs.writeFileSync(exportPath, JSON.stringify(output, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ ...output, ...(exportPath && { exportPath }) }, null, 2));
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(JSON.stringify({ mode: 'DRY_RUN', error: error.message }));
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
