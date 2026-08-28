# HZ-05 — Non-régression

Le patch production est limité au routeur et aux deux requêtes du contrôleur ; une seule suite Mongo adversariale est ajoutée. Aucun fichier client/mobile, schéma, service, migration, fixture partagée ni hotfix HZ-01→HZ-04 n'est modifié.

Preuves : HZ-05 18/18 ; cluster HZ-01→HZ-05 90/90 ; huit suites HotelReservation/hôtel/finance/opérations 165/165 ; backend unit complet 141 suites et 1 579/1 579 tests. Les filtres status/hotel/search, la pagination, le total, les deux tris et les populate ont des assertions dédiées. Client/Proprietaire restent 403, anonyme 401 et une comparaison Mongo avant/après prouve que les endpoints restent read-only.

Les montants et PII sont synthétiques. Aucune production n'a été contactée ou mutée. Aucun commit, push ou déploiement n'a été effectué.
