# SECURITY-CLOSURE-P0-WAVE-1 — Décision

## Verdict : **A. P0 WAVE CERTIFIED GREEN — 5/5 CLOSED**

| Lot | ID | Statut |
|---|---|---|
| P0-A | RA-01 (Messaging `sendMessage`) | **CLOSED** |
| P0-B | RA-02 (Paiement listes/stats/alertes) | **CLOSED** |
| P0-C | RA-03 (encaissement multiple) | **CLOSED** |
| P0-D | RA-05 (lease lifecycle) | **CLOSED** |
| P0-E | RA-09 (admin properties legacy) | **CLOSED** |

## Critères du verdict A, vérifiés un par un

- 5/5 P0 fermés, chacun avec reproduction rouge réelle puis correctif prouvé vert. ✅
- Security cluster 100 % (208/208). ✅
- Backend 100 % (141/141 suites, 1579/1579 tests, deux flakes isolés confirmés non-régressions). ✅
- Mongo exhaustif 100 % (116/116 suites, 1212/1212 tests, un flake de timeout isolé confirmé non-régression par isolation + ré-exécution complète propre). ✅
- Architecture PASS, 0 nouvelle violation. ✅
- Lint 0 nouvelle erreur (108 avertissements, identique à la baseline). ✅
- diff-check vert (4 avertissements CRLF pré-existants inchangés). ✅
- Aucun frontend/mobile/schema/migration touché. ✅
- Aucun P1 corrigé accidentellement — les 9 P1 du re-audit restent explicitement ouverts (`_P1_BACKLOG.md`). ✅

## Ce qui a été corrigé (rappel synthétique)

- **P0-A** : `sendMessage` réutilise désormais `assertConversationAccess`, exactement comme `getMessages` (hotfix précédent).
- **P0-B** : `getAll/getStats/getAlertes` de `paiementController.js` filtrent désormais par tenant via la relation canonique `Property.owner → OrgMembership` (pas un champ `tenant` dénormalisé), derrière `requireTenantScopeForStaffOrPlatformOperator`.
- **P0-C** : `encaisserMultiple` vérifie désormais l'autorité tenant du `Contrat` ciblé avant toute mutation, avec la même tolérance « non attribué » que les routes `:id` du même fichier.
- **P0-D** : `rentalLeaseLifecycleRoutes.js` reçoit le même `router.param('id')` tenant que `contratRoutes.js`, implémenté dans le contrôleur pour ne pas créer de nouvel edge route→model.
- **P0-E** : `adminController.js` (flux Property legacy) reçoit le même garde et la même autorité tenant que le flux canonique `propertyController.js` (HZ-07), y compris sur le hard-delete.

## Discipline de reproduction rouge respectée

Pour chacun des 5 lots, le correctif a été **temporairement désactivé** (via patch git réversible ou commentaire), la suite permanente exécutée pour observer l'échec exact attendu, puis le correctif restauré et la suite re-exécutée pour confirmer le passage au vert — jamais un correctif appliqué puis simplement supposé fonctionner.

## Transparence sur les 4 ajustements effectués en cours de route

Documentés en détail dans `_GATE_MATRIX.md` : une correction d'architecture (édge route→model évité), une correction de mock manquant dans un test préexistant, une correction de portée du garde tenant (fail-closed déplacé du niveau route vers une vérification de ressource précise dans `encaisserMultiple`, pour ne pas casser un Contrat legacy non attribué), et une correction de lint. Chacune a été re-vérifiée avant de poursuivre — aucune n'a affaibli la sécurité des correctifs, toutes ont soit corrigé une régression introduite par erreur, soit amélioré la fidélité au contrat canonique déjà établi ailleurs dans la campagne.

## Prochaine étape (§49 du mandat)

Ne pas relancer un audit horizontal complet immédiatement. Prochaine étape recommandée : **`SECURITY-CLOSURE-P1-WAVE-1`**, pour traiter les 9 P1 restants (voir `_P1_BACKLOG.md`) selon la même méthodologie en vague contrôlée. Ensuite seulement : un unique audit de clôture final, puis `RELEASE-CONSOLIDATION-SECURITY-1`.
