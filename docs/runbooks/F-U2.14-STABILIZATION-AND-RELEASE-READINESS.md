# F-U2.14 — Recovery & continuation report / Stabilisation et préparation de release

Date : 2026-10-15. Dépôt `altitude-vision-1`, branche `main`, HEAD `5a54a13` (inchangé, aucun commit).
Rapport de récupération détaillé : [F-U2.14-RECOVERY-REPORT.md](F-U2.14-RECOVERY-REPORT.md).

## A. Cause de l'interruption

Extinction brutale de l'ordinateur (batterie déchargée) le 2026-10-15 vers 04:00. La session d'exécution de F-U2.14 (Claude Code, transcription `37a2d563…`) était alors en attente d'une réponse utilisateur : aucune écriture n'était en cours, aucun fichier n'a été corrompu.

## B. État retrouvé

- `main` @ `5a54a13`, 228 fichiers suivis modifiés, 199 non suivis, rien d'indexé, aucun conflit ni verrou Git.
- 11 fichiers (tests et seed E2E) attribués à F-U2.14. Les autres modifications sont antérieures (chantiers F-U1 à F-U2.13 et autres) et ont été conservées sans attribution à F-U2.14.
- Journaux de tests de la session perdus (`/private/tmp` purgé au redémarrage). Les résultats ont été reconstitués depuis la transcription.

## C. Sauvegarde effectuée

`~/altitude-vision-backups/F-U2.14-recovery-20261015-111526/` (droits `700`, hors dépôt) contient :
- le patch binaire complet, dont l'application sur HEAD a été vérifiée ;
- l'archive des 199 fichiers non suivis ;
- un instantané des fichiers modifiés ;
- l'état Git et les empreintes SHA-256.

`git stash` n'a pas été utilisé.

## D. Travaux récupérés

Seed E2E (`PlatformOperator`, `businessRole` Admin, abonnement d'organisation, rattachements C2.10A, faux prestataire Yabetoo HTTPS), connexion partagée robuste, sélection explicite du tenant opérateur, CSS applicatif des tests visuels indépendant de `.next`, consentement cookies pré-enregistré. Tous ces éléments étaient complets et valides ; aucun n'a été réécrit.

## E–G. Travaux terminés après reprise et corrections

### Défauts réels de l'application (2)

| # | Défaut | Gravité | Correction | Preuve |
|---|---|---|---|---|
| 1 | **Régression `3ca61dc`** : l'en-tête global, seul porteur de la cloche de notifications, est masqué dans les espaces propriétaire. Les propriétaires n'avaient donc plus aucun accès web aux notifications. | Moyenne (fonctionnelle) | `NotificationBell` réintégrée dans `client/lib/pages/dashboard/OwnerDashboard.jsx` (instance unique, mobile ou desktop) | Vitest `OwnerDashboardNavigation` (desktop et mobile) ; E2E dash4 et e2e1 notifications |
| 2 | `assertReservationAccess` (`server/controllers/hotelReservationController.js`) sortait par la branche gestionnaire sans propager le contexte tenant résolu. Résultat : 403 permanent sur `/checkout-financial-readiness`, alors que la route financière équivalente l'autorisait. | Moyenne (PMS) | Propagation de `req.platformTenant` avant les branches de rôle. La capacité financière et l'appartenance au tenant restent exigées. | Nouveau `hotelCheckoutReadinessManagerFU214.mongo.integration.test.js` (3 tests : positif, sans rôle refusé, tenant étranger refusé). Le test échoue si la correction est retirée. |

### Fixtures, tests obsolètes et environnement (sans changement de comportement applicatif)

| Cause | Classement | Correction |
|---|---|---|
| 403 sur contrats et transactions : seed antérieur à `platformAuthority` | Fixture (403 légitimes) | `PlatformOperator`, rôles métier |
| 403 « Capacité financière requise » (PMS) : capacités dérivées du `businessRole` (`e7c8e6c`) | Fixture (403 légitime) | Gestionnaire en `GestionnaireImmobilier` (lecture financière seule) |
| Pages tenant, PATH B opérateur | Test obsolète | Sélection explicite du tenant, depuis la page du module ; ouverture du menu sur mobile |
| Ressources `tenant:null` invisibles en contexte tenant (invariant) | Fixture | Biens, fiches et villa rattachés à « Tenant E2E » |
| Réservation `pending_payment` (`4075831`) ; redirection `/mon-espace` | Test obsolète | Assertions alignées |
| 202 `PAYMENT_ALREADY_INITIATED`, rejeu idempotent sans double intent | Test incomplet | 202 accepté avec code et intent vérifiés |
| 404 au lieu de 403 sur une ressource hors périmètre (invariant fail-closed) | Test trop strict | `[403, 404]` |
| Refonte de la modération hôtelière (`8822eb9`), titres `PropertyRegistry` (`38001d0`) | Test obsolète | Parcours fiche de détail, titres « Ventes — tenant » |
| Banc visuel isolé : contexte `unresolved` fail-closed, `useRouter` hors App Router | Configuration du banc | Simulations de `PlatformTenantRuntimeContext` et `next/navigation` |
| Chambres A1–A5 partagées entre desktop et mobile | Fixture | Chambres M1–M5 dédiées au projet mobile |
| Compilation à la demande de `next dev` (jusqu'à 19 s par page, API ralentie à 17 s) | Environnement | Attentes bornées sur les navigations à froid, budget de 240 s pour le parcours hôtelier multi-pages |

Aucun test désactivé, aucune assertion supprimée, aucun contrôle d'autorisation assoupli.

## H. Résultats des tests (exécutions complètes)

| Suite | Résultat |
|---|---|
| `certify:financial` | **501/501** (1ʳᵉ exécution : 168 échecs « MongoMemory instance failed to start », dus à la charge machine. 168/168 en série, puis exécution complète verte.) |
| `certify:rental` | **141/141** |
| Portail, notifications, scheduler (9 suites de référence) | **74/74** |
| `architecture:check` | **PASS** |
| Serveur `test:unit` | **1 942/1 942** |
| Serveur `test:mongo` (8 shards, séquentiel) | **3 454/3 454** |
| Client Vitest | **1 363/1 363** (dont 2 nouveaux tests) |
| Client build Next.js | OK |
| Mobile `test:coverage` | **657/657** ; syntaxe, lint et typecheck OK ; `expo export` Android OK |
| Lint serveur, client, mobile | 0 erreur (165, 282 et 128 avertissements) |

## I. État des 46 scénarios E2E

Campagne Playwright complète, desktop et mobile, en un seul passage sans relance : **96/96 réussis** (référence 50/46).

## J–N. Certifications

| Dimension | Verdict |
|---|---|
| Code local | Certifié |
| Tests financiers (J) | PASS |
| Tests locatifs (K) | PASS |
| Frontend (L) | PASS |
| E2E | PASS (96/96) |
| Mobile (M) | Partiel : tests, types et export OK ; `expo-doctor` en échec (voir N) |
| Android | Partiel (export JS OK, aucune build native ni publication réalisée) |
| iOS | Non vérifié (aucune build iOS locale) |
| **Release (N)** | **FAIL — 12/13 validations.** `MOBILE — Doctor` : 11 paquets Expo SDK 57 en retard de correctif (`expo` 57.0.26 au lieu de ~57.0.30 ; `expo-asset`, `-auth-session`, `-constants`, `-crypto`, `-dev-client`, `-location`, `-notifications`, `-sharing`, `-updates`, `jest-expo`). |
| Sécurité | PASS (aucun assouplissement ; tests négatifs ajoutés) |
| Préproduction | Non prête tant que la release n'est pas verte |
| Production | Non autorisée |

## O. État Git final

`main` @ `5a54a13`, aucun commit ni push, rien d'indexé. 242 fichiers suivis modifiés et 201 non suivis. Aucune modification préexistante perdue : vérifié par comparaison avec la sauvegarde, aucune entrée retirée.

Modifié depuis la reprise :
- application : `client/lib/pages/dashboard/OwnerDashboard.jsx`, `server/controllers/hotelReservationController.js` ;
- tests : 9 specs E2E, `e2e/support/{auth,platformContext}.js`, `OwnerDashboardNavigation.test.jsx` ;
- seed : `server/scripts/start-accommodation-e2e.js` ;
- nouveaux fichiers : `hotelCheckoutReadinessManagerFU214.mongo.integration.test.js` et les deux rapports.

Captures réécrites par les tests et non restaurées, à relire avant tout commit : `client/e2e/accommodationSearchBar1/screenshots/*.png` (5) et `client/e2e/inbox2/screenshots/*.png` (6, déjà modifiées avant F-U2.14).

## P. Risques résiduels

1. **`expo-doctor`** : alignement des correctifs Expo à décider (`npx expo install --fix`). Cela modifie `package.json`, le lockfile et des modules natifs (`expo-updates`, `expo-notifications`), puis exige une nouvelle validation Android (certification Google Play R2) avant release.
2. **Node v20.20.2** : plantages natifs V8 intermittents observés avant le redémarrage, aucun depuis. À surveiller ; installer un autre correctif de Node 20 si cela réapparaît.
3. **E2E sous `next dev`** : sensible à la charge machine (compilation à la volée). Recommandation : faire tourner le banc E2E sur `next build` + `next start`. Ce changement touche le banc partagé avec `.github/workflows/e2e.yml` et relève d'une décision.
4. **Certifications parallèles** : `mongodb-memory-server` échoue au démarrage sous forte charge. Ne pas lancer plusieurs suites lourdes simultanément.
5. Les avertissements de lint sont à comparer avec la référence ; aucune erreur.

## Q. Verdict

**`F-U2.14 CERTIFIÉ LOCAL — RELEASE BLOQUÉE`**

Toutes les corrections locales sont validées : E2E 96/96, financier, locatif, backend, frontend et mobile verts. La release reste bloquée par une seule validation : `expo-doctor`, pour une dérive de versions de correctif des dépendances Expo, sans défaut de code. Aucune mise en production sans nouvelle autorisation.
