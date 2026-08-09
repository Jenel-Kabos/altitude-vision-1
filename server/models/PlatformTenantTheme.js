// TENANT-CORE-1 (Phase 5) — Branding par PlatformTenant : logo, couleurs,
// nom de marque affiché. Aujourd'hui codé en dur (logo unique
// `client/public/images/Logo_Altitude1.png`, couleurs `secondary`/`gold` —
// voir CLAUDE.md) : purement additif, un tenant sans thème utilise les
// valeurs par défaut actuelles de la plateforme (voir `defaults` ci-dessous),
// jamais un changement visuel pour l'agence existante tant qu'aucun thème
// n'est explicitement configuré.
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformTenant', required: true, unique: true, index: true },
  logoUrl: { type: String, trim: true, default: null },
  brandName: { type: String, trim: true, maxlength: 200, default: null },
  primaryColor: { type: String, trim: true, default: '#C8960C', maxlength: 20 }, // GOLD, défaut actuel de la plateforme
  secondaryColor: { type: String, trim: true, default: '#2E7BB5', maxlength: 20 }, // BLUE, défaut actuel
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('PlatformTenantTheme', schema);
