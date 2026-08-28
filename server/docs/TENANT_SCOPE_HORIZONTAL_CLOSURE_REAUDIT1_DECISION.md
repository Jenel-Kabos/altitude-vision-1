# TENANT-SCOPE-HORIZONTAL-CLOSURE-REAUDIT-1 — Décision

## Verdict : **B. CAMPAIGN REMAINS OPEN — NEW BLOCKERS**

La campagne Tenant Scope / RBAC / Resource Authority **ne peut pas** être déclarée fermée. Ce re-audit horizontal, mené en cherchant activement à invalider les 10 certifications précédentes plutôt qu'à les reconfirmer, a permis de découvrir **14 findings CONFIRMED GAP bloquants** (RA-01 à RA-15, hors RA-16 à clarifier), dont **5 de sévérité P0** touchant des mutations financières ou destructives cross-tenant :

| ID | Endpoint | Root cause | Reproduction | Severity | Hotfix recommandé |
|---|---|---|---|---|---|
| **RA-01** | `POST /api/messages` (`sendMessage`) | Aucun `assertConversationAccess` sur le chemin d'écriture, contrairement au chemin de lecture déjà corrigé | Confirmé par lecture directe du code (2 lectures indépendantes convergentes) | **P0** | `HOTFIX-MESSAGING-SEND-MESSAGE-AUTHORITY-1` |
| **RA-02** | `GET /api/paiements`, `/stats`, `/alertes` | Filtre de liste/agrégation sans dimension tenant | **Reproduit par test Mongo+HTTP réel (3/3 PASS)** | **P0** | `HOTFIX-FINANCE-PAIEMENT-LIST-TENANT-1` |
| **RA-03** | `POST /api/paiements/encaisser-multiple` | `contrat`/`paiementId` du body jamais vérifiés contre le tenant, contourne le garde `:id` du même fichier | **Reproduit par test Mongo+HTTP réel (3/3 PASS)** | **P0** | `HOTFIX-FINANCE-ENCAISSER-MULTIPLE-TENANT-1` |
| **RA-05** | `rentalLeaseLifecycleController.*` (dont opérations de caution) | Aucun garde tenant sur un routeur séparé opérant sur le même modèle `Contrat` déjà protégé ailleurs | Confirmé par 2 agents indépendants + lecture des routes | **P0** | `HOTFIX-RENTAL-LEASE-LIFECYCLE-TENANT-1` |
| **RA-09** | `adminController.js` `/api/admin/properties*` (dont DELETE) | Duplicata legacy non aligné sur le correctif `propertyController.js`, hard-delete sans aucune autorité | Confirmé par lecture directe (route mountée live, `server.js:410`) | **P0** | `HOTFIX-ADMIN-LEGACY-PROPERTIES-TENANT-1` |

9 findings additionnels de sévérité P1 (RA-04, RA-06 à RA-08, RA-10 à RA-15) et plusieurs P2/mineurs (RA-16 à RA-19) sont documentés en détail dans `_FINDING_MATRIX.md`.

## Ce qui reste vert (ne pas confondre avec une clôture de campagne)

- Les 10 hotfixs déjà certifiés (HZ-01→HZ-07, HF-FINAL-01, RBAC-FINAL-01, HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1) restent **intégralement verts sur leur périmètre exact** — aucune régression détectée (voir `_HOTFIX_VALIDATION_MATRIX.md`).
- Le sous-système financier « Sprint Finance » (FinancialDocument/FinancialPayment/Allocation, hôtel) reste **SAFE**, contrastant nettement avec le sous-système « Gestion Locative legacy » qui, lui, est vulnérable.
- HZ-08 et HZ-09 restent à leur statut précédent (P2/DEFERRED et P3/RECLASSIFIED respectivement) — aucune nouvelle preuve d'exploitation ne les aggrave.
- `errorMiddleware.js` (500 au lieu de 404/403) reste une dette de sérialisation non bloquante pour la sécurité, non aggravée.
- `controller → controller` reste à 1, architecture PASS, lint PASS, backend complet et Mongo exhaustif 100 % — toutes les portes techniques sont vertes (voir `_GATE_MATRIX.md`), ce qui confirme qu'aucune régression de code n'a eu lieu, mais ne suffit pas à fermer la campagne puisque les findings ci-dessus touchent des surfaces jamais couvertes par un test permanent.

## Pourquoi ce n'est pas simplement « le même travail à refaire »

Le mandat demandait explicitement (§10) de ne pas se contenter de rejouer les tests déjà verts, et de chercher activement hors des findings déjà nommés (§88). Les 14 findings confirmés ici sont tous des surfaces **jamais nommées** par un mandat antérieur — souvent des routes sœurs du même fichier ou du même modèle qu'un hotfix déjà certifié, mais dans un fichier de routes différent ou contournant le paramètre `:id` déjà protégé. Ceci confirme la même méthode de découverte qui avait permis de trouver le P0 `getMessages` lors de l'audit précédent.

## Prochaine étape

Conformément au mandat (§86), ce constat s'arrête ici : **aucun correctif n'a été appliqué**, aucun code de production n'a été modifié, uniquement des documents et un test temporaire (créé puis supprimé) ont existé pendant ce mandat. La prochaine étape recommandée est l'ouverture d'une série de hotfixs ciblés (au minimum les 5 listés en P0 ci-dessus), suivant exactement la même méthodologie « reproduction rouge permanente → correction minimale → certification complète » que les hotfixs précédents de cette campagne — **pas** `TENANT-SCOPE-HORIZONTAL-CLOSURE-REAUDIT-1` à nouveau, et **pas** `RELEASE-CONSOLIDATION-SECURITY-1` (réservé au verdict A, non atteint ici).
