// MOB-E2E — backend de test pour la certification runtime mobile (Maestro).
// Réutilise EXACTEMENT les mêmes fixtures que le harnais E2E web
// (start-accommodation-e2e.js : ids, seed()) pour ne jamais faire diverger
// deux jeux de données E2E, plus un fixture locataire additionnel pour le
// Tenant Portal (absent du harnais web, nécessaire ici uniquement).
//
// Différences avec le harnais web :
//   - Aucun processus Next.js démarré (app mobile, pas de client web).
//   - Le serveur écoute sur toutes les interfaces (comportement par défaut
//     de `httpServer.listen(PORT)`), donc joignable depuis l'émulateur
//     Android via `10.0.2.2:<PORT>` — c'est le mécanisme standard de
//     l'émulateur pour atteindre le loopback de la machine hôte.
//   - Jamais de credentials externes réels (safeTestEnv + externalNetworkGuard,
//     identique au harnais web) ni d'écriture vers un backend de production.
const path = require("path");
const http = require("http");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const { safeTestEnv } = require("../test-utils/safeTestEnv");
const { spawn } = require("child_process");
const { ids, seed } = require("./start-accommodation-e2e");

const serverDir = path.resolve(__dirname, "..");
const PORT = process.env.MOBILE_E2E_PORT || "5057";

let mongo;
let serverChild;
let shuttingDown = false;

const tenantIds = {
  tenantUser: "66e200000000000000000090",
  proprietaireLease: "66e200000000000000000091",
  contratLease: "66e200000000000000000092",
  // POST-E2E-1 — second locataire/bail totalement indépendant, nécessaire
  // pour prouver l'isolation Tenant Portal (un locataire A ne doit jamais
  // pouvoir lire le bail/documents/maintenance du locataire B). Jamais
  // réutilisé par le PMS déjà certifié (MOB_E2E2_REPORT.md), additif pur.
  tenantUserB: "66e2000000000000000000a0",
  proprietaireLeaseB: "66e2000000000000000000a1",
  contratLeaseB: "66e2000000000000000000a2",
  propertyB: "66e2000000000000000000a3",
};

async function seedTenantFixture() {
  const User = require("../models/User");
  const Proprietaire = require("../models/Proprietaire");
  const Locataire = require("../models/Locataire");
  const Contrat = require("../models/Contrat");
  const Property = require("../models/Property");

  await User.create({
    _id: tenantIds.tenantUser,
    name: "Locataire E2E",
    email: "tenant-e2e@example.test",
    password: "E2eTenant!2026",
    passwordConfirm: "E2eTenant!2026",
    role: "Client",
    isEmailVerified: true,
  });
  const locataire = await Locataire.create({
    nom: "E2E", prenom: "Locataire", telephone: "+242060000097",
    email: "tenant-e2e@example.test",
    user: tenantIds.tenantUser,
  });
  await Proprietaire.create({
    _id: tenantIds.proprietaireLease,
    nom: "PropriétaireBail", prenom: "E2E", telephone: "+242060000096",
  });
  const dateEntree = new Date(); dateEntree.setMonth(dateEntree.getMonth() - 6);
  const dateFinBail = new Date(); dateFinBail.setMonth(dateFinBail.getMonth() + 6);
  await Contrat.create({
    _id: tenantIds.contratLease,
    type: "location",
    bien: ids.property,
    proprietaire: tenantIds.proprietaireLease,
    locataire: locataire._id,
    statut: "actif",
    cycleVie: "actif",
    adresseBien: "Villa E2E Brazzaville",
    villeBien: "Brazzaville",
    dateEntree, dateFinBail,
    montantLoyer: 35000,
    montantCaution: 70000,
    cautionVersee: true,
    dureePreavis: 1,
    chargesIncluses: true,
  });

  // POST-E2E-1 — Locataire B, structure identique, ménage/bail/montants
  // volontairement distincts pour ne jamais pouvoir être confondus avec A
  // dans une assertion de test.
  await User.create({
    _id: tenantIds.tenantUserB,
    name: "Locataire E2E B",
    email: "tenant-b-e2e@example.test",
    password: "E2eTenantB!2026",
    passwordConfirm: "E2eTenantB!2026",
    role: "Client",
    isEmailVerified: true,
  });
  const locataireB = await Locataire.create({
    nom: "E2EB", prenom: "Locataire", telephone: "+242060000098",
    email: "tenant-b-e2e@example.test",
    user: tenantIds.tenantUserB,
  });
  await Proprietaire.create({
    _id: tenantIds.proprietaireLeaseB,
    nom: "PropriétaireBailB", prenom: "E2E", telephone: "+242060000099",
  });
  // Bien distinct obligatoire : un index unique (`one_open_contract_per_property_and_type`)
  // interdit deux contrats "location" actifs sur le même `bien` — réutiliser
  // `ids.property` (déjà utilisé par le bail du Locataire A) provoquerait un
  // conflit réel en base, pas seulement une confusion de lisibilité.
  await Property.create({
    _id: tenantIds.propertyB,
    title: "Studio E2E Tenant B", description: "Fixture POST-E2E-1 bail locataire B.",
    pole: "Altimmo", type: "Studio", status: "location", price: 42000,
    address: { arrondissement: "Ouenzé", city: "Brazzaville" },
    latitude: -4.24, longitude: 15.31, images: ["http://127.0.0.1:5051/fixture.svg"], surface: 35,
    statusAdmin: "Validée", isPublished: true, availability: "Disponible",
    owner: ids.owner,
  });
  await Contrat.create({
    _id: tenantIds.contratLeaseB,
    type: "location",
    bien: tenantIds.propertyB,
    proprietaire: tenantIds.proprietaireLeaseB,
    locataire: locataireB._id,
    statut: "actif",
    cycleVie: "actif",
    adresseBien: "Studio E2E Tenant B Brazzaville",
    villeBien: "Brazzaville",
    dateEntree, dateFinBail,
    montantLoyer: 42000,
    montantCaution: 84000,
    cautionVersee: true,
    dureePreavis: 1,
    chargesIncluses: false,
  });
}

// POST-E2E-1 — Owner B / Hôtel C : deuxième propriétaire réel, totalement
// étranger à rental-owner-e2e (Hôtel A/B), nécessaire pour prouver qu'un
// deep-link vers une ressource hôtelière n'appartenant pas à l'acteur
// courant est réellement refusé (mandat §17). Additif pur, ne touche à
// aucun id déjà utilisé par le PMS certifié MOB-E2E-2.
const foreignOwnerIds = {
  ownerBUser: "66e2000000000000000000b0",
  hotelCProperty: "66e2000000000000000000b1",
  hotelC: "66e2000000000000000000b2",
  roomCategoryC: "66e2000000000000000000b3",
  roomC1: "66e2000000000000000000b4",
};

async function seedForeignOwnerFixture() {
  const User = require("../models/User");
  const Property = require("../models/Property");
  const Hotel = require("../models/Hotel");
  const RoomCategory = require("../models/RoomCategory");
  const Room = require("../models/Room");
  const FIXTURE_IMAGE = "http://127.0.0.1:5051/fixture.svg";

  await User.create({
    _id: foreignOwnerIds.ownerBUser,
    name: "Owner B E2E",
    email: "owner-b-e2e@example.test",
    password: "E2eOwnerB!2026",
    passwordConfirm: "E2eOwnerB!2026",
    role: "Proprietaire",
    isEmailVerified: true,
  });
  await Property.create({
    _id: foreignOwnerIds.hotelCProperty,
    title: "Hôtel Owner C E2E", description: "Fixture POST-E2E-1 hôtel étranger.",
    pole: "Altimmo", type: "Appartement", status: "hebergement", price: 50000,
    address: { arrondissement: "Talangaï", city: "Brazzaville" },
    latitude: -4.25, longitude: 15.3, images: [FIXTURE_IMAGE], surface: 280,
    statusAdmin: "Validée", isPublished: true, availability: "Disponible",
    owner: foreignOwnerIds.ownerBUser,
  });
  await Hotel.create({
    _id: foreignOwnerIds.hotelC,
    tenant: ids.platformTenant,
    name: "Hôtel Owner C E2E",
    property: foreignOwnerIds.hotelCProperty,
    manager: foreignOwnerIds.ownerBUser,
    createdBy: foreignOwnerIds.ownerBUser,
    publicationStatus: "publie",
    active: true,
  });
  await RoomCategory.create({
    _id: foreignOwnerIds.roomCategoryC, hotel: foreignOwnerIds.hotelC,
    name: "Standard E2E-1 C", code: "E2E1C", unitsAvailable: 1,
    capacity: { maxAdults: 2, maxChildren: 0 }, createdBy: foreignOwnerIds.ownerBUser,
  });
  await Room.create({
    _id: foreignOwnerIds.roomC1, hotel: foreignOwnerIds.hotelC, roomCategory: foreignOwnerIds.roomCategoryC,
    roomNumber: "C1", status: "available", active: true, createdBy: foreignOwnerIds.ownerBUser,
  });
}

// MOB-E2E-2 — fixture PMS : réservation pré-seedée directement au statut
// `confirmed` sur Hôtel A (rental-owner-e2e, 8 chambres réelles E2E-1
// disponibles). Le mandat autorise explicitement ce pré-seed quand la
// création via l'UI mobile n'est pas certifiée dans le temps du sprint
// (mandat MOB-E2E-2 §30) — documenté ici et dans le rapport, jamais
// présenté comme une création UI. Le reste du cycle (room assignment,
// check-in, financial readiness, check-out, housekeeping, inspection) est
// piloté par de vraies actions applicatives depuis l'app.
// MOB-E2E-2 — trois réservations identiques en structure (A, B, C) pour
// permettre 3 passages complets du cycle PMS (stabilité 3/3, mandat §60)
// sans dépendre d'une création UI répétée (non certifiée ce sprint, cf.
// commentaire ci-dessus). Chambres différentes pour éviter toute
// collision d'affectation entre les 3 passages exécutés à la suite.
const pmsIds = {
  reservationA: "66e200000000000000000095",
  reservationB: "66e200000000000000000096",
  reservationC: "66e200000000000000000097",
};

async function seedPmsReservation() {
  const HotelReservation = require("../models/HotelReservation");
  const checkInDate = new Date(); checkInDate.setDate(checkInDate.getDate() - 1);
  const checkOutDate = new Date(); checkOutDate.setDate(checkOutDate.getDate() + 2);
  const base = {
    hotel: ids.dash4HotelA,
    roomCategory: ids.e2e1RoomCategoryA,
    checkInDate, checkOutDate,
    roomsCount: 1, adults: 2, children: 0,
    unitPrice: 40000, subtotal: 80000, totalAmount: 80000, currency: "XAF",
    status: "confirmed",
    source: "admin_dashboard",
  };
  await HotelReservation.create({
    ...base, _id: pmsIds.reservationA,
    guest: { firstName: "Guest", lastName: "MobE2E2A", email: "guest-mobe2e2-a@example.test", phone: "+242060000095" },
  });
  await HotelReservation.create({
    ...base, _id: pmsIds.reservationB,
    guest: { firstName: "Guest", lastName: "MobE2E2B", email: "guest-mobe2e2-b@example.test", phone: "+242060000096" },
  });
  await HotelReservation.create({
    ...base, _id: pmsIds.reservationC,
    guest: { firstName: "Guest", lastName: "MobE2E2C", email: "guest-mobe2e2-c@example.test", phone: "+242060000097" },
  });
}

function start(command, args, cwd, env) {
  const guardPath = path.resolve(serverDir, "test-utils/externalNetworkGuard.js");
  const nodeOptions = [process.env.NODE_OPTIONS, `--require=${guardPath}`].filter(Boolean).join(" ");
  const child = spawn(command, args, {
    cwd,
    env: safeTestEnv(process.env, { NODE_ENV: "e2e", NODE_OPTIONS: nodeOptions, ...env }),
    stdio: "inherit",
    detached: true,
  });
  return child;
}

const waitFor = (url, timeout = 120000) =>
  new Promise((resolve, reject) => {
    const started = Date.now();
    const retry = () =>
      Date.now() - started > timeout
        ? reject(new Error(`MOBILE_E2E_TIMEOUT ${url}`))
        : setTimeout(poll, 500);
    const poll = () =>
      http.get(url, (response) => { response.resume(); response.statusCode < 500 ? resolve() : retry(); }).on("error", retry);
    poll();
  });

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const forcedExit = setTimeout(() => process.exit(), 3000);
  forcedExit.unref();
  if (serverChild) { try { process.kill(-serverChild.pid, "SIGTERM"); } catch { /* déjà arrêté */ } }
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (mongo) { try { await mongo.stop(); } catch (error) { console.warn(`MOBILE_E2E Mongo cleanup warning: ${error.message}`); } }
  process.exit();
}

async function main() {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  const uri = mongo.getUri("altitude_mobile_e2e");
  await seed(uri);
  await mongoose.connect(uri);
  await seedTenantFixture();
  await seedPmsReservation();
  await seedForeignOwnerFixture();
  await mongoose.disconnect();

  serverChild = start(process.execPath, ["server.js"], serverDir, {
    MONGO_URI: uri,
    PORT,
    NODE_ENV: "e2e",
    FRONTEND_URL: "http://localhost:3000",
    JWT_SECRET: "e2e-jwt-secret-not-for-production",
    // POST-E2E-1 — relevé à 4h (au lieu de 1h) : les sprints précédents ont
    // observé des expirations de session en cours de manipulation manuelle
    // ADB (temps réel écoulé, pas un bug), gérées proprement par l'app mais
    // interrompant le pilotage. Un délai plus long réduit ce bruit sans
    // affaiblir la portée du test (le comportement d'expiration lui-même
    // reste inchangé et déjà certifié — MOB_E2E2_REPORT.md §26).
    JWT_EXPIRES_IN: "4h",
    DISABLE_SCHEDULED_JOBS: "1",
  });
  await waitFor(`http://localhost:${PORT}/api/health`);
  console.log(`MOBILE_E2E_READY port=${PORT} hotelA=${ids.dash4HotelA} hotelB=${ids.dash4HotelB} hotelC=${foreignOwnerIds.hotelC} reservationA=${pmsIds.reservationA} reservationB=${pmsIds.reservationB} reservationC=${pmsIds.reservationC} ownerAdmin=owner-e2e@example.test client=client-e2e@example.test proprietaire=rental-owner-e2e@example.test ownerB=owner-b-e2e@example.test tenant=tenant-e2e@example.test tenantB=tenant-b-e2e@example.test`);
  await new Promise(() => setInterval(() => {}, 1000));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
main().catch(async (error) => {
  console.error(error);
  await shutdown();
});
