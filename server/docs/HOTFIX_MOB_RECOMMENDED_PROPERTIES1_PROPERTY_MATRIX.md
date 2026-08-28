# HOTFIX-MOB-RECOMMENDED-PROPERTIES-1 — MATRICE DES DEUX BIENS

Source : lecture directe, en lecture seule, de la base réelle configurée (`server/.env` `MONGO_URI`), confirmée par une requête directe à l'API de production. Aucune mutation effectuée.

| Field | PARCELLE A VENDRE | BUREAU A LOUER |
|---|---|---|
| `_id` | `6a89f9bcbbb632e80e727ec4` | `6a8be8be306fabec9cad0506` |
| `type` | Parcelle | Bureau |
| `status` (vente/location) | vente | location |
| `statusAdmin` | Validée | Validée |
| `isPublished` | true | true |
| `availability` | Disponible | Disponible |
| `recommande` | true | true |
| `pole` | Altimmo | Altimmo |
| `images` | `['url1', 'url2', 'url3', 'url4', 'url5']` — 5 chaînes Cloudinary valides | `['url1', ..., 'url7']` — 7 chaînes Cloudinary valides |
| `photos` (champ legacy éventuel) | absent | absent |
| `createdAt` | 2026-08-22 | 2026-08-24T06:46 |
| `updatedAt` | 2026-08-24T07:06 | 2026-08-24T07:04 |
| Renvoyé par `GET /properties/recommended` (production, vérifié en direct) | **Oui** | **Oui** |

## Constat central

**Aucune différence de données entre les deux biens n'explique les symptômes rapportés.** Les deux satisfont exactement le même contrat public + recommandation, ont la même forme de champ `images` (tableau de chaînes), et sont tous deux effectivement renvoyés par l'API de production au moment de cet audit. Ceci exclut toute hypothèse de règle métier ("Bureau non éligible", "Parcelle avec structure d'image différente") — voir `_REPORT.md`.
