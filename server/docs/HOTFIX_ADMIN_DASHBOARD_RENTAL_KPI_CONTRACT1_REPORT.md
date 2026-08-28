# HOTFIX-ADMIN-DASHBOARD-RENTAL-KPI-CONTRACT-1 — Rapport

**Verdict : A. ADMIN DASHBOARD RENTAL KPI CONTRACT CERTIFIED GREEN**
**Aucun commit, push ou déploiement.**

## Réponses aux questions obligatoires (§31)

1. HEAD initial : `bdcba2462a17f4ded3ccad188ae5024a14940f8b` — inchangé (aucun commit). 2. Route live confirmée : `GET /api/dashboard/stats` (`server/routes/dashboardRoutes.js`). 3. Handler live : fonction inline du routeur, protégée par `auth.protect` + `restrictTo(...STAFF_ALL)` + `requireTenantScope`. 4. Service live : `getDashboardKpis` (`server/services/dashboardKpiQueryService.js`), issu de l'extraction ARCH2. 5. `dashboardController.js` confirmé mort : **oui**, reconfirmé (`grep -rn "require.*dashboardController"` → 0 résultat), **non modifié** dans ce mandat.

6. Champ frontend lu (avant) : `data.kpis?.gestionLocative?.contratsActifs`. 7. Champ backend réellement absent : `data.kpis` n'existe pas du tout dans la réponse — seul `data.stats` (objet plat) existe. 8. Pourquoi le widget affichait 0 : l'expression optionnelle-chaînée retombait systématiquement sur `?? 0`, quel que soit le nombre réel de contrats.

9. Nouveau champ API : `RentalActiveContracts`, ajouté à l'objet plat déjà retourné par `getDashboardKpis` (aux côtés de `Altimmo`, `MilaEvents`, `Altcom`, `Users`, `Owners`). 10. Ajouté dans : `server/services/dashboardKpiQueryService.js`. 11. Query exacte : `Contrat.countDocuments({ bien: { $in: propertyIds }, type: 'location', statut: 'actif' })`, où `propertyIds = await Property.find({ owner: { $in: scopeUserIds } }).distinct('_id')`. 12. Filtre type location : **oui** (`type: 'location'`). 13. Filtre statut actif : **oui** (`statut: 'actif'`). 14. Scope tenant préservé : **oui** — réutilise exactement le `scopeUserIds` déjà résolu par `requireTenantScope` et déjà transmis à `getDashboardKpis`, la même autorité que celle utilisée par le KPI `Altimmo` voisin (`getPropertyPortfolioForTenantScope`) ; aucun second mécanisme de résolution tenant introduit.

15. Contrat location actif compté ? **Oui**, prouvé (test Mongo : 1). 16. Contrat vente actif exclu ? **Oui**, prouvé RED→GREEN (2 puis 1 après restauration du filtre). 17. Contrat location expiré exclu ? **Oui**, prouvé (fixture `statut:'expiré'` non comptée). 18. Tenant B exclu pour Tenant A ? **Oui**, prouvé par test dédié (« isolation tenant »).

19. Test RED backend : **oui**, désactivation ciblée temporaire du filtre `type:'location'` → 2 tests échoués (2 au lieu de 1) sur la suite Mongo dédiée. 20. Test GREEN backend : **oui**, 5/5 après restauration. 21. Test frontend : **oui**, RED (mapping `data.kpis.gestionLocative...` retourne 0 au lieu de 3) → GREEN (3/3) après correction du mapping. 22. Cas zéro : **oui**, testé explicitement des deux côtés (backend : `RentalActiveContracts: 0` sans erreur ; frontend : `contratsActifs: 0`, jamais `undefined`/`NaN`).

23. Autres KPI modifiés ? **Non** — `Altimmo`, `MilaEvents`, `Altcom`, `Users`, `Owners` inchangés (vérifié par les tests existants toujours verts avec les mêmes valeurs). 24. `dashboardController.js` modifié ? **NON**, confirmé — non touché, non branché, non supprimé. 25. API breaking change ? **Non** — le nouveau champ est additif ; aucun champ existant renommé/supprimé ; le frontend continue de recevoir/exposer la même clé publique `contratsActifs`. 26. Hotfix RM (Rental Management Dashboard Semantics) préservé ? **Oui**, diffs identiques avant/après (`RentalStats.jsx` +5/-1, `GestionLocativePage.jsx` +1/-1, `rentalMaintenanceController.js` +9/-2 — inchangés). 27. Fix Inbox préservé ? **Oui**, diffs identiques avant/après (`InternalMessagingPage.jsx` +5/-5, `InternalMessagingPageUX.test.jsx` +23) — **aucune modification** dans ce mandat.

28. Tests ciblés : **backend** — `dashboardKpiQueryService.test.js` (5/5), `dashboardKpiRouteBoundary.test.js` (5/5), `dashboardKpiQueryService.mongo.integration.test.js` (5/5) = **3 suites, 15 tests, tous PASS**. **Frontend** — `dashboardService.test.js` (3/3, nouveau). 29. Architecture : **PASS**, 473 files, 1574 edges, 0 nouvelle violation. 30. Lint backend : **0 erreur, 104 warnings** (identique à la dernière mesure). 31. Lint frontend : **0 erreur, 267 warnings** (identique). 32. Next build : **PASS**, exit 0. 33. `git diff --check` : **PASS**, aucun avertissement.

34. Mongo production ? **NON** — tous les tests utilisent `mongodb-memory-server`. 35. Migration ? **NON** — aucun changement de schéma. 36. Mobile ? **NON modifié.** 37. Commit ? **NON.** 38. Push ? **NON.** 39. Deploy ? **NON.** 40. HEAD final : `bdcba2462a17f4ded3ccad188ae5024a14940f8b`, inchangé.

41. **Verdict : A. ADMIN DASHBOARD RENTAL KPI CONTRACT CERTIFIED GREEN.**

## Fichiers de ce mandat (périmètre exact)

- `server/services/dashboardKpiQueryService.js` — ajout de `countActiveRentalContractsForTenantScope` + champ `RentalActiveContracts`.
- `server/__tests__/dashboardKpiQueryService.test.js` — mocks `Property`/`Contrat` ajoutés, 3 tests existants mis à jour (nouveau champ), 2 nouveaux tests ciblés.
- `server/__tests__/dashboardKpiRouteBoundary.test.js` — mocks étendus, 3 tests existants mis à jour, 1 nouveau test de bout-en-bout HTTP.
- `server/__tests__/dashboardKpiQueryService.mongo.integration.test.js` — 2 tests existants mis à jour, 3 nouveaux tests (définition métier, isolation tenant, cas zéro).
- `client/lib/services/dashboardService.js` — mapping `contratsActifs` corrigé pour lire `data.stats.RentalActiveContracts`.
- `client/lib/__tests__/dashboardService.test.js` — nouveau, 3 tests RED→GREEN.

**Non modifié** (confirmé) : `dashboardController.js` (code mort, laissé tel quel), tout autre widget/KPI, `DashboardHome.jsx` (design inchangé, seule la source de données en amont change), toute logique tenant existante, le fix Inbox, le hotfix RM Dashboard Semantics.
