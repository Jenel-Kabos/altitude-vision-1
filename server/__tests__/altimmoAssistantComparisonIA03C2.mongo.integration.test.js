const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const RatePlan = require('../models/RatePlan');
const { compareRealEstate, COMPARISON_MODE } = require('../services/altimmoAssistant/comparisonService');

jest.setTimeout(120000);
const oid = () => new mongoose.Types.ObjectId();
const property = (overrides = {}) => ({
  title: 'Maison réelle', description: 'Annonce de test représentative et suffisamment détaillée.', pole: 'Altimmo',
  type: 'Maison', status: 'location', price: 200000, address: { street: 'Rue privée 12', neighborhood: 'Plateau', arrondissement: 'Talangaï', city: 'Brazzaville' },
  latitude: -4.22, longitude: 15.29, images: ['https://example.test/house.jpg'], bedrooms: 3, bathrooms: 2,
  surface: 120, amenities: ['parking'], availability: 'Disponible', statusAdmin: 'Validée', isPublished: true,
  owner: oid(), documents: ['https://example.test/private.pdf'], commissionRate: 17, tenant: oid(), ...overrides,
});
const compare = (ids, extra = {}, dependencies = {}) => compareRealEstate({ mode: COMPARISON_MODE.SELECTED, propertyIds: ids.map(String), context: { scopeMode: 'PUBLIC' }, ...extra }, dependencies);

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('IA-03C2 — comparaison manuelle sur annonces Mongo réelles de test', () => {
  test('compare deux locations publiées avec projection fermée et sans écriture', async () => {
    const a = await Property.create(property({ title: 'A', price: 180000 }));
    const b = await Property.create(property({ title: 'B', price: 240000, amenities: ['parking', 'climatisation'] }));
    const before = await Property.find({ _id: { $in: [a._id, b._id] } }).select('views updatedAt').lean();
    const out = await compare([a._id, b._id], { preferences: ['parking', 'climatisation'] });
    expect(out.status).toBe('success');
    expect(out.items.map((item) => item.label)).toEqual(['A', 'B']);
    expect(out.items[1].score).toBe(10000);
    const json = JSON.stringify(out);
    for (const secret of ['owner', 'tenant', 'commissionRate', 'private.pdf', 'Rue privée', 'latitude', 'longitude', 'description']) expect(json).not.toContain(secret);
    const after = await Property.find({ _id: { $in: [a._id, b._id] } }).select('views updatedAt').lean();
    expect(after).toEqual(before);
  });

  test('non publié, non approuvé, retiré, supprimé, privé et inconnu : réponse uniforme', async () => {
    const visible = await Property.create(property({ title: 'Visible' }));
    const otherTenantPublic = await Property.create(property({ title: 'Autre tenant public', tenant: oid() }));
    const hidden = await Promise.all([
      Property.create(property({ title: 'Non publiée', isPublished: false })),
      Property.create(property({ title: 'En attente', statusAdmin: 'En attente' })),
      Property.create(property({ title: 'Louée', availability: 'Loué' })),
      Property.create(property({ title: 'Hors marketplace', pole: 'Altcom' })),
    ]);
    const deleted = await Property.create(property({ title: 'Supprimée' }));
    await Property.deleteOne({ _id: deleted._id });
    const unknown = oid();
    const ids = [visible._id, otherTenantPublic._id, ...hidden.map((item) => item._id), deleted._id, unknown];
    // Limite serveur configurée à 10 pour couvrir tous les cas d'inaccessibilité en une sélection.
    const out = await compare(ids, {}, { config: { maxListings: 10 } });
    expect(out.status).toBe('success');
    expect(out.items.map((item) => item.label)).toEqual(['Visible', 'Autre tenant public']);
    expect(out.unavailable).toEqual([...hidden.map((item) => item._id), deleted._id, unknown].map((id) => ({ id: String(id), code: 'LISTING_UNAVAILABLE' })));
    expect(JSON.stringify(out)).not.toMatch(/Non publiée|En attente|Louée|Hors marketplace|Supprimée/);
  });

  test('les trois contextes résolus appliquent la même visibilité ; UNRESOLVED ne lit rien', async () => {
    const a = await Property.create(property({ title: 'A' }));
    const b = await Property.create(property({ title: 'B' }));
    const hidden = await Property.create(property({ title: 'Cachée', isPublished: false }));
    for (const scopeMode of ['PUBLIC', 'TENANT', 'PLATFORM']) {
      const out = await compare([a._id, b._id, hidden._id], { context: { scopeMode, tenantId: String(hidden.tenant) } });
      expect(out.items.map((item) => item.label)).toEqual(['A', 'B']);
    }
    const findSpy = jest.spyOn(Property, 'find');
    const out = await compare([a._id, b._id], { context: { scopeMode: 'UNRESOLVED' } });
    expect(out.status).toBe('forbidden');
    expect(findSpy).not.toHaveBeenCalled();
    findSpy.mockRestore();
  });

  test('meublé : tarifs RatePlan nocturne et mensuel, jamais Property.price ; hébergement non publié exclu', async () => {
    const furnished = await Property.create(property({ title: 'Maison meublée', status: 'hebergement', price: 1 }));
    const accommodation = await Accommodation.create({
      property: furnished._id, accommodationType: 'maison_meublee', publicationStatus: 'publie', active: true, createdBy: oid(),
      capacity: { maxAdults: 4, maxChildren: 2 }, minimumStay: 2, maximumStay: 120, amenities: { salon: ['climatisation'] },
    });
    await RatePlan.create({ accommodation: accommodation._id, mode: 'nightly', amount: 30000, currency: 'XAF', active: true, createdBy: oid() });
    await RatePlan.create({ accommodation: accommodation._id, mode: 'monthly', amount: 600000, currency: 'XAF', active: true, createdBy: oid() });
    const other = await Property.create(property({ title: 'Appartement meublé', status: 'hebergement', price: 2 }));
    await Accommodation.create({ property: other._id, accommodationType: 'appartement_meuble', publicationStatus: 'publie', active: true, createdBy: oid() });
    const pending = await Property.create(property({ title: 'Hébergement soumis', status: 'hebergement' }));
    await Accommodation.create({ property: pending._id, accommodationType: 'maison_meublee', publicationStatus: 'soumis', createdBy: oid() });

    const out = await compare([furnished._id, other._id, pending._id], { preferences: ['climatisation'] });
    expect(out.items.map((item) => item.label)).toEqual(['Maison meublée', 'Appartement meublé']);
    expect(out.unavailable).toEqual([{ id: String(pending._id), code: 'LISTING_UNAVAILABLE' }]);
    const row = (key) => out.grid.rows.find((item) => item.key === key);
    expect(row('stay.nightlyRate').values.map((v) => v.state)).toEqual(['KNOWN', 'UNKNOWN']);
    expect(row('stay.nightlyRate').values[0].value).toEqual({ amount: 30000, currency: 'XAF', period: 'NIGHT' });
    expect(row('stay.monthlyRate').values[0].value).toEqual({ amount: 600000, currency: 'XAF', period: 'MONTH' });
    expect(row('stay.capacity').values[0].display).toBe('4 adultes, 2 enfants');
    expect(row('need.amenity.air_conditioning').values.map((v) => v.state)).toEqual(['TRUE', 'UNKNOWN']);
    expect(out.comparability.dimensions.price).toMatchObject({ comparable: false, reason: 'PRICE_UNKNOWN' });
    expect(JSON.stringify(row('price'))).not.toMatch(/"amount":(1|2)\b/);
  });

  test('le snapshot public approuvé prévaut sur une révision non approuvée', async () => {
    const a = await Property.create(property({ title: 'Révision en attente', price: 999999, approvedPublicSnapshot: { title: 'Titre approuvé', price: 210000 } }));
    const b = await Property.create(property({ title: 'B' }));
    const out = await compare([a._id, b._id]);
    expect(out.items[0].label).toBe('Titre approuvé');
    expect(out.items[0].price.amount).toBe(210000);
    expect(JSON.stringify(out)).not.toContain('Révision en attente');
  });
});
