// DOC-EVO-2 — actions contextuelles : purement fonctionnel, filtrage par
// rôle (mêmes groupes que gestionDocumentRoutes — STAFF_DOC) et par état
// réel du dossier. Jamais d'exécution ici, seulement des clés descriptives.
const { computeDossierActions } = require('../services/dossier/dossierActionsEngine');

const staffUser = { role: 'Admin' };
const tenantUser = { role: 'Client' };

const baseArgs = (overrides = {}) => ({
  user: staffUser,
  contrat: { statut: 'actif', documents: [] },
  rental: null,
  paiements: [],
  ...overrides,
});

test('un rôle non-staff ne reçoit aucune action', () => {
  expect(computeDossierActions(baseArgs({ user: tenantUser }))).toEqual([]);
});

test('aucun bail valide : propose de le générer', () => {
  const actions = computeDossierActions(baseArgs());
  expect(actions.map((a) => a.key)).toContain('generate_bail');
});

test('bail déjà généré et valide : ne propose plus de le régénérer', () => {
  const actions = computeDossierActions(baseArgs({ contrat: { statut: 'actif', documents: [{ type: 'bail', invalidated: false }] } }));
  expect(actions.map((a) => a.key)).not.toContain('generate_bail');
});

test('bail invalidé : propose de le régénérer', () => {
  const actions = computeDossierActions(baseArgs({ contrat: { statut: 'actif', documents: [{ type: 'bail', invalidated: true }] } }));
  expect(actions.map((a) => a.key)).toContain('generate_bail');
});

test('une échéance non réglée : propose de générer une quittance', () => {
  const actions = computeDossierActions(baseArgs({ paiements: [{ statut: 'impayé' }] }));
  expect(actions.map((a) => a.key)).toContain('generate_quittance');
});

test('toutes les échéances réglées : ne propose pas de quittance', () => {
  const actions = computeDossierActions(baseArgs({ paiements: [{ statut: 'payé' }] }));
  expect(actions.map((a) => a.key)).not.toContain('generate_quittance');
});

test('préavis déjà actif : ne propose pas d\'en générer un nouveau, propose de le gérer', () => {
  const actions = computeDossierActions(baseArgs({ rental: { noticeStartedAt: new Date(), exitInspectionClearedAt: null } }));
  expect(actions.map((a) => a.key)).not.toContain('generate_preavis');
  expect(actions.map((a) => a.key)).toContain('gerer_preavis');
});

test('préavis actif et état des lieux de sortie absent : propose de le générer', () => {
  const actions = computeDossierActions(baseArgs({ rental: { noticeStartedAt: new Date(), exitInspectionClearedAt: null } }));
  expect(actions.map((a) => a.key)).toContain('generate_etat_des_lieux_sortie');
});

test('contrat résilié : ni bail, ni clôture (déjà clôturé), mais renouvellement possible', () => {
  const actions = computeDossierActions(baseArgs({ contrat: { statut: 'expiré', documents: [] } }));
  expect(actions.map((a) => a.key)).toContain('renouveler_bail');
  expect(actions.map((a) => a.key)).not.toContain('cloturer_bail');
});

test('contrat actif : propose la clôture, jamais le renouvellement', () => {
  const actions = computeDossierActions(baseArgs());
  expect(actions.map((a) => a.key)).toContain('cloturer_bail');
  expect(actions.map((a) => a.key)).not.toContain('renouveler_bail');
});
