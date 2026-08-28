# ARCH-2D1 — Rapport final

## Verdict

**CERTIFIÉ VERT.** Les six dépendances ont été auditées et groupées en trois clusters. Une extraction minimale a supprimé `rentalLeaseRenewalService → contratController` sans changer le comportement. La baseline service→controller passe de 6 à 5 ; la dernière controller→controller Property reste intacte.

## Réalisation

- Ajout de `rentalPaymentScheduleService.js`, propriétaire canonique de `generatePaiements`.
- Migration des deux consommateurs : `contratController` et `rentalLeaseRenewalService`.
- Suppression de l'export controller et de l'import service→controller.
- Cinq tests de caractérisation écrits et exécutés avant le déplacement, puis rejoués après.
- Aucune duplication, règle métier, permission, route, réponse HTTP, donnée ou provider modifié.

## Gates

| Gate | Résultat |
|---|---|
| Caractérisation | 1 suite, 5/5 verts avant et après |
| Unitaires ciblés rental | 2 suites, 11/11 verts |
| Mongo ciblé rental | 2 suites, 27/27 verts |
| Backend complet | 136 suites, 1533/1533 tests verts |
| Architecture checker tests | 2 suites, 26/26 tests verts |
| `architecture:check` | PASS ; 5 service→controller, 1 controller→controller, 17 route→model, cycles/new/stale = 0 |
| Lint | 0 erreur ; 108 warnings cumulés du worktree, aucun dans les fichiers ARCH-2D1 |
| `git diff --check` | Vert |
| Mongo exhaustif | Non rejoué : responsabilité locale rental ; Mongo ciblé obligatoire vert. Le dernier exhaustif immédiatement antérieur était vert (977/977). |

## Réponses obligatoires

1. Les six edges exactes sont : `mobileAccommodationPublicationService→propertyMobileController`, `rentalLeaseRenewalService→contratController`, et les quatre rapports `accommodationReport`, `hotelReport`, `immobilierReport`, `locationReport` vers `dashboardAnalyticsController`.
2. Elles importent respectivement `buildMobilePropertyData`, `generatePaiements`, `accommodations`, `hotels`, `sales`, `rentals`.
3. Trois clusters.
4. Publication mobile Property, échéancier de bail, analytics/reporting.
5. Cluster choisi : échéancier de bail.
6. Responsabilité unique, surface étroite, signature explicite, aucune dépendance HTTP/sécurité et caractérisation simple.
7. Risque moyen car il écrit des échéances, mais borné et sans mouvement financier réel.
8. Des suites rental existaient ; cinq tests de frontière dédiés ont été ajoutés avant extraction.
9. La génération inclusive des mensualités et leur insertion `Paiement.insertMany`.
10. Oui : cette responsabilité de domaine était mal placée dans un controller.
11. Non, ce n'était pas un handler HTTP.
12. Pas strictement pur : calcul déterministe suivi d'une écriture DB.
13. Non.
14. Non.
15. Oui, une règle existante d'échéancier, déplacée sans modification.
16. `contratId`, `dateEntree`, `dateFinBail`, `montantLoyer`.
17. Promise résolue avec `undefined`.
18. Insertion en lot des échéances `impayé`, ou aucun effet si input manquant/falsy.
19. Oui, modèle `Paiement`.
20. Non.
21. Non.
22. Non.
23. Non.
24. Oui au sens d'échéancier locatif ; non pour confirmation, ledger, checkout, payout ou reversal.
25. Non.
26. Non.
27. Non.
28. Oui, `rentalPaymentScheduleService`.
29. Aucune abstraction existante équivalente n'a été trouvée.
30. L'emplacement appartient au domaine rental et est partagé sans dépendre d'Express.
31. Non.
32. Non.
33. Non.
34. L'API était déjà basée exclusivement sur des données métier explicites.
35. Oui, couvert par le contrat avant/après.
36. Oui : aucun status HTTP n'est produit par ce helper et les controllers sont inchangés.
37. Oui : l'erreur DB continue d'être propagée telle quelle.
38. Oui, aucun tenant n'entre dans ce chemin.
39. Oui, aucun contrôle ownership déplacé.
40. Oui, aucun contrôle IAM déplacé.
41. Non.
42. Non.
43. Non.
44. Non.
45. 6.
46. 5.
47. 1.
48. Oui, stable à 1.
49. Oui, `altimmoSearchController→propertyController.runPropertySearch` est intacte.
50. Oui, stable à 17.
51. Oui, 0.
52. Oui, 0.
53. Oui, 0.
54. Oui, 5/5 avant et après.
55. Oui, 11/11.
56. Oui, 27/27.
57. Oui, suite backend complète verte.
58. Non ; non requis pour ce helper local, avec justification ci-dessus.
59. Oui, verts.
60. Oui, PASS.
61. Oui, 0 erreur ; 108 warnings cumulés hors fichiers ARCH-2D1.
62. Oui, vert.
63. Non.
64. Non.
65. Non.
66. Non.
67. Non.
68. Non.
69. Aucune anomalie métier démontrée.
70. Sans objet ; tout changement métier potentiel reste explicitement hors scope.
71. Le cluster reporting, seulement après caractérisation multi-domaines tenant/Hotel/finance ; ne pas le lancer sur le seul gain de quatre edges.
72. **ARCH-2D1 — CERTIFIÉ VERT.**

Aucun commit, push ou déploiement n'a été effectué.
