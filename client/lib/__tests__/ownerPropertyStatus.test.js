import { projectOwnerPropertyStatus, summarizeOwnerProperties } from '../utils/ownerPropertyStatus';

describe('DASH-2 — projection du statut métier propriétaire', () => {
  test.each([
    [{ statusAdmin: 'En attente' }, null, 'En validation'],
    [{ statusAdmin: 'Validée' }, null, 'Validé'],
    [{ statusAdmin: 'Validée', isPublished: true }, null, 'Publié'],
    [{ availability: 'Loué' }, null, 'Occupé'],
    [{ availability: 'Vendu' }, null, 'Vendu'],
    [{ availability: 'Retiré' }, null, 'Archivé'],
    [{ isPublished: true }, { managementActivated: true }, 'En gestion'],
    [{ isPublished: true }, { managementActivated: true, occupancyStatus: 'occupe' }, 'Occupé'],
  ])('projette uniquement les champs existants', (property, rental, label) => {
    expect(projectOwnerPropertyStatus(property, rental).label).toBe(label);
  });

  test('agrège un bien une seule fois selon son état prioritaire', () => {
    const summary = summarizeOwnerProperties([
      { _id: 'A', isPublished: true }, { _id: 'B', statusAdmin: 'En attente' }, { _id: 'C', availability: 'Vendu' },
    ], [{ property: 'A', managementActivated: true, occupancyStatus: 'occupe' }]);
    expect(summary).toMatchObject({ total: 3, occupied: 1, pending: 1, sold: 1, published: 0 });
  });
});
