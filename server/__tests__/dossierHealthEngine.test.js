// DOC-EVO-2 — moteur de santé du dossier : purement fonctionnel (aucun
// accès DB), jamais de champ stocké. Un test par check, plus la règle de
// priorité (critique > attention > conforme).
const { computeDossierHealth } = require('../services/dossier/dossierHealthEngine');

const baseArgs = () => ({
  contrat: { statut: 'actif', dateFinBail: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000), documents: [{ type: 'etat_entree' }], locataire: { _id: 'L1' } },
  rental: null,
  paiements: [],
  maintenanceTickets: [],
  identiteDocs: [{ _id: 'D1' }],
});

test('dossier sans anomalie : conforme', () => {
  const { level, checks } = computeDossierHealth(baseArgs());
  expect(level).toBe('conforme');
  expect(checks).toEqual([]);
});

test('bail expirant dans moins de 15 jours : critique', () => {
  const args = baseArgs();
  args.contrat.dateFinBail = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  const { level, checks } = computeDossierHealth(args);
  expect(level).toBe('critique');
  expect(checks[0].key).toBe('bail_expire_imminent');
});

test('bail expirant dans moins de 60 jours : attention', () => {
  const args = baseArgs();
  args.contrat.dateFinBail = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000);
  const { level, checks } = computeDossierHealth(args);
  expect(level).toBe('attention');
  expect(checks[0].key).toBe('bail_bientot_expire');
});

test('paiement en retard : critique (prioritaire sur impayé/attention)', () => {
  const args = baseArgs();
  args.paiements = [{ statut: 'en_retard' }, { statut: 'impayé' }];
  const { level, checks } = computeDossierHealth(args);
  expect(level).toBe('critique');
  expect(checks.map((c) => c.key)).toContain('paiement_en_retard');
});

test('paiement impayé sans retard : attention', () => {
  const args = baseArgs();
  args.paiements = [{ statut: 'impayé' }];
  const { level } = computeDossierHealth(args);
  expect(level).toBe('attention');
});

test('maintenance urgente ouverte : critique', () => {
  const args = baseArgs();
  args.maintenanceTickets = [{ priority: 'urgente', status: 'ouvert' }];
  const { level, checks } = computeDossierHealth(args);
  expect(level).toBe('critique');
  expect(checks.map((c) => c.key)).toContain('maintenance_urgente');
});

test('maintenance urgente résolue : aucune alerte', () => {
  const args = baseArgs();
  args.maintenanceTickets = [{ priority: 'urgente', status: 'resolu' }];
  const { level } = computeDossierHealth(args);
  expect(level).toBe('conforme');
});

test('préavis actif non clôturé : attention', () => {
  const args = baseArgs();
  args.rental = { noticeStartedAt: new Date(), exitInspectionClearedAt: null };
  const { level, checks } = computeDossierHealth(args);
  expect(level).toBe('attention');
  expect(checks.map((c) => c.key)).toContain('preavis_actif');
});

test('pièce d\'identité manquante pour un locataire présent : attention', () => {
  const args = baseArgs();
  args.identiteDocs = [];
  const { checks } = computeDossierHealth(args);
  expect(checks.map((c) => c.key)).toContain('piece_identite_manquante');
});

test('état des lieux d\'entrée absent (contrat non en_attente) : attention', () => {
  const args = baseArgs();
  args.contrat.documents = [];
  const { checks } = computeDossierHealth(args);
  expect(checks.map((c) => c.key)).toContain('etat_des_lieux_absent');
});

test('contrat en_attente : pas d\'alerte état des lieux (bail pas encore commencé)', () => {
  const args = baseArgs();
  args.contrat.statut = 'en_attente';
  args.contrat.documents = [];
  const { checks } = computeDossierHealth(args);
  expect(checks.map((c) => c.key)).not.toContain('etat_des_lieux_absent');
});

test('quittance manquante pour une échéance réglée : attention', () => {
  const args = baseArgs();
  args.paiements = [{ _id: 'P1', statut: 'payé' }];
  const { checks } = computeDossierHealth(args);
  expect(checks.map((c) => c.key)).toContain('quittance_manquante');
});

test('quittance présente pour l\'échéance réglée : aucune alerte quittance', () => {
  const args = baseArgs();
  args.paiements = [{ _id: 'P1', statut: 'payé' }];
  args.contrat.documents = [{ type: 'etat_entree' }, { type: 'quittance', sourcePaiement: 'P1' }];
  const { checks } = computeDossierHealth(args);
  expect(checks.map((c) => c.key)).not.toContain('quittance_manquante');
});
