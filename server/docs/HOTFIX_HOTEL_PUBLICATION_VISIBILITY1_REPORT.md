# HOTFIX-HOTEL-PUBLICATION-VISIBILITY-1 — Rapport final

## 1. Executive Summary

SPRINT: **HOTFIX-HOTEL-PUBLICATION-VISIBILITY-1**
VERDICT: **C — BACKEND PUBLICATION SYNC FIXED — EXISTING DATA RE-SYNC REQUIRED**
BRANCH: `main`
HEAD: `49f12d787b1011d16f9682cedefb81b377823e4d`
ROOT CAUSE: `server/controllers/hotelController.js::reviewDecision` validait le Hotel, l'Accommodation et `Property.statusAdmin`, mais n'écrivait pas `Property.isPublished=true`; `server/controllers/propertyController.js::runPropertySearch` exige simultanément `statusAdmin='Validée'` et `isPublished=true`, donc l'ancre Property de l'hôtel était retirée avant le rendu de `/immobilier/annonces`.
HOTEL MODEL: `server/models/Hotel.js`
PROPERTY REPRESENTATION: **YES — Property ancre + Hotel métier + Accommodation adaptateur**
HOTEL MILA VALIDATED: **YES selon le symptôme utilisateur; non relu en production pendant ce sprint**
HOTEL MILA PUBLICATION FLAG: **`Property.isPublished=false` fortement démontré comme divergence, mais valeur production non relue**
PUBLIC ENDPOINT: `GET /api/properties`
PUBLIC QUERY FILTER: `availability='Disponible'`, `statusAdmin='Validée'`, `isPublished=true`, `pole='Altimmo'`, puis pour `status='hebergement'` une Accommodation `publicationStatus='publie'`
HOTEL EXCLUDED BY: **Property.isPublished absent/false**
BACKEND FIX: **YES**
FRONTEND FIX: **NO**
MODEL CHANGE: **NO**
MIGRATION: **NO**
TENANT ISOLATION / RBAC: **PRESERVED / PRESERVED**
RED: **PASS — échec exact observé**
GREEN: **PASS**
MONGO INTEGRATION: **22/22**
BACKEND TARGETED TESTS: **172/172**
BACKEND FULL UNIT: **1,593/1,593**
FRONTEND TESTS: **NOT RUN — frontend unchanged**
BUILD: **NOT RUN — frontend unchanged**
ARCHITECTURE: **PASS, 0 new violation**
LINT: **PASS, 0 errors / 102 pre-existing warnings**
DIFF CHECK: **GREEN**
PRODUCTION WRITE: **NO**
MANUAL PROD CHECK REQUIRED: **YES**
COMMIT / PUSH / DEPLOY: **NO / NO / NO**

Un Hotel validé et publié doit apparaître dans `/immobilier/annonces` parce que le contrat existant crée volontairement une Property publique `status='hebergement'`, que la recherche immobilière prend explicitement en charge les hébergements publiés, et que la carte/détail Property possèdent déjà ce contrat. Le correctif ne force aucun Hotel public: il complète uniquement la transition de modération déjà autorisée.

## 2. Git Baseline

Worktree initial non propre. Six fichiers suivis étaient déjà modifiés et quinze fichiers non suivis étaient présents, notamment les travaux portails financiers et les rapports Altimmo Pro. Ils ont été préservés. `git diff --check` initial était vert. Aucun reset, clean, restore, checkout, stash, add, commit, push ou deploy.

Fichiers de ce hotfix:

- `server/controllers/hotelController.js`;
- `server/__tests__/hotelRoutes.test.js`;
- `server/__tests__/propertySearchFilters.mongo.integration.test.js`;
- ce rapport.

## 3. Symptom

Les vues internes ne partagent pas le filtre public. `/mes-biens` et `/dashboard/properties` peuvent montrer la Property indépendamment de `isPublished`. `/immobilier/annonces` appelle le filtre public strict. Le delta 4 interne / 3 public est donc expliqué exactement par le gate manquant, sans supposer que tout bien interne est public.

## 4. Product Contract

**YES:** un Hotel complet, soumis, validé et actif doit apparaître dans la liste immobilière publique sous forme de Property `hebergement`. Preuves:

- le wizard `hotel_establishment` crée explicitement une Property `pole='Altimmo'`, `status='hebergement'`, historiquement de type `Commerce`;
- `runPropertySearch` traite explicitement `status='hebergement'` et vérifie son Accommodation publiée;
- la page publique accepte `offerType=hebergement`;
- `PropertyCard` affiche le badge Hébergement, supporte les champs optionnels et pointe vers la fiche Property publique;
- le domaine Hotel possède parallèlement sa fiche spécialisée `/immobilier/hotels/:id`; cette duplication de surfaces est intentionnelle, pas une duplication de données.

Validation n'est pas synonyme de publication en général. Ici, l'action Hotel `validate` est précisément la transition métier qui publie le Hotel et l'Accommodation; elle doit donc aligner les deux gates de la Property ancre.

## 5. Hotel Architecture

Architecture réelle: **C — Hotel métier séparé avec projection/ancre Property**, plus Accommodation adaptateur.

- `Hotel`: identité établissement, services, galerie, chambres/catégories, cycle `brouillon|soumis|publie|rejete|suspendu`.
- `Property`: titre, adresse, géolocalisation, images principales, offre `hebergement`, modération générale et gate `isPublished`.
- `Accommodation`: adaptateur de séjour/réservation lié à la Property et au Hotel, avec son propre `publicationStatus`.

Il n'existe aucun `Property.type='hotel'`: l'enum Property ne le permet pas. Le type réel du wizard Hotel est `Commerce`; `hotelType='hotel'` appartient au modèle Hotel. Aucun filtre de casse/accent sur `hotel|hôtel` n'est donc impliqué.

## 6. Property Representation

La création complète persiste `Property + Hotel + Accommodation`, puis catégories et tarifs. `Hotel.property` et `Accommodation.property` pointent sur la même ancre; `Accommodation.hotel` pointe sur Hotel. Aucune nouvelle représentation n'a été créée par ce hotfix.

## 7. Creation Flow

`HotelCreationWizard` (`client/lib/components/dashboard/HotelPropertyForm.jsx`) → `POST /api/hotels/admin` (ou `/mine`) → `hotelController.createFull` → publication payload partagé / `createFullHotel` → Property `status='hebergement'`, Hotel et Accommodation. Le flux complet auto-soumet à la modération; il ne publie pas.

Champs structurants initiaux: Property `pole=Altimmo`, `status=hebergement`, `statusAdmin=En attente`, `isPublished=false`, `availability=Disponible`; Hotel `publicationStatus=soumis`, `status=actif`, `active=true`; Accommodation `publicationStatus=soumis`, `active=true`. Tenant/owner/manager viennent du serveur.

## 8. Moderation Flow

Route exacte: `PATCH /api/hotels/:id/:action`, protégée par authentification, rôle de modération et `assertHotelAccess(...HOTEL_MANAGE)`.

Avant fix, `validate` écrivait:

- Hotel: `soumis→publie`, `publishedAt`, reviewer, historique;
- Property: `statusAdmin='Validée'`, `reviewedAt`;
- Accommodation: `publicationStatus='publie'`.

Le seul champ manquant était `Property.isPublished=true`. Le rejet alignait les statuts mais ne garantissait pas non plus explicitement `isPublished=false`.

## 9. Publication Flow

Après fix, la même décision écrit également:

- validate: `Property.isPublished=true`;
- reject: `Property.isPublished=false`.

Brouillon, soumis, incomplet, rejeté et acteur non autorisé ne peuvent pas atteindre la branche de validation. Suspension/réactivation continuent d'utiliser `Hotel.active` et `Accommodation.active`; aucun changement de contrat.

## 10. Public Listing Flow

`/immobilier/annonces` → `PropertiesPage`/service `getPropertiesWithFilters` → `GET /api/properties` → `propertyController.getAllProperties` → `runPropertySearch` → Mongo Property → contrôle Accommodation pour les hébergements → réponse → `PropertyCard`.

Le frontend rend directement la réponse; aucun `.filter()` n'exclut Hotel, `Commerce` ou `hebergement`. Pagination/tri n'étaient pas la cause: l'élément échouait le filtre Mongo de base avant pagination utile.

## 11. Current Hotel Characterization

| Field | HOTEL MILA | Property visible classique |
|---|---|---|
| architecture | Hotel + Property + Accommodation | Property |
| Property.type | `Commerce` selon le contrat de création/audit antérieur | Villa/Bureau/Parcelle selon annonce |
| status | `hebergement` | vente/location |
| pole | `Altimmo` | `Altimmo` |
| statusAdmin | `Validée` selon symptôme | `Validée` |
| isPublished | probablement `false`, non relu en production | `true` requis |
| availability | `Disponible` selon dernier audit | `Disponible` requis |
| Hotel.publicationStatus | `publie` selon validation observée | N/A |
| Accommodation.publicationStatus | attendu `publie` par sync | N/A |

Le rapport antérieur `AUDIT_HOTEL_ESTABLISHMENT_CREATION_VISIBILITY1_REPORT.md` avait caractérisé MILA HOTEL avant validation (`soumis`, Property en attente) et documentait déjà que la validation ne mettait à jour que `statusAdmin`, pas `isPublished`. Aucun accès production n'a été utilisé ici.

## 12. Public Query Characterization

Condition exacte non-staff:

```text
Property.availability = Disponible
Property.statusAdmin = Validée
Property.isPublished = true
Property.pole = Altimmo
AND, si status=hebergement:
Accommodation.property = Property._id
Accommodation.publicationStatus = publie
```

Il n'y a aucun filtre `$ne:'hotel'`, aucune allowlist excluant Hotel, aucun filtre image et aucun filtre frontend de type.

## 13. Root Cause

**Exact file:** `server/controllers/hotelController.js`.
**Exact mutation gap:** l'update Property de `reviewDecision(validate)` contenait seulement `statusAdmin:'Validée'` et `reviewedAt`; `isPublished` restait à sa valeur initiale `false`.
**Exact endpoint/query:** `GET /api/properties`, `runPropertySearch`, `baseFilter.isPublished=true`.
**Exact disappearance:** Mongo excluait la Property ancre avant que le contrôle Accommodation ou le frontend ne puisse la conserver.

## 14. RED Test

Une assertion a été ajoutée au vrai appel `PATCH /api/hotels/:id/validate`: elle exige l'update `{statusAdmin:'Validée', isPublished:true, reviewedAt}`. Avant fix: **1 échec exact, 38 autres tests verts**; reçu sans `isPublished`. Le premier lancement sandboxé a échoué sur `listen EPERM`; la relance autorisée a fourni le RED métier ci-dessus.

## 15. Fix

Correctif minimal dans l'update Property déjà existant:

```js
isPublished: action === 'validate'
```

Le document retourné en mémoire est aligné de la même façon. Aucune query, route, permission, resolver tenant, modèle, migration ou UI modifié.

## 16. GREEN Tests

- `hotelRoutes.test.js`: **40/40**;
- cluster Hotel/Property/Accommodation/Payload: **5 suites, 172/172**;
- backend unit complet: **145 suites, 1,593/1,593**.

La matrice couvre brouillon/incomplet, soumis, rejet, validate, Hotel publié, Property classique, Accommodation, permissions, concurrence, suspension et réactivation.

## 17. Mongo Integration

`propertySearchFilters.mongo.integration.test.js`: **22/22** sur MongoMemoryReplSet.

Le nouveau cas persiste une vraie Property `hebergement` avec `isPublished=false`, un vrai Hotel `publie` et une vraie Accommodation Hotel `publie`: résultat public 0. Après alignement `isPublished=true`: résultat public 1, titre exact retrouvé. Les tests existants confirment aussi vente/location, Villa/Studio, filtres ville/type, publication Accommodation et absence de fuite des statuts non publics.

## 18. Frontend Validation

Aucun changement frontend nécessaire. `PropertyCard` supporte `status='hebergement'`, image absente via fallback, chambres/surface optionnelles et URL `/immobilier/property/:id`. `getPropertyById` accepte le détail lorsque `statusAdmin='Validée'`, `isPublished=true` et disponibilité publique. La route spécialisée Hotel reste `/immobilier/hotels/:id`; aucune URL legacy ajoutée.

## 19. Tenant/RBAC Safety

Préservés par construction: la route et `assertHotelAccess` sont inchangés; l'update vise exclusivement `hotel.property._id` après décision autorisée. Aucun élargissement cross-tenant, aucune autorité Admin supprimée, aucun resolver modifié.

## 20. Regression Matrix

| Scenario | Résultat |
|---|---|
| Hotel brouillon | non public, transition validate refusée |
| Hotel soumis incomplet | 422, non public |
| Hotel rejeté | Property explicitement dépubliée |
| Hotel validé + publié | Property publiée, éligible aux deux surfaces |
| Hotel suspendu | Hotel/Accommodation inactifs selon contrat existant |
| Property vente/location validée | inchangée, tests verts |
| Accommodation indépendante | inchangée, tests verts |
| acteur non autorisé | 403 |
| conflit concurrent | 409, aucune sync secondaire |
| internalManagedOnly | aucun auto-enrollment; ce hotfix ne touche qu'une Property déjà liée à un Hotel soumis |
| image absente | fallback carte; aucun filtrage |

## 21. Architecture Gate

PASS: 482 fichiers, 1,600 arêtes statiques, 0 cycle, 0 import non résolu, 0 nouvelle violation. Dette préexistante inchangée.

## 22. Lint

Backend: **0 erreur, 102 warnings préexistants**. Aucun warning dans les lignes ajoutées.

## 23. Diff Check

Initial et final: **GREEN**.

## 24. Production Manual Check

Obligatoire après revue/déploiement futur:

1. réparer de façon contrôlée la Property ancre déjà validée de HOTEL MILA via une opération de resynchronisation explicitement autorisée; ce sprint ne fournit ni script ni mutation production;
2. vérifier en lecture que Hotel=`publie`, Accommodation=`publie`, Property `Validée/isPublished=true/Disponible/Altimmo`;
3. appeler `GET /api/properties?offerType=hebergement` et confirmer le delta 3→4;
4. ouvrir la carte, la fiche Property et la fiche Hotel spécialisée;
5. confirmer qu'aucun brouillon/soumis/rejeté/interne n'est apparu.

Le correctif de code n'est pas rétroactif pour HOTEL MILA déjà `publie`: la route refuse légitimement de revalider un Hotel qui n'est plus `soumis`. Une réparation de données séparée et autorisée est donc nécessaire.

## 25. Final Verdict

**C — BACKEND PUBLICATION SYNC FIXED — EXISTING DATA RE-SYNC REQUIRED.**

La cause racine est prouvée par code, RED ciblé et Mongo réel isolé. Le correctif aligne la Property ancre uniquement lors d'une vraie décision Hotel validate/reject, sans contourner modération, tenant ou RBAC. Toutes les suites exécutées sont vertes. Aucun frontend, modèle ou migration n'est requis. HOTEL MILA existant doit néanmoins être réparé manuellement dans un sprint/opération production explicitement autorisé après déploiement; aucune écriture production n'a été faite ici.
