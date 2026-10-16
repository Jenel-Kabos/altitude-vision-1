// F-U2.9 — Grille commerciale validée Altimmo (miroir de
// server/constants/billingConstants.js — ALTIMMO_AUTONOMOUS_PRICING).
// Ne pas modifier ces montants, seuils et taux sans nouvelle décision.

export const ALTIMMO_PRICING_VERSION = 'ALTIMMO-AUTONOME-2026-10';

export const AUTONOMOUS_VARIABLE_RATE_LABEL = '1 %';
export const DELEGATED_COMMISSION_LABEL = '10 %';
export const CONFIRMED_RENT_BASIS = 'des loyers effectivement encaissés et confirmés';

export const AUTONOMOUS_FORMULAS = [
  { code: 'GRATUIT', label: 'Gratuit', range: '1 bien', minProperties: 1, maxProperties: 1, monthlyPriceMinor: 0, price: '0 FCFA / mois' },
  { code: 'STANDARD', label: 'Standard', range: '2 à 10 biens', minProperties: 2, maxProperties: 10, monthlyPriceMinor: 5000, price: '5 000 FCFA / mois' },
  { code: 'ENTREPRISE', label: 'Entreprise', range: '11 à 20 biens', minProperties: 11, maxProperties: 20, monthlyPriceMinor: 10000, price: '10 000 FCFA / mois' },
  { code: 'GRAND_PORTEFEUILLE', label: 'Grand portefeuille', range: '21 biens et plus', minProperties: 21, maxProperties: null, monthlyPriceMinor: null, price: 'Sur devis' },
];

export const GRATUIT_DISCLOSURE = 'Abonnement gratuit pour un bien. Frais de service de 1 % sur les loyers effectivement encaissés et confirmés.';

export const formulaLabel = (code) => AUTONOMOUS_FORMULAS.find((formula) => formula.code === code)?.label || code || '—';
