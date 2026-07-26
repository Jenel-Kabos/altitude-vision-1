export const createHotelRoomCategory = (index = 0) => ({
  clientKey: `category-${Date.now()}-${index}`,
  name: '', code: '', categoryType: 'standard', quantity: 1,
  adultCapacity: 2, childCapacity: 0, beds: 1, surface: '',
  amenities: {}, ratePlans: [{ rateType: 'public', amount: '', currency: 'XAF' }],
});

export function getHotelCategoryTotals(categories = []) {
  const publicRates = categories.flatMap((category) => (
    (category.ratePlans || []).filter((rate) => rate.rateType === 'public' && Number(rate.amount) > 0)
      .map((rate) => Number(rate.amount))
  ));
  return {
    totalRooms: categories.reduce((sum, category) => sum + (Number(category.quantity) || 0), 0),
    totalCapacity: categories.reduce((sum, category) => sum + (Number(category.quantity) || 0)
      * ((Number(category.adultCapacity) || 0) + (Number(category.childCapacity) || 0)), 0),
    totalBeds: categories.reduce((sum, category) => sum + (Number(category.quantity) || 0) * (Number(category.beds) || 0), 0),
    minNightlyRate: publicRates.length ? Math.min(...publicRates) : 0,
    maxNightlyRate: publicRates.length ? Math.max(...publicRates) : 0,
    currency: 'XAF',
  };
}

export function validateHotelCategories(categories = []) {
  const errors = {};
  if (!categories.length) return { roomCategories: 'Ajoutez au moins une catégorie de chambres' };
  const codes = new Set();
  categories.forEach((category, index) => {
    const prefix = `roomCategories.${index}`;
    const code = String(category.code || '').trim().toUpperCase();
    if (!String(category.name || '').trim()) errors[`${prefix}.name`] = 'Nom requis';
    if (!code) errors[`${prefix}.code`] = 'Code requis';
    else if (codes.has(code)) errors[`${prefix}.code`] = 'Ce code est déjà utilisé';
    codes.add(code);
    if (!Number.isInteger(Number(category.quantity)) || Number(category.quantity) < 1) errors[`${prefix}.quantity`] = 'Minimum 1 unité';
    if (!Number.isInteger(Number(category.adultCapacity)) || Number(category.adultCapacity) < 1) errors[`${prefix}.adultCapacity`] = 'Capacité adulte requise';
    if (!Number.isInteger(Number(category.beds)) || Number(category.beds) < 1) errors[`${prefix}.beds`] = 'Minimum 1 lit';
    const publicRate = (category.ratePlans || []).find((rate) => rate.rateType === 'public');
    if (!publicRate || !(Number(publicRate.amount) > 0)) errors[`${prefix}.ratePlans`] = 'Tarif public requis';
  });
  return errors;
}
