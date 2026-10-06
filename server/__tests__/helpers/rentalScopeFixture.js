// C2.10A — rattache un bail de test au scope ORGANIZATION canonique.
//
// Depuis C2.10A, une ressource locative n'appartient à un tenant que par
// Contrat.bien → Property.tenant : un bail sans bien, ou sur un bien
// tenant:null, n'est plus accessible au staff d'aucune organisation. Les
// suites qui testent la MÉCANIQUE locative (encaissements, reçus, cycle de
// vie…) — et non la frontière tenant — utilisent ce helper pour placer leur
// fixture dans un tenant réel, l'acteur staff y étant membre.
const { createTenantFixture, addTenantMember } = require('./tenantAwareFixture');
const Property = require('../../models/Property');

let sequence = 0;

async function createTenantRentalProperty({ tenant, owner, overrides = {} }) {
  sequence += 1;
  return Property.create({
    title: `Bien locatif C2.10A ${sequence}`,
    description: 'Description suffisamment longue pour la validation du bien de test.',
    pole: 'Altimmo', type: 'Appartement', status: 'location', price: 150000,
    address: { city: 'Brazzaville', arrondissement: 'Centre' }, images: ['https://example.test/c210a.jpg'],
    surface: 60, statusAdmin: 'Validée', availability: 'Loué', latitude: -4.27, longitude: 15.27,
    owner: owner._id, tenant: tenant._id,
    ...overrides,
  });
}

// `staff` : utilisateurs à rendre membres du tenant ({ user, businessRole }).
// Avec une seule membership, resolveTenantForUser résout ce tenant sans
// en-tête X-Platform-Tenant-Id.
async function attachLeaseToTenant({ contrat, owner, staff = [], label = 'C2.10A GL tenant', propertyOverrides } = {}) {
  const { tenant, bootstrap } = await createTenantFixture({ label });
  for (const { user, businessRole = 'Admin' } of staff) {
    await addTenantMember({ tenant, user, bootstrap, businessRole });
  }
  const property = await createTenantRentalProperty({ tenant, owner: owner || staff[0]?.user, overrides: propertyOverrides });
  if (contrat) {
    contrat.bien = property._id;
    await contrat.save();
  }
  return { tenant, bootstrap, property };
}

module.exports = { attachLeaseToTenant, createTenantRentalProperty };
