# RBAC-ACCOMMODATION-AVAILABILITY-BLOCKS-1 — Contrat métier existant (preuve, pas supposition)

## Qui gère réellement les blocages — preuve par symétrie sur la même ressource

Trois routes distinctes, sur le **même modèle** (`AccommodationAvailabilityBlock`) et la **même ressource parente** (`Accommodation`), appliquent **indépendamment** la même règle :

| Route | Fichier | Ligne | Règle |
|---|---|---|---|
| `GET .../reservation-calendar` (`calendar`) | `controllers/accommodationReservationController.js` | 210 | `isStaff(req.user) \|\| String(accommodation.property?.owner) === String(req.user.id)` |
| `POST .../availability-blocks` (`createBlock` → `service.createBlock`) | `services/accommodationReservationService.js` | 105 | `isStaff (mêmes 4 rôles) \|\| String(accommodation.property.owner) === String(user.id)` |
| `DELETE .../availability-blocks/:blockId` (`deleteBlock`) | `controllers/accommodationReservationController.js` | 195 | `isStaff(req.user) \|\| String(block.accommodation.property.owner) === String(req.user.id)` |

Trois implémentations indépendantes (deux fichiers différents), la même règle exacte, déjà en production, déjà documentée par `HOTFIX_ACCOMMODATION_CALENDAR_TENANT_SCOPE1_RBAC_CONTRACT.md` (ligne 7-12) qui liste explicitement ces quatre rôles staff et l'ownership Proprietaire pour CREATE/UPDATE/DELETE sur cette ressource. **C'est une preuve directe du contrat métier**, pas une inférence.

`GET .../availability-blocks` (`listBlocks`) était la **seule** des quatre routes de gestion de cette ressource à n'appliquer aucune de ces deux vérifications — un oubli caractérisé, pas un choix de conception distinct (déjà noté comme tel par `HOTFIX_ACCOMMODATION_CALENDAR_TENANT_SCOPE1_RBAC_FINDINGS.md`, qui l'avait explicitement laissé de côté pour un hotfix séparé — celui-ci).

## Rôles réellement prévus (par preuve, pas par nom)

- **Admin, Collaborateur, GestionnaireImmobilier, CommunityManager** — `isStaff` local à `accommodationReservationController.js`, distinct de `ALL_STAFF` (utilisé ailleurs, ex. `Secretaire`/`Communicant` inclus). Ce sous-ensemble plus étroit est délibéré et spécifique à la gestion immobilière/hébergement (cohérent avec `ROLES_ALTIMMO`/`STAFF_IMMO`/`STAFF_CM` de `utils/roles.js`, qui couvrent ce même périmètre métier).
- **Proprietaire, uniquement s'il possède réellement l'hébergement** (`property.owner === user.id`) — jamais `role === 'Proprietaire'` seul.
- **PlatformOperator** — hérite du même `isStaff` quand son rôle sous-jacent est `'Admin'` (cas réel confirmé par `HOTFIX_ACCOMMODATION_CALENDAR_TENANT_SCOPE1_*` et revérifié dans ce sprint) ; la frontière tenant (HZ-02) gère séparément la portée globale/scopée.
- **Client** — jamais mentionné dans aucun contrat existant pour cette ressource. Aucune preuve d'un besoin métier de lire les blocages internes.
- **Staff hors de ce sous-ensemble** (Secretaire, Communicant) — authentifiés, staff pour d'autres modules (documents, messagerie), mais jamais mentionnés pour la gestion Accommodation dans aucun fichier source, route, ou test existant.

## Données exposées par `listBlocks` (mandat §31)

`Block.find({accommodation}).sort({startDate:1}).lean()` — **aucun `.select()`**, document complet retourné : `startDate`, `endDate`, `type` (enum), **`reason`** (texte libre jusqu'à 1000 caractères — potentiellement une note interne sensible, ex. « Client VIP, ne pas déranger », « Fuite d'eau, chambre 2 »), **`createdBy`** (ObjectId `User` — identifie le staff/propriétaire ayant créé le blocage). Ce sont des données de gestion interne, jamais présentées comme publiques ailleurs dans le code.

## Distinction disponibilité publique vs gestion interne (mandat §32/33) — déjà existante

`GET /:id/availability` (`exports.availability`, ligne 172, montée **avant** `router.use(auth.protect)` — route publique volontaire) répond déjà avec `unavailableDates: locks.map(lock => ({date, type: lock.sourceType}))`, dérivé de `NightLock` — **jamais** le modèle `AvailabilityBlock` brut, jamais `reason` ni `createdBy`. Cette séparation existe **déjà** dans le code, prouvant que le produit a déjà résolu "un client doit-il connaître les périodes indisponibles ?" par une route dédiée, minimale, sans exposer le modèle de gestion interne. `listBlocks` n'a donc jamais été le point d'entrée destiné à ce besoin — encore une preuve que son ouverture à tout utilisateur authentifié était un oubli, pas un choix.

## Consommateurs frontend (read-only, confirmé)

`client/lib/services/accommodationReservationService.js` exporte `listAccommodationBlocks`/`createAccommodationBlock`/`deleteAccommodationBlock`, tous les trois consommés exclusivement par `client/lib/components/dashboard/AccommodationReservationsPanel.jsx`, monté uniquement dans `client/lib/pages/dashboard/AccommodationDetailPage.jsx` — une page du **dashboard** (staff/propriétaire), jamais une page publique ou client. Aucune autre page frontend n'appelle `listAccommodationBlocks`.

## Consommateurs mobile

`grep -rl "availability-blocks" altimmo-app/` → **NOT_FOUND**, aucun consommateur mobile.

## Conclusion

Le contrat existant, prouvé par trois implémentations indépendantes déjà en production sur la même ressource, est sans ambiguïté : lecture des blocages réservée à `isStaff (4 rôles) OU Proprietaire propriétaire de la ressource`. `listBlocks` doit appliquer exactement cette même règle — ni plus (pas de PlatformOperator spécial-casé, déjà géré par la frontière tenant), ni moins.
