# HOTFIX-ACCOMMODATION-RESERVATION-TENANT-SCOPE-1 — Rapport

## Verdict

**GO SOUS RÉSERVE — NON CERTIFIÉ VERT.** La correction et la matrice Mongo ciblée sont vertes, mais le protocole exigeait une capture runtime rouge avant correction ainsi que Mongo exhaustif et backend complet ; ces preuves ne sont pas toutes acquises dans ce run.

## Résultat

- Cinq endpoints vivants protégés, sans élargissement de périmètre.
- Tenant direct canonique : `AccommodationReservation.tenant` (`PlatformTenant`).
- Staff sans tenant : 403 fail-closed ; cross-tenant : 404 anti-énumération.
- Même document autorisé puis muté ; aucun second lookup ObjectId non scopé.
- A→A, A→B, B→B, B→A sur les cinq actions : 20 cas Mongo, plus staff sans tenant ; 21/21 verts.
- Sur refus : statut/historique, notifications, documents financiers et locks inchangés.
- Architecture finale : 471 fichiers, 1529 edges, dettes contraintes inchangées (2/1/12), cycles 0, unresolved 0, nouvelles violations 0, PASS.
- Aucun frontend/mobile/schema/migration/production/commit/push/deploy.

## Gates exécutés

| Gate | Résultat |
|---|---|
| Matrice tenant Mongo ciblée | 21/21 verts |
| Lifecycle/finance AccommodationReservation | 14/14 verts |
| Architecture | PASS ; 2/1/12, cycles 0, unresolved 0, violations 0 |
| Lint backend | 0 erreur, 109 warnings existants |
| Lint fichiers touchés | 0 erreur ; 1 warning préexistant dans le controller |
| `git diff --check` | Vert ; seuls 3 warnings CRLF préexistants |
| Mongo exhaustif | NON EXÉCUTÉ |
| Backend complet | NON EXÉCUTÉ |

## Réponses 1–135

1–5. HEAD `a04055f...`; branche `main`; worktree initial sale ; baseline ci-dessus ; finding statique revalidé. 6–15. Cinq mutations, endpoints/handlers listés dans la matrice ; routes montées, auth présente, RBAC staff présent mais tenant resolver/authorization absents avant ; ownership owner/guest présent. 16–20. Relation directe via `AccommodationReservation.tenant`, Model `PlatformTenant`; c'est la source canonique.

21–40. Réservations et Admin A/B créés sur Mongo ; après correction A→A/B→B réussissent et A→B/B→A échouent pour les cinq actions. Vulnérabilité runtime avant correction : NON CONFIRMÉE faute de capture rouge archivée ; aucune route morte ; suite finale 21 tests utilisant vrais endpoints/handlers. 41–56. États fixtures : pending, confirmed, checked_in selon transition. Cause : rôle staff global + lookup ObjectId. Primitive canonique réutilisée ; politique générique exportée, middleware route puis query `{_id, tenant}` controller ; TOCTOU réduit par passage du même document ; 404 anti-énumération.

57–78. Staff sans tenant 403 ; Admin A/B isolés. PlatformOperator global/scoped préservé par le garde canonique mais test runtime spécifique dans cette suite : NON CONFIRMÉ. Proprietaire/Client restent sur l'ownership service, non modifié. Les cinq comportements autorisés sont verts. KPI/lifecycle/statuts/rôles/IAM/schema/migration : non modifiés.

79–98. Confirm crée une facture sur chemin autorisé. La création cross-tenant avant était statiquement atteignable mais runtime : NON CONFIRMÉE. Après : zéro facture. Confirm crée des locks ; cancel/no-show en suppriment ; check-in/out posent timestamps. Tous restent inchangés sur refus. Notifications : zéro sur refus. Webhook/Cloudinary : aucun.

99–116. 21 tests adversariaux Mongo ciblés verts ; facture et availability couvertes. Mongo exhaustif/backend complet : NON CONFIRMÉS dans ce run. Checker/architecture PASS ; final 2 service→controller, 1 controller→controller, 12 route→model, 0 cycle, stale/dangling 3, unresolved 0, violations 0. Lint et diff-check : voir gates, à finaliser.

117–135. Frontend/mobile/autres six P0/listes/calendrier/HotelReservation/Hotel admin/Property moderation : non touchés. Aucune règle métier ajoutée/supprimée ; production non mutée ; aucun commit/push/deploy. Vulnérabilité statique confirmée, runtime historique NON CONFIRMÉ ; sévérité P0 par impact potentiel. Aucune voie connue sur ces cinq routes après patch ; autres P0 restent hors périmètre. Prochain P0 recommandé : calendrier/blocages Accommodation. Verdict : GO SOUS RÉSERVE, non certifié vert.
