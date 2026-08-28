# TENANT-SCOPE-HORIZONTAL-FINAL-AUDIT-1 — Décision

## Verdict retenu

**B. AUDIT FINAL — NEW P0/P1 IDENTIFIED — CAMPAIGN REMAINS OPEN.**

## Justification

Un P0 (HF-FINAL-01) a été démontré en conditions réelles (HTTP + Mongo réels, pas une hypothèse statique) : un membre du staff appartenant légitimement à deux tenants, sans sélection explicite d'un tenant, peut lire, faire disparaître (suppression réelle confirmée) et écrire dans les conversations partagées d'un tenant tiers via `/api/conversations/staff-inbox` et les routes de détail associées. Le critère de certification n°1 du mandat (« aucune nouvelle fuite P0/P1 tenant-scope démontrée ») n'est pas rempli — la campagne ne peut donc pas être formellement clôturée, indépendamment de l'état par ailleurs sain des autres critères (HZ-01→HZ-07 verts, HZ-08/HZ-09 correctement isolés, architecture inchangée, aucun code de production modifié).

Un second finding (RBAC-FINAL-01) confirme qu'un problème RBAC déjà connu et cité par le mandat (`GET /availability-blocks`) est toujours présent — classé séparément, ne change pas le verdict à lui seul, mais renforce la recommandation de ne pas clôturer sans traitement d'au moins le finding P0.

## Ce que cette décision NE dit PAS

Elle ne dit pas que HZ-01→HZ-09 sont remis en cause — ils restent dans l'état exact où les audits précédents les ont laissés, revérifiés vert ce sprint. Elle ne dit pas non plus que tout le reste du système est vulnérable — les domaines audités en profondeur ce sprint en dehors de Messaging (Dev Portal, Dashboard Analytics) sont CLEAN.

## Prochaine étape recommandée (non exécutée)

1. **Prioritaire** : `HOTFIX-MESSAGING-TENANT-AMBIGUOUS-STAFF-1` — corriger HF-FINAL-01 avant toute autre action de clôture de campagne.
2. Sprint RBAC dédié pour RBAC-FINAL-01 (`availability-blocks`).
3. Une fois ces deux points traités et revérifiés, relancer un audit final horizontal de clôture (potentiellement `TENANT-SCOPE-HORIZONTAL-FINAL-AUDIT-2`) plutôt que de supposer la clôture acquise.
4. `RELEASE-CONSOLIDATION-SECURITY-1` reste pertinent mais ne doit pas être entamé avant la fermeture d'HF-FINAL-01 — un release de consolidation sur un P0 confirmé ouvert exposerait ce même risque en production.
