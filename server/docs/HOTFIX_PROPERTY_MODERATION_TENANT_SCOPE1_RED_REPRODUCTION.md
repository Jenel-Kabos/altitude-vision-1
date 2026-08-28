# HZ-07 — Reproduction rouge archivée

Commande ciblée exécutée avant toute correction de production :

`npx jest --runInBand __tests__/propertyModerationTenantScope.mongo.integration.test.js`

Après alignement de deux assertions de mutation sur la convention historique 404, résultat rouge exact : **13 échecs, 4 succès, 17 tests**.

Preuves runtime :

- Admin A et Admin B recevaient chacun les 5 Property globales au lieu de 2 et 3.
- pending et pending-count incluaient l’autre tenant.
- Admin, GestionnaireImmobilier et Collaborateur sans tenant recevaient 200 sur leurs surfaces accessibles.
- PlatformOperator scoped restait global.
- `?tenant=B` remplaçait effectivement la frontière attendue ; `?owner=B` permettait également de sonder l’autre tenant.
- titre privé, montant et données owner peuplées (`name email photo role phone`) de B étaient exposés à A.
- vente/location/Parcelle partageaient la query vulnérable.
- PlatformOperator global et catalogue public étaient conformes.
- validate/reject cross-tenant retournaient déjà 404, sans update ni Notification : ALREADY SAFE.

La reproduction utilise MongoMemory replica set et Supertest, sans production.
