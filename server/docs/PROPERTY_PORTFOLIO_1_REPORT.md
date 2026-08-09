# PROPERTY-PORTFOLIO-1 — Rapport de clôture

## 1. Architecture trouvée avant correction

La page `/dashboard/properties` lisait directement `GET /api/properties?dashboardClassification=1`. Pour un utilisateur staff, cette API expose volontairement le référentiel `Property` interne sans imposer les gates de publication. Les pages Hébergements et Établissements lisaient, elles, leurs services spécialisés filtrés. Ventes et Locations réutilisaient également la collection `Property`, avec un filtre de statut côté client.

L'audit détaillé est disponible dans `server/docs/PROPERTY_PORTFOLIO_1_AUDIT.md`.

## 2. Cause exacte de l'incohérence

`dashboardClassification` classait les relations Property/Accommodation/Hotel sans décider de leur éligibilité. Une ancre `Property` pouvait donc rester visible dans Tous les biens alors que son `Accommodation` ou son `Hotel` était brouillon, rejeté, désactivé, indisponible ou absent. Le widget KPI historique interrogeait en outre toute la collection `Property`, soit un dataset différent de la liste.

## 3. Sources de vérité retenues

- Vente et Location : `Property` et son workflow de publication existant.
- Hébergement indépendant : `Accommodation`, avec son `Property` d'ancrage.
- Établissement : `Hotel`, avec son `Property` d'ancrage.
- Gestion locative : jamais une source d'annonce; `RentalManagement` reste opérationnel uniquement.

## 4. Matrice domaine/modèle/publication

| Domaine | Modèle source | Condition d'existence | Condition de publication | Condition dans Tous les biens |
|---|---|---|---|---|
| Vente | Property | `status=vente` | Altimmo, Validée, publiée, Disponible | mêmes gates |
| Location | Property | `status=location` | Altimmo, Validée, publiée, Disponible | mêmes gates |
| Hébergement | Accommodation + Property | indépendante, relations valides | Accommodation publiée/active et règle `isPubliclyVisible` | même règle spécialisée |
| Hôtel | Hotel + Property | relations valides | Hotel publié/actif et Property validée/disponible | même sélection que le portefeuille Hôtel |

## 5. Architecture finale de Tous les biens

`GET /api/properties/portfolio`, protégé par authentification et rôles staff immobilier, appelle une projection calculée à la demande. Trois requêtes de source bornées sont lancées en parallèle, normalisées puis dédupliquées par identifiant physique `Property`. Aucune collection, copie, synchronisation, migration ou listener n'a été ajouté.

## 6. Services existants réutilisés

- `accommodationService.isPubliclyVisible` pour l'éligibilité Accommodation.
- La sélection canonique de `hotelService.listValidatedHotelPortfolio`, extraite en `listEligibleHotels` puis réutilisée par les deux consommateurs.
- Les modèles et workflows `Property`, `Accommodation` et `Hotel` existants.

`propertyAssetPortfolioService` n'a pas été détourné : c'est un cockpit patrimonial/GL, pas un catalogue multi-source.

## 7. Services créés

`propertyPortfolioService` centralise uniquement la lecture, la normalisation, la déduplication et les statistiques de la projection. `propertyPortfolioController` expose cette projection à la nouvelle route staff.

## 8. Règles de publication

Les ventes/locations doivent être validées, publiées, disponibles et appartenir au pôle Altimmo. Accommodation et Hotel conservent exactement leurs règles spécialisées. Aucun nouveau statut ni règle métier concurrente n'a été créé.

## 9. Suppression, archivage et dépublication

Un élément désactivé, retiré, dépublié ou devenu inéligible disparaît naturellement au prochain calcul. Aucune copie n'est supprimée et aucun mécanisme de synchronisation n'est nécessaire.

## 10. Interaction avec Gestion locative

`RentalManagement` n'est pas interrogé comme source du portfolio. Un bien géré mais non publié reste absent. Sa publication ultérieure par le workflow Property le rend éligible sans modifier le lien GL. L'exception historique GL-RECON n'est pas modifiée.

## 11. Interaction avec la modération

Les brouillons, attentes, rejets, éléments internes et sources spécialisées inactives restent exclus selon leurs workflows existants. Le portfolio ne peut ni valider ni publier.

## 12. Cas historiques et incohérents

La classification documentaire retient : A cohérent; B source spécialisée non éligible; C source absente; D doublon probable; E ancre legacy légitime; F relations/statuts incompatibles. Un orphelin legacy est ignoré sans crash. Aucune base distante ni donnée réelle n'a été inspectée ou modifiée; une classification réelle demanderait un dry-run séparé et explicitement configuré.

## 13. Déduplication

La clé est l'identifiant du `Property` physique. Si plusieurs représentations existent, la source la plus spécialisée gagne : Hotel, puis Accommodation, puis Location, puis Vente. L'invariant `stats.total === items.length` est conservé après déduplication.

## 14. KPI corrigés

Tous les biens affiche désormais ses KPI à partir de `filteredProperties`, le même dataset que la liste après projection, déduplication et filtres d'interface. Le cockpit patrimonial historique n'est plus monté dans cette vue en lecture seule. Les cartes indiquent Vente, Location, Hébergement ou Hôtel.

## 15. Performances

La projection exécute trois lectures parallèles : Property vente/location, Accommodation avec populate de Property, Hotel via la sélection spécialisée avec populate contrôlé. Il n'existe aucune requête dans une boucle et donc aucun N+1. La projection reste calculée, sans coût de synchronisation ni stockage dérivé.

## 16. Tests réellement exécutés

| Gate | Résultat |
|---|---|
| Tests PROPERTY-PORTFOLIO-1 Mongo ciblés | PASS — 1 suite, 6 tests |
| Tests de route Property ciblés | PASS — 1 suite, 33 tests |
| Tests UI ManagePropertiesPage ciblés | PASS — 1 fichier, 28 tests |
| Backend Unit complet | PASS — 105 suites, 1217 tests |
| Backend Mongo complet | PASS — 62 suites, 574 tests, 638,512 s |
| Web Vitest complet | PASS — 76 fichiers, 510 tests |
| ESLint serveur | PASS — 0 erreur, 125 avertissements existants |
| ESLint client | PASS — 0 erreur, 268 avertissements existants |
| Build Next.js | PASS — compilation et 142 pages statiques |
| Playwright desktop | PASS — 17 tests, 5,3 min |
| Playwright mobile | PASS — 17 tests, 6,6 min |
| `git diff --check` | PASS |

Mobile Jest, TypeScript Mobile et ESLint mobile n'ont pas été exécutés : aucun fichier mobile ni dépendance partagée mobile n'a été touché.

## 17. Fichiers créés

- `server/__tests__/propertyPortfolio.mongo.integration.test.js`
- `server/controllers/propertyPortfolioController.js`
- `server/docs/PROPERTY_PORTFOLIO_1_AUDIT.md`
- `server/docs/PROPERTY_PORTFOLIO_1_REPORT.md`
- `server/services/propertyPortfolioService.js`

## 18. Fichiers modifiés

- `client/lib/pages/dashboard/ManagePropertiesPage.jsx`
- `client/lib/services/propertyService.js`
- `server/routes/propertyRoutes.js`
- `server/services/hotelService.js`

Les autres fichiers déjà modifiés dans le worktree appartiennent au sprint TENANT-HARDENING-1 précédent et ont été préservés.

## 19. Dettes restantes

- La classification des données de production A–F n'a volontairement pas été exécutée sans URI de dry-run explicitement fournie.
- La route Property historique conserve ses usages multiples public, GL et staff; elle n'a pas été restreinte afin de ne pas casser GL-PROPERTY-FLOW-1.
- Une pagination serveur du portfolio pourra devenir utile si le volume dépasse la taille adaptée à cette vue dashboard.
- Les avertissements ESLint existants restent à résorber indépendamment; aucune erreur n'est présente.

## 20. Confirmation de sécurité

- Aucun commit.
- Aucun push.
- Aucun déploiement.
- Aucune donnée de production consultée ou modifiée.
- Aucune migration destructive.
- Aucune suppression de données réelles.
- Aucun credential `.env` utilisé pour joindre une base distante.

Invariant final : les modules spécialisés possèdent les données; Tous les biens les observe exclusivement.
