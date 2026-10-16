// F-U2 — Facturation financière unifiée.
//
// Aucune valeur tarifaire, fiscale ou d'échéance n'est définie ici : prix
// d'abonnement, délai de paiement, taxes et mentions obligatoires sont des
// paramètres à valider (SubscriptionTariff, identité légale vérifiée).

const mongoose = require('mongoose');

const BILLING_KINDS = Object.freeze({
  RENT: 'RENT',
  AUTONOMOUS_SUBSCRIPTION: 'AUTONOMOUS_SUBSCRIPTION',
  MANAGEMENT_COMMISSION: 'MANAGEMENT_COMMISSION',
  SUBSCRIPTION: 'SUBSCRIPTION',
  CREDIT_NOTE: 'CREDIT_NOTE',
});

// Ancre technique de la série de numérotation de l'émetteur PLATFORM
// (Altitude Vision) : une série continue par émetteur légal, tous types de
// facturation confondus. Les émetteurs TENANT utilisent l'identifiant du tenant.
const PLATFORM_ISSUER_ANCHOR = new mongoose.Types.ObjectId('6166752d706c6174666f726d');

// Rôles des parties, jamais confondus.
const BILLING_PARTY_ROLES = Object.freeze(['serviceProvider', 'issuer', 'collectionAgent', 'economicBeneficiary', 'payer']);

// F-U2.9 — Politique commerciale VALIDÉE de la gestion locative autonome
// Altimmo. Valeurs officielles : ne pas modifier sans nouvelle décision.
// Les tarifs actifs en base (SubscriptionTariff) doivent leur être identiques.
const ALTIMMO_AUTONOMOUS_PRICING = Object.freeze({
  version: 'ALTIMMO-AUTONOME-2026-10',
  decisionReference: 'Politique commerciale gestion autonome Altimmo validée (F-U2.9)',
  currency: 'XAF',
  // 1 % des loyers effectivement encaissés et confirmés, commun aux 4 formules.
  variableRateBasisPoints: 100,
  formulas: Object.freeze([
    Object.freeze({ code: 'GRATUIT', label: 'Gratuit', minProperties: 1, maxProperties: 1, monthlyPriceMinor: 0 }),
    Object.freeze({ code: 'STANDARD', label: 'Standard', minProperties: 2, maxProperties: 10, monthlyPriceMinor: 5000 }),
    Object.freeze({ code: 'ENTREPRISE', label: 'Entreprise', minProperties: 11, maxProperties: 20, monthlyPriceMinor: 10000 }),
    // Abonnement fixe déterminé par devis accepté.
    Object.freeze({ code: 'GRAND_PORTEFEUILLE', label: 'Grand portefeuille', minProperties: 21, maxProperties: null, monthlyPriceMinor: null }),
  ]),
});
const AUTONOMOUS_FORMULAS = Object.freeze(ALTIMMO_AUTONOMOUS_PRICING.formulas.map((formula) => formula.code));

// Politique de COMPTAGE des biens gérés — PROPOSITION à valider. Seule la
// catégorie « en gestion active avec bail en cours » est comptée ; la gestion
// déléguée est exclue (régime 10 %) ; les autres cas sont NON DÉCIDÉS et
// bloquent la facture fixe dès qu'ils pourraient changer la formule.
const PROPERTY_COUNTING_POLICY = Object.freeze({
  // F-U2.12/F-U2.13 — validé : biens autonomes activés, occupés ou vacants ;
  // hors simples annonces et biens délégués ; bien définitivement clôturé ou
  // désactivé : exclu à partir de sa date effective (compté pour la période
  // déjà commencée). Clôture sans date connue : à régulariser (bloquant si
  // elle change la formule).
  status: 'VALIDATED',
  categories: Object.freeze({
    MANAGED_OCCUPIED: 'COUNTED',
    DELEGATED: 'EXCLUDED',
    MANAGED_VACANT: 'COUNTED',
    ENDED_AFTER_PERIOD_START: 'COUNTED',
    LISTING_ONLY: 'EXCLUDED',
    INACTIVE: 'EXCLUDED',
    CLOSED_EFFECTIVE: 'EXCLUDED',
    CLOSED: 'UNDECIDED',
  }),
});

module.exports = {
  BILLING_KINDS, PLATFORM_ISSUER_ANCHOR, BILLING_PARTY_ROLES,
  ALTIMMO_AUTONOMOUS_PRICING, AUTONOMOUS_FORMULAS, PROPERTY_COUNTING_POLICY,
};
