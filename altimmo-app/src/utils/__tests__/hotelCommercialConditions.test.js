import {
  formatMealPlan, formatCancellationOffer, formatCancellationTerms, formatCancellationEligibility,
} from '../hotelCommercialConditions';

describe('formatMealPlan — PHASE-H5', () => {
  test('mappe les valeurs canoniques en libellés français', () => {
    expect(formatMealPlan('breakfast_included')).toBe('Petit-déjeuner inclus');
    expect(formatMealPlan('room_only')).toBe('Chambre seule');
  });
  test('absence (null) → aucun libellé, jamais "Repas non inclus" par défaut', () => {
    expect(formatMealPlan(null)).toBeNull();
    expect(formatMealPlan(undefined)).toBeNull();
  });
});

describe('formatCancellationOffer — PHASE-H5 (offre, deadline absolue serveur)', () => {
  test('non_refundable → libellé fixe, sans date', () => {
    expect(formatCancellationOffer({ type: 'non_refundable', deadlineAt: null })).toBe('Non remboursable');
  });
  test('free_until avec deadlineAt → date formatée, jamais recalculée', () => {
    const label = formatCancellationOffer({ type: 'free_until', deadlineAt: '2026-09-12T00:00:00.000Z' });
    expect(label).toMatch(/12\/09\/2026/);
  });
  test('absence (null) → aucun libellé', () => {
    expect(formatCancellationOffer(null)).toBeNull();
  });
});

describe('formatCancellationTerms — PHASE-H5 (RatePlan brut, délai relatif)', () => {
  test('flexible avec délai → libellé relatif, jamais une date recalculée côté mobile', () => {
    expect(formatCancellationTerms({ type: 'flexible', deadlineHoursBeforeCheckIn: 48 })).toBe('Annulation gratuite jusqu’à 48h avant l’arrivée');
  });
  test('non_refundable → libellé fixe', () => {
    expect(formatCancellationTerms({ type: 'non_refundable' })).toBe('Non remboursable');
  });
  test('absence (null) → aucun libellé', () => {
    expect(formatCancellationTerms(null)).toBeNull();
  });
});

describe('formatCancellationEligibility — PHASE-H5 (réservation existante)', () => {
  test('politique inconnue → message neutre, jamais une promesse fabriquée', () => {
    expect(formatCancellationEligibility({ policyKnown: false })).toMatch(/non communiquées/);
  });
  test('gratuite avant échéance → date affichée', () => {
    const text = formatCancellationEligibility({ policyKnown: true, freeCancellation: true, deadlineAt: '2026-09-12T00:00:00.000Z' });
    expect(text).toMatch(/gratuite/i);
    expect(text).toMatch(/12\/09\/2026/);
  });
  test('pénalité après échéance → montants affichés', () => {
    const text = formatCancellationEligibility({ policyKnown: true, freeCancellation: false, penaltyAmount: 30000, refundableAmount: 70000 });
    expect(text).toMatch(/30[\s ]000/);
    expect(text).toMatch(/70[\s ]000/);
  });
  test('non remboursable → libellé fixe', () => {
    const text = formatCancellationEligibility({ policyKnown: true, freeCancellation: false, penaltyAmount: 60000, refundableAmount: 0 });
    expect(text).toBe('Non remboursable.');
  });
});
