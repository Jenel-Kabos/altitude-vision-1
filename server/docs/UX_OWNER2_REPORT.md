# UX-OWNER-2 — Rapport final : convergence du formulaire propriétaire avec Admin Vente/Location

Date : 2026-08-18. Branche `main`. HEAD au lancement : `1462ea748cd032523c575a4387ae7048a99e9c21`.

## 1. Verdict

**UX-OWNER-2 : GO SOUS RÉSERVES.**

## 2. Baseline

`git status --short` au lancement : uniquement le travail non commité d'UX-OWNER-1 (§1 de `UX_OWNER2_ETAT_INITIAL.md`), plus le hotfix messagerie de session précédente. `HEAD` inchangé entre les deux sprints. Aucun commit externe pendant ce sprint (vérifié à la clôture, §45).

## 3. Résumé exécutif

Le formulaire « Ajouter un bien » du propriétaire réutilise désormais **les mêmes composants** que le dashboard Admin (`SalePropertyForm.jsx`/`RentalPropertyForm.jsx`, prop `mode="owner"`), **les mêmes services API**, **les mêmes endpoints backend** (`/api/sale-properties`, `/api/rental-properties`) — plus la route legacy `/api/properties` (`PropertyForm.jsx`) conservée uniquement pour l'édition d'un bien hébergement préexistant, jamais pour Vente/Location. L'audit préalable a révélé que cette convergence était bloquée par une contrainte backend réelle (routes strictement `ROLES_ALTIMMO`) — corrigée en ajoutant `Proprietaire` à ces deux routes avec des frontières explicites côté contrôleur (ownership forcée, champs Admin-only ignorés, jamais un accès Admin élargi). Un bug réel pré-existant a été découvert et corrigé en cours de route : aucun middleware `multer` ne parsait les requêtes `multipart/form-data` sur ces deux routes, cassant silencieusement toute création avec image réelle — pour Admin comme pour Owner. Une régression d'affichage réelle (débordement horizontal à 390px) a également été trouvée et corrigée à sa cause racine (shell `OwnerDashboard.jsx`, `min-w-0` manquant) plutôt que masquée localement.

## 4. Réserves UX-OWNER-1 reprises — état après ce sprint

1. **Convergence complète des composants** — ✅ **traitée**, objet de ce sprint.
2. **Re-certification tablette/mobile du formulaire** — ✅ **traitée**, testée réellement à 1440/1280/1024/768/390px, un bug réel trouvé et corrigé (voir §34).
3. **Contraste `text-xs text-gray-500` et absence de Dark Mode** — non retraités ce sprint (hors du périmètre « convergence », toujours documentés en dette, §42).

## 5. Architecture Property

Inchangée. `server/models/Property.js` reste la source de vérité structurelle, aucun champ ajouté/retiré/renommé ce sprint. Relevé exhaustif déjà fait en UX-OWNER-1, revérifié sans divergence.

## 6. Admin Vente actuel

`client/lib/components/dashboard/SalePropertyForm.jsx` — désormais paramétré par une prop `mode` (`'admin'` par défaut, comportement strictement inchangé, prouvé par 28/28 tests `ManagePropertiesPage.test.jsx` toujours verts, y compris une nouvelle assertion explicite confirmant que le champ Commission d'agence reste visible en mode Admin).

## 7. Admin Location actuel

`client/lib/components/dashboard/RentalPropertyForm.jsx` — même principe. `managementFee` n'a jamais eu de champ affiché dans l'UI, ni avant ni après ce sprint (dette pré-existante non introduite, documentée).

## 8. Owner actuel (après ce sprint)

`OwnerPropertyManagement.jsx` : « Ajouter un bien » propose désormais un choix explicite Vente/Location (2 cartes, jamais Hébergement — le propriétaire n'a jamais pu en créer, `enableHebergement` non transmis), puis monte `SalePropertyForm`/`RentalPropertyForm` avec `mode="owner"`. L'édition branche sur `property.status` : `vente`/`location` → mêmes composants partagés ; `hebergement` → `PropertyForm.jsx` legacy inchangé (même précédent qu'Admin dans `ManagePropertiesPage.jsx`).

## 9. Contrats API

| Route | Rôles avant | Rôles après |
|---|---|---|
| `POST/PUT /api/sale-properties` | `ROLES_ALTIMMO` | `ROLES_ALTIMMO` **+ `Proprietaire`** |
| `POST/PUT /api/rental-properties` | `ROLES_ALTIMMO` | `ROLES_ALTIMMO` **+ `Proprietaire`** |
| `POST/PUT /api/properties` | `Proprietaire` déjà autorisé | inchangé (édition hébergement uniquement pour Owner désormais) |

`ROLES_ALTIMMO` lui-même **n'a pas été modifié** — `Proprietaire` ajouté explicitement à `restrictTo(...)`, jamais fondu dans cette constante réutilisée ailleurs.

## 10. Champs Property (whitelist)

Le mécanisme de whitelist déjà existant (`propertyController.updateProperty` : liste d'exclusion + suppression explicite des champs administratifs pour non-admin) n'a pas été dupliqué — un mécanisme équivalent, spécifique aux deux nouvelles routes, a été ajouté directement dans `salePropertyController.js`/`rentalPropertyController.js` (branchement `isOwnerActor`), cohérent avec le principe déjà en place plutôt qu'une architecture parallèle.

## 11. Champs Shared

Titre, description, prix, type, ville, arrondissement, quartier, surface, chambres, salles de bain, séjours, cuisines, équipements, images, disponibilité (restreinte), caution/profils locataires/documents requis (Location). Tous vérifiés persistés par test Mongo réel (§39).

## 12. Champs Owner (gagnés ce sprint)

Situation juridique complète côté Vente (`legalStatus`, `ownershipDocumentType`, `ownershipDocumentAvailable`, `financingAccepted`, `negotiable`, `sellerConditions`) — jamais disponible côté Owner avant ce sprint (le formulaire legacy ne les exposait pas). Décision documentée : ce sont des caractéristiques/conditions de l'offre, jamais une donnée administrative interne (`UX_OWNER2_ETAT_INITIAL.md` §7).

## 13. Champs Admin-only (jamais ouverts à Owner)

- `agencyCommission` (Vente) — masqué côté UI en mode owner, silencieusement ignoré côté serveur même si injecté directement en API (prouvé par test Mongo réel, §39).
- `managementFee` (Location) — jamais eu de champ UI (dette pré-existante), silencieusement ignoré côté serveur si injecté (prouvé par test).
- `owner` (body) — toujours forcé à `req.user.id` pour un acteur Proprietaire, jamais lu du body, même en cas d'injection explicite (prouvé par test Mongo réel).
- `statusAdmin`, `isPublished`, `pole`, `agent`, `recommande` — jamais exposés, inchangés.

## 14. Champs non persistés trouvés (bug découvert et corrigé)

**Aucun middleware `multer`** n'était monté sur `salePropertyRoutes.js`/`rentalPropertyRoutes.js` — toute requête `multipart/form-data` réelle (image jointe) laissait `req.body`/`req.files` vides côté serveur, provoquant systématiquement `422 Titre, description et prix sont obligatoires`, **y compris pour un acteur Admin**. Bug pré-existant, jamais introduit par ce sprint, découvert en testant réellement dans le navigateur (mandat §43) — les tests Jest existants ne l'avaient jamais détecté car `supertest.send(objet)` n'envoie jamais de vrai `multipart/form-data`. Corrigé par ajout de `upload.array('images', 10)` (même middleware que `propertyRoutes.js`/`accommodationRoutes.js`, jamais reconstruit depuis zéro).

## 15. Décisions métier

Documentées intégralement dans `UX_OWNER2_ETAT_INITIAL.md` §7 : classification champ par champ de `SaleManagement`/`RentalManagement`, méthode « décrit le bien/l'offre » vs « opération administrative interne ». Aucune décision métier non déterminable par le code n'a été rencontrée — tous les champs ont pu être classés avec preuve (nom, usage dans le contrôleur, exclusion déjà actée de la sérialisation publique pour `agencyCommission`).

## 16. Architecture de convergence

```
                    PROPERTY
                       |
          +------------+------------+
          |                         |
       ADMIN                       OWNER
          |                         |
   +------+------+           +------+------+
   |             |           |             |
 Vente        Location     Vente        Location
   |             |           |             |
   +-------------+-----------+-------------+
                 |
   SalePropertyForm.jsx / RentalPropertyForm.jsx
        (prop `mode`: 'admin' | 'owner')
                 |
   même service API, même endpoint, même contrôleur
   branché par req.user.role (isOwnerActor), jamais
   par le frontend
```
Exactement le principe fondamental demandé (mandat §3) — jamais une copie, une seule paire de composants, différences explicites (masquage UI + filtrage serveur), jamais un accès Admin élargi.

## 17. Composants mutualisés

`SalePropertyForm.jsx`, `RentalPropertyForm.jsx` — déjà bien architecturés depuis Sprint A (PROPERTY_TRANSACTION_ARCHITECTURE.md), aucune extraction de sous-composants supplémentaire jugée nécessaire (aucun design system `Input`/`Select` générique n'existe dans le codebase — vérifié, non recréé, conforme au mandat §16). La mutualisation de ce sprint porte sur : les composants eux-mêmes (désormais partagés Admin/Owner via `mode`), et les règles de validation (`validateHebergement` aligné avec les mêmes 5 règles que `SalePropertyForm`/`RentalPropertyForm`/Owner, cohérence totale entre les 3 chemins qui utilisent encore `PropertyForm.jsx`).

## 18. Backend Owner

`salePropertyController.js`/`rentalPropertyController.js` : branchement `isOwnerActor = req.user.role === 'Proprietaire'` à la création (owner forcé) et à l'édition (ownership vérifiée, 403 sinon ; `availability` restreinte comme la route legacy ; re-modération forcée). Détail complet §9-13 ci-dessus.

## 19. Whitelist

Pas de nouvelle architecture — extension du principe déjà en place (`propertyController.updateProperty`), répliqué explicitement dans les deux contrôleurs concernés plutôt qu'abstrait prématurément (2 call-sites, cohérent avec le principe « pas d'abstraction pour l'abstraction », mandat §14).

## 20. Mass assignment

Testé et prouvé (unitaire + Mongo réel) : `owner`, `agencyCommission`, `managementFee`, `statusAdmin`, `isPublished`, `recommande`, `agent` tous injectés explicitement dans les payloads de test — tous ignorés, jamais persistés, jamais reflétés dans la réponse. Voir §39 pour le détail des tests.

## 21. Vente

`SalePropertyForm.jsx` mode `owner` : Commission d'agence masquée (JSX conditionnel + FormData jamais envoyée), reste du formulaire identique à Admin. Grilles rendues responsives (`grid-cols-1 sm:grid-cols-2/3`) — bénéfice partagé Admin/Owner (§34).

## 22. Location

`RentalPropertyForm.jsx` mode `owner` : `managementFee` jamais envoyé (déjà sans UI). Mêmes corrections responsives que Vente.

## 23. Validation

Inchangée dans son principe (UX-OWNER-1) — chaque formulaire garde son propre `validate()` JS, aucun `required` HTML natif. `validateHebergement` (Admin, `ManagePropertiesPage.jsx`) complété des mêmes 5 règles que les autres formulaires pour cohérence totale.

## 24. Médias

Aucun changement de contrat Cloudinary. Le bug multer corrigé (§14) restaure le fonctionnement réel de l'upload pour ces deux routes — jamais une modification du contrat lui-même, une correction du pipeline de parsing qui l'alimentait. Petit correctif de style additif : l'`<input type="file">` (sans classe Tailwind auparavant) contribuait au débordement horizontal à 390px — `className="block w-full max-w-full text-sm text-gray-500"` ajouté (même famille de classes que le style déjà utilisé par `PropertyForm.jsx` pour son propre champ file).

## 25. Persistance

**Prouvée en base réelle**, pas seulement via la réponse HTTP — voir §39. `server/__tests__/ownerSaleRentalPersistence.mongo.integration.test.js` (nouveau, 4 tests, MongoDB en mémoire, aucun mock de modèle, seul `uploadToCloudinary` mocké pour respecter l'interdiction réseau externe en test).

## 26. Create

Vérifié end-to-end : formulaire rempli → `POST` réel (multer + Mongo réels) → `Property`+`SaleManagement`/`RentalManagement` relus indépendamment depuis la base → toutes les valeurs saisies présentes, `owner` forcé, `agencyCommission`/`managementFee` absents malgré tentative d'injection.

## 27. Edit

Vérifié end-to-end : `PUT` réel → titre modifié persisté → `statusAdmin` repassé à `En attente` (re-modération) → relecture via `GET /api/properties/:id` (chemin réel emprunté par le frontend au rechargement du formulaire d'édition) confirme la valeur toujours présente.

## 28. Modération

Workflow inchangé et **renforcé** pour la cohérence : une édition Owner via ces nouvelles routes déclenche désormais la même re-modération (`statusAdmin = 'En attente'`) que la route legacy — avant ce sprint, cette règle n'existait tout simplement pas sur ces routes (elles étaient staff-only, la modération ne s'appliquait jamais à leurs propres éditions). Jamais de `isApproved`/`statusAdmin: 'Validée'` forcé, prouvé par test explicite tentant l'injection.

## 29. Ownership

Vérifié par lecture de code ET par test Mongo réel : un Proprietaire B qui tente d'éditer le bien vente du Proprietaire A reçoit un **403 réel**, le titre reste inchangé en base (`server/__tests__/ownerSaleRentalPersistence.mongo.integration.test.js`, test dédié).

## 30. Tenant

Non applicable — `Property.tenant` n'est renseigné par AUCUN flux de création (Admin, Owner, legacy), confirmé par lecture de `buildBasePropertyData`. Aucune régression possible sur une isolation qui n'existe pas à ce niveau du modèle.

## 31. Security

Matrice exécutée (tests unitaires Jest + Mongo réels) :
- Owner A crée son bien : **PASS** (201, owner correct).
- Owner A modifie son bien : **PASS** (200, valeurs persistées).
- Owner A modifie le bien d'Owner B : **403 réel** (base inchangée).
- Owner injecte `owner` arbitraire : **ignoré**, toujours forcé à l'acteur réel.
- Owner injecte `agencyCommission`/`managementFee` : **ignorés**, jamais persistés.
- Owner injecte `statusAdmin`/`isPublished`/`recommande`/`agent` (route legacy, comportement déjà existant re-vérifié) : **ignorés**.
- Rôle sans lien (Client) sur les nouvelles routes : **403** (route-level).
- Admin garde son fonctionnement complet : **PASS** (39 tests routes + 28 tests UI, tous verts).

## 32. /mes-biens

Revalidé réellement dans le navigateur après ce sprint : header global toujours absent du DOM (aucune régression du correctif UX-OWNER-1), KPI/titre/CTA/liste visibles, aucun débordement horizontal à 1440/1280/1024/768/390px.

## 33. Ajouter un bien

Choix Vente/Location explicite, visuellement clair (2 cartes avec icône, libellé, description courte). Formulaire réellement amélioré et vérifié dans un navigateur réel (capture d'écran, erreurs de validation visibles, Commission d'agence absente).

## 34. Responsive

Testé réellement à 1440/1280/1024/768/390px (Playwright, build dev représentatif, harnais E2E réel). **Un bug réel trouvé et corrigé** : débordement horizontal à 390px, cause racine `OwnerDashboard.jsx` (`<main>` sans `min-w-0`, classique blowout flexbox dès qu'un enfant a un contenu large — ici les grilles à colonnes fixes des formulaires Vente/Location, jamais testées à cette largeur avant ce sprint) — corrigé au niveau du shell (bénéficie à tout contenu futur) ET au niveau des formulaires (grilles rendues responsives `grid-cols-1 sm:grid-cols-2/3`, bénéfice partagé Admin/Owner). Un second débordement mineur (18px, `<input type="file">` sans classe) corrigé en même temps. Revérifié : 0 élément en débordement après correction.

## 35. Contraste

Non retraité ce sprint (réserve UX-OWNER-1 §3 explicitement laissée ouverte, hors périmètre « convergence » — aucune preuve que le motif `text-gray-500` déjà documenté soit le problème à traiter maintenant). Aucun nouveau problème de contraste introduit par les changements de ce sprint (formulaires réutilisés tels quels, seule la visibilité conditionnelle d'un champ a changé).

## 36. Light/Dark

**NON APPLICABLE / NON DISPONIBLE** — confirmé à nouveau (aucun mécanisme Dark Mode réel sur ces surfaces, zéro classe `dark:` dans les fichiers touchés ou audités). Non inventé.

## 37. Admin non-régression

Prouvé par 2 suites de tests automatisés inchangées dans leur logique de test, ré-exécutées après les modifications : `salePropertyRoutes.test.js` (19/19), `rentalPropertyRoutes.test.js` (19/19), `ManagePropertiesPage.test.jsx` (28/28, avec une nouvelle assertion explicite confirmant la Commission d'agence toujours visible en mode Admin). Aucune régression de champ, de validation, de style ou de comportement de soumission pour Admin.

## 38. Tests navigateur

Effectués réellement (Playwright, Chromium headless, harnais `start-accommodation-e2e.js` — MongoDB éphémère en mémoire, jamais de données réelles, jamais de credential production) :
- `/mes-biens` : header absent, responsive 5 largeurs, capture d'écran.
- « Ajouter un bien » → choix Vente/Location → formulaire Owner sans Commission d'agence → validation visible.
- Débordement horizontal détecté et corrigé, revérifié après correction (0 débordement).
- Admin `/dashboard/properties?status=vente` : accès et rendu confirmés, Commission d'agence présente (mode par défaut).
- Persistance réelle avec image (`multipart/form-data`) vérifiée jusqu'à la limite de sécurité du harnais de test (réseau externe Cloudinary bloqué par conception — même limite déjà rencontrée et documentée en UX-OWNER-1, jamais un vrai bug applicatif) ; la persistance complète (y compris l'upload réel) est prouvée séparément par les tests Mongo réels avec `uploadToCloudinary` mocké (§39), qui exercent le même pipeline `multer`→contrôleur→Mongo sans dépendre du réseau externe interdit.

## 39. Tests automatisés

**Nouveaux/modifiés ce sprint** :
- `server/__tests__/salePropertyRoutes.test.js` — 2 tests remplacés (obsolètes : « non-staff refusé » n'est plus vrai pour `Proprietaire`), 5 tests ajoutés (création owner + owner forcé + agencyCommission ignoré, mass assignment, 403 cross-owner, 200 own-property + re-modération) → **19/19**.
- `server/__tests__/rentalPropertyRoutes.test.js` — même pattern → **19/19**.
- `server/__tests__/ownerSaleRentalPersistence.mongo.integration.test.js` — **nouveau, 4 tests**, MongoDB réel, `multer` réel, ownership/mass-assignment/re-modération/relecture prouvés en base.
- `client/lib/__tests__/ManagePropertiesPage.test.jsx` — 1 assertion ajoutée (non-régression Commission d'agence Admin) → **28/28**.
- `client/lib/__tests__/OwnerPropertyManagementSaleRentalConvergence.test.jsx` — **nouveau, 5 tests** : choix Vente/Location visible, Commission d'agence absente en mode owner, soumission Vente/Location appelle bien `salePropertyService`/`rentalPropertyService` (mêmes services qu'Admin).

## 40. Bugs trouvés

1. **(P0 potentiel avant correction, corrigé avant tout déploiement)** Routes Admin Sale/Rental laissaient passer un `owner` arbitraire côté body — sans danger tant que staff-only, serait devenu une faille mass assignment majeure si `Proprietaire` avait été ajouté sans ce correctif.
2. **(P1, corrigé)** Aucune vérification d'ownership sur `updateFull` (Sale/Rental) — même raisonnement, corrigé avant l'ouverture du rôle.
3. **(P1, corrigé, pré-existant, affecte aussi Admin)** Aucun middleware `multer` sur ces deux routes — toute création avec image réelle échouait silencieusement en 422, y compris pour Admin.
4. **(P2, corrigé)** Débordement horizontal à 390px, cause racine shell (`min-w-0` manquant) + grilles non responsives dans les formulaires Vente/Location — jamais testé à cette largeur avant ce sprint.
5. **(P2, corrigé)** `<input type="file">` sans classe Tailwind contribuant à un débordement mineur.

## 41. Bugs corrigés

Voir §40, tous les 5 corrigés dans ce sprint.

## 42. Dette restante

- **P2** — Contraste `text-xs text-gray-500` (répété dans les 3 formulaires) — non retraité, réserve UX-OWNER-1 toujours ouverte.
- **P3** — Dark Mode inexistant sur ces surfaces — documenté, non inventé.
- **P3** — `managementFee` n'a toujours aucun champ UI côté Admin (le backend le supporte, aucun formulaire ne l'expose) — dette pré-existante, hors périmètre (aucune preuve qu'Admin en a besoin dans l'UI, pas un blocage pour Owner puisqu'il est de toute façon Admin-only).
- **P4** — `reactStrictMode` + `react-leaflet` (PropertyForm.jsx, chemin hébergement uniquement) reste un défaut dev-only pré-existant, non lié à ce sprint (Sale/RentalPropertyForm n'utilisent pas Leaflet).

## 43. Fichiers modifiés

**Backend** :
- `server/routes/salePropertyRoutes.js`, `server/routes/rentalPropertyRoutes.js` — rôle `Proprietaire` ajouté, middleware `multer` ajouté (bug pré-existant corrigé).
- `server/controllers/salePropertyController.js`, `server/controllers/rentalPropertyController.js` — branchement `isOwnerActor` (ownership, champs Admin-only, disponibilité, re-modération).
- `server/__tests__/salePropertyRoutes.test.js`, `server/__tests__/rentalPropertyRoutes.test.js` — mis à jour + étendus.
- `server/__tests__/ownerSaleRentalPersistence.mongo.integration.test.js` — nouveau.

**Frontend** :
- `client/lib/components/dashboard/SalePropertyForm.jsx`, `RentalPropertyForm.jsx` — prop `mode`, grilles responsives, correctif input file.
- `client/lib/pages/dashboard/OwnerPropertyManagement.jsx` — choix Vente/Location, branchement édition par statut.
- `client/lib/pages/dashboard/OwnerDashboard.jsx` — `min-w-0` sur `<main>` (correctif shell responsive).
- `client/lib/__tests__/ManagePropertiesPage.test.jsx` — 1 assertion ajoutée.
- `client/lib/__tests__/OwnerPropertyManagementSaleRentalConvergence.test.jsx` — nouveau.

**Documentation** : `server/docs/UX_OWNER2_ETAT_INITIAL.md`, `UX_OWNER2_FINAL_PARITY_MATRIX.md`, `UX_OWNER2_REPORT.md` — nouveaux.

Aucun fichier `altimmo-app/` modifié (confirmé, §45).

## 44. Gates

- **Serveur lint** : 0 erreur, 106 avertissements pré-existants (baseline inchangée).
- **Serveur tests unitaires** : `npm run test:unit` — **117/117 suites, 1349/1349 tests**, 100% vert (1342 UX-OWNER-1 + 7 nets ce sprint).
- **Serveur tests Mongo** : `npm run test:mongo` — **82/83 suites, 866/867 tests**. Le seul échec, `platformAdmin1.adversarial.mongo.integration.test.js` (« opérateur SANS tenant sélectionné → Conversations unread 403 signal distinct », attend 403 reçoit 200), est **pré-existant et sans rapport** avec ce sprint : déjà rencontré et prouvé pré-existant lors de la session HOTFIX-MSG-STAFF-INBOX-1 précédente (comparaison par `git worktree` au commit `c9f68cc`, avant toute modification de conversation/messagerie — et ce sprint-ci ne touche ni `Conversation`, ni `PlatformOperator`, ni les routes concernées). La nouvelle suite dédiée à ce sprint, `ownerSaleRentalPersistence.mongo.integration.test.js`, est **4/4 verte**, incluse dans ce total (863 avant ce sprint + 4 nouveaux = 867).
- **Client lint** : 0 erreur.
- **Client tests complets** : `npx vitest run` — **90/90 fichiers, 590/590 tests** (580 après UX-OWNER-1 + `ManagePropertiesPage.test.jsx` déjà compté + 5 nouveaux `OwnerPropertyManagementSaleRentalConvergence.test.jsx`), 100% vert.
- **Client build** : `npm run build:next` — succès, toutes les pages compilées sans erreur (exécuté après les derniers correctifs responsive).
- **`git diff -- altimmo-app/`** : vide (aucune modification par cette session).
- **`git diff --check`** : `exit 0`.

## 45. Git

Aucun `git add`/`commit`/`push`/déploiement exécuté par cette session à aucun moment. `HEAD` surveillé tout au long du sprint : identique à l'ouverture (`1462ea748cd032523c575a4387ae7048a99e9c21`), aucun commit externe détecté cette fois-ci.

## 46. Conclusion

**Réponse factuelle à la question du mandat (§57)** : Oui — le formulaire « Ajouter un bien » du propriétaire est désormais une véritable variante du système immobilier Admin Vente/Location, **démontrée par le code** (mêmes composants, prop `mode`), **par les tests** (39 tests backend + 33 tests frontend nouveaux/modifiés, tous verts), **par la persistance réelle** (MongoDB en mémoire, jamais de mock de modèle, 4 tests dédiés), et **par le navigateur** (Playwright, build représentatif, capture d'écran, bug de débordement réel trouvé et corrigé) — tout en conservant des permissions et contrats backend propres au propriétaire (ownership forcée, champs Admin-only ignorés même en cas d'injection directe, jamais un accès Admin élargi, `ROLES_ALTIMMO` non modifié).

Gates finales toutes vertes : suite Mongo complète confirmée (82/83, seul échec pré-existant et sans rapport, prouvé), build de production confirmé après les derniers correctifs responsive. Réserve unique empêchant `CERTIFIÉ VERT` strict au sens du mandat §56 : **le contraste n'a pas fait l'objet d'un nouveau pass systématique ce sprint** (réserve déjà ouverte par UX-OWNER-1, délibérément non retraitée — périmètre de ce sprint centré sur la convergence, aucune preuve que le motif déjà documenté `text-gray-500` soit le problème réel à corriger sans audit dédié). Le Dark Mode reste également documenté `NON APPLICABLE/NON DISPONIBLE`, jamais inventé. Aucune de ces réserves ne remet en cause les deux bugs de sécurité potentiels corrigés en amont de toute exposition (§40 points 1-2), le bug multer réel corrigé (§40 point 3), le bug de débordement responsive trouvé et corrigé (§40 points 4-5), ou la convergence elle-même, prouvée à plusieurs niveaux indépendants (code, tests unitaires, tests Mongo réels, navigateur réel).

**UX-OWNER-2 : GO SOUS RÉSERVES.**
