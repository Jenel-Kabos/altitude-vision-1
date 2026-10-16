// F-U1.H — fixture de TEST uniquement : crée directement une habilitation
// sensible active (comme les autres suites insèrent leurs fixtures), sans
// passer par le double contrôle — réservé aux suites qui testent les
// opérations protégées, pas la gouvernance elle-même.
const mongoose = require('mongoose');
const ContractualFinanceGrant = require('../../models/ContractualFinanceGrant');

const DAY = 86400000;

async function activeGrantFixture({ user, capability, tenant = null, validUntil = new Date(Date.now() + 365 * DAY) }) {
  const userId = user?._id || user;
  const tenantId = tenant?._id || tenant || null;
  const fixtureActor = new mongoose.Types.ObjectId();
  return ContractualFinanceGrant.create({
    user: userId, scopeType: tenantId ? 'TENANT' : 'PLATFORM', tenant: tenantId, capability, status: 'active',
    justification: 'Fixture de test', validFrom: new Date(Date.now() - DAY), validUntil,
    proposedBy: fixtureActor, proposedAt: new Date(), proposalKey: `fixture:${new mongoose.Types.ObjectId()}`,
    approvedBy: fixtureActor, approvedAt: new Date(), activatedAt: new Date(),
    history: [{ action: 'fixture', to: 'active', actor: fixtureActor }],
  });
}

module.exports = { activeGrantFixture };
