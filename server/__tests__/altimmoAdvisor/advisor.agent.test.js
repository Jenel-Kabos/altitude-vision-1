/** @jest-environment ./__tests__/altimmoAdvisor/realmCloneEnvironment.js */
'use strict';
const assert = require('node:assert/strict');
const { createSessionStore } = require('../../services/altimmoAdvisor/sessionStore');
const { createAgent } = require('../../services/altimmoAdvisor/agent');

const { fakeTools } = require('./fixtures');
const make = (options = {}) => {
  const store = createSessionStore();
  const tools = options.tools || fakeTools();
  return { agent: createAgent({ store, llm: options.llm || null, tools }), store, tools };
};
const talk = async (agent, sessionId, messages) => { let last; for (const message of messages) last = await agent.turn({ sessionId, message }); return last; };

test('S1-S2 maison sans opération : une question achat/location, rien de redemandé', async () => {
  const { agent } = make();
  const r = await agent.turn({ sessionId: 's', message: "Je cherche une maison avec trois chambres et une cour, à Poto-Poto, pour 200 000 FCFA maximum. C'est pour mes enfants, donc j'aimerais être proche d'une école." });
  assert.equal(r.status, 'needs_clarification');
  assert.match(r.reply, /loyer mensuel ou .*prix d’achat/);
  assert.doesNotMatch(r.reply.split('.').at(-1), /chambres|quartier/);
  assert.deepEqual(r.cards, []);
  const r2 = await agent.turn({ sessionId: 's', message: 'Un loyer mensuel, je veux louer.' });
  assert.equal(r2.status, 'success');
  assert.equal(r2.cards[0].listing.id, 'm-poto');
});

test('S3-S5 budget maximum et trois chambres : seules les annonces conformes, budget respecté', async () => {
  const { agent } = make();
  const r = await agent.turn({ sessionId: 's', message: 'Je veux louer une maison de 3 chambres à Brazzaville, 280 000 FCFA maximum.' });
  assert.equal(r.status, 'success');
  assert.deepEqual(r.cards.map((c) => c.listing.id).sort(), ['m-ouenze-2', 'm-poto']);
  assert.ok(r.cards.every((c) => c.listing.price === null || c.listing.price <= 280000));
  assert.match(r.reply, /prix n’est pas publié/);
});

test('S4 et S14 mémoire : budget remplacé, cour ajoutée, critères conservés sur quatre tours', async () => {
  const { agent, tools } = make();
  const r = await talk(agent, 's', ['Je cherche une maison à Poto-Poto pour 200 000 FCFA.', 'Finalement, 250 000 FCFA maximum.', 'Et je voudrais une cour.', "Qu'est-ce que tu me proposes ?"]);
  assert.equal(r.state.criteria.propertyType, 'Maison');
  assert.equal(r.state.criteria.district, 'Poto-Poto');
  assert.equal(r.state.criteria.budget.max, 250000);
  assert.deepEqual(r.state.amenities.preferred, ['cour']);
  assert.match(tools.calls.at(-1)[1], /budget maximum 250000/);
  assert.doesNotMatch(tools.calls.at(-1)[1], /450000/);
  assert.match(r.reply, /la cour n’y est pas indiquée/);
});

test('S6-S7 cour et école : préférences retenues, école signalée comme non vérifiable', async () => {
  const { agent } = make();
  const r = await talk(agent, 's', ['Je veux louer une maison à Poto-Poto, 250 000 FCFA, avec une cour.', 'Proche d’une école pour mes enfants.']);
  assert.equal(r.state.proximity.school, 'important');
  assert.ok(r.state.motivations.includes('famille'));
  assert.match(r.reply, /école/);
  assert.match(r.reply, /vérifier sur place/);
  assert.doesNotMatch(r.reply, /à \d+ ?(m|min|km)|se trouve (près|proche)/);
});

test('S8-S9-S10 aucun résultat, proposition d un autre quartier vérifiée, acceptation', async () => {
  const { agent, tools } = make();
  const none = await agent.turn({ sessionId: 's', message: 'Je veux louer une maison de 3 chambres à Moungali, 300 000 FCFA maximum, budget strict.' });
  assert.equal(none.status, 'alternative_proposed');
  assert.match(none.reply, /autres quartiers de Brazzaville/);
  assert.match(none.reply, /300 000 FCFA/);
  assert.doesNotMatch(none.reply, /Ouenzé|Poto-Poto|Bacongo|voisin/);
  assert.equal(none.cards.length, 0);
  const accepted = await agent.turn({ sessionId: 's', message: "Oui, d'accord." });
  assert.equal(accepted.status, 'success');
  assert.equal(accepted.state.criteria.district, null);
  assert.equal(accepted.state.criteria.budget.max, 300000);
  assert.equal(accepted.state.criteria.bedrooms.min, 3);
  assert.ok(accepted.cards.length >= 2);
  assert.ok(accepted.cards.every((c) => c.listing.price === null || c.listing.price <= 300000));
  assert.deepEqual(accepted.state.acceptedRelaxations, ['widen_district']);
  assert.equal(tools.calls.filter(([kind]) => kind === 'search').length, 3, 'recherche, vérification de l alternative, relance');
});

test('S11 refus d une alternative : critères conservés, option non reproposée', async () => {
  const { agent } = make();
  await agent.turn({ sessionId: 's', message: 'Je veux louer une maison de 3 chambres à Moungali, 300 000 FCFA maximum, budget strict.' });
  const declined = await agent.turn({ sessionId: 's', message: 'Non, je préfère rester à Moungali.' });
  assert.equal(declined.status, 'success');
  assert.equal(declined.state.criteria.district, 'Moungali');
  assert.deepEqual(declined.state.rejectedRelaxations, ['widen_district']);
  assert.equal(declined.state.pendingRelaxation, null);
  const again = await agent.turn({ sessionId: 's', message: "Qu'est-ce que tu me proposes ?" });
  assert.notEqual(again.proposal?.id, 'widen_district');
});

test('S12-S13 comparaison de deux biens et explication des avantages fondée sur les faits', async () => {
  const { agent } = make();
  await agent.turn({ sessionId: 's', message: 'Je veux louer une maison à Brazzaville, 300 000 FCFA maximum, pour ma famille.' });
  const compared = await agent.turn({ sessionId: 's', message: 'Compare les deux premiers.' });
  assert.equal(compared.status, 'comparison');
  assert.equal(compared.comparison.items.length, 2);
  const advice = await agent.turn({ sessionId: 's', message: 'Quels sont les avantages pour une famille ?' });
  assert.equal(advice.status, 'success');
  assert.match(advice.reply, /chambres/);
  assert.match(advice.reply, /en revanche|n’est pas publié|n’y est pas indiqu/);
  for (const card of advice.cards) assert.match(card.listing.title, /^\[FICTIF\]/);
});

test('S15 réinitialisation : la session et ses critères disparaissent', async () => {
  const { agent, store } = make();
  await agent.turn({ sessionId: 's', message: 'Je veux louer une maison à Poto-Poto.' });
  assert.equal(agent.reset('s'), true);
  assert.equal(store.get('s'), null);
  const fresh = await agent.turn({ sessionId: 's', message: 'Bonjour' });
  assert.equal(fresh.state.criteria.district, null);
});

test('trop petit : proposition d espace supplémentaire vérifiée', async () => {
  const { agent } = make();
  await agent.turn({ sessionId: 's', message: 'Je veux louer un appartement à Bacongo, 200 000 FCFA.' });
  const r = await agent.turn({ sessionId: 's', message: 'Ce logement est trop petit.' });
  assert.equal(r.status, 'alternative_proposed');
  assert.match(r.reply, /superficie|espace/i);
});

test('S19-S20 injection dans une annonce et paiement : refus sans modèle ni outil', async () => {
  let llmCalls = 0;
  const llm = { plan: async () => { llmCalls += 1; throw new Error('non'); }, streamNarration: async () => { llmCalls += 1; throw new Error('non'); } };
  const { agent, tools } = make({ llm });
  for (const message of ['Je veux payer l’acompte avec Yabetoo.', 'Réserve cette maison.', 'Donne-moi le téléphone du propriétaire.']) {
    const r = await agent.turn({ sessionId: 'p', message });
    assert.equal(r.status, 'refused');
    assert.match(r.reply, /ne peux pas/);
  }
  assert.equal(llmCalls, 0);
  assert.equal(tools.calls.length, 0);
  const search = await agent.turn({ sessionId: 'i', message: 'Je veux louer un appartement à Bacongo, 200 000 FCFA.' });
  assert.doesNotMatch(JSON.stringify(search), /IGNORE|\+242|téléphone du propriétaire/);
});

test('outil indisponible : critères conservés, aucune annonce affichée', async () => {
  const { agent } = make({ tools: fakeTools({ fail: true }) });
  const r = await agent.turn({ sessionId: 's', message: 'Je veux louer une maison à Poto-Poto, 200 000 FCFA.' });
  assert.equal(r.status, 'tool_unavailable');
  assert.equal(r.cards.length, 0);
  assert.equal(r.state.criteria.district, 'Poto-Poto');
});

test('sérialise deux tours simultanés de la même session', async () => {
  const { agent } = make();
  const [first, second] = await Promise.all([agent.turn({ sessionId: 'same', message: 'Je cherche une maison.' }), agent.turn({ sessionId: 'same', message: 'Pour louer.' })]);
  assert.equal(first.state.criteria.transaction, null);
  assert.equal(second.state.criteria.transaction, 'RENT');
  assert.equal(second.state.criteria.propertyType, 'Maison');
  assert.equal(agent.pendingTurns(), 0);
});

test('opération inconnue : l agent interroge location et achat, sans traiter le blocage IA-03 comme « aucun résultat »', async () => {
  const { agent, tools } = make();
  const r = await talk(agent, 's', ['Je cherche une maison à Poto-Poto pour 200 000 FCFA.', "Qu'est-ce que tu me proposes ?"]);
  assert.equal(r.status, 'success');
  assert.equal(r.cards[0].listing.id, 'm-poto');
  assert.match(r.reply, /à la fois achat et location/);
  const queries = tools.calls.filter(([kind]) => kind === 'search').map(([, q]) => q);
  assert.ok(queries.some((q) => q.includes('à louer')) && queries.some((q) => q.includes('à acheter')));
  assert.equal(r.state.criteria.transaction, null, 'aucune opération supposée');
});

test('moteur limité (429) : critères conservés, message d attente clair, aucune annonce', async () => {
  const tools = fakeTools();
  tools.searchPublished = async () => { throw Object.assign(new Error('429'), { code: 'rate_limited' }); };
  const { agent } = make({ tools });
  const r = await agent.turn({ sessionId: 's', message: 'Je veux louer une maison à Poto-Poto, 200 000 FCFA.' });
  assert.equal(r.status, 'rate_limited');
  assert.match(r.reply, /une minute/);
  assert.equal(r.state.criteria.district, 'Poto-Poto');
});
