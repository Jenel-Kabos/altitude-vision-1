# HOTFIX-HOTEL-DUPLICATE-NAME-GUARD-1 — Rapport final

## Verdict

**GO SOUS RÉSERVE — correctif ciblé vert, gate Mongo exhaustif non certifié.**

Le backend refuse désormais, avant la première écriture, tout nom d'hôtel déjà utilisé dans le tenant effectif. La garantie couvre la création Web et le service transactionnel partagé, le renommage direct, l'approbation d'un renommage publié et les courses concurrentes. Le frontend traduit le conflit sans vider ni fermer le wizard. Aucun commit, push, déploiement ou changement de données n'a été effectué.

## Baseline et audit

- Branche initiale et finale : `main`.
- HEAD initial et final : `ad7f360c323085a4b6cd72a9a3aa422e58e96982`.
- Worktree initial : propre ; aucune modification préexistante à préserver.
- Modèle canonique : `Hotel`, champ officiel `name`, scope `tenant` issu de `actingUser.platformTenant` résolu par le middleware. Le body n'est jamais une autorité de tenant.
- Aucun soft-delete Hotel. `deleteHotel` supprime réellement le document et libère donc le nom. Tant qu'un document existe, `brouillon`, `soumis`, `publie`, `rejete`, `suspendu`, `actif` et `inactif` bloquent tous la réutilisation.
- Premier write du workflow complet : `Property.create`, suivi de `Hotel`, `Accommodation`, `RoomCategory`, `RatePlan`, puis soumission/journalisation. Le guard est exécuté avant `Property.create`.
- Index matérialisés avant correctif : `_id_`, `tenant_1`, `manager_1`, `status_1`, `publicationStatus_1` ; aucun index unique sur le nom.
- Audit production strictement read-only : lecture des index Mongo et agrégation des deux documents Hotel par tenant avec la même fonction de normalisation appliquée en mémoire. Résultat : 2 hôtels, 0 tenant nul, 0 groupe de collision normalisé. Aucune donnée n'a été modifiée.

## Contrat implémenté

La fonction canonique `server/utils/normalizeHotelName.js` applique : Unicode NFD, retrait des diacritiques, trim, réduction des espaces consécutifs à un espace et casse française insensible. La ponctuation, les chiffres, les mots et leur ordre sont conservés. Ainsi `Hôtel Mila` et `Hotel Mila` sont identiques, mais `Mila Hotel` et `Hôtel Mila Brazzaville` restent différents.

Le service `hotelNameUniquenessService` :

- recherche dans le tenant canonique et sait encore comparer les documents legacy sans `normalizedName` ;
- exclut le document courant lors d'une auto-édition ;
- renvoie `409` avec `HOTEL_NAME_ALREADY_EXISTS` et un message non technique ;
- ne traduit que la collision de l'index hôtelier pertinent, jamais les autres erreurs Mongo.

Le modèle dérive toujours `normalizedName` côté serveur et déclare l'index unique partiel `tenant_normalized_hotel_name_unique` sur `{ tenant, normalizedName }`. Le filtre partiel exige un tenant ObjectId et une chaîne normalisée : il n'impose aucun backfill et ignore sans danger les documents legacy non encore normalisés. Le guard applicatif couvre ces documents. L'index a été matérialisé dans Mongo de test et a garanti `1 succès / 1 conflit` lors de deux créations concurrentes. Son installation en production reste naturellement liée au processus normal de gestion des index ; aucun `syncIndexes` production n'a été lancé ici.

## Matrice obligatoire

| Cas | Attendu | Résultat |
|---|---|---|
| Même tenant + même nom | 409 | Vert |
| Même tenant + casse différente | 409 | Vert |
| Même tenant + espaces différents | 409 | Vert |
| Même tenant + accents différents | 409 | Vert |
| Même tenant + nom réellement différent | création | Vert |
| Autre tenant + même nom | création | Vert, aucune fuite |
| Existing soumis + même nom | 409 | Vert |
| Existing publié + même nom | 409 | Vert |
| Existing brouillon/rejeté/suspendu | 409 | Vert |
| Rename vers nom existant | 409 | Vert |
| Self-update | autorisé | Vert |
| Duplicate rejected | 0 ressource orpheline | Vert : Hotel/Property/Accommodation/Category/Rate inchangés |
| Concurrent duplicate | 1 succès maximum | Vert : 1 succès, 1 conflit métier |

## RED → GREEN

Avant le correctif, la nouvelle suite Mongo acceptait les variantes exactes, de casse, d'espaces et d'accents, acceptait un doublon publié et permettait deux succès concurrents : 19 tests passaient et 6 échouaient. Le nouveau test frontend échouait également, car le wizard restait sur la dernière étape sans message dédié. Après correction, la suite Mongo ciblée passe 29/29 et le test frontend ciblé 2/2.

## UX et absence d'orphelins

Sur `409/HOTEL_NAME_ALREADY_EXISTS`, le wizard revient au champ nom, conserve les huit étapes déjà saisies, affiche un message métier et n'appelle pas `onSuccess`. Il ne ferme pas le formulaire et ne produit aucune redirection ni notification de succès. Le backend effectue son contrôle avant toute écriture ; une collision d'index concurrente avorte la transaction. Le fallback historique de création traduit aussi `E11000`, et la duplication compense sa Property si la création Hotel perd une course.

## Gates

| Gate | Résultat |
|---|---|
| Mongo ciblé | 29/29 vert |
| Routes hôtelières | 39/39 vert |
| Frontend ciblé | 2/2 vert |
| Backend unitaire complet | 141 suites, 1582/1582 verts (heap Node portée à 8 Go après OOM du runner par défaut) |
| Mongo exhaustif | Non vert : campagne arrêtée après échec irréversible et cascade de timeouts Mongo. Échecs observés dans des suites hors périmètre (`rentalPaymentMultiEcheanceAllocation`, `gestionLocativePaiements`, `hotfixUsersCount1`, `securityClosureP1WavePropertyAssetTransitionAuthority`, `tenantDataRegularizationExec1`, `rentalAssetOnboardingOptions`) ; une assertion 401/201 a aussi échoué après dégradation du runner. Plusieurs suites ont duré 12 à 105 minutes avant timeout. Le Mongo ciblé du hotfix reste 29/29 vert. |
| Frontend complet | 106 suites, 763/763 verts |
| Architecture | PASS, 0 nouvelle violation, 0 cycle |
| Lint backend | Vert, 0 erreur, 103 avertissements préexistants |
| Lint frontend | Vert, 0 erreur, 267 avertissements préexistants |
| Next.js build | Vert, 144 pages générées ; appels statiques locaux indisponibles tolérés par le build |
| `git diff --check` | Vert |

## Réponses de certification

- POST protégé : oui, dans la couche métier partagée et avant `Property.create`.
- UPDATE/rename protégé : oui, avec exclusion du propre `_id`. Un renommage sensible publié est revérifié au dépôt et à l'approbation pour fermer la fenêtre temporelle.
- Admin et PlatformOperator : aucun bypass ajouté ; le tenant effectif canonique reste appliqué.
- HTTP/code/message : `409`, `HOTEL_NAME_ALREADY_EXISTS`, « Un établissement portant ce nom existe déjà dans ce contexte. »
- Property, Accommodation, Category ou Rate orphelins après rejet précoce : aucun.
- Garantie DB : index unique partiel tenant + normalizedName, testé sur vraie réplique Mongo. Compatible sans backfill avec l'état legacy observé ; aucune migration n'a été exécutée.
- Modération, portfolio, statuts de publication, activation : non modifiés.
- Mobile UI : non modifiée. Le service métier partagé est protégé afin qu'aucun client ne puisse contourner le backend.
- Dépendance ajoutée : aucune.
- Donnée Mongo migrée : aucune.
- Commit/push/deploy : aucun.

## Fichiers modifiés

- `client/lib/components/dashboard/HotelPropertyForm.jsx`
- `client/lib/__tests__/HotelCreationWizardModerationUx.test.jsx`
- `server/models/Hotel.js`
- `server/utils/normalizeHotelName.js`
- `server/services/hotel/hotelNameUniquenessService.js`
- `server/services/accommodation/mobileAccommodationPublicationService.js`
- `server/services/accommodationService.js`
- `server/services/hotelService.js`
- `server/controllers/hotelController.js`
- `server/__tests__/mobileAccommodationPublicationService.mongo.integration.test.js`
- `server/__tests__/hotelRoutes.test.js`
- `server/docs/HOTFIX_HOTEL_DUPLICATE_NAME_GUARD1_REPORT.md`
