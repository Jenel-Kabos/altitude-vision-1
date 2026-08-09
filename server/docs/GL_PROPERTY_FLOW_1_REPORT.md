# GL-PROPERTY-FLOW-1 — Rapport de hotfix

## Audit initial et cause architecturale

Le couplage provenait de trois chemins historiques :

1. `rentalAssetOnboardingService.createManaged` créait un `Property` privé puis un `RentalManagement` actif dans la même action.
2. `proprietaireGestionImportService` et la route `importer-gestion` transformaient un élément legacy `Proprietaire.biensPropres[]` en `Property` et l'activaient immédiatement en gestion.
3. `GestionLocativePage` exposait ces deux chemins sous « Créer un nouveau bien géré » et « Créer la fiche de gestion ».

La recherche publique ne filtrait que `statusAdmin: "Validée"` et la disponibilité. Un `Property` validé mais explicitement non publié pouvait donc rester visible dans « Toutes les annonces » et dans l'API publique.

## Cartographie avant / après

Avant : `Gestion locative → création/import Property → RentalManagement`.

Après :

- `Immobilier → Property` : référentiel unique, création initiale non publiée et en attente de modération ;
- `Property existant → RentalManagement.managementActivated=true` : activation GL idempotente ;
- `Property existant → modération → isPublished=true` : publication, sans création d'un second bien ;
- `RentalManagement → désactivation` : sortie de gestion sans suppression de `Property`, contrat, paiement, document ou historique.
- `GL-RECON-UX-1 → reconstruction historique contrôlée` : unique exception autorisée à créer un `Property`, uniquement depuis un contrat location ouvert sans référence `bien`.

La page `/dashboard/properties` est désormais nommée « Tous les biens » : elle représente le référentiel interne. Les listes publiques représentent les annonces publiées.

## Règles définitives

### Création Property

La création appartient au domaine Immobilier. Le rôle `GestionnaireImmobilier` peut utiliser le workflow staff existant de `/dashboard/properties`. Le schéma conserve par défaut `isPublished=false` et le contrôleur fixe `statusAdmin="En attente"`. Aucun chemin GL exposé ne crée plus de `Property`.

### Activation Gestion locative

Seuls `Admin` et `GestionnaireImmobilier` accèdent à l'onboarding. Le payload doit être `{ mode: "existing", property }`. Les modes `new` et legacy sont refusés par `EXISTING_PROPERTY_REQUIRED`.

L'interface normale impose d'abord un filtre propriétaire, puis permet une recherche par référence, titre, adresse, ville ou type. Elle affiche le propriétaire, l'adresse, le loyer et l'état de publication du `Property` choisi. Aucun champ de création immobilière n'est exposé.

L'éligibilité vérifie : Property réel, type location, propriétaire métier relié, absence de gestion active, absence de contrat ouvert incompatible, bien non vendu/retiré/archivé. `statusAdmin`, `isPublished` et l'état de publication ne bloquent pas l'activation. L'index unique `RentalManagement.property` et l'upsert conditionnel empêchent les doublons concurrents.

### Publication et visibilité

La publication change le même `Property`. La gate publique canonique Vente/Location est :

`statusAdmin === "Validée" && isPublished === true && availability === "Disponible" && pole === "Altimmo"`.

Elle est appliquée à la liste, au détail, aux recommandations et à l'API publique. La Gestion locative peut demander la publication, mais ne crée jamais une annonce distincte.

### Retrait de la Gestion locative

L'action « Retirer de la gestion locative » est réservée à `Admin` et `GestionnaireImmobilier`. Elle est refusée si un contrat location est actif/ouvert ou si les obligations financières associées sont impayées, en retard ou partielles. Sinon, elle désactive et archive fonctionnellement le dossier (`managementActivated=false`, `active=false`), conserve `Property` et ajoute `rental_management_deactivated` à `workflowHistory`.

### Exception historique GL-RECON-UX-1

La reconstruction reste volontairement possible dans le seul centre `/dashboard/gestion-locative/regularisation`. L'action `create_internal` :

- est réservée à `Admin` et `GestionnaireImmobilier` ;
- exige un identifiant de contrat et un motif métier d'au moins cinq caractères ;
- recharge le contrat et refuse tout contrat moderne déjà rattaché à un `Property`, clôturé ou non-location ;
- crée exactement un `Property` avec `isPublished=false`, `statusAdmin="En attente"` et `internalManagedOnly=true` ;
- crée le `RentalManagement` actif mais avec publication interdite et état `suspendu` ;
- journalise l'acteur, le contrat et le motif dans l'historique de réconciliation et dans `ActionLog` ;
- conserve le `Property` lors d'un revert administrateur contrôlé.

Cette fonction est exportée sous le nom explicite `reconstructHistoricalManagedProperty` et n'est appelée par aucun onboarding GL normal.

## Données historiques

Aucune correction massive n'a été exécutée. Les structures `Proprietaire.biensPropres[]`, `sourceOwnerAssetId` et `internalManagedOnly` restent lisibles pour traçabilité, mais ne sont plus proposées ni importables depuis la Gestion locative normale. Les 17 contrats réels n'ont pas été consultés : aucun environnement métier explicitement sûr et en lecture seule n'était disponible. Leur classement A–F et leur traitement restent donc **NON EXÉCUTÉS**, dossier par dossier depuis le centre de régularisation.

Les catégories à auditer en lecture sur l'environnement métier sont : gérés/non publiés, publiés/non gérés, publiés/gérés, ni publiés ni gérés, ainsi que `statusAdmin="Validée" && isPublished!=true`. Aucun `updateMany`, backfill ou apply n'appartient à ce hotfix.

## RBAC

- Activation et retrait GL : `Admin`, `GestionnaireImmobilier`.
- Consultation opérationnelle GL : rôles `ROLES_GL` existants, sans capacité implicite d'onboarding.
- Création dans le référentiel Immobilier : rôles `ROLES_ALTIMMO`, avec ajout du `GestionnaireImmobilier` au CTA existant.
- `Proprietaire`, `Client`, `Locataire`, `Collaborateur` et `Secretaire` ne peuvent pas activer/retirer via les endpoints réservés.

## Tests et gates

Résultats exécutés sur l'état final :

- Backend Unit : **105 suites, 1 217 tests, succès**.
- Backend Mongo/replica complet : **60 suites, 563 tests, succès**.
- Tests ciblés GL-RECON : **1 suite, 6 tests, succès** (liaison, reconstruction, garde-fous, audit et revert conservateur).
- Tests ciblés onboarding Web : **1 fichier, 4 tests, succès** (sélection existante, propriétaire, recherche, absence d'import).
- Web Vitest complet : **76 fichiers, 510 tests, succès**.
- Playwright ciblé GL desktop/mobile : premier passage fonctionnel **mobile 1/1**, desktop en timeout de compilation froide après une authentification serveur réussie ; rejeu desktop avec délai adapté **1/1 succès**. Verdict final du workflow affecté : **desktop PASS, mobile PASS**, flake environnemental documenté.
- Next.js production : **succès**, 142 pages statiques générées.
- ESLint serveur : **succès, 0 erreur, 121 avertissements historiques**.
- ESLint client : **succès, 0 erreur, 268 avertissements historiques**.
- `git diff --check` : **succès**.

Le ciblage couvre onboarding, RBAC, brouillon gérable, index unique, visibilité publique, ancien import fermé et retrait non destructif. Mobile natif non impacté : aucun contrat API partagé mobile ni écran mobile modifié.

## Risques et dettes

- Le code du service d'import legacy reste présent pour traçabilité, mais sa route a été retirée, aucun écran ne l'appelle et son test Mongo garantit désormais l'absence de création. Sa suppression physique complète pourra suivre après décision sur l'archivage de GL-ARCH-1.1.
- Les champs locatifs de fiche restent stockés dans un `RentalManagement` inactif par le workflow d'annonce Location existant. `managementActivated` garantit l'absence d'impact KPI/GL ; une extraction vers une fiche de publication dédiée serait une évolution de modèle hors hotfix.
- Une recette sur données métier est nécessaire pour quantifier les anciens `Property` validés mais `isPublished!=true`; ils sont désormais masqués sans mutation.
- Le classement réel des 17 contrats en états A–F reste une opération métier ultérieure ; aucune connexion de production n'a été supposée à partir des fichiers `.env` locaux.

## Fichiers du hotfix

Créé :

- `server/docs/GL_PROPERTY_FLOW_1_REPORT.md`

Les fichiers modifiés sont listés dans le rapport final à partir du diff Git, en distinguant les changements préexistants du dépôt.

Modifiés pour ce hotfix :

- `server/controllers/propertyController.js`
- `server/controllers/rentalManagementController.js`
- `server/routes/proprietaireRoutes.js`
- `server/routes/rentalManagementRoutes.js`
- `server/services/publicApi/publicPropertyService.js`
- `server/services/rentalAssetOnboardingService.js`
- `server/scripts/start-accommodation-e2e.js`
- `server/__tests__/accommodationPublicDetail.mongo.integration.test.js`
- `server/__tests__/accommodationRoutes.test.js`
- `server/__tests__/altimmoSearch.mongo.integration.test.js`
- `server/__tests__/propertyRoutes.test.js`
- `server/__tests__/propertySearchFilters.mongo.integration.test.js`
- `server/__tests__/proprietaireGestionImport.mongo.integration.test.js`
- `server/__tests__/publicApi.mongo.integration.test.js`
- `server/__tests__/rentalAssetOnboardingOptions.mongo.integration.test.js`
- `server/__tests__/rentalAssetOnboardingRoutes.test.js`
- `server/__tests__/rentalContractRegularization.mongo.integration.test.js`
- `server/__tests__/tenantCore.mongo.integration.test.js` (fixture d'une suite préexistante)
- `client/lib/pages/dashboard/GestionLocativePage.jsx`
- `client/lib/pages/dashboard/ManagePropertiesPage.jsx`
- `client/lib/pages/dashboard/AdminDashboard.jsx`
- `client/lib/services/gestionLocativeService.js`
- `client/lib/__tests__/AdminDashboardDomains.test.jsx`
- `client/lib/__tests__/RentalAssetOnboardingModal.test.jsx`
- `client/e2e/contrat-creation-form.spec.js`
- `client/e2e/rental-asset-onboarding.spec.js`

Codex n'exécute aucun commit, aucun push, aucune migration destructive et aucune suppression de données réelles pendant ce hotfix.
