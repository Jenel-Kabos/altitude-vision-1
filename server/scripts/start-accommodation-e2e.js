const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
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
};
let mongo;
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
      availability: "Disponible",
      owner: ids.owner,
    },
    {
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
      availability: "Disponible",
      owner: ids.owner,
    },
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
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const forcedExit = setTimeout(() => process.exit(), 3000);
  forcedExit.unref();
  children.forEach((child) => {
    try { process.kill(-child.pid, "SIGTERM"); } catch { /* processus déjà arrêté */ }
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (mongo) {
    try {
      await mongo.stop({ doCleanup: false });
      await mongo.cleanup({ force: true });
    } catch (error) {
      console.warn(`E2E Mongo cleanup warning: ${error.message}`);
    }
  }
  process.exit();
}
async function main() {
  mongo = await MongoMemoryServer.create();
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
