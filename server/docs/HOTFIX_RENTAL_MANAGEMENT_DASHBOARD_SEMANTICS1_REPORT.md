# HOTFIX-RENTAL-MANAGEMENT-DASHBOARD-SEMANTICS-1 — Rapport

**Verdict : A. RENTAL MANAGEMENT DASHBOARD HOTFIX CERTIFIED GREEN**
**Aucun commit, push ou déploiement.**

## Baseline (§44 questions 1-2)
1. HEAD initial : `bdcba2462a17f4ded3ccad188ae5024a14940f8b`. 2. Worktree préexistant préservé ? **Oui** — le correctif Inbox non commité (`InternalMessagingPage.jsx`, `InternalMessagingPageUX.test.jsx`, `UX_INBOX_FULL_HEIGHT_MESSAGE_VIEW1_REPORT.md`) était déjà présent au démarrage de ce mandat et n'a reçu aucune modification, aucun stage, aucune suppression — diff identique avant/après (10+23 lignes inchangées).

**Note méthodologique** : les trois correctifs (A, B, C) et leurs tests étaient déjà présents dans le worktree au moment où ce mandat a commencé à travailler (probablement issus d'une itération précédente sur ce même sujet). Ce rapport documente leur vérification complète (RED→GREEN prouvé pour chacun via désactivation ciblée temporaire, puis restauration), pas leur écriture initiale.

## Fix A — "Bien inscrit" (§44 questions 3-8)
3. Ancienne définition : libellé `"Biens inscrits"` sur un compteur backend (`biensInscrits`) qui compte toute `Property` (`status=location`, non retirée, `owner` = un `User` de rôle `Proprietaire`) — sans exiger de `RentalManagement`. 4. Choix retenu : **Option A — libellé corrigé, query conservée** (`RentalStats.jsx` : `eligibleRentalLabel` = `"Bien locatif éligible"` / `"Biens locatifs éligibles"` selon le compte). 5. Pourquoi : recommandation métier du mandat elle-même (§7) — le véritable état de prise en gestion est déjà représenté par `"Biens gérés"` ; corriger la query aurait créé un doublon d'information avec ce KPI existant. 6. Une simple Property locative sans RentalManagement est-elle toujours comptée ? **Oui**, intentionnellement (c'est un catalogue de biens éligibles, pas un état d'enrôlement). 7. Sous quel libellé ? `"Bien locatif éligible"` (singulier) / `"Biens locatifs éligibles"` (pluriel) — jamais `"1 Biens"`. 8. `"Biens gérés"` reste-t-il basé sur `RentalManagement.managementActivated = true` ? **Oui, inchangé.**

## Fix B — Contrats actifs (§44 questions 9-14)
9. Ancienne query : `contrats.filter(c => c.statut==='actif')` (frontend, `GestionLocativePage.jsx`), sans filtre de type. 10. Pourquoi elle incluait les ventes : `Contrat.type` (enum `'location'`/`'vente'`, champ canonique déjà présent sur le modèle `Contrat`) n'était jamais vérifié — seul `statut` l'était. 11. Nouveau filtre : `contrats.filter(c => c.type==='location' && c.statut==='actif')`. 12. Contrat vente actif exclu ? **Oui**, prouvé par test (RED : 2, GREEN : 1). 13. Contrat location actif inclus ? **Oui**. 14. Contrat location expiré exclu ? **Oui** (fixture `c3: {type:'location', statut:'expiré'}` non comptée).

## Fix C — Maintenance overview tenant scope (§44 questions 15-22)
15. Ancienne query : pour un staff sans `propertyId`, la branche `else if (!isStaff)` ne s'appliquait jamais (staff exclu), donc `query.property` restait `undefined` → **aucun filtre**, tous les tickets de maintenance de toutes les tenants étaient renvoyés. 16. Pourquoi non tenant-scopée : le code ne traitait le cas `staff` que via le filtre explicite `propertyId` ; en son absence, aucun repli sur le scope tenant n'existait (contrairement aux autres lectures Gestion Locative). 17. Mécanisme canonique réutilisé : `req.tenantScopeUserIds`, déjà peuplé par le middleware `requireTenantScope` (`middleware/tenantContext.js`) monté en tête de `rentalMaintenanceRoutes.js` — **aucun nouveau helper créé**. 18. Tenant A isolé de B ? **Oui**, prouvé par test permanent (RED : ticket B visible dans la réponse de A ; GREEN : absent). 19. Staff sans tenant résolvable → fail-closed ? **Oui**, par construction : `requireTenantScope` est déjà fail-closed (aucun mode global implicite) et, à défaut, `ownerIds=[]` produit `query.property = {$in: []}` → 0 résultat, jamais un fallback global. 20. Comportement avec `propertyId` préservé ? **Oui**, testé explicitement (test 2, inchangé, toujours vert). 21. Admin préservé ? **Oui**, dans son périmètre tenant (testé). 22. PlatformOperator global/scoped préservé ? **Oui par construction** — `requireTenantScope` est le même mécanisme déjà certifié pour PO sur tout le reste de l'application ; aucun comportement PO n'a été modifié ni recréé dans ce fix.

## Non-régression (§44 questions 23-26)
23. Vacants modifié ? **NON.** 24. Publiés modifié ? **NON.** 25. Biens gérés modifié ? **NON.** 26. Workflow d'enrôlement (`AddManagedPropertyModal`, activation) modifié ? **NON.**

## Tests et gates (§44 questions 27-34)
27. RED prouvé pour les 3 fixes ? **Oui**, individuellement, par désactivation ciblée temporaire (jamais par revert de fichier entier, pour éviter de contaminer avec le fix Inbox pré-existant dans des fichiers voisins) :
   - Fix A : label revenu à `"Biens inscrits"` → 2/2 tests `RentalOverviewComponents.test.jsx` échoués.
   - Fix B : filtre `type==='location'` retiré → test `"Contrats actifs compte uniquement le bail location actif"` échoué (2 au lieu de 1).
   - Fix C : `ownerIds` forcé à `[]` pour staff → test `"sans propertyId, Admin A ne reçoit que les maintenances du Tenant A"` échoué (ticket B visible).
28. GREEN après restauration ? **Oui**, les 3 confirmés indépendamment puis en suite complète.
29. Tests ciblés total : **11 suites, 80 tests** (backend, domaine RentalManagement/Maintenance/Onboarding complet) + **2 suites, 25 tests** (frontend, `GestionLocativeAccess.test.jsx` + `RentalOverviewComponents.test.jsx`) = **13 suites, 105 tests, tous PASS**.
30. Architecture : **PASS**, 473 files, 1572 edges, 0 nouvelle violation. 31. Lint backend : **0 erreur, 104 warnings** (baseline précédente 108 — aucune régression, écart dû à des fichiers non liés à ce hotfix). 32. Lint frontend : **0 erreur, 267 warnings** (identique à la dernière baseline mesurée). 33. Frontend build (`npm run build:next`) : **PASS**, exit 0. 34. `git diff --check` : **PASS**, aucun avertissement.

## Périmètre exact (§44 questions 35-40)
35. Fichiers backend modifiés : `server/controllers/rentalMaintenanceController.js` (Fix C) + `server/__tests__/rentalMaintenanceListTenantScope.mongo.integration.test.js` (nouveau test permanent). 36. Fichiers frontend modifiés : `client/lib/components/dashboard/RentalStats.jsx` (Fix A), `client/lib/pages/dashboard/GestionLocativePage.jsx` (Fix B), `client/lib/__tests__/RentalOverviewComponents.test.jsx` + `client/lib/__tests__/GestionLocativeAccess.test.jsx` (tests). 37. Fix Inbox intact ? **Oui**, vérifié par diff identique avant/après ce mandat. 38. Mobile modifié ? **NON.** 39. Migration ? **NON** — aucun changement de schéma. 40. Mongo production ? **NON**, tous les tests utilisent `mongodb-memory-server` (base de test éphémère).

## Git (§44 questions 41-44)
41. Commit ? **NON.** 42. Push ? **NON.** 43. Deploy ? **NON.** 44. HEAD final : `bdcba2462a17f4ded3ccad188ae5024a14940f8b`, inchangé.

## Découverte connexe non corrigée (transparence, hors périmètre strict)

`server/controllers/dashboardController.js` (ligne ~65) contient une **query identique dans sa nature** à celle de Fix B — `Contrat.countDocuments({ statut: 'actif' })`, sans filtre de type — exposée dans le widget « Gestion Locative » du tableau de bord Admin global (pas la page `/dashboard/gestion-locative` auditée). **Cette surface n'a jamais été tracée par `AUDIT-RENTAL-MANAGEMENT-ENROLLMENT-1`** (absente des 4 documents source). Conformément à l'interdiction explicite de nouvel audit horizontal ou d'extension de périmètre sans preuve déjà établie, **ce fichier n'a pas été modifié**. Signalé ici pour décision humaine future — même root cause, correctif potentiellement trivial et identique (`type: 'location'` ajouté au filtre), mais nécessiterait d'être confirmé par un audit ou une décision dédiée avant correction.

## Décision

Les 7 constats de l'audit (Findings 1 à 7) sont respectés : le modèle `RentalManagement` n'a pas été touché, le workflow d'enrôlement est intact, Vacants/Publiés/Biens gérés sont inchangés, et les trois anomalies ciblées (libellé trompeur, contrats de vente comptés comme locatifs actifs, maintenance overview non tenant-scopée) sont corrigées et prouvées RED→GREEN par des tests permanents.

**Verdict final : A. RENTAL MANAGEMENT DASHBOARD HOTFIX CERTIFIED GREEN.**
