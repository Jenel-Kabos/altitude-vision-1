# DATA-RESET-CERT-1 — Audit

Date : 2026-08-13

Mode : certification post-reset, accès production strictement en lecture seule

Verdict : **POST-RESET STATE CERTIFIED WITH LIMITATIONS**

## P0 — rotation et invalidation

La projection MongoDB excluant tout secret confirme sur l'unique Admin : `role=Admin`, `status=Actif`, `tokenVersion=1`, `passwordChangedAt=2026-08-13T16:30:55.816Z`, puis `lastLoginAt=2026-08-13T16:31:50.216Z`. La rotation et une authentification ultérieure sont donc matérialisées.

Le middleware refuse un JWT dont `tokenVersion` est inférieur à celui de l'utilisateur et applique aussi `changedPasswordAfter(iat)`. Le test unitaire correspondant (`authMiddleware.test.js`) fait partie des 1 265 tests backend réussis. Aucun ancien jeton réel n'était disponible : son rejet n'a pas été rejoué contre la production.

## Base cible et état final

- Base : `altitudevision`; hôte masqué `cl***.atigmso.mongodb.net`.
- Contrôle initial et contrôle final identiques : 104 collections, 22 documents.
- Bootstrap structurel : 12 documents (Admin, tenant, root OrgUnit, membership owner, opérateur actif, settings, theme, subscription et quatre ActionLog).
- Toutes les collections métier tenant sont vides.
- `facebookposts` contient 10 publications publiques recréées après le reset, sans tenant et sans timestamp antérieur au reset. La collection est utilisée par le runtime actuel (`/api/facebook-posts`) et possède l'index unique `facebook_id_1`; elle n'est pas une restauration legacy ni une donnée métier tenant.
- Le second audit, exécuté après toutes les suites isolées, retrouve exactement ces comptes : aucun test n'a muté la production.

## Cohérence structurelle

Le tenant unique `Altitude Vision` (`slug=altitude-vision`) référence l'unique OrgUnit racine (`parent=null`, `ancestors=[]`, `path=/`). L'unique membership relie l'Admin à cette racine avec `roleInUnit=owner`, `status=active`. L'unique PlatformOperator référence le même Admin, est actif et porte les 28 capacités granulaires actuelles. Settings, thème et abonnement trial référencent le même tenant.

Les quatre ActionLog correspondent exclusivement au bootstrap : `organization.created`, `platform_tenant.created`, `organization.membership_granted`, `platform_operator.granted`. Aucun secret n'y a été observé.

## Index et CRM

Les index des collections critiques (User, PlatformTenant, OrgUnit, OrgMembership, PlatformOperator, Property, RentalManagement, Contrat, Conversation, Message, Document, CrmCustomer et FinancialDocument) sont présents. L'index CRM actif est exactement `one_crm_customer_per_tenant_source`, unique sur `tenant + sourceRefs.entityType + sourceRefs.entityId`, avec filtre partiel `string/objectId`. Aucun ancien équivalent n'existe : **CRM INDEX MIGRATION NO LONGER REQUIRED AFTER RESET**.

## Gates exécutés

- Backend unit : 110/110 suites, 1 265/1 265 tests.
- Backend Mongo/replica isolé : 82/82 suites, 860/860 tests.
- Web Vitest : 76/76 fichiers, 513/513 tests.
- Playwright, base E2E locale isolée : 34/34 scénarios.
- Mobile Jest : 24/24 suites, 227/227 tests.
- Next build : succès, 142/142 pages générées.
- `npm run health` : 28 OK, 0 avertissement, 0 erreur.
- `npm run verify` : 4 validations, 0 erreur.
- Expo Doctor : 20/20 contrôles.
- ESLint : 0 erreur; 129 avertissements server, 268 client, 86 mobile. TypeScript mobile : succès.

## Limitations et incident de test

- Le navigateur intégré n'était pas disponible. Les marqueurs P0 et l'authentification post-rotation sont prouvés par la base, mais aucun appel HTTP authentifié n'a été envoyé à la production.
- La suite Mongo isolée `hotelFinancialCheckoutF23.mongo.integration.test.js` a tenté un envoi Zoho vers une adresse `.test`. Zoho a répondu 404 `URL_RULE_NOT_CONFIGURED`; aucun email n'a été délivré. C'est un défaut d'isolation du test à corriger, sans impact sur `altitudevision`.
- Les avertissements lint préexistants restent ouverts.

## Garanties de périmètre

Aucune écriture de certification n'a visé `altitudevision`; seules les bases éphémères Mongo/Playwright ont reçu des fixtures. Aucun commit, push, deploy, seed métier réel, restauration legacy, rotation de credential fournisseur, appel de nettoyage Cloudinary ou suppression d'asset n'a été effectué. **LEGACY/ORPHANED CLOUDINARY ASSETS MAY STILL EXIST.**
