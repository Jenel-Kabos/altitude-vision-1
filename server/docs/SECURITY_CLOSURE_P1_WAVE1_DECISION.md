# SECURITY-CLOSURE-P1-WAVE-1 — Décision

## Verdict : **A. P1 WAVE CERTIFIED GREEN — 10/10 CLOSED**

| Lot | ID | Statut |
|---|---|---|
| P1-A | RA-04 (Contrat liste) | **CLOSED** |
| P1-B | RA-06 (Visites) | **CLOSED** |
| P1-C | RA-07 (Litiges/Signalements) | **CLOSED** |
| P1-D | RA-08 (Candidatures immobilières) | **CLOSED** |
| P1-E | RA-10 (Accommodation updateFull) | **CLOSED** |
| P1-F | RA-11 (Sale/Rental Property updateFull) | **CLOSED** |
| P1-G | RA-12 (Property asset transition) | **CLOSED** |
| P1-H | RA-13 (Hotel staff assignment) | **CLOSED** |
| P1-I | RA-14 (Transactions) | **CLOSED** |
| P1-J | RA-15 (Locataire/Proprietaire listes) | **CLOSED** |

**Note de comptage** (transparence, voir `_SOURCE_FINDINGS.md`) : le backlog source contenait en réalité 10 findings distincts (RA-04, 06, 07, 08, 10, 11, 12, 13, 14, 15), malgré une erreur de comptage en prose dans le résumé du sprint précédent qui les annonçait comme « 9 ». Les 10 ont été traités et fermés — aucun n'a été omis, aucun n'a été inventé.

## Critères du verdict A, vérifiés un par un

- 10/10 P1 fermés, chacun avec reproduction rouge réelle puis correctif prouvé vert. ✅
- Security cluster 100 % (18 suites / 138 tests). ✅
- P0 Wave non régressée (4 suites P0 + Message Read Authority + HF-FINAL-01 + RBAC-FINAL-01, toutes vertes). ✅
- Backend complet 100 % (141/141 suites, 1579/1579 tests). ✅
- Mongo exhaustif 100 % (126/126 suites, 1263/1263 tests). ✅
- Architecture PASS, 0 nouvelle violation. ✅
- Lint 0 nouvelle erreur (108 avertissements, identique à la baseline). ✅
- diff-check vert. ✅
- Aucun changement schema/migration. ✅
- Aucun P2/P3 corrigé accidentellement (RA-16 à RA-22 restent hors périmètre, statuts inchangés). ✅
- HZ-08/HZ-09/errorMiddleware inchangés. ✅
- Aucun commit/push/deploy. ✅

## Ce qui a été corrigé (rappel synthétique par domaine)

- **Gestion Locative** (P1-A, P1-J) : `contratController.getAll`, `locataireController.getAll/listDossiers/:id/dossier`, `proprietaireController.getAll` scopés via la relation canonique `Property.owner → OrgMembership` (jamais un champ tenant inventé, ces modèles n'en ont pas).
- **Visites** (P1-B) : `visiteController.*` scopé via `Visite.property → Property.owner`, le champ `Visite.tenant` existant mais jamais peuplé n'étant pas exploitable.
- **Litiges/Signalements** (P1-C) : `litigeController.*`/`signalementController.*` scopés via `bienConcerné`/`property`, réutilisant les `resourceType` déjà déclarés dans `tenantResourceAttributionService`.
- **Candidatures** (P1-D) : `realEstateApplicationController.*` — vérification tenant appliquée UNIQUEMENT quand l'accès est accordé via le statut staff, jamais pour le propriétaire/candidat légitime.
- **Accommodation/Property Sprint A** (P1-E, P1-F) : `accommodationController.updateFull`/`salePropertyController.updateFull`/`rentalPropertyController.updateFull` alignés sur les gardes déjà canoniques du reste de leurs fichiers respectifs.
- **Property lifecycle** (P1-G) : `propertyAssetController.transition` — ajout d'une frontière tenant (pas un simple doublon du RBAC déjà garanti par la route).
- **Hotel** (P1-H) : `hotelStaffAssignmentController.*` — recroisement systématique `assignment.hotel` vs `hotelId` de l'URL.
- **Transactions** (P1-I) : `transactionController.*`/`paiementTransactionController.*` scopés via `Transaction.property`, avec résolution tenant en ligne (pas de garde de route fail-closed) pour les endpoints unitaires, fail-closed pour les listes.

## Discipline de reproduction rouge respectée

Pour chacun des 10 lots, le correctif a été **temporairement désactivé** (technique de commentaire ciblé, jamais un revert de fichier entier — leçon tirée d'un faux-négatif rencontré sur P1-E où un revert de fichier complet avait par erreur annulé un correctif d'architecture préexistant sans rapport), la suite permanente exécutée pour observer l'échec exact attendu, puis le correctif restauré et la suite re-exécutée pour confirmer le passage au vert.

## Transparence sur les régressions rencontrées en cours de route

Documentées en détail dans `_GATE_MATRIX.md` : 5 régressions unitaires (mocks de test incomplets, une assertion obsolète mise à jour pour refléter son intention réelle) et 1 régression d'intégration (garde de route trop strict pour un cas legacy non attribué, corrigé en appliquant la même leçon déjà tirée de P0-C). Chacune a été diagnostiquée avant d'être corrigée, jamais supposée être un flake sans preuve, et aucune n'a affaibli la sécurité visée par les 10 correctifs.

## Prochaine étape (§80-81 du mandat)

Conformément à la trajectoire : **P0 WAVE (terminée) → P1 WAVE (ce sprint, terminé) → UN SEUL `SECURITY-FINAL-CLOSURE-AUDIT-1` → RELEASE CONSOLIDATION**. Ce mandat ne démarre PAS le closure audit final — cette décision revient à un mandat séparé. Aucun commit, push ou déploiement n'a été effectué ni ne doit l'être avant ce closure audit.
