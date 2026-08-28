# HZ-09 — Matrice RBAC

| Entrypoint | Admin | Staff | Proprietaire | Client | PlatformOperator | Autre |
|---|---|---|---|---|---|---|
| Paiement/Contrat/Documents GL | selon capability/Admin, scoped | selon capability, scoped | refusé sauf route métier distincte | refusé | sélection explicite requise | refusé |
| Profils métier | Admin mutate ; staff read, scoped | lecture selon ROLES_DOCS, scoped | self seulement | self seulement | scoped selon rôle/capacité | refusé |
| Locataire/Proprietaire CRUD | scoped selon rôle | scoped selon rôle | aucun bypass ; self routes distinctes | refusé | scoped | refusé |
| Document locatif | scoped pour staff | scoped pour staff | ownership du bail | relation locataire | scoped | refusé |
| Property/Accommodation | action Admin bornée tenant | lecture/action selon route, bornée | ownership préservé | public/self seulement | scoped ; global uniquement là où explicitement prévu ailleurs | refusé |
| Organisation | scoped | lecture scoped | refusé | refusé | scoped | refusé |
| RentalManagement | scoped + capability | scoped + capability | ownership sur routes owner | refusé | middleware impose scope | refusé |
| AccommodationReservation | scoped pour actions staff | scoped selon rôle | owner | guest | global uniquement sur list/transitions explicitement allow-platform-wide ; finance exige scope | refusé |

HZ-09 ne modifie pas le RBAC. Un rôle Admin ne vaut jamais preuve de même tenant. Les appels inline ajoutent une vérification tenant après le RBAC/ownership. Staff sans tenant : les chemins stricts refusent ; la liste réservation peut être globale uniquement pour un PlatformOperator explicitement reconnu par le middleware.
