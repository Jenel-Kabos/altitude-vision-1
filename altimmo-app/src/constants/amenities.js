export const AMENITIES = [
  { value: 'Parking',       icon: 'car-outline' },
  { value: 'Piscine',       icon: 'water-outline' },
  { value: 'Gardien',       icon: 'shield-outline' },
  { value: 'Électricité',   icon: 'flash-outline' },
  { value: 'Eau courante',  icon: 'water' },
  { value: 'Climatisation', icon: 'snow-outline' },
  { value: 'Internet',      icon: 'wifi-outline' },
  { value: 'Sécurité',      icon: 'lock-closed-outline' },
  { value: 'Buanderie',     icon: 'shirt-outline' },
  { value: 'Débarras',      icon: 'cube-outline' },
  { value: 'Véranda',       icon: 'home-outline' },
];

export const AMENITY_VALUES = AMENITIES.map(a => a.value);
