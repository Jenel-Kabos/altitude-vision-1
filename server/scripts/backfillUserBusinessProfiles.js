// USER-ARCH-1 — Phase 4 : backfill rétrocompatible des profils métiers.
// STRICTEMENT ADDITIF — ne modifie, ne supprime et n'écrase jamais aucune
// donnée existante (User.role, Property, Hotel, Accommodation,
// HotelStaffAssignment, Locataire restent intouchés) ; ne fait que CRÉER
// des documents UserBusinessProfile pour les utilisateurs qui n'en ont pas
// encore, déduits des données déjà réelles (voir
// userBusinessProfileService.deriveProfilesFromExistingData).
//
// Idempotent : peut être relancé sans risque, grantProfile() ne crée
// jamais de doublon (index unique partiel sur user+profileType actif).
//
// Par défaut en mode DRY-RUN (--apply requis pour écrire réellement) —
// n'a jamais été exécuté contre la base de données réelle dans le cadre de
// ce sprint (voir rapport final USER-ARCH-1) : fourni comme outil prêt à
// l'emploi, l'exécution reste une décision opérationnelle délibérée.
//
// Volontairement : ne crée PAS de profil 'client' en masse (un profil par
// simple utilisateur Client/User n'apporte aucune valeur d'audit et
// gonflerait la collection sans raison) — seuls 'proprietaire_immobilier',
// 'exploitant_etablissement' et 'locataire' sont dérivés, car ce sont les
// seuls à lever une réelle ambiguïté métier (l'objet de ce sprint).
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { deriveProfilesFromExistingData, grantProfile } = require('../services/userBusinessProfileService');

const APPLY = process.argv.includes('--apply');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await User.find({}).select('_id').lean();
  const summary = { scanned: 0, wouldCreate: 0, created: 0, byType: {} };

  for (const u of users) {
    summary.scanned += 1;
    // eslint-disable-next-line no-await-in-loop
    const derived = await deriveProfilesFromExistingData(u._id);
    for (const profileType of derived) {
      summary.byType[profileType] = (summary.byType[profileType] || 0) + 1;
      summary.wouldCreate += 1;
      if (APPLY) {
        // eslint-disable-next-line no-await-in-loop
        const profile = await grantProfile({ userId: u._id, profileType, source: 'derived', metadata: { backfill: true } });
        if (profile) summary.created += 1;
      }
    }
  }

  console.log(`[backfillUserBusinessProfiles] mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`[backfillUserBusinessProfiles] utilisateurs scannés: ${summary.scanned}`);
  console.log(`[backfillUserBusinessProfiles] profils ${APPLY ? 'créés' : 'à créer'}: ${summary.wouldCreate}`);
  console.log('[backfillUserBusinessProfiles] répartition par type:', summary.byType);
  if (!APPLY) console.log('[backfillUserBusinessProfiles] Aucune écriture effectuée — relancer avec --apply pour appliquer.');

  await mongoose.disconnect();
}

main().catch((err) => { console.error('[backfillUserBusinessProfiles] échec', err); process.exit(1); });
