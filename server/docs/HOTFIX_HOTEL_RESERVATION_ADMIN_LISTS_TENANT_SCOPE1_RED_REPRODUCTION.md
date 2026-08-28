# HZ-05 — Reproduction rouge archivée

La suite Mongo/Supertest réelle `hotelReservationAdminListsTenantScope.mongo.integration.test.js` a été écrite avant toute correction production, puis exécutée sur le vrai routeur Express avec deux tenants et cinq réservations synthétiques.

Commande ciblée Jest Mongo : 18 tests exécutés, 11 échecs et 7 succès avant fix.

Observations rouges : Admin A recevait des réservations B, Admin B recevait des réservations A, les deux endpoints pending mélangeaient A et B, `total` valait 5 au lieu de 2/3, `hotelId` de B permettait à A de lire B, les trois rôles staff autorisés sans tenant recevaient HTTP 200, le PlatformOperator scoped restait global, et PII/demandes spéciales/montants B étaient sérialisés pour A.

Attendu sécurisé : A→A seulement, B→B seulement, total tenant-scoped, staff sans tenant→403, PlatformOperator global→global, PlatformOperator scoped→tenant sélectionné. Les mêmes assertions, sans affaiblissement, passent après correction : 18/18.
