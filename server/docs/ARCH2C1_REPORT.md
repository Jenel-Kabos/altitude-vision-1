# ARCH-2C1 — Rapport final

## Verdict

**CERTIFIÉ VERT.** Le cluster pilote « document streaming » a été extrait vers une frontière infrastructurelle précise. Neuf dépendances controller→controller ont réellement disparu, sans duplication, sans déplacement de contrôles tenant/IAM/ownership et sans changement du contrat HTTP.

## Résultat

- Avant : 6 service→controller, 18 controller→controller, 17 route→model, 0 cycle.
- Après : 6 service→controller, **9 controller→controller**, 17 route→model, 0 cycle.
- Baseline réduite de neuf entrées exactes; 0 entrée stale finale; 0 nouvelle violation.
- `streamRemoteDocument` et `safeFilename` vivent dans `services/storage/documentStreamingService.js`.
- Les neuf appelants et `rentalDocumentController` consomment la même abstraction canonique.
- Routes, middleware, modèles, permissions et APIs publiques sont inchangés.

## Gates

| Gate | Résultat |
|---|---|
| Caractérisation avant extraction | 7/7 verte |
| Tests ciblés service + architecture | 14/14 verts |
| Mongo documentaire ciblé | 14/14 verts |
| Backend unitaire complet | 131 suites, 1 495/1 495 verts |
| Architecture | PASS; 463 fichiers, 1 511 arêtes, 0 cycle, 0 nouvelle violation |
| Lint backend | 0 erreur; 106 avertissements préexistants |
| `git diff --check` | Vert |

La suite Mongo exhaustive n'a pas été rejouée : le cluster ne change ni modèle, ni schéma, ni requête DB; la suite Mongo pertinente exerce le flux réel, tenant et ownership. Le full Mongo de référence ARCH-2B était vert à 977/977 immédiatement avant ce sprint.

## Réponses aux 55 questions

1. **Les 6 service→controller ont-ils été inventoriés ?** Oui, individuellement avec symbole, responsabilité et risque.
2. **Les 18 controller→controller ?** Oui, individuellement.
3. **Combien de clusters ?** 7.
4. **Quels clusters ?** Document streaming, Property partagé, reporting analytics, user scope, message serialization, mobile Property payload, lease payment generation.
5. **Lequel choisi ?** Document streaming.
6. **Pourquoi ?** Responsabilité infrastructurelle unique, neuf appelants, contrôles métier externes au helper, forte réduction pour faible surface.
7. **Quel niveau de risque ?** Faible fonctionnellement, sécurité sensible et donc fortement caractérisé.
8. **Quels symboles exacts étaient partagés ?** Pour le pilote : `streamRemoteDocument`; `safeFilename` était sa dépendance privée et a été déplacé avec lui.
9. **Combien d'edges dans le cluster ?** 9 arêtes interdites.
10. **Quelle responsabilité réelle ?** Proxy-stream HTTP(S), conversion d'erreurs upstream et pose d'en-têtes privés.
11. **Métier ou infrastructure ?** Infrastructure.
12. **Quels tests existaient avant ?** Une intégration Mongo/HTTP réelle de 14 cas sur le téléchargement de bail, auth, tenant, ownership et erreurs.
13. **Quels tests ajoutés ?** 7 tests unitaires adversariaux du contrat précis du streamer.
14. **Quel comportement caractérisé ?** URL/protocole, upstream 404/500, erreur réseau, MIME, disposition, filename, cache, nosniff, pipe et réponse après headers.
15. **Nouvelle abstraction créée ?** Oui, `storage/documentStreamingService`.
16. **Abstraction existante réutilisée ?** `secureStorageService` a été audité mais traite les assets privés, pas le proxy legacy HTTP(S); il n'a pas été surchargé.
17. **Pourquoi ?** Séparer précisément le streaming distant legacy du stockage privé et éviter un god service.
18. **Express req/res retirés de la logique partagée ?** `req` n'y entre pas; `res` reste nécessaire au pipe HTTP et demeure le seul objet Express reçu, comme avant.
19. **Contrat HTTP identique ?** Oui.
20. **Payload identique ?** Oui.
21. **Status codes identiques ?** Oui : 422 pour URL invalide, 502 pour upstream/transport, plus les statuts métier des contrôleurs inchangés.
22. **Tenant identique ?** Oui, checks inchangés avant streaming.
23. **Ownership identique ?** Oui.
24. **IAM identique ?** Oui.
25. **Finance intacte ?** Oui; aucune règle financière changée.
26. **Property intact ?** Oui.
27. **Notification/CRM intact après ARCH-2B ?** Oui.
28. **service→controller avant ?** 6.
29. **Après ?** 6.
30. **controller→controller avant ?** 18.
31. **Après ?** 9.
32. **route→model avant ?** 17 arêtes sur 13 routes.
33. **Après ?** 17 arêtes sur 13 routes.
34. **Cycles avant ?** 0.
35. **Après ?** 0.
36. **Baseline réduite ?** Oui.
37. **Combien d'entrées supprimées ?** 9, exactement les arêtes devenues stale.
38. **Baseline stale = 0 ?** Oui au passage final.
39. **Nouvelle violation = 0 ?** Oui.
40. **Tests ciblés ?** Oui : 14/14 unitaires service/architecture.
41. **Backend complet ?** Oui : 1 495/1 495.
42. **Mongo ?** Suite pertinente : 14/14; full non rejoué pour les raisons documentées ci-dessus.
43. **Architecture tests ?** Oui : 7/7 au sein du ciblage combiné.
44. **architecture:check ?** PASS, 0 cycle, 0 nouvelle violation.
45. **Lint ?** Vert, 0 erreur et 106 avertissements préexistants.
46. **git diff --check ?** Vert.
47. **Frontend modifié ?** Non.
48. **Mobile modifié ?** Non par ARCH-2C1; l'APK non suivi était déjà présent dans le worktree.
49. **Fichiers modifiés ?** 21 dans le périmètre ARCH-2C1 : 10 contrôleurs, 1 service, 1 test, 1 baseline et 8 documents.
50. **Commit ?** Aucun.
51. **Push ?** Aucun.
52. **Deploy ?** Aucun.
53. **Dette restante ?** 6 service→controller, 9 controller→controller, 17 route→model, 202 controller→model progressives et 3 imports pendants progressifs.
54. **Cluster recommandé pour ARCH-2C2 ?** Message serialization (`conversationController -> messageController`), sous réserve d'une caractérisation exhaustive des champs privés et unread.
55. **Verdict ?** **ARCH-2C1 CERTIFIÉ VERT.**

## Livrables

- `ARCH2C1_ETAT_INITIAL.md`
- `ARCH2C1_DEPENDENCY_INVENTORY.md`
- `ARCH2C1_CLUSTER_SELECTION.md`
- `ARCH2C1_BEHAVIOR_CONTRACT.md`
- `ARCH2C1_REFACTOR_MATRIX.md`
- `ARCH2C1_SECURITY_MATRIX.md`
- `ARCH2C1_FINAL_BASELINE.md`
- `ARCH2C1_REPORT.md`

Aucun commit, push ou déploiement n'a été effectué. ARCH-2C2 est proposé mais non démarré.
