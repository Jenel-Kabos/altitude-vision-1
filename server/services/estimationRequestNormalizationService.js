const { PROPERTY_TYPES } = require("../utils/valuationConstants");

const BUILT_TYPES = new Set(
  PROPERTY_TYPES.filter(
    (type) =>
      !["Terrain", "Terrain nu", "Parcelle agricole", "Ferme"].includes(type),
  ),
);
const number = (value) =>
  value === "" || value == null ? undefined : Number(value);
const positive = (value) => {
  const result = number(value);
  return Number.isFinite(result) && result >= 0 ? result : undefined;
};
const text = (value, max = 500) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const boolean = (value) => value === true || value === "true";
const validEmail = (value) => /^\S+@\S+\.\S+$/.test(value);
const validPhone = (value) => /^[+\d][\d\s().-]{6,24}$/.test(value);
const cleanObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const calculateCompleteness = (data) => {
  const built = BUILT_TYPES.has(data.typeBien);
  const sections = [
    ["contact", Boolean(data.nom && data.email && data.telephone)],
    ["localisation", Boolean(data.location.city && data.location.neighborhood)],
    [
      "surfaces",
      Boolean(
        data.surface > 0 && (!built || data.construction.builtSurface > 0),
      ),
    ],
    ["construction", !built || Boolean(data.construction.condition)],
    [
      "composition",
      !built || Object.values(data.rooms).some((value) => Number(value) > 0),
    ],
    ["documents", data.documents.length > 0],
    ["photos", data.photos.length > 0],
    [
      "données économiques",
      Object.values(data.declaredValues).some(
        (value) => value !== undefined && value !== "" && value !== false,
      ),
    ],
  ];
  const score = Math.round(
    (sections.filter(([, complete]) => complete).length / sections.length) *
      100,
  );
  const missingInformation = sections
    .filter(([, complete]) => !complete)
    .map(([name]) => name);
  return {
    score,
    missingInformation,
    weakSections: missingInformation.slice(),
  };
};

const normalizeEstimationRequest = (
  raw,
  { userId = null, photos = [], documents = [] } = {},
) => {
  const input = cleanObject(raw);
  const location = cleanObject(input.location);
  const land = cleanObject(input.land);
  const construction = cleanObject(input.construction);
  const rooms = cleanObject(input.rooms);
  const economics = cleanObject(
    input.declaredValues || input.ownerDeclaredValues,
  );
  const contact = cleanObject(input.contact);
  const typeBien = PROPERTY_TYPES.includes(input.typeBien)
    ? input.typeBien
    : PROPERTY_TYPES.includes(input.propertyType)
      ? input.propertyType
      : "";
  const mainSurface = positive(
    input.surface ?? land.surface ?? construction.builtSurface,
  );
  const normalized = {
    typeBien,
    transaction: ["vente", "location"].includes(input.transaction)
      ? input.transaction
      : "vente",
    adresse: text(
      input.adresse ||
        [location.street, location.neighborhood, location.city]
          .filter(Boolean)
          .join(", "),
      300,
    ),
    surface: mainSurface,
    chambres: positive(input.chambres ?? rooms.bedrooms),
    etat: text(input.etat || construction.condition, 100),
    disponibilite: text(input.disponibilite, 100),
    description: text(input.description, 2000),
    nom: text(contact.lastName || input.nom, 100),
    firstName: text(contact.firstName || input.firstName, 100),
    email: text(contact.email || input.email, 160).toLowerCase(),
    telephone: text(contact.phone || input.telephone, 30),
    whatsapp: text(contact.whatsapp || input.whatsapp, 30),
    preferredContact: text(
      contact.preferredContact || input.preferredContact,
      50,
    ),
    clientAvailability: text(
      contact.availability || input.clientAvailability,
      200,
    ),
    clientComment: text(contact.comment || input.clientComment, 2000),
    requesterUser: userId,
    valuationPurpose: text(input.valuationPurpose, 100),
    urgency: text(input.urgency, 100),
    requestedValueType: text(input.requestedValueType, 100),
    usage: text(input.usage, 100),
    occupation: text(input.occupation, 100),
    location: {
      country: text(location.country || "Congo", 80),
      city: text(location.city, 100),
      district: text(location.district, 100),
      neighborhood: text(location.neighborhood, 100),
      microZone: text(location.microZone, 100),
      street: text(location.street || location.landmark, 200),
      zoneType: ["urbaine", "périurbaine", "rurale"].includes(location.zoneType)
        ? location.zoneType
        : "",
      latitude: number(location.latitude),
      longitude: number(location.longitude),
    },
    land: {
      surface: positive(land.surface),
      unit: text(land.unit || "m²", 20),
      shape: text(land.shape, 50),
      streetFrontage: positive(land.streetFrontage),
      depth: positive(land.depth),
      facades: positive(land.facades),
      topography: text(land.topography, 100),
      slope: text(land.slope, 50),
      accessibility: text(land.accessibility, 100),
      pavedRoad: boolean(land.pavedRoad),
      floodRisk: text(land.floodRisk, 50),
      erosionRisk: text(land.erosionRisk, 50),
      fenced: boolean(land.fenced),
      serviced: boolean(land.serviced),
      waterAvailable: boolean(land.waterAvailable),
      electricityAvailable: boolean(land.electricityAvailable),
    },
    construction: {
      builtSurface: positive(construction.builtSurface),
      livingSurface: positive(construction.livingSurface),
      floors: positive(construction.floors),
      buildings: positive(construction.buildings),
      constructionYear: positive(construction.constructionYear),
      renovationYear: positive(construction.renovationYear),
      condition: text(construction.condition, 100),
      finishLevel: text(construction.finishLevel, 100),
      roofType: text(construction.roofType, 100),
      walls: text(construction.walls, 100),
      flooring: text(construction.flooring, 100),
      joinery: text(construction.joinery, 100),
      plumbing: text(construction.plumbing, 100),
      electricity: text(construction.electricity, 100),
      renovationNeeded: boolean(construction.renovationNeeded),
    },
    rooms: Object.fromEntries(
      [
        "bedrooms",
        "livingRooms",
        "kitchens",
        "bathrooms",
        "toilets",
        "offices",
        "shops",
        "apartments",
        "garages",
        "terraces",
        "balconies",
        "outbuildings",
        "parkingSpaces",
        "units",
        "occupiedUnits",
        "vacantUnits",
      ]
        .map((key) => [key, positive(rooms[key])])
        .concat([["otherRooms", text(rooms.otherRooms, 500)]]),
    ),
    equipment: Array.isArray(input.equipment)
      ? input.equipment
          .map((item) => text(item, 80))
          .filter(Boolean)
          .slice(0, 30)
      : [],
    equipmentComment: text(input.equipmentComment, 1000),
    photos,
    documents,
    declaredValues: {
      desiredPrice: positive(economics.desiredPrice),
      purchasePrice: positive(economics.purchasePrice),
      acquisitionDate: economics.acquisitionDate || undefined,
      lastKnownEstimate: positive(economics.lastKnownEstimate),
      recentWorksAmount: positive(economics.recentWorksAmount),
      monthlyRent: positive(economics.monthlyRent),
      charges: positive(economics.charges),
      tenantCount: positive(economics.tenantCount),
      occupancyRate: positive(economics.occupancyRate),
      currentlyListed: boolean(economics.currentlyListed),
      saleUrgency: text(economics.saleUrgency, 100),
    },
    statut: "En attente",
    staffViewedAt: null,
    source: input.publicFormVersion ? "PUBLIC_FORM" : "LEGACY_PUBLIC_FORM",
    publicFormVersion: positive(input.publicFormVersion) || 1,
    submittedAt: new Date(),
    workflowHistory: [
      {
        from: "",
        to: "En attente",
        comment: "Soumission du formulaire public",
        at: new Date(),
      },
    ],
  };
  const newForm = Boolean(input.publicFormVersion);
  if (
    !normalized.typeBien ||
    !normalized.adresse ||
    !(normalized.surface > 0) ||
    !normalized.nom ||
    !validEmail(normalized.email) ||
    (newForm && !validPhone(normalized.telephone)) ||
    (!newForm && normalized.telephone && !validPhone(normalized.telephone))
  )
    throw new Error(
      "Type de bien, localisation, surface positive, nom, email et téléphone valides sont obligatoires.",
    );
  const currentYear = new Date().getFullYear();
  for (const value of [
    normalized.construction.constructionYear,
    normalized.construction.renovationYear,
  ])
    if (value != null && (value < 1800 || value > currentYear + 1))
      throw new Error("Année de construction ou rénovation invalide.");
  if (
    normalized.location.latitude != null &&
    (!Number.isFinite(normalized.location.latitude) ||
      normalized.location.latitude < -90 ||
      normalized.location.latitude > 90)
  )
    throw new Error("Latitude invalide.");
  if (
    normalized.location.longitude != null &&
    (!Number.isFinite(normalized.location.longitude) ||
      normalized.location.longitude < -180 ||
      normalized.location.longitude > 180)
  )
    throw new Error("Longitude invalide.");
  const completeness = calculateCompleteness(normalized);
  Object.assign(normalized, {
    completenessScore: completeness.score,
    missingInformation: completeness.missingInformation,
    weakSections: completeness.weakSections,
  });
  return normalized;
};

module.exports = {
  normalizeEstimationRequest,
  calculateCompleteness,
  BUILT_TYPES,
};
