# HOTFIX-PROPERTY-PUBLICATION-VISIBILITY-1 : GO SOUS RÉSERVES

## Cause et correctif

Le bien réel est approuvé mais non publié (`statusAdmin=Validée`, `isPublished=false`). La route de modération classique ne modifiait jamais `isPublished`, et aucune autre action de publication vente/location n'existait. En parallèle, le KPI Sales « Publiés » comptait la seule validation. Les listes et la Home appliquaient correctement la sécurité et excluaient le document.

La transition Admin `validate` publie désormais atomiquement une annonce classique vente/location ; `reject` la retire. Les cycles Accommodation/Hotel restent séparés. Le KPI Sales utilise le prédicat public complet. Aucun filtre frontend, type, propriétaire ou scope tenant n'a été élargi.

## Réponses obligatoires

1. `Property` `_id=6a887b…e4ec`, titre `PARCELLE A VENDRE`.
2. `Parcelle`.
3. Aucun champ `listingType`; canonique `status=vente`.
4. Aucun `isApproved`; canonique `statusAdmin=Validée`.
5. `status=vente`, `statusAdmin=Validée`.
6. Publication classique réelle : `isPublished=true` en plus de validation/disponibilité/pôle.
7. Les statistiques Patrimoine comptaient tout actif ; le KPI « Publiés » confondait validation et publication.
8. La liste exigeait correctement `isPublished=true`, alors que le document valait false.
9. Non.
10. Même exclusion par le portefeuille publié.
11. L'exclusion d'un document non publié était correcte ; l'absence de transition et le libellé KPI étaient les bugs.
12. Les quatre sources métier réellement publiées, actives et dédupliquées.
13. `GET /api/properties/latest`.
14. Non, car `isPublished=false`.
15. Non ; aucun filtre Altimmo supplémentaire.
16. Non ; `Parcelle` est dans le schéma et `propertyFilterConstants`.
17. Non ; `status=vente` est canonique.
18. Oui : validation vraie, publication fausse, KPI incorrect.
19. Non. Owner présent, tenant null, un seul tenant actif ; scope staff borné incluant le propriétaire non affilié.
20. Backend uniquement.
21. Validation classique publie/rejet retire ; KPI publié réaligné.
22. Les projections publiques existantes, déjà cohérentes, sont conservées ; pas de helper global dangereux.
23. Oui dans les tests locaux après validation.
24. Oui, conformément au contrat portefeuille.
25. Oui après validation/publication.
26. Oui si dans les cinq derniers `createdAt`.
27. Oui, privé.
28. Oui, privé et explicitement dépublié.
29. Oui, privé.
30. Oui.
31. Oui.
32. Oui, projection publique inchangée.
33. Oui, tests tenant ciblés verts.
34. Tests ciblés verts.
35. ManageProperties 28/28 vert ; aucun code frontend modifié.
36. Tests Mongo visibilité/tenant verts.
37. Oui : suite unitaire backend complète terminée avec code 0.
38. Oui : suite client complète terminée avec code 0.
39. Oui : lint backend et client sans erreur ; avertissements préexistants seulement (106/266).
40. Oui : build Next de production terminé avec code 0 ; les refus réseau pendant le pré-rendu sont tolérés par les fallbacks existants.
41. Oui : `git diff --check` vert.
42. Deux contrôleurs backend, quatre tests étendus, quatre documents.
43. Aucun commit, push ni déploiement.
44. **GO SOUS RÉSERVES** : le code local est corrigé, mais le document production reste `isPublished=false` jusqu'au déploiement et à une nouvelle validation/régularisation explicitement autorisée.

## Sécurité

Pending, rejeté, brouillon, non publié, retiré, vendu ou loué ne deviennent jamais publics par simple lecture. L'action de publication reste Admin et tenant-scopée. La projection publique continue d'utiliser une allow-list sans owner, agent, documents ni coordonnées privées.

## Gates

| Gate | Résultat |
|---|---|
| Backend ciblé routes + analytics | 4 suites, 87/87 verts |
| Mongo portefeuille + tenant | 3 suites, code 0 |
| Mongo catalogue + Home/latest | 1 suite, 21/21 verts |
| Backend unitaire complet | Vert, code 0 |
| Lint backend | Vert, 0 erreur ; 106 avertissements préexistants |
| Client ManageProperties | 28/28 verts |
| Client complet | Vert, code 0 ; bruit console jsdom préexistant |
| Lint client | Vert, 0 erreur ; 266 avertissements préexistants |
| Build Next production | Vert, code 0 ; fallbacks actifs sur les appels réseau indisponibles au pré-rendu |
| `git diff --check` | Vert |
| Vérification production après déploiement | Non exécutée : déploiement et mutation interdits par le mandat |

Aucune mutation de production n'a été effectuée. Le document réel reste donc volontairement inchangé dans l'environnement déployé.
