# PREP-1 — Dossier de préparation à la production

Date de l'audit : 2026-08-06. Ce document est un runbook ; il n'autorise aucune écriture en base.

## Verdict de préparation

**NO-GO tant que les bloqueurs sécurité et exploitation ci-dessous ne sont pas levés.** Le code fonctionnel peut être validé par les gates, mais une certification de production ne doit pas masquer les vulnérabilités npm critiques ni l'absence d'une stratégie explicite d'exécution unique des cron.

## Inventaire initial

- Backend Express/Mongoose : 83 modèles, 65 routeurs, 68 contrôleurs, 105 services, 9 middlewares et 14 scripts.
- Web Next.js : 186 fichiers sous `client/app` et 436 sous `client/lib`.
- Mobile Expo 52 / React Native 0.76 : 156 fichiers sous `altimmo-app/src`.
- Navigation partagée : `shared/navigation/registry.json`, consommée par le Web, le Mobile et les notifications NAV-CORE.
- Le diff entrant au début de PREP-1 correspond à CRM-UX-1 : 11 fichiers suivis modifiés, 256 insertions/22 suppressions, 5 composants CRM et 3 fichiers serveur/doc non suivis. Git ne permet pas d'attribuer les sprints antérieurs déjà intégrés au dernier commit autrement que par leur historique.
- PREP-1 n'ajoute aucune fonctionnalité métier. Il complète les gabarits d'environnement, actualise les verrous npm uniquement dans les plages compatibles et fournit ce runbook.

## Données de production — contrôle lecture seule

Le contrôle a utilisé uniquement des comptages, agrégations et lectures d'index :

- 17 contrats, tous ouverts et sans référence `Property` ; aucune référence cassée lorsque `bien` existe ; aucun doublon d'engagement ouvert par bien/type.
- 8 `Property`, 1 `RentalManagement`, aucune référence `Property` ou bail actif cassée, aucun doublon par bien.
- 0 dossier de réconciliation : les 17 contrats restent volontairement à traiter dossier par dossier depuis `/dashboard/gestion-locative/regularisation`.
- 34 locataires et 2 propriétaires ; aucun doublon testé sur `Locataire.user` ou l'email propriétaire.
- 161 notifications, toutes legacy sans `destination` NAV-CORE, mais toutes avec destinataire et sans conflit de `dedupeKey`. Ne pas les migrer automatiquement.
- 0 client CRM, 5 documents, 0 document financier, 0 réservation Accommodation et 0 réservation Hotel.
- Pour les 12 collections critiques contrôlées, le nombre d'index en base égale le nombre déclaré par Mongoose plus l'index `_id`. Aucun conflit préalable sur les index uniques contrôlés.

## Variables d'environnement

### Backend obligatoires selon les modules activés

Socle : `NODE_ENV`, `PORT`, `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `FRONTEND_URL`, `BACKEND_URL`. Fichiers : `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. OAuth : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_ID_ANDROID`, `GOOGLE_CLIENT_ID_IOS`, `NEXTAUTH_API_SECRET`. Paiement : `CINETPAY_API_KEY`, `CINETPAY_SECRET`, `CINETPAY_SITE_ID`, `YABETOO_API_URL`, `YABETOO_SECRET_KEY`, `YABETOO_WEBHOOK_SECRET`. Email : `ZOHO_ACCOUNT_ID`, `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_WEBHOOK_SECRET`, `ZOHO_IMAP_PASSWORD`, `ZOHO_FROM`, `ZOHO_FROM_EMAIL`, `ZOHO_FROM_NAME`. Réconciliation/tests : `MONGODB_FINANCIAL_INTEGRATION_URI`, `FINANCIAL_MONGO_STANDALONE`, `FINANCIAL_RECONCILIATION_ALLOW_PRODUCTION`, `RENTAL_RECONCILIATION_ALLOW_PRODUCTION`. Exploitation : `DISABLE_SCHEDULED_JOBS`, `REAL_ESTATE_RESERVATION_MINUTES`, `RENTAL_CONTRACT_EXPIRY_ALERT_DAYS`, `COMPANY_PHONE`, `FACEBOOK_ACCESS_TOKEN`.

### Web et Mobile

- Web : `NEXT_PUBLIC_API_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_API_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`.
- Mobile : `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SOCKET_URL`, `EXPO_PUBLIC_APP_ENV`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_SENTRY_DSN`, `GOOGLE_MAPS_API_KEY`. Les variables `EXPO_PUBLIC_*` ne doivent jamais contenir de secret.
- Les valeurs réelles restent dans les coffres des plateformes. Aucun `.env` réel ne doit être versionné.

## Index MongoDB et migrations

1. Sauvegarder la base et relever `getIndexes()` avant tout déploiement.
2. Exécuter les agrégations de détection de doublons avant la synchronisation des index uniques : contrats ouverts par `{bien,type}`, gestion locative par `property`, CRM par `identityKeys` et `sourceRefs`, notifications par `{recipient,dedupeKey}`, documents financiers par clé métier.
3. Déployer les schémas compatibles. Ne jamais lancer `syncIndexes()` à l'aveugle : cette commande peut supprimer des index.
4. Vérifier les index attendus après démarrage. Les index TTL (`Notification`, verrous, inscriptions) entraînent des suppressions automatiques prévues par le modèle ; ils doivent être explicitement acceptés dans la politique de rétention.
5. Les scripts `reconcile-finance.js` et `reconcile-rental-management.js` sont en lecture seule par défaut et exigent un drapeau explicite pour écrire en production. Les scripts de migration/seed ne font pas partie du déploiement PREP-1.

## Ordre de déploiement

### 1. Backend

1. Geler les écritures administratives sensibles et prendre un snapshot MongoDB.
2. Installer avec `npm ci`, injecter les secrets, conserver `DISABLE_SCHEDULED_JOBS=1` sur toutes les nouvelles instances.
3. Déployer une instance canari, vérifier `/api/health`, authentification/RBAC, MongoDB, Socket.IO, stockage, paiement et email.
4. Basculer le trafic après smoke tests. Ne conserver les cron actifs que sur **une seule** instance désignée.

### 2. Web

Construire avec les URL du backend validé, déployer en preview, tester login, dashboards, navigation NAV-CORE, documents et paiements, puis promouvoir sans changer le backend.

### 3. Mobile

Produire un AAB avec le profil EAS `production`, vérifier API/socket/deep links, signer et diffuser progressivement. L'OTA ne doit cibler que le même `runtimeVersion`.

### 4. Cron

Activer sur un worker unique : Facebook horaire, IMAP/visites/hôtel/immobilier toutes les 5 minutes, rappels Accommodation toutes les 15 minutes, pénalités locatives à 06:00. Surveiller idempotence, durée, erreurs et chevauchements. Ne jamais activer les mêmes cron sur plusieurs réplicas.

### 5. Monitoring

Alertes minimales : disponibilité/latence/5xx, connexions Mongo, mémoire/CPU, espace du stockage d'uploads, échecs webhook paiement, erreurs email, échecs et durée cron, erreurs Socket.IO, taux d'authentification refusée, erreurs Web et Sentry Mobile. Conserver un identifiant de corrélation sans journaliser tokens, mots de passe ou pièces personnelles.

## Rollback contrôlé

- Déclencheurs : hausse 5xx, auth/RBAC dégradé, écriture financière incohérente, cron dupliqué, index en erreur, crash Web/Mobile.
- Couper d'abord les cron (`DISABLE_SCHEDULED_JOBS=1`) et les écritures sensibles ; conserver les lectures si sûres.
- Web : repromouvoir l'artefact précédent. Backend : redéployer l'image précédente compatible avec le schéma additif. Mobile : stopper le rollout ; publier une OTA uniquement si compatible avec le runtime, sinon soumettre un binaire de correction.
- Base : ne restaurer un snapshot qu'après décision d'incident, car cela écrase les écritures postérieures. Préférer une compensation métier journalisée. Ne jamais supprimer un index ou une donnée pendant le rollback improvisé.
- Valider santé, authentification, finance, documents, notifications et cron avant réouverture.

## Plan de commits recommandé (non exécuté)

1. `chore(deps): apply compatible security updates` — uniquement les lockfiles concernés.
2. `docs(env): complete production variable templates` — `.env.example` et `client/.env.example`.
3. `docs(prep): add production audit deployment and rollback runbook` — ce document.
4. Conserver CRM-UX-1 dans ses commits métier séparés (modèle/service/API, composants Web, tests, NAV-CORE, rapports), sans le mélanger à PREP-1.

## Bloqueurs et dettes

- Audit npm initial : serveur 15 vulnérabilités (10 hautes), Web 13 (2 critiques, 9 hautes), Mobile 34 (1 critique, 15 hautes). Les correctifs sans `--force` sont appliqués aux lockfiles ; les résidus doivent être relevés dans le rapport de gates.
- La résolution complète Mobile demande une montée majeure Expo 52 → 57 : changement cassant potentiel, hors PREP-1 sans sprint de migration dédié.
- Nodemailer demande une montée majeure 8 → 9 pour supprimer toutes les alertes ; valider OAuth/SMTP/IMAP et les formats d'envoi dans un sprint sécurité dédié.
- Web utilise NextAuth 5 beta : toute correction restante doit être qualifiée avec des tests d'authentification dédiés avant production.
- Les 17 contrats non réconciliés faussent les KPI tant qu'ils ne sont pas traités individuellement.
- Les 161 notifications legacy n'ont pas de destination NAV-CORE ; préserver leur historique et appliquer NAV-CORE uniquement aux nouvelles notifications.
- Les uploads locaux exigent un volume persistant partagé ou une migration vers un stockage objet avant mise à l'échelle horizontale.
- La CI utilise `npm install` pour lint/test alors que l'E2E utilise `npm ci`; uniformiser sur `npm ci` pour la reproductibilité.

## Check-list GO/NO-GO

GO uniquement si toutes les gates demandées passent, si aucune vulnérabilité critique de production exploitable ne reste, si l'exécution unique des cron et le stockage persistant sont confirmés, si secrets/CORS/URLs sont validés, si snapshot et artefacts de rollback existent, et si les responsables Backend/Web/Mobile/DB sont joignables pendant la fenêtre.

## Résultats des gates exécutées le 2026-08-06

Tous les résultats ci-dessous proviennent d'exécutions neuves réalisées pendant PREP-1 :

| Gate | Résultat | Détail |
| --- | --- | --- |
| Backend Unit | PASS | 105 suites, 1 215 tests |
| Backend MongoDB complet | PASS | 51 suites, 414 tests, replica set arrêté proprement, 448,383 s |
| Web Vitest complet | PASS après relance complète | 76 fichiers, 505 tests ; une première exécution avait exposé un test de retry intermittent dans `ManageAccommodationsPage.test.jsx` |
| Mobile Jest | PASS | 24 suites, 227 tests |
| Playwright | PASS | 34 tests sur 34, 10,3 min |
| Build Next.js | PASS | Next.js 15.5.22, génération complète des routes |
| Expo Doctor | PASS | 18 contrôles sur 18 |
| Export Android | PASS | 1 967 modules, bundle HBC 6,46 MB sous `/private/tmp/prep1-expo-export` |
| TypeScript Mobile | PASS | aucune erreur |
| ESLint serveur | PASS avec dette | 0 erreur, 109 avertissements |
| ESLint client | PASS avec dette | 0 erreur, 267 avertissements |
| ESLint mobile | PASS avec dette | 0 erreur, 81 avertissements |
| `git diff --check` | PASS | aucune erreur d'espace ou de conflit |

La première exécution MongoDB, lancée en concurrence avec Playwright, a eu un timeout isolé dans `propertyAssetRoutes.mongo.integration.test.js`. La relance complète et isolée a passé les 51 suites ; le risque de contention CI doit néanmoins être conservé dans la dette d'exploitation.

## Dépendances et audit de sécurité après corrections compatibles

Les arbres directs sont cohérents (`npm ls --depth=0` à code 0 pour les trois applications). Le Web conserve un paquet optionnel `@emnapi/runtime` signalé `extraneous` par npm, y compris après `npm prune` ; il provient de la chaîne native Sharp et doit être surveillé lors d'une réinstallation propre avec `npm ci`.

- Serveur, audit complet : 3 vulnérabilités hautes ; production (`--omit=dev`) : 1 haute, `nodemailer`. La résolution annoncée demande une évolution majeure.
- Web, audit complet : 7 vulnérabilités (3 modérées, 4 hautes) ; production : 5 (2 modérées, 3 hautes), dans `next`, `postcss`, `sharp`, `react-router` et `react-router-dom`. npm propose notamment Next 16.3.0, évolution majeure à qualifier.
- Mobile, audit complet : 26 vulnérabilités (19 modérées, 6 hautes, 1 critique) ; production : 25 (18 modérées, 6 hautes, 1 critique). La critique concerne `tar` dans la chaîne Expo ; la correction proposée impose Expo 57 et constitue un breaking change potentiel.
- Les corrections compatibles sans `--force` ont ramené les audits depuis 15/13/34 vulnérabilités respectivement. Aucun `npm audit fix --force` n'a été exécuté.

## Fichiers PREP-1

Créé :

- `server/docs/PREP_1_PRODUCTION_RUNBOOK.md`

Modifiés :

- `.env.example`
- `client/.env.example`
- `server/package-lock.json`
- `client/package-lock.json`
- `altimmo-app/package-lock.json`

Les autres fichiers présents dans `git status` sont les travaux CRM-UX-1 entrants, conservés sans nettoyage ni écrasement : `client/app/dashboard/crm/page.jsx`, `client/lib/__tests__/CrmCustomersPage.test.jsx`, `client/lib/pages/dashboard/CrmCustomersPage.jsx`, `client/lib/services/crmService.js`, `server/__tests__/crm.mongo.integration.test.js`, `server/controllers/crmController.js`, `server/models/CrmCustomer.js`, `server/models/CrmOpportunity.js`, `server/routes/crmRoutes.js`, `server/services/crmService.js`, `shared/navigation/registry.json`, les cinq composants sous `client/lib/components/crm/`, `server/docs/CRM_UX_1_AUDIT.md`, `server/docs/CRM_UX_1_REPORT.md` et `server/models/CrmConsolidation.js`.

## Conclusion finale

**Verdict PREP-1 : NO-GO production.** La totalité des gates fonctionnelles et de construction passe, mais la vulnérabilité critique de production de la chaîne Mobile interdit raisonnablement la certification. Restent également à traiter les alertes hautes Backend/Web, à contractualiser l'instance unique des cron et le stockage persistant, puis à valider secrets, CORS, domaines, snapshot et artefacts de rollback dans l'environnement cible. Les montées Expo 52 → 57, Next 15 → 16 et Nodemailer 8 → 9 doivent être réalisées dans des sprints dédiés avec tests de non-régression.

PREP-1 n'exécute aucun commit, aucun push, aucune migration destructive et aucune suppression de données.
