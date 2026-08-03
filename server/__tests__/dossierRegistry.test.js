// DOC-EVO-1 — moteur générique de dossier : tests unitaires purs (aucune DB)
// sur le registre d'adaptateurs et le tri chronologique partagé.
const { registerDossierAdapter, getDossierAdapter, listDossierDomains, buildTimeline } = require('../services/dossier/dossierRegistry');

describe('dossierRegistry', () => {
  test('un adaptateur enregistré est retrouvable par domaine', () => {
    const fake = async () => ({});
    registerDossierAdapter('test_domain_unit', fake);
    expect(getDossierAdapter('test_domain_unit')).toBe(fake);
    expect(listDossierDomains()).toContain('test_domain_unit');
  });

  test('un domaine non enregistré renvoie null (jamais une exception)', () => {
    expect(getDossierAdapter('domaine_totalement_inconnu')).toBeNull();
  });

  test('buildTimeline trie chronologiquement et ignore les événements sans date', () => {
    const timeline = buildTimeline([
      { date: '2027-03-01', label: 'C' },
      { date: '2027-01-01', label: 'A' },
      { date: null, label: 'ignoré' },
      { date: '2027-02-01', label: 'B' },
    ]);
    expect(timeline.map((e) => e.label)).toEqual(['A', 'B', 'C']);
  });

  test('buildTimeline retourne des dates sérialisées en ISO string', () => {
    const timeline = buildTimeline([{ date: new Date('2027-01-01'), label: 'A' }]);
    expect(typeof timeline[0].date).toBe('string');
  });
});
