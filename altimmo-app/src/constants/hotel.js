export const HOTEL_HIGHLIGHT_DEFINITIONS = [
  { key: 'restaurant', icon: 'restaurant-outline', label: 'Restaurant' },
  { key: 'bar', icon: 'wine-outline', label: 'Bar' },
  { key: 'piscine', icon: 'water-outline', label: 'Piscine' },
  { key: 'spa', icon: 'flower-outline', label: 'Spa' },
  { key: 'salleSport', icon: 'barbell-outline', label: 'Salle de sport' },
  { key: 'salleConference', icon: 'business-outline', label: 'Salle de conférence' },
  { key: 'navette', icon: 'bus-outline', label: 'Navette' },
  { key: 'parking', icon: 'car-outline', label: 'Parking' },
  { key: 'reception24h', icon: 'time-outline', label: 'Réception 24h/24' },
  { key: 'wifi', icon: 'wifi-outline', label: 'Wi-Fi' },
];

export const getHotelHighlightLabels = (hotelServices) => HOTEL_HIGHLIGHT_DEFINITIONS
  .filter(({ key }) => Boolean(hotelServices?.[key]))
  .map(({ label }) => label);
