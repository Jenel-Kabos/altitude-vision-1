export const VALUATION_PROPERTY_TYPES = [
  ["Terrain nu", "Terrain sans construction"],
  ["Maison", "Maison individuelle"],
  ["Villa", "Villa résidentielle"],
  ["Duplex", "Construction sur deux niveaux"],
  ["Appartement", "Logement dans un immeuble"],
  ["Immeuble résidentiel", "Immeuble d’habitation"],
  ["Immeuble mixte", "Habitation et commerce"],
  ["Bureau", "Espace professionnel"],
  ["Local commercial", "Boutique ou surface commerciale"],
  ["Entrepôt", "Stockage ou activité industrielle"],
  ["Hôtel", "Établissement hôtelier"],
  ["Ferme", "Exploitation agricole bâtie"],
  ["Parcelle agricole", "Terrain agricole"],
  ["Autre", "Autre type de bien"],
].map(([value, description]) => ({ value, label: value, description }));
export const LAND_TYPES = new Set([
  "Terrain nu",
  "Maison",
  "Villa",
  "Duplex",
  "Immeuble résidentiel",
  "Immeuble mixte",
  "Local commercial",
  "Entrepôt",
  "Hôtel",
  "Ferme",
  "Parcelle agricole",
  "Autre",
]);
export const BUILT_TYPES = new Set(
  VALUATION_PROPERTY_TYPES.map((item) => item.value).filter(
    (value) => !["Terrain nu", "Parcelle agricole"].includes(value),
  ),
);
export const ROOM_TYPES = new Set(
  [...BUILT_TYPES].filter(
    (value) => !["Entrepôt", "Parcelle agricole"].includes(value),
  ),
);
