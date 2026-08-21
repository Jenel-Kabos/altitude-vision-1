# HOTFIX-PROPERTY-PUBLICATION-VISIBILITY-1 — État initial

## Snapshot réel masqué

Lecture Mongo en date du 2026-08-21, sans mutation :

| Champ | Valeur |
|---|---|
| `_id` | `6a887b…e4ec` |
| `title` | `PARCELLE A VENDRE` |
| `type` | `Parcelle` |
| `listingType` | absent ; la valeur canonique est `status=vente` |
| `statusAdmin` | `Validée` |
| `isApproved` | absent ; la modération canonique est `statusAdmin` |
| `isPublished` | **false** |
| `publicationStatus` | absent sur `Property` classique |
| `availability` | `Disponible` |
| `pole` | `Altimmo` |
| propriétaire | présent, inscription publique non affiliée |
| `tenant` | absent/null |
| `internalManagedOnly` | false |
| images | 6 |
| création | 2026-08-21T16:23:09.616Z |

Un seul tenant actif/trial existe dans l'environnement observé : l'extension locale et bornée du scope portefeuille inclut donc correctement ce propriétaire non affilié. Le tenant n'est pas la cause.

## Chaîne et cause avant correction

- `/dashboard/sales` monte `ManagePropertiesPage(section="vente")`.
- La liste appelle `GET /api/properties/portfolio`, puis filtre `status === "vente"` côté React.
- Le portefeuille exige `pole=Altimmo`, `status in [vente,location]`, `statusAdmin=Validée`, `isPublished=true`, `availability=Disponible`.
- Le KPI Sales appelle `GET /api/dashboard-analytics/sales`. Son compteur nommé `published` comptait uniquement `statusAdmin=Validée`, sans vérifier `isPublished`.
- « Tous les biens » utilise le même portefeuille : son contrat prouvé est le portefeuille public éligible dédupliqué, pas tous les documents internes.
- La Home appelle `GET /api/properties/latest?pole=Altimmo&limit=5`, qui réutilise la recherche publique exigeant `statusAdmin=Validée`, `isPublished=true`, `availability=Disponible`, `pole=Altimmo`.
- Le frontend Home n'ajoute aucun filtre Altimmo supplémentaire.

Le document était donc approuvé mais jamais publié. La modération `validate` ne modifiait que `statusAdmin`; aucune transition de publication n'existait pour les `Property` classiques vente/location. Le KPI confondait approbation et publication, créant l'illusion « Publiés : 1 ».
