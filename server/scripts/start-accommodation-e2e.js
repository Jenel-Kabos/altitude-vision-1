const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const root = path.resolve(__dirname, "../..");
const serverDir = path.join(root, "server");
const clientDir = path.join(root, "client");
const ids = {
  owner: "66e200000000000000000001",
  guest: "66e200000000000000000002",
  property: "66e200000000000000000003",
  accommodation: "66e200000000000000000004",
  hotelProperty: "66e200000000000000000010",
  hotel: "66e200000000000000000011",
  roomCategory: "66e200000000000000000012",
  mobileHotelProperty: "66e200000000000000000020",
  mobileHotel: "66e200000000000000000021",
  mobileRoomCategory: "66e200000000000000000022",
  saleProperty: "66e200000000000000000030",
  rentalProperty: "66e200000000000000000031",
  finalizationSaleProperty: "66e200000000000000000032",
  finalizationSalePropertyMobile: "66e200000000000000000034",
  rentalActivationProperty: "66e200000000000000000035",
  rentalActivationPropertyMobile: "66e200000000000000000036",
  rentalOnboardingOwner: "66e200000000000000000037",
  rentalOnboardingProperty: "66e200000000000000000038",
  rentalOnboardingPropertyMobile: "66e200000000000000000039",
  proprietaireBienPropre: "66e200000000000000000040",
  contratFormPropertyMobile: "66e200000000000000000041",
  proprietaireBienPropreMobile: "66e200000000000000000042",
};
let mongo;
let fakePaymentProvider;
let shuttingDown = false;
const children = [];
const waitFor = (url, timeout = 120000) =>
  new Promise((resolve, reject) => {
    const started = Date.now();
    const retry = () =>
      Date.now() - started > timeout
        ? reject(new Error(`E2E_TIMEOUT ${url}`))
        : setTimeout(poll, 500);
    const poll = () =>
      http
        .get(url, (response) => {
          response.resume();
          response.statusCode < 500 ? resolve() : retry();
        })
        .on("error", retry);
    poll();
  });
async function seed(uri) {
  process.env.MONGO_URI = uri;
  await mongoose.connect(uri);
  const User = require("../models/User");
  const Property = require("../models/Property");
  const Accommodation = require("../models/Accommodation");
  const RatePlan = require("../models/RatePlan");
  const Hotel = require("../models/Hotel");
  const RoomCategory = require("../models/RoomCategory");
  const PaiementTransaction = require("../models/PaiementTransaction");
  await User.create([
    {
      _id: ids.owner,
      name: "Administrateur E2E",
      email: "owner-e2e@example.test",
      password: "E2eOwner!2026",
      passwordConfirm: "E2eOwner!2026",
      role: "Admin",
      isEmailVerified: true,
    },
    {
      _id: ids.guest,
      name: "Client E2E",
      email: "client-e2e@example.test",
      password: "E2eClient!2026",
      passwordConfirm: "E2eClient!2026",
      role: "Client",
      isEmailVerified: true,
    },
    {
      _id: ids.rentalOnboardingOwner,
      name: "Propriétaire Gestion E2E",
      email: "rental-owner-e2e@example.test",
      password: "E2eOwnerRental!2026",
      passwordConfirm: "E2eOwnerRental!2026",
      role: "Proprietaire",
      isEmailVerified: true,
    },
  ]);
  await Property.create([
    {
      _id: ids.property,
      title: "Villa E2E Brazzaville",
      description:
        "Hébergement entièrement fictif réservé à la recette automatisée Playwright.",
      pole: "Altimmo",
      type: "Villa",
      status: "hebergement",
      price: 35000,
      address: { arrondissement: "Bacongo", city: "Brazzaville" },
      latitude: -4.26,
      longitude: 15.28,
      images: ["https://placehold.co/1200x800/png?text=E2E"],
      surface: 100,
      bedrooms: 2,
      bathrooms: 1,
      statusAdmin: "Validée",
      availability: "Disponible",
      owner: ids.owner,
    },
    {
      _id: ids.hotelProperty,
      title: "Hôtel Portefeuille E2E",
      description: "Établissement hôtelier fictif réservé à la recette automatisée.",
      pole: "Altimmo",
      type: "Appartement",
      status: "hebergement",
      price: 35000,
      address: { arrondissement: "Centre-ville", city: "Brazzaville" },
      latitude: -4.27,
      longitude: 15.29,
      surface: 500,
      images: ["https://placehold.co/1200x800/png?text=Hotel-1", "https://placehold.co/1200x800/png?text=Hotel-2", "https://placehold.co/1200x800/png?text=Hotel-3"],
      statusAdmin: "En attente",
      availability: "Disponible",
      owner: ids.owner,
    },
    {
      _id: ids.mobileHotelProperty,
      title: "Hôtel Portefeuille E2E Mobile",
      description: "Établissement hôtelier mobile fictif réservé à la recette automatisée.",
      pole: "Altimmo",
      type: "Appartement",
      status: "hebergement",
      price: 35000,
      address: { arrondissement: "Centre-ville", city: "Brazzaville" },
      latitude: -4.27,
      longitude: 15.29,
      surface: 500,
      images: ["https://placehold.co/1200x800/png?text=Mobile-1", "https://placehold.co/1200x800/png?text=Mobile-2", "https://placehold.co/1200x800/png?text=Mobile-3"],
      statusAdmin: "En attente",
      availability: "Disponible",
      owner: ids.owner,
    },
    {
      _id: ids.saleProperty,
      title: "Appartement Vente E2E",
      description: "Bien fictif de comparaison visuelle.",
      pole: "Altimmo",
      type: "Appartement",
      status: "vente",
      price: 95000000,
      address: { arrondissement: "Centre-ville", city: "Brazzaville" },
      latitude: -4.27,
      longitude: 15.29,
      images: ["https://placehold.co/1200x800/png?text=Vente"],
      surface: 120,
      bedrooms: 3,
      bathrooms: 2,
      statusAdmin: "Validée",
      isPublished: true,
      availability: "Disponible",
      owner: ids.owner,
    },
    {
      _id: ids.rentalProperty,
      title: "Maison Location E2E",
      description: "Bien fictif de comparaison visuelle.",
      pole: "Altimmo",
      type: "Maison",
      status: "location",
      price: 450000,
      address: { arrondissement: "Moungali", city: "Brazzaville" },
      latitude: -4.25,
      longitude: 15.27,
      images: ["https://placehold.co/1200x800/png?text=Location"],
      surface: 90,
      bedrooms: 2,
      bathrooms: 1,
      statusAdmin: "Validée",
      isPublished: true,
      availability: "Disponible",
      owner: ids.owner,
    },
    {
      _id: ids.contratFormPropertyMobile,
      title: "Maison Location E2E Mobile",
      description: "Bien fictif dédié au projet mobile-chromium (évite le conflit d'index avec desktop-chromium sur la même base).",
      pole: "Altimmo",
      type: "Maison",
      status: "location",
      price: 450000,
      address: { arrondissement: "Moungali", city: "Brazzaville" },
      latitude: -4.25,
      longitude: 15.27,
      images: ["https://placehold.co/1200x800/png?text=Location"],
      surface: 90,
      bedrooms: 2,
      bathrooms: 1,
      statusAdmin: "Validée",
      isPublished: true,
      availability: "Disponible",
      owner: ids.owner,
    },
    {
      _id: ids.finalizationSaleProperty,
      title: "Villa Vente Finalisation E2E",
      description: "Bien fictif réservé au parcours paiement et finalisation.",
      pole: "Altimmo",
      type: "Villa",
      status: "vente",
      price: 125000000,
      address: { arrondissement: "Bacongo", city: "Brazzaville" },
      latitude: -4.28,
      longitude: 15.27,
      images: ["https://placehold.co/1200x800/png?text=Finalisation"],
      surface: 180,
      bedrooms: 4,
      bathrooms: 3,
      statusAdmin: "Validée",
      isPublished: true,
      availability: "Disponible",
      owner: ids.owner,
    },
    {
      _id: ids.finalizationSalePropertyMobile,
      title: "Villa Vente Finalisation E2E Mobile",
      description: "Bien fictif mobile réservé au parcours paiement et finalisation.",
      pole: "Altimmo",
      type: "Villa",
      status: "vente",
      price: 125000000,
      address: { arrondissement: "Bacongo", city: "Brazzaville" },
      latitude: -4.28,
      longitude: 15.27,
      images: ["https://placehold.co/1200x800/png?text=Finalisation-Mobile"],
      surface: 180,
      bedrooms: 4,
      bathrooms: 3,
      statusAdmin: "Validée",
      isPublished: true,
      availability: "Disponible",
      owner: ids.owner,
    },
    {
      _id: ids.rentalActivationProperty,
      title: "Studio Location Activation E2E",
      description: "Bien fictif dédié au parcours candidature → contrat → bail actif.",
      pole: "Altimmo",
      type: "Studio",
      status: "location",
      price: 300000,
      address: { arrondissement: "Poto-Poto", city: "Brazzaville" },
      latitude: -4.26,
      longitude: 15.28,
      images: ["https://placehold.co/1200x800/png?text=Location-Activation"],
      surface: 35,
      bedrooms: 1,
      bathrooms: 1,
      statusAdmin: "Validée",
      isPublished: true,
      availability: "Disponible",
      owner: ids.owner,
    },
    {
      _id: ids.rentalActivationPropertyMobile,
      title: "Studio Location Activation E2E Mobile",
      description: "Bien fictif mobile dédié au parcours candidature → contrat → bail actif.",
      pole: "Altimmo",
      type: "Studio",
      status: "location",
      price: 300000,
      address: { arrondissement: "Poto-Poto", city: "Brazzaville" },
      latitude: -4.26,
      longitude: 15.28,
      images: ["https://placehold.co/1200x800/png?text=Location-Activation-Mobile"],
      surface: 35,
      bedrooms: 1,
      bathrooms: 1,
      statusAdmin: "Validée",
      isPublished: true,
      availability: "Disponible",
      owner: ids.owner,
    },
    ...[
      [ids.rentalOnboardingProperty, "Bien privé Gestion E2E"],
      [ids.rentalOnboardingPropertyMobile, "Bien privé Gestion E2E Mobile"],
    ].map(([_id, title]) => ({
      _id, title, description: "Bien privé fictif dédié à l'onboarding Gestion locative.",
      pole: "Altimmo", type: "Appartement", status: "location", price: 225000,
      address: { street: "12 rue E2E", arrondissement: "Bacongo", city: "Brazzaville" },
      latitude: -4.27, longitude: 15.28, images: ["https://placehold.co/1200x800/png?text=Gestion-Locative"], surface: 65, bedrooms: 2, bathrooms: 1,
      statusAdmin: "En attente", isPublished: false, recommande: false, availability: "Disponible",
      owner: ids.rentalOnboardingOwner,
    })),
  ]);
  await Accommodation.create({
    _id: ids.accommodation,
    property: ids.property,
    accommodationType: "villa_meublee",
    publicationStatus: "publie",
    active: true,
    capacity: { maxAdults: 4, maxChildren: 2 },
    cleaningFee: 5000,
    minimumStay: 1,
    createdBy: ids.owner,
  });
  await RatePlan.create({
    accommodation: ids.accommodation,
    mode: "nightly",
    amount: 35000,
    currency: "XAF",
    active: true,
    createdBy: ids.owner,
  });
  await Hotel.create({
    _id: ids.hotel,
    name: "Hôtel Portefeuille E2E",
    description: "Établissement hôtelier fictif réservé à la recette automatisée.",
    starRating: 4,
    phone: "+242060000000",
    hotelServices: { wifi: true, parking: true },
    manager: ids.owner,
    property: ids.hotelProperty,
    publicationStatus: "soumis",
    submittedAt: new Date(),
    totalRooms: 13,
    totalCapacity: 26,
    minNightlyRate: 35000,
    maxNightlyRate: 35000,
    createdBy: ids.owner,
  });
  await Accommodation.create({ property: ids.hotelProperty, accommodationType: "hotel", hotel: ids.hotel, publicationStatus: "soumis", active: true, createdBy: ids.owner });
  await RoomCategory.create({ _id: ids.roomCategory, hotel: ids.hotel, name: "Standard", code: "STD", unitsAvailable: 13, capacity: { maxAdults: 2, maxChildren: 0 }, createdBy: ids.owner });
  await RatePlan.create({ roomCategory: ids.roomCategory, rateType: "public", amount: 35000, currency: "XAF", active: true, createdBy: ids.owner });
  await Hotel.create({
    _id: ids.mobileHotel,
    name: "Hôtel Portefeuille E2E Mobile",
    description: "Établissement hôtelier mobile fictif réservé à la recette automatisée.",
    starRating: 4,
    phone: "+242060000001",
    hotelServices: { wifi: true, parking: true },
    manager: ids.owner,
    property: ids.mobileHotelProperty,
    publicationStatus: "soumis",
    submittedAt: new Date(),
    totalRooms: 13,
    totalCapacity: 26,
    minNightlyRate: 35000,
    maxNightlyRate: 35000,
    createdBy: ids.owner,
  });
  await Accommodation.create({ property: ids.mobileHotelProperty, accommodationType: "hotel", hotel: ids.mobileHotel, publicationStatus: "soumis", active: true, createdBy: ids.owner });
  await RoomCategory.create({ _id: ids.mobileRoomCategory, hotel: ids.mobileHotel, name: "Standard Mobile", code: "STDM", unitsAvailable: 13, capacity: { maxAdults: 2, maxChildren: 0 }, createdBy: ids.owner });
  await RatePlan.create({ roomCategory: ids.mobileRoomCategory, rateType: "public", amount: 35000, currency: "XAF", active: true, createdBy: ids.owner });
  await PaiementTransaction.syncIndexes();
  // REG-GL-1.1 / GL-ARCH-1.1 — propriétaire avec un "bien propre"
  // (Proprietaire.biensPropres[], structure embarquée historique sans
  // document Property réel), utilisé par contrat-creation-form.spec.js pour
  // vérifier (1) que ce bien n'apparaît jamais directement comme option
  // sélectionnable du portefeuille, et (2) que le staff peut l'intégrer à la
  // Gestion locative (POST .../importer-gestion) puis créer un contrat
  // dessus. Champs complets (photos/description/superficie/prixLoyer) pour
  // que cet import réussisse réellement dans le test e2e (seuls
  // arrondissement/latitude/longitude restent à compléter via `overrides`,
  // jamais présents sur biensPropres[]).
  //
  // GL-ARCH-1.2 — deux fiches distinctes (desktop / mobile), même
  // convention que `contratFormPropertyMobile` ci-dessus : desktop-chromium
  // et mobile-chromium partagent la même base éphémère (un seul webServer
  // Playwright pour tout le run, voir playwright.config.js), et l'import
  // biensPropres→Property crée un état PERMANENT (Property.sourceOwnerAssetId
  // unique + RentalManagement actif) — jamais nettoyé entre projets par
  // conception (ce n'est pas un état éphémère comme un Contrat, c'est le
  // portefeuille géré lui-même). Réutiliser la même fiche pour les deux
  // projets rendait donc le second projet à s'exécuter dépendant du
  // premier (bien déjà importé) — cause exacte du `skip` précédent.
  // Deux fiches avec des `_id`, adresses et clés `sourceOwnerAssetId`
  // (dérivées de `_id`) totalement distinctes éliminent cette dépendance
  // d'ordre : chaque projet importe SON propre bien, indépendamment,
  // idempotent en lui-même, sans jamais toucher à celui de l'autre projet.
  const Proprietaire = require("../models/Proprietaire");
  await Proprietaire.create({
    nom: "GestionE2E", prenom: "Propriétaire", telephone: "+242060000097",
    user: ids.rentalOnboardingOwner, biensPropres: [],
  });
  await Proprietaire.create({
    _id: ids.proprietaireBienPropre,
    nom: "PropriétaireE2E", prenom: "BienPropre", telephone: "+242060000099",
    biensPropres: [{
      typeBien: "location", titre: "Bien propre E2E", type: "Maison",
      adresse: "12 rue du bien propre", ville: "Brazzaville",
      description: "Description e2e suffisamment longue pour la validation du modèle Property.",
      superficie: 90, nombreChambres: 3, nombreSDB: 1, prixLoyer: 275000,
      photos: ["https://placehold.co/1200x800/png?text=BienPropreE2E"],
    }],
  });
  await Proprietaire.create({
    _id: ids.proprietaireBienPropreMobile,
    nom: "PropriétaireE2E", prenom: "BienPropreMobile", telephone: "+242060000098",
    biensPropres: [{
      typeBien: "location", titre: "Bien propre E2E Mobile", type: "Maison",
      adresse: "13 rue du bien propre mobile", ville: "Brazzaville",
      description: "Description e2e suffisamment longue pour la validation du modèle Property (fiche dédiée mobile-chromium).",
      superficie: 88, nombreChambres: 3, nombreSDB: 1, prixLoyer: 270000,
      photos: ["https://placehold.co/1200x800/png?text=BienPropreE2EMobile"],
    }],
  });
  await mongoose.disconnect();
}
function start(command, args, cwd, env) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: "inherit",
    detached: true,
  });
  children.push(child);
  return child;
}
function startFakePaymentProvider() {
  let sequence = 0;
  fakePaymentProvider = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'POST' && req.url === '/v1/payment-intents') {
        sequence += 1;
        res.end(JSON.stringify({ id: `e2e-intent-${sequence}` }));
        return;
      }
      if (req.method === 'POST' && /^\/v1\/payment-intents\/[^/]+\/confirm$/.test(req.url)) {
        res.end(JSON.stringify({ status: 'processing' }));
        return;
      }
      if (req.method === 'GET' && /^\/v1\/payment-intents\/[^/]+$/.test(req.url)) {
        res.end(JSON.stringify({ status: 'succeeded' }));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'not_found' }));
    });
  });
  return new Promise((resolve) => fakePaymentProvider.listen(5051, '127.0.0.1', resolve));
}
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const forcedExit = setTimeout(() => process.exit(), 3000);
  forcedExit.unref();
  children.forEach((child) => {
    try { process.kill(-child.pid, "SIGTERM"); } catch { /* processus déjà arrêté */ }
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (fakePaymentProvider) await new Promise((resolve) => fakePaymentProvider.close(resolve));
  if (mongo) {
    try {
      await mongo.stop();
    } catch (error) {
      console.warn(`E2E Mongo cleanup warning: ${error.message}`);
    }
  }
  process.exit();
}
async function main() {
  await startFakePaymentProvider();
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  const uri = mongo.getUri("altitude_e2e");
  await seed(uri);
  start(process.execPath, ["server.js"], serverDir, {
    MONGO_URI: uri,
    PORT: "5000",
    NODE_ENV: "e2e",
    FRONTEND_URL: "http://localhost:3000",
    JWT_SECRET: "e2e-jwt-secret-not-for-production",
    JWT_EXPIRES_IN: "1h",
    DISABLE_SCHEDULED_JOBS: "1",
    YABETOO_API_URL: "http://127.0.0.1:5051/v1",
    YABETOO_SECRET_KEY: "e2e-provider-secret",
    YABETOO_WEBHOOK_SECRET: "e2e-webhook-secret",
  });
  await waitFor("http://localhost:5000/api/health");
  start(
    process.execPath,
    [path.join(clientDir, "node_modules/next/dist/bin/next"), "dev", "--hostname", "localhost", "--port", "3000"],
    clientDir,
    { NEXT_PUBLIC_API_URL: "http://localhost:5000/api" },
  );
  await waitFor("http://localhost:3000");
  console.log(`E2E_READY property=${ids.property}`);
  // Le processus lancé par Playwright est le propriétaire explicite de
  // MongoMemoryServer et des deux groupes de processus. Sans ce verrou de
  // cycle de vie, le launcher pouvait terminer dès la fin de main(),
  // laissant npm/Next/Express orphelins et privant Playwright de verdict.
  await new Promise(() => setInterval(() => {}, 1000));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
main().catch(async (error) => {
  console.error(error);
  await shutdown();
});
