import { getPropertyFormConfig } from '../utils/propertyFormConfig';

describe('getPropertyFormConfig', () => {
  it.each([
    ['vente', 'create', 'Ajouter un bien à vendre', 'Prix de vente (FCFA)'],
    ['vente', 'edit', 'Modifier un bien à vendre', 'Prix de vente (FCFA)'],
    ['location', 'create', 'Ajouter un bien à louer', 'Loyer mensuel (FCFA)'],
    ['location', 'edit', 'Modifier un bien à louer', 'Loyer mensuel (FCFA)'],
    ['hebergement', 'create', 'Ajouter un hébergement', 'Tarif par nuit (FCFA)'],
    ['hebergement', 'edit', 'Modifier un hébergement', 'Tarif par nuit (FCFA)'],
  ])('synchronise %s en mode %s', (transactionType, mode, title, priceLabel) => {
    expect(getPropertyFormConfig({ transactionType, mode })).toMatchObject({ title, priceLabel });
  });

  it('personnalise les terrains sans ajouter de champ métier', () => {
    const config = getPropertyFormConfig({ transactionType: 'vente', propertyType: 'Terrain', mode: 'edit' });
    expect(config.isLand).toBe(true);
    expect(config.contextHelp).toContain('superficie');
  });

  it('identifie le contexte hôtelier existant', () => {
    expect(getPropertyFormConfig({ transactionType: 'hebergement', accommodationType: 'hotel', mode: 'edit' })).toMatchObject({ isHotel: true, title: 'Modifier un hôtel' });
  });
});
