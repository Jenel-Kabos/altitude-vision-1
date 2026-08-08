// ORGANIZATION-1 — Couche organisationnelle générique, AU-DESSUS de tout ce
// qui existe déjà (User, UserBusinessProfile, HotelStaffAssignment,
// Property.owner, Hotel.manager, CRM) — ne remplace rien de tout cela.
//
// Choix d'architecture : le brief propose un exemple à 4 niveaux fixes
// (Organisation → BusinessUnit → Département → Équipe). Un UNIQUE modèle
// générique auto-référencé (`type` + `parent` + chemin matérialisé) a été
// retenu à la place, car il satisfait littéralement l'exigence explicite
// « la profondeur doit rester flexible » : ajouter un niveau futur (marque,
// pôle, filiale de filiale…) ne nécessite qu'une nouvelle valeur de `type`,
// jamais une migration de schéma ni un nouveau modèle Mongoose. C'est aussi
// le patron « chemin matérialisé » standard pour les hiérarchies Mongo —
// permet de résoudre "tous les descendants de X" en UNE requête indexée
// (préfixe de `path`), jamais une récursion applicative (voir Phase 6/9).
const mongoose = require('mongoose');
const { ORG_UNIT_TYPES, ORG_UNIT_STATUSES } = require('../constants/organizationConstants');

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  type: { type: String, enum: ORG_UNIT_TYPES, required: true },
  // Racine (type:'organization') uniquement : parent obligatoirement null.
  // Tout le reste doit avoir un parent — la profondeur au-delà de ce point
  // n'est jamais contrainte par le schéma (voir organizationService.js pour
  // la validation applicative, volontairement souple).
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'OrgUnit', default: null },
  // Chemin matérialisé "/<idRacine>/.../<idParentDirect>/" — jamais inclut
  // l'unité elle-même. Recalculé uniquement à la création (aucun
  // déplacement de sous-arbre pris en charge dans ce sprint, voir dettes).
  ancestors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'OrgUnit' }],
  path: { type: String, default: '/', index: true },
  // Rattachement optionnel, purement indicatif, à un établissement métier
  // déjà existant — jamais un remplacement de Hotel.manager/
  // HotelStaffAssignment/Property.owner, qui restent seuls responsables de
  // l'autorisation par objet. Sert uniquement de pont pour Phase 7/9 (ex :
  // filtrer le Reporting Hôtel par l'hôtel lié à cette unité organisationnelle).
  linkedEstablishment: {
    establishmentType: { type: String, enum: ['Hotel', 'Property', null], default: null },
    establishmentId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  status: { type: String, enum: ORG_UNIT_STATUSES, default: 'active', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

schema.index({ parent: 1 });
schema.index({ type: 1, status: 1 });

module.exports = mongoose.model('OrgUnit', schema);
