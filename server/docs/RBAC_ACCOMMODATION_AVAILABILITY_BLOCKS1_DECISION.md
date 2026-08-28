# RBAC-ACCOMMODATION-AVAILABILITY-BLOCKS-1 — Décision

## Verdict retenu

**A. CERTIFIÉ VERT — RBAC-FINAL-01 CLOSED.**

## Justification

Le contrat métier a été prouvé par symétrie directe sur la même ressource (`calendar`, `createBlock`, `deleteBlock` appliquent tous, indépendamment, `isStaff(4 rôles) || owner===user.id`) — pas supposé. Le rouge a été reproduit en conditions réelles (3/12 tests échoués, tous et uniquement pour les acteurs sans autorité légitime : Client, Proprietaire non-owner, staff hors périmètre). Le correctif applique la garde canonique déjà existante, dans le seul endroit où elle manquait, sans toucher à la frontière tenant HZ-02, sans réduire aucune capacité Admin/staff/Proprietaire légitime, sans middleware nouveau. Tous les gates de non-régression sont verts.

## Ce que cette décision NE dit PAS

Elle ne dit pas que la sécurité Accommodation est désormais parfaite — les domaines listés `UNKNOWN` par `TENANT_SCOPE_HORIZONTAL_FINAL_AUDIT1_*` restent non ré-audités. Elle ne dit pas non plus que ce correctif règle `messageController.getMessages` (finding distinct, explicitement non touché ici).

## Prochaine étape recommandée (non exécutée)

Conformément au mandat §69 : **ne pas** lancer immédiatement `TENANT-SCOPE-HORIZONTAL-CLOSURE-REAUDIT-1`. Le finding découvert pendant `HOTFIX-MESSAGING-TENANT-AMBIGUOUS-STAFF-1` (`messageController.getMessages` semble manquer d'un contrôle participant/staff) doit d'abord être **caractérisé** — sans correctif automatique — via un mandat dédié : `MESSAGING-MESSAGE-READ-AUTHORITY-ASSESSMENT-1`. Ce n'est qu'après cette caractérisation (et sa correction si confirmée) qu'un audit de clôture de la campagne tenant-scope aurait un périmètre complet.
