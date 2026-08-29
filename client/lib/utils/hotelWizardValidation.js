import { validateHotelRates, validateHotelRoomCategories } from './hotelPublication';

const META = {
  name: ["Nom de l’hôtel", 0], description: ['Description', 0], city: ['Ville', 1],
  arrondissement: ['Arrondissement', 1], phone: ['Téléphone', 1], roomCategories: ['Catégories de chambres', 2],
  hotelServices: ['Services', 4], checkInTime: ["Heure d’arrivée", 5], checkOutTime: ['Heure de départ', 5], images: ['Photos', 6],
};

export function getHotelWizardFieldMeta(field) {
  if (META[field]) return { label: META[field][0], step: META[field][1] };
  if (field.startsWith('roomCategories.')) return { label: field.includes('ratePlans') ? 'Tarif de catégorie' : 'Catégorie de chambre', step: field.includes('ratePlans') ? 3 : 2 };
  return { label: field, step: 0 };
}

export function validateHotelWizard(form, onlyStep = null) {
  const errors = {}; const include = (step) => onlyStep === null || onlyStep === step;
  if (include(0)) {
    if (!String(form.name || '').trim()) errors.name = "Le nom de l’hôtel est obligatoire.";
    if (!String(form.description || '').trim()) errors.description = 'La description est obligatoire.';
  }
  if (include(1)) {
    if (!form.address?.city) errors.city = 'Veuillez sélectionner une ville.';
    if (!form.address?.arrondissement) errors.arrondissement = 'Veuillez sélectionner un arrondissement.';
    if (!String(form.phone || '').trim()) errors.phone = 'Le téléphone est obligatoire.';
  }
  if (include(2)) Object.assign(errors, validateHotelRoomCategories(form.roomCategories));
  if (include(3)) Object.assign(errors, validateHotelRates(form.roomCategories));
  if (include(4) && !Object.values(form.hotelServices || {}).some(Boolean)) errors.hotelServices = 'Sélectionnez au moins un service.';
  if (include(5)) {
    if (!form.checkInTime) errors.checkInTime = "L’heure d’arrivée est obligatoire.";
    if (!form.checkOutTime) errors.checkOutTime = "L’heure de départ est obligatoire.";
  }
  if (include(6) && !(form.images?.length > 0)) errors.images = 'Ajoutez au moins une photo.';
  return errors;
}

export function firstHotelWizardError(errors) {
  return Object.entries(errors).map(([field, message]) => ({ field, message, ...getHotelWizardFieldMeta(field) })).sort((a, b) => a.step - b.step)[0] || null;
}
