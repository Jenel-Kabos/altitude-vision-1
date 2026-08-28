# HZ-06 — Reproduction rouge

Commande valide exécutée avant patch de production :

`npx jest --runInBand __tests__/hotelAdminListsTenantScope.mongo.integration.test.js`

Une première tentative de fixture invalide (`Property.type=Hotel`) a été rejetée avant requête et n’est pas comptée. Après correction exclusive de la fixture vers `Villa`, le rouge valide donne **10 échecs, 6 succès, 16 tests**.

Fuites runtime : Admin A/B globaux sur les trois GET, PlatformOperator scoped global, staff sans tenant en 200, inventaire privé B visible depuis A (nom, email, téléphone, tarifs, Property et owner). PO global et scopes manager non-Admin étaient déjà conformes. Aucun accès production.
