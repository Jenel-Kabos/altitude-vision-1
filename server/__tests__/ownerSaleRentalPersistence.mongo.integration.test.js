// UX-OWNER-2 — preuve de persistance réelle (mandat §29, "PERSISTENCE TEST
// — CRITIQUE") : un Proprietaire crée une annonce Vente/Location complète
// via les mêmes routes qu'Admin (`/api/sale-properties`, `/api/rental-properties`,
// désormais ouvertes à `Proprietaire`, voir salePropertyRoutes.js/
// rentalPropertyRoutes.js), en base RÉELLE (MongoDB en mémoire, jamais de
// mock de modèle) — Property + SaleManagement/RentalManagement lus depuis
// une requête `findById` INDÉPENDANTE après coup, jamais depuis la réponse
// HTTP seule. Seul `uploadToCloudinary` est mocké (réseau externe interdit
// en test, voir test-utils/externalNetworkGuard.js) — le middleware
// `multer` réel (`upload.array`) parse un vrai `multipart/form-data`
// (`.attach()`), exerçant le pipeline complet qui a révélé un bug réel
// pré-existant (aucun middleware multer sur ces deux routes avant ce
// sprint — voir salePropertyRoutes.js, commentaire UX-OWNER-2).

jest.mock('../config/cloudinary', () => {
  const actual = jest.requireActual('../config/cloudinary');
  return {
    ...actual,
    uploadToCloudinary: jest.fn().mockResolvedValue({ secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/altitude-vision/properties/fake-test.jpg' }),
    destroyFromCloudinary: jest.fn().mockResolvedValue(true),
  };
});

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const SaleManagement = require('../models/SaleManagement');
const RentalManagement = require('../models/RentalManagement');
const salePropertyRoutes = require('../routes/salePropertyRoutes');
const rentalPropertyRoutes = require('../routes/rentalPropertyRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/sale-properties', salePropertyRoutes);
app.use('/api/rental-properties', rentalPropertyRoutes);
app.use(errorHandler);

const signToken = (id, tokenVersion = 0) => jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1d' });

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({
    name: 'Propriétaire Test', email: `ownersalerental${counter}${Date.now()}@example.com`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', ...overrides,
  });
};

const tinyPngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('UX-OWNER-2 — persistance réelle Vente (Proprietaire)', () => {
  test('création complète : Property + SaleManagement réellement en base, relus indépendamment', async () => {
    const owner = await makeUser();

    const res = await request(app)
      .post('/api/sale-properties')
      .set('Authorization', `Bearer ${signToken(owner._id)}`)
      .field('title', 'Villa Persistance E2E')
      .field('description', 'Description suffisamment longue pour la validation du modèle Property.')
      .field('price', '75000000')
      .field('type', 'Villa')
      .field('surface', '250')
      .field('address[city]', 'Brazzaville')
      .field('address[arrondissement]', 'Bacongo')
      .field('latitude', '-4.26')
      .field('longitude', '15.24')
      .field('legalStatus', 'regularise')
      .field('negotiable', 'true')
      .field('agencyCommission', '7') // tentative Admin-only — doit être ignorée
      .field('owner', '000000000000000000000099') // tentative d'injection — doit être ignorée
      .attach('images', tinyPngBuffer, 'photo.png');

    expect(res.status).toBe(201);
    const propertyId = res.body.data.property._id;

    // Relecture INDÉPENDANTE — jamais depuis la réponse HTTP seule.
    const persisted = await Property.findById(propertyId);
    expect(persisted).not.toBeNull();
    expect(persisted.title).toBe('Villa Persistance E2E');
    expect(persisted.status).toBe('vente');
    expect(String(persisted.owner)).toBe(String(owner._id)); // jamais l'owner injecté
    expect(persisted.images.length).toBe(1);
    expect(persisted.statusAdmin).toBe('En attente');

    const sale = await SaleManagement.findOne({ property: propertyId });
    expect(sale).not.toBeNull();
    expect(sale.legalStatus).toBe('regularise');
    expect(sale.negotiable).toBe(true);
    expect(sale.agencyCommission).toBeNull(); // Admin-only, jamais persisté pour un Owner
  });

  test('édition : les valeurs modifiées sont réellement persistées, agencyCommission jamais ajouté', async () => {
    const owner = await makeUser();
    const createRes = await request(app)
      .post('/api/sale-properties')
      .set('Authorization', `Bearer ${signToken(owner._id)}`)
      .field('title', 'Villa Avant Édition')
      .field('description', 'Description suffisamment longue pour la validation du modèle Property.')
      .field('price', '50000000')
      .field('type', 'Villa')
      .field('surface', '180')
      .field('address[city]', 'Brazzaville')
      .field('address[arrondissement]', 'Bacongo')
      .field('latitude', '-4.26')
      .field('longitude', '15.24')
      .attach('images', tinyPngBuffer, 'photo.png');
    const propertyId = createRes.body.data.property._id;

    const editRes = await request(app)
      .put(`/api/sale-properties/${propertyId}`)
      .set('Authorization', `Bearer ${signToken(owner._id)}`)
      .field('title', 'Villa Après Édition')
      .field('sellerConditions', 'Vente rapide souhaitée')
      .field('agencyCommission', '15');

    expect(editRes.status).toBe(200);

    const persisted = await Property.findById(propertyId);
    expect(persisted.title).toBe('Villa Après Édition');
    expect(persisted.statusAdmin).toBe('En attente'); // repasse en modération

    const sale = await SaleManagement.findOne({ property: propertyId });
    expect(sale.sellerConditions).toBe('Vente rapide souhaitée');
    expect(sale.agencyCommission).toBeNull();

    // Rouvrir "Modifier" (GET /api/properties/:id, chemin réel du frontend
    // Owner) confirme que la valeur reste lisible après coup.
    const propertyRoutes = require('../routes/propertyRoutes');
    const appWithProperties = express();
    appWithProperties.use(express.json());
    appWithProperties.use('/api/properties', propertyRoutes);
    appWithProperties.use(errorHandler);
    const reread = await request(appWithProperties)
      .get(`/api/properties/${propertyId}`)
      .set('Authorization', `Bearer ${signToken(owner._id)}`);
    expect(reread.status).toBe(200);
    expect(reread.body.data.property.title).toBe('Villa Après Édition');
  });

  test('sécurité — un Proprietaire ne peut pas modifier le bien vente d\'un AUTRE propriétaire (403 réel, en base)', async () => {
    const ownerA = await makeUser();
    const ownerB = await makeUser();
    const createRes = await request(app)
      .post('/api/sale-properties')
      .set('Authorization', `Bearer ${signToken(ownerA._id)}`)
      .field('title', 'Villa Owner A')
      .field('description', 'Description suffisamment longue pour la validation du modèle Property.')
      .field('price', '30000000')
      .field('type', 'Villa')
      .field('surface', '120')
      .field('address[city]', 'Brazzaville')
      .field('address[arrondissement]', 'Bacongo')
      .field('latitude', '-4.26')
      .field('longitude', '15.24')
      .attach('images', tinyPngBuffer, 'photo.png');
    const propertyId = createRes.body.data.property._id;

    const res = await request(app)
      .put(`/api/sale-properties/${propertyId}`)
      .set('Authorization', `Bearer ${signToken(ownerB._id)}`)
      .field('title', 'Piraté par Owner B');

    expect(res.status).toBe(403);
    const persisted = await Property.findById(propertyId);
    expect(persisted.title).toBe('Villa Owner A'); // inchangé
  });
});

describe('UX-OWNER-2 — persistance réelle Location (Proprietaire)', () => {
  test('création complète : Property + RentalManagement réellement en base, managementFee jamais persisté', async () => {
    const owner = await makeUser();

    const res = await request(app)
      .post('/api/rental-properties')
      .set('Authorization', `Bearer ${signToken(owner._id)}`)
      .field('title', 'Appartement Persistance E2E')
      .field('description', 'Description suffisamment longue pour la validation du modèle Property.')
      .field('price', '180000')
      .field('type', 'Appartement')
      .field('surface', '75')
      .field('address[city]', 'Brazzaville')
      .field('address[arrondissement]', 'Bacongo')
      .field('latitude', '-4.26')
      .field('longitude', '15.24')
      .field('monthlyRent', '180000')
      .field('furnished', 'true')
      .field('cautionMultiplicateur', '2')
      .field('minimumLeaseMonths', '6')
      .field('managementFee', '25000') // Admin-only — doit être ignoré
      .attach('images', tinyPngBuffer, 'photo.png');

    expect(res.status).toBe(201);
    const propertyId = res.body.data.property._id;

    const persisted = await Property.findById(propertyId);
    expect(persisted).not.toBeNull();
    expect(persisted.status).toBe('location');
    expect(String(persisted.owner)).toBe(String(owner._id));

    const rental = await RentalManagement.findOne({ property: propertyId });
    expect(rental).not.toBeNull();
    expect(rental.furnished).toBe(true);
    expect(rental.minimumLeaseMonths).toBe(6);
    expect(rental.managementFee).toBeUndefined();
    expect(rental.managementActivated).toBe(false); // simple annonce, jamais un bail actif automatique
  });
});
