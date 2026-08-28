# HOTFIX-MOB-RECOMMENDED-PROPERTIES-1 — ÉTAT INITIAL

## Baseline git

- Branche : `main`
- HEAD : `a04055f62952c782b92aeef2f100824a17a5f645` ("Update Altimmo 40") — inchangé.
- `git status --short` : 239 lignes — travail parallèle déjà documenté (`ARCH2*`) plus mes hotfix non commités des sprints précédents. Aucun écrasement.
- `git diff --check` : propre.

## Accès en lecture seule à la base réelle

`server/.env` contient un `MONGO_URI` réel (`mongodb+srv://...`), déjà configuré pour ce projet. Conformément au mandat §8/§50, une inspection **strictement en lecture seule** a été effectuée (requêtes `Property.find(...).select(...).lean()`, aucune écriture, aucun `.updateOne`/`.save`) pour retrouver les deux biens réels du rapport.

## Résultat de l'inspection directe (lecture seule, aucune mutation)

| Champ | PARCELLE A VENDRE | BUREAU A LOUER |
|---|---|---|
| `_id` | `6a89f9bcbbb632e80e727ec4` | `6a8be8be306fabec9cad0506` |
| `title` | PARCELLE A VENDRE | BUREAU A LOUER |
| `type` | Parcelle | Bureau |
| `status` | vente | location |
| `statusAdmin` | Validée | Validée |
| `isPublished` | true | true |
| `availability` | Disponible | Disponible |
| `recommande` | true | true |
| `pole` | Altimmo | Altimmo |
| `images` (type des éléments) | tableau de **5 chaînes** (URLs Cloudinary valides) | tableau de **7 chaînes** (URLs Cloudinary valides) |
| `photos` | absent (`undefined`) | absent (`undefined`) |
| `createdAt` | 2026-08-22 | 2026-08-24T06:46 |
| `updatedAt` | 2026-08-24T07:06 | 2026-08-24T07:04 |

**Les deux biens satisfont déjà, au moment de cet audit, l'intégralité du filtre public (`statusAdmin: 'Validée', isPublished: true, availability: 'Disponible', pole: 'Altimmo'`) ET `recommande: true`. Les deux ont un tableau `images` de chaînes valides, pas d'objets, pas de champ `photos`.**

## Preuve directe contre l'API réellement consommée par le mobile

Requête `GET https://altitude-vision.onrender.com/api/properties/recommended` (API de production réelle, celle que l'application mobile appelle) exécutée pendant cet audit :

```
results: 2, isFallback: false
- PARCELLE A VENDRE | Parcelle | vente | recommande:true | images: [2 URLs valides affichées]
- BUREAU A LOUER    | Bureau   | location | recommande:true | images: [2 URLs valides affichées]
```

**Le backend renvoie déjà, au moment de cet audit, les deux biens correctement, avec leurs images.** Ce constat oriente immédiatement l'investigation vers le mobile plutôt que vers une hypothèse de correctif backend (voir `_MOBILE_FLOW.md`/`_REPORT.md` pour la suite).

## Horodatage — indice déterminant

Les deux biens ont un `updatedAt`/`createdAt` très récent (moins d'une heure avant cet audit), cohérent avec l'hypothèse retenue après investigation complète : les symptômes rapportés reflètent un état antérieur à ces modifications, resté affiché côté mobile faute de rafraîchissement (voir `_REPORT.md`, cause racine unifiée).
