# AUDIT-RENTAL-MANAGEMENT-ENROLLMENT-1 — Rapport final

## Verdict

**A. RENTAL ENROLLMENT MODEL IS CORRECT — UI/COUNT BUG CONFIRMED**, avec deux anomalies connexes circonscrites au même dashboard.

Le système distingue correctement une annonce et un dossier opérationnel grâce à `RentalManagement.managementActivated`, et fournit déjà une action explicite d'onboarding. Le `1 Bien inscrit` ne prouve cependant aucun enrôlement : il provient directement d'une `Property` locative appartenant à un compte `Proprietaire`.

## Réponses obligatoires

1. **Property** représente le bien physique et le socle commun de son annonce commerciale; le code assume donc une responsabilité double, avec des champs legacy locatifs.
2. **RentalManagement** représente le satellite locatif unique et le dossier opérationnel; `managementActivated` sépare fiche de location et prise en gestion.
3. Relation : `RentalManagement.property` est requis et unique vers `Property`; owner, locataire courant et bail actif complètent le dossier.
4. Une création générique de Property ne crée pas automatiquement un RM. Le flux complet d'annonce locative `/rental-properties` crée néanmoins un RM satellite non activé.
5. Aucun RM opérationnel n'est créé par simple publication; `managementActivated:false` est explicite.
6. Le RM actif est créé/réactivé par onboarding, API `/rental-management`, import historique ou création explicite d'un bail.
7. Oui, workflow explicite « Ajouter un bien à la gestion locative ».
8. Oui, UI dans `GestionLocativePage`, modal `AddManagedPropertyModal`, bouton « Activer en gestion locative ».
9. Oui : options et activation sous `/api/rental-management/onboarding`; ancienne activation `POST /api/rental-management` également présente.
10–11. `1 Bien inscrit` vient de `Property.aggregate`: Property tenant, `status=location`, non retirée, owner présent dont le User a le rôle `Proprietaire`.
12. Il vaut 1 si une seule Property satisfait ces critères dans Altitude Vision.
13. Oui, ce 1 peut correspondre uniquement à l'annonce décrite, sans RM activé; les tests le prouvent. L'identité du document runtime n'a pas été lue en production.
14. `0 Biens gérés` vient de `RentalManagement.aggregate.total` avec `managementActivated:true` et Property tenant.
15. Il vaut 0 lorsqu'aucun dossier activé ne correspond au portefeuille tenant.
16. Différence technique : catalogue Property locatif externe contre dossier RM activé.
17. Une vente sans RM n'est pas comptée dans `biensInscrits`.
18. Une location sans RM activé est comptée dans `biensInscrits`.
19. Ce n'est pas cohérent avec le sens métier proposé du mot « inscrit ».
20. Vacant = RM activé dont `occupancyStatus='vacant'`.
21. Non, une simple annonce non activée ne peut pas compter comme vacante.
22. Publié = RM activé dont `publicationStatus='publie'`.
23. Il s'agit du statut de publication du dossier locatif; ce n'est pas un comptage direct de `Property.isPublished`.
24. Le KPI Maintenance header exige un RM activé. Le compteur overview de tickets n'exige pas un RM et présente en plus un défaut de scope staff.
25. Les impayés exigent un `Paiement` rattaché à un `Contrat type=location` d'une Property tenant, mais la query n'exige pas directement un RM.
26. Les nouveaux contrats sont reliés à Property et provoquent l'activation RM; le KPI client « Contrats actifs » inclut toutefois aussi les ventes.
27. Via l'API courante, non : `ensureRentalManagementActive` s'exécute avant `Contrat.create`.
28. Des données legacy peuvent exister sans RM; le service et les tests de réconciliation le documentent.
29. Non, pas tous : les statistiques principales le sont, mais la liste de maintenance consommée par l'overview ne filtre pas le tenant pour le staff sans `propertyId`.
30. L'onglet et `Biens gérés` utilisent le même concept RM activé; le badge de l'onglet compte seulement les lignes de la page chargée, alors que le KPI agrège tout.
31. RM-01 : confirmée par l'architecture opérationnelle, contredite par `biensInscrits`.
32. RM-02 : confirmée.
33. RM-03 : contredite partiellement.
34. RM-04 : confirmée.
35. RM-05 : confirmée pour l'enrôlement normal et le KPI inscrit.
36. RM-06 : confirmée pour vacant/publié/maintenance header; contredite par les lectures périphériques signalées.
37. Plusieurs incohérences : une cause principale compteur/libellé, plus contrats actifs et maintenance overview.
38–39. RM-F01 P2, RM-F02 P2, RM-F03 P2, RM-F08 P3, RM-F09 P2, RM-F10 P1.
40. Oui, si « inscrit » signifie réellement entré en gestion.
41. Source canonique proposée : `RentalManagement` et son état d'activation, pas le catalogue Property.
42. À conserver séparément uniquement si une seconde définition métier réelle est validée; sinon les deux KPI deviennent doublons.
43. Définition actuelle solide : dossier `managementActivated:true`. Une future distinction « inscrit/géré » doit définir un état supplémentaire explicite avant modification.
44. Oui, l'action est nécessaire.
45. Elle existe déjà.
46. Sans objet : elle s'appuie déjà sur RentalManagement existant.
47. Aucune migration de schéma nécessaire pour le compteur.
48. Aucun backfill des annonces ordinaires; inventaire/réconciliation uniquement pour les baux legacy sans RM.
49. Préserver Property legacy, RM non activés, contrats historiques et la réconciliation idempotente.
50. Futur correctif minimal : `rentalManagementController.stats`, `RentalStats`, `GestionLocativePage`, `rentalMaintenanceController.list` et tests ciblés associés.
51. Tests RED→GREEN listés dans le document Findings.
52. Code modifié pendant audit : **NON**.
53. Mongo production modifiée : **NON**.
54. Commit : **NON**.
55. Push : **NON**.
56. Deploy : **NON**.
57. Verdict : **A**, pas B : le workflow d'enrôlement n'est ni absent ni incomplet dans son principe.

## Validation

- Baseline : branche `main`, HEAD `bdcba2462a17f4ded3ccad188ae5024a14940f8b`.
- Worktree initial indépendant préservé : deux fichiers Inbox modifiés et son rapport non suivi.
- Tests ciblés : **4 suites, 26 tests, tous PASS** (`rentalManagementActivation`, routes onboarding, KPI biens inscrits Mongo, options onboarding Mongo).
- Première exécution sandbox : impossible (`listen EPERM`); relance autorisée avec ports locaux éphémères réussie.
- `git diff --check` : PASS.
- Aucun test temporaire créé; aucun fichier temporaire à supprimer.

