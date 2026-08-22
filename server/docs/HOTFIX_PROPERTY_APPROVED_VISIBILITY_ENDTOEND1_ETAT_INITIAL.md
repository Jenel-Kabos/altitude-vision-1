# HOTFIX-PROPERTY-APPROVED-VISIBILITY-ENDTOEND-1 — État initial

Date : 2026-08-22. Branche `main`. `HEAD` = `63880f58ff41bd805b828d07603d878d55122d45`. `git status --short` vide, `git diff --check` exit 0, `git diff --stat` vide — worktree strictement propre au démarrage (aucun travail externe préexistant à préserver au-delà de ce qui est déjà commité).

## Rapports précédents relus avant travail

- `HOTFIX_PROPERTY_PUBLICATION_VISIBILITY1_REPORT.md` : avait déjà diagnostiqué exactement le même document (`_id` masqué `6a887b…e4ec`, `PARCELLE A VENDRE`) dans l'état `status=vente, statusAdmin=Validée, isPublished=false`, corrigé le workflow de validation pour publier atomiquement, et conclu **GO SOUS RÉSERVES** en prévenant explicitement : *"le document production reste `isPublished=false` jusqu'au déploiement et à une nouvelle validation/régularisation explicitement autorisée."* Ce sprint vérifie si cette réserve s'est concrétisée.
- `HOTFIX_PROPERTY_SALE_RENT_SEPARATION1_REPORT.md` : confirme `PropertyPortfolioDashboard` accepte déjà `status=vente|location`, non remis en cause ici.
- `HOTFIX_MODERATION_PROPERTY_SUBMITTER_CONTACT1_REPORT.md` : `owner` déjà le vrai soumissionnaire, non concerné.
- `AUDIT_HOTEL_MODERATION_TEST_DRIFT1_REPORT.md` : `HotelModerationPage.jsx` déjà classé amélioration frontend légitime — **non touché dans ce sprint**, conformément à l'interdiction explicite du mandat.

## Méthode d'audit du document réel

`server/.env` contient une `MONGO_URI` fonctionnelle (Atlas, base `altitudevision`) — la même base déjà interrogée/documentée par les sprints précédents (même `_id` masqué retrouvé). Une requête **strictement en lecture** (`Property.find(...).lean()`, aucun `save`/`updateOne`/`deleteOne` nulle part dans le script) a été exécutée une seule fois pour retrouver le document réel et compter les documents affectés par le même défaut — voir `HOTFIX_PROPERTY_APPROVED_VISIBILITY_ENDTOEND1_DOCUMENT_MATRIX.md` pour le résultat complet. Aucune mutation n'a été effectuée sur cette base à aucun moment de ce sprint.

## Constat immédiat

Le document réel est **exactement** dans l'état déjà documenté par le hotfix précédent (`statusAdmin='Validée'`, `isPublished=false`) — **inchangé depuis**. Ceci confirme d'emblée, avant tout audit de requête, que la réserve du hotfix précédent ("nécessite une nouvelle validation") ne s'est jamais concrétisée : personne n'a re-déclenché l'action de validation sur ce document depuis l'introduction du correctif atomique.

## Corrélation temporelle (preuve, pas supposition)

- `git log -S "classicListing" -- controllers/propertyController.js` → commit `51f581e`, horodaté `2026-08-21T23:19:15+01:00` = `2026-08-21T22:19:15Z` — introduction du correctif de publication atomique.
- Champ `reviewedAt` du document réel : `2026-08-21T21:46:33.464Z`.

**Le document a été validé 33 minutes avant l'introduction du correctif atomique.** C'est la preuve directe, horodatée, que ce document a été approuvé par l'ANCIEN code (qui ne publiait pas atomiquement), et non par une régression du code actuel.

## Plan d'audit

1. Documenter le document réel champ par champ (`DOCUMENT_MATRIX.md`).
2. Auditer indépendamment les 3 pipelines de lecture (Sales list/KPI, Tous les biens, Home) — `QUERY_MATRIX.md`.
3. Reproduire le défaut via un test d'intégration Mongo AVANT toute correction (fixture identique au document réel, passée par le vrai workflow où pertinent).
4. Rechercher les sources de vérité dupliquées du prédicat "publiquement visible".
5. Ne corriger que si une cause de CODE est prouvée — sinon documenter la dette de données et sa stratégie de réparation idempotente (jamais exécutée sur la base réelle sans autorisation explicite).
