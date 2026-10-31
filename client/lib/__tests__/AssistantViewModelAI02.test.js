// ALTIMMO-AI-INTEGRATION-02 — couche de présentation commune web/mobile, alimentée par les réponses
// RÉELLES du moteur (shared/altimmoAssistant/contractFixtures.json, produit et vérifié par le test
// serveur altimmoAssistantUiContractAI02).
import fs from 'node:fs';
import path from 'node:path';
import fixtures from '../../../shared/altimmoAssistant/contractFixtures.json';
import {
  classifyAssistantError, describeCriteria, formatAmount, toComparisonView, toSearchView,
} from '../utils/assistantViewModel';

test('fichier identique sur le web et le mobile (une seule couche d’adaptation)', () => {
  const web = fs.readFileSync(path.join(__dirname, '../utils/assistantViewModel.js'), 'utf8');
  const mobile = fs.readFileSync(path.join(__dirname, '../../../altimmo-app/src/utils/assistantViewModel.js'), 'utf8');
  expect(mobile).toBe(web);
});

test('montants : valeur exacte de l’annonce, groupement des milliers, rien sans montant', () => {
  expect(formatAmount(250000)).toBe('250 000 FCFA');
  expect(formatAmount(25000000)).toBe('25 000 000 FCFA');
  expect(formatAmount(0)).toBeNull();
  expect(formatAmount(null)).toBeNull();
});

test('résultats : type, localisation, prix, caractéristiques, critères satisfaits ; aucun score', () => {
  const view = toSearchView(fixtures.searchResults);
  expect(view.kind).toBe('results');
  const first = view.results.find((card) => card.title === 'AI02 Maison Moungali 3 chambres');
  expect(first).toMatchObject({
    typeLabel: 'Maison', offerLabel: 'Location', category: 'classic', isLodging: false, hotelId: null,
    location: 'Plateau des 15 ans, Moungali, Brazzaville',
    price: { label: 'Loyer indiqué', value: '200 000 FCFA' },
    honoraires: { label: 'Honoraires indiqués', value: '200 000 FCFA' },
    features: ['3 chambres', '120 m²'], satisfied: ['Parking confirmé.'],
  });
  const other = view.results.find((card) => card.title === 'AI02 Maison Moungali 4 chambres');
  expect(other.honoraires).toBeNull(); // honoraires null sur l'annonce : rien d'affiché, rien de calculé
  expect(JSON.stringify(view)).not.toMatch(/"score"|"confidence"/);
  expect(view.orderLabel).toBe('Classés selon vos préférences');
  expect(view.criteria.map((chip) => chip.label)).toEqual(expect.arrayContaining(['Location', 'Maison', 'Moungali, Brazzaville', 'Souhaité : Parking']));
});

test('information manquante : bien « à vérifier », critère inconnu nommé', () => {
  const view = toSearchView(fixtures.searchToVerify);
  expect(view.toVerify).toHaveLength(1);
  expect(view.toVerify[0]).toMatchObject({ needsVerification: true, toVerify: ['Parking'] });
  expect(view.results.map((card) => card.title)).not.toContain(view.toVerify[0].title);
});

test('proximité comprise mais non vérifiable', () => {
  const view = toSearchView(fixtures.searchProximity);
  expect(view.criteria).toEqual(expect.arrayContaining([{ key: 'proximity-market', label: 'Proche d’un marché', verifiable: false }]));
  expect(view.unverifiable).toEqual(['Proximité non vérifiée sans catalogue POI validé.']);
});

test('aucun résultat exact, critères incomplets, requête invalide', () => {
  const empty = toSearchView(fixtures.searchEmpty);
  expect(empty).toMatchObject({ kind: 'empty', noExactMatch: true, results: [], toVerify: [] });
  const incomplete = toSearchView(fixtures.searchIncomplete);
  expect(incomplete.kind).toBe('incomplete');
  expect(incomplete.questions.length).toBeGreaterThan(0);
});

test('hôtel : catégorie distincte, page établissement, disponibilité aux dates non confirmée', () => {
  const view = toSearchView(fixtures.searchHotel);
  const card = [...view.results, ...view.toVerify][0];
  expect(card).toMatchObject({ category: 'hotel', isLodging: true, typeLabel: 'Hôtel', price: { label: 'Prix indiqué sur l’annonce', value: '45 000 FCFA' } });
  expect(card.hotelId).toMatch(/^[0-9a-f]{24}$/);
  expect(view.notices.join(' ')).toMatch(/disponibilités aux dates souhaitées ne sont pas vérifiées/i);
});

test('comparaison : colonnes, lignes affichées, avantages et limites ; annonce non publiée écartée', () => {
  const view = toComparisonView(fixtures.compareSelected);
  expect(view.kind).toBe('compared');
  expect(view.columns.map((column) => column.title).sort()).toEqual(['AI02 Maison Moungali 3 chambres', 'AI02 Maison Moungali 4 chambres']);
  expect(view.columns[0].advantages.length).toBeGreaterThan(0);
  expect(view.rows.find((row) => row.label === 'Ville').values).toEqual(['Brazzaville', 'Brazzaville']);
  expect(view.unavailableCount).toBe(1);
  expect(view.conclusion).toMatch(/aucun n'est désigné/);
  expect(JSON.stringify(view)).not.toMatch(/non approuvée|"score"/);
  const unavailable = toComparisonView(fixtures.compareUnavailable);
  expect(unavailable).toMatchObject({ kind: 'unavailable', columns: expect.any(Array) });
  expect(unavailable.message).toMatch(/ne peuvent pas être comparés/);
});

test('erreurs : désactivé (503), débit (429), requête (400), réseau, indisponible', () => {
  expect(classifyAssistantError({ response: { status: 503, data: fixtures.disabled } }).kind).toBe('disabled');
  expect(classifyAssistantError({ response: { status: 429, data: fixtures.rateLimited } }).kind).toBe('rate_limited');
  expect(classifyAssistantError({ response: { status: 400, data: fixtures.invalid } }).kind).toBe('invalid');
  expect(classifyAssistantError({ message: 'Network Error' }).kind).toBe('network');
  expect(classifyAssistantError({ response: { status: 500, data: { code: 'ALTIMMO_ASSISTANT_UNAVAILABLE' } } }).kind).toBe('unavailable');
  expect(classifyAssistantError({ response: { status: 503, data: {} } }).kind).toBe('unavailable');
});

test('critères : budget, chambres, équipements exigés ou exclus, voyageurs', () => {
  expect(describeCriteria({
    transaction: 'STAY', accommodationTypes: ['studio_meuble'], location: { city: 'Brazzaville', districts: [] },
    budget: { min: 10000, max: 50000, currency: 'XAF' }, bedrooms: { min: 2 }, amenities: { required: ['wifi'], preferred: [], excluded: ['pool'] },
    proximity: { required: [], preferred: [] }, stay: { adults: 2 },
  }).map((chip) => chip.label)).toEqual(['Séjour', 'Studio meublé', 'Brazzaville', 'Budget de 10 000 FCFA à 50 000 FCFA', '2 chambres minimum', 'Exigé : Wi-Fi', 'Sans : Piscine', '2 adultes']);
});
