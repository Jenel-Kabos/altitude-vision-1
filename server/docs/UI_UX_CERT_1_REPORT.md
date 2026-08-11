# UI-UX-CERT-1 — Rapport de certification finale

Date d'exécution : 11 août 2026  
Périmètre : fermeture des gates Backend Unit et Playwright de UI-UX-CORE-1, puis revalidation de toutes les gates critiques.

## 1. Cause des dix échecs Backend Unit

Le baseline transmis signalait dix tests rouges, tous sur trois suites locatives. Les routes existaient encore et leurs préfixes étaient corrects. La cause commune était l'ajout, lors du durcissement TENANT-CERT-2, de gardes `router.param('id')` fail-closed sur `RentalManagement`, `Paiement` et `Contrat`. Les tests unitaires auto-mockaient ces modèles sans fournir la ressource demandée et ne simulaient pas les services de contexte/attribution tenant. Le garde s'arrêtait donc légitimement en `404` avant le contrôleur testé.

| # | Fichier / test | Endpoint | Attendu / observé | Origine du 404 | Classe |
|---|---|---|---|---|---|
| 1 | `rentalAssetOnboardingRoutes.test.js` — retrait du dossier | `POST /api/rental-management/:id/deactivate` | 200 / 404 | `RentalManagement.findById` absent du contexte du nouveau garde | C |
| 2 | même suite — contrat actif | même endpoint | 409 / 404 | même fixture de ressource/tenant incomplète | C |
| 3 | `rentalDossiersRoutes.test.js` — paiement payé immuable | `DELETE /api/paiements/:id` | 409 / 404 | `Paiement` non résolu par le garde tenant | C |
| 4 | même suite — suppression collaborateur interdite | même endpoint | 403 / 404 | le garde s'arrêtait avant le RBAC testé | C |
| 5 | même suite — marquage payé partiel | `POST /api/paiements/:id/marquer-paye` | 200 / 404 | ressource `Paiement` absente de la fixture | C |
| 6 | même suite — conflit concurrent | même endpoint | 409 / 404 | même cause | C |
| 7 | même suite — contrat immuable | `DELETE /api/contrats/:id` | 409 / 404 | `Contrat` non résolu par le garde tenant | C |
| 8 | `rentalMaintenanceRoutes.test.js` — accusé de préavis | `POST /api/rental-management/:id/acknowledge-notice` | 200 / 404 | `RentalManagement` absent de la fixture du garde | C |
| 9 | même suite — annulation de préavis | `POST /api/rental-management/:id/cancel-notice` | 200 / 404 | même cause | C |
| 10 | même suite — conflit d'annulation | même endpoint | 409 / 404 | même cause | C |

Ces dix cas ne dépendaient ni de UI-UX-CORE-1, ni d'une route renommée. Ils touchaient des domaines GL-PROPERTY-FLOW/GL-LIFE, mais sans invalider leur métier. GL-RECON n'était pas impliqué. Les contrôles tenant réels restent couverts par les suites Mongo adversariales.

Lors de la première relance fraîche de ce sprint, neuf de ces dix cas étaient déjà verts dans l'arbre de travail et un autre test de la même suite a retourné une fois `400` au lieu de `422`. Le contrôleur, la route et les relances isolée puis complète ont confirmé `422 / EXISTING_PROPERTY_REQUIRED`; ce résultat transitoire est classé F (flake/environnement), sans modification de production.

## 2. Corrections appliquées aux suites locatives

- Ajout de fixtures unitaires tenant explicites réutilisant les interfaces de `tenantContextService` et `tenantResourceAttributionService`.
- Fourniture des ressources `RentalManagement`, `Paiement`, `Contrat` et `Property` nécessaires avant d'atteindre le comportement métier ciblé.
- Aucun bypass du fail-closed, aucune restauration de l'ancien flux où la Gestion locative créait un `Property`.
- Vérification explicite du refus `422 / EXISTING_PROPERTY_REQUIRED` pour le mode legacy `new`.

## 3. Résultat Backend Unit final

Commande fraîche : `npm --prefix server run test:unit -- --runInBand --silent --forceExit`

- 105/105 suites réussies.
- 1217/1217 tests réussis.
- Durée Jest : 110,835 s.
- `--forceExit` ferme uniquement les handles cron/socket laissés ouverts après le résumé; dette d'outillage à traiter séparément.

La première gate Mongo de certification a, de son côté, réussi ses 618 assertions mais quitté avec le code 1 pendant le teardown de `rentalPaymentCloudinaryRollback.mongo.integration.test.js`. Son hook `afterEach` ne retournait pas la promesse de `clearFinancialMongo()`, autorisant `afterAll` à déconnecter Mongoose pendant le nettoyage. Le hook attend désormais explicitement ce nettoyage. La suite ciblée repasse 4/4; la gate Mongo complète indiquée plus bas est la relance fraîche post-correction.

## 4. Playwright : ports et processus

Les ports `3000`, `5051` et les ports du lanceur E2E ont été inspectés avant exécution. Aucun listener résiduel n'était présent; aucun processus n'a dû être tué. La configuration démarre un MongoDB mémoire, l'API E2E et Next.js, puis les arrête par `SIGTERM` gracieux.

Une exécution mobile non qualifiée a subi une collision interne lorsque `next build` et `next dev` ont été lancés simultanément et ont partagé `.next`. Les gates ont ensuite été strictement séquencées. Cette exécution invalidée n'entre pas dans le verdict.

## 5. Régression mobile démontrée et corrigée

Le premier run mobile qualifiable a obtenu 16/17 : le menu d'actions d'un établissement était recouvert par le portail d'erreur Next. La trace montrait une erreur React 19 causée par `inert=""`. Les layouts Admin et Propriétaire transmettent désormais le booléen `true`, conforme à React et au DOM. Aucun `force: true` ni contournement Playwright n'a été utilisé.

Le test E2E du portefeuille hôtelier a aussi été aligné sur le composant certifié : ouverture du menu accessible `Actions pour …`, sélection du `menuitem` Modifier et lien réel `Ouvrir`.

## 6. Résultats Playwright

- Desktop Chromium complet : 17/17, 5,1 min, PASS.
- Mobile Chromium ciblé Établissements après correction : 1/1, 41,2 s, PASS.
- Mobile Chromium complet final, exécuté seul : 17/17, 5,7 min, PASS.
- Navigation, headers, KPI, portfolios Property/Accommodation/Hotel, menus d'actions, documents, Gestion locative, dossiers vente/location et responsive critique couverts par la matrice existante.

## 7. Profils et domaines

- **Admin** : pilotage, modération, Property Portfolio, hébergements, établissements, documents et Gestion locative validés par E2E et tests de composants.
- **Gestionnaire immobilier** : RBAC et workflows locatifs validés par Backend Unit/Mongo; expérience opérationnelle distincte de l'Admin conservée.
- **Propriétaire immobilier** : navigation patrimoine, annonces, activité et exclusion des opérations hôtelières validées par `OwnerDashboardNavigation.test.jsx`.
- **Exploitant établissement** : établissements, hébergements et réservations visibles sans fonctions patrimoniales non pertinentes, validés par la même suite.
- **Double profil** : switcher Patrimoine/Exploitation et séparation des menus validés; aucun rôle supplémentaire n'est attribué.
- **CRM, Reporting, ERP** : routes et domaines Admin conservés; Vitest complet, build et suites Mongo de non-régression verts.

La seed Playwright authentifie principalement Admin et Client. Les permutations fines des profils propriétaire/exploitant sont volontairement testées en Vitest avec états d'authentification déterministes; elles ne prétendent pas être des sessions E2E distinctes.

## 8. Responsive et accessibilité

- Sidebar mobile masquée avec `aria-hidden` et `inert={true}` quand fermée.
- Boutons icon-only nommés, menus `role=menu/menuitem`, navigation clavier et focus testés par les composants ciblés.
- Cards, tableaux, KPI, modales/drawers et menu `…` exercés dans les viewports desktop/mobile.
- Le défaut qui rendait une action tactile inaccessible est corrigé à la source.

## 9. Non-régression et sécurité

- Aucun changement d'API, de règle financière, de permission ou de destination NAV-CORE pour obtenir les résultats.
- Les gardes TENANT-CONTEXT/TENANT-ATTRIBUTION restent fail-closed.
- GL-PROPERTY-FLOW conserve la séparation stricte Property / RentalManagement / Contrat.
- GL-RECON, USER-ARCH, ORGANIZATION, CRM, MARKETING, REPORTING, ERP, API-PUBLIC, DOC-EVO, FINANCE, HOTEL et ACC sont couverts par les gates transverses.

## 10. Gates finales réellement exécutées

| Gate | Résultat final |
|---|---|
| Backend Unit complet | PASS — 105 suites, 1217 tests |
| Backend Mongo complet | PASS — 65/65 suites, 618/618 tests, 0 snapshot, 798,788 s Jest / 803,545 s lanceur global |
| Web Vitest complet | PASS — 76 fichiers, 513 tests |
| UI ciblée | PASS — 5 fichiers, 32 tests |
| Playwright desktop complet | PASS — 17/17 |
| Playwright mobile complet | PASS — 17/17 |
| Next.js build | PASS — 142 pages statiques générées |
| ESLint serveur | PASS — 0 erreur; avertissements historiques |
| ESLint client | PASS — 0 erreur; 268 avertissements historiques |
| `git diff --check` | PASS |
| Mobile natif Jest/TypeScript/Expo Doctor | NON NÉCESSAIRES — aucun fichier `altimmo-app` ou shared mobile touché |

## 11. Fichiers du sprint

Créé :

- `server/docs/UI_UX_CERT_1_REPORT.md`

Modifiés pour fermer la certification (incluant les corrections déjà présentes dans l'arbre au démarrage de cette reprise) :

- `server/__tests__/rentalAssetOnboardingRoutes.test.js`
- `server/__tests__/rentalDossiersRoutes.test.js`
- `server/__tests__/rentalMaintenanceRoutes.test.js`
- `server/__tests__/rentalPaymentCloudinaryRollback.mongo.integration.test.js`
- `client/e2e/hotel-establishments-portfolio.spec.js`
- `client/lib/pages/dashboard/AdminDashboard.jsx`
- `client/lib/pages/dashboard/OwnerDashboard.jsx`

Les autres fichiers modifiés/non suivis visibles dans le dépôt appartiennent aux sprints antérieurs présents dans l'arbre de travail; ils n'ont pas été annulés ni revendiqués comme créations de UI-UX-CERT-1.

## 12. Dettes restantes

- Les unités serveur laissent des handles cron/socket ouverts après le résumé et nécessitent actuellement `--forceExit` pour une fermeture déterministe.
- ESLint reste vert avec des avertissements historiques (serveur et client).
- Les données Browserslist/baseline-browser-mapping sont anciennes.
- Le build requiert le réseau pour `next/font` (Cinzel, Cormorant Garamond, DM Sans).
- La matrice E2E ne possède pas encore des comptes seed séparés pour chaque combinaison de profil métier; la séparation est couverte au niveau composant.

## 13. Verdict

**CERTIFIÉ**

Toutes les gates critiques finales sont vertes. Confirmation explicite : aucun commit, aucun push, aucun déploiement, aucune migration destructive, aucune suppression de données réelles et aucun assouplissement tenant/security.
