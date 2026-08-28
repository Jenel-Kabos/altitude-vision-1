# HOTFIX-MESSAGING-TENANT-AMBIGUOUS-STAFF-1 — Contrat de comportement

| Scénario | Avant | Après |
|---|---|---|
| Staff single-tenant, aucune sélection | Résolution automatique, accès à son tenant | **Inchangé** |
| Staff multi-tenant, **aucun en-tête** | 200, accès cross-tenant (A+B mélangés en liste ; lecture/suppression/envoi cross-tenant réussis) | **403** sur toutes les surfaces corrigées |
| Staff multi-tenant + en-tête A | 200, A uniquement (déjà correct quand un tenant était résolu) | **Inchangé** |
| Staff multi-tenant + en-tête B | 200, B uniquement | **Inchangé** |
| En-tête invalide (tenant sans adhésion) | 403 (déjà correct pour les listes bornées ; incohérent pour les routes non gardées) | **403 partout, cohérent** |
| PlatformOperator global (aucune sélection) | 200, accès de facto à tout tenant (c'était HF-FINAL-01) | **403** — aligné sur `/count/unread`, jamais de mode plateforme natif pour Messaging |
| PlatformOperator scopé A/B | Tenant sélectionné uniquement | **Inchangé** |
| DETAIL même tenant | 200 | **Inchangé** |
| DETAIL tenant croisé (les deux résolus, différents) | 500 (défaut de sérialisation pré-existant, hors périmètre) | **Inchangé** (non corrigé, documenté séparément) |
| DELETE même tenant | Historique | **Inchangé** |
| DELETE tenant croisé | 500 (idem) | **Inchangé** |
| SEND même tenant | Historique | **Inchangé** |
| SEND tenant croisé | 500 (idem) | **Inchangé** |
| Unread (`/count/unread`) | 403 si ambigu (déjà correct) | **Inchangé** |

## Résumé du contrat cible atteint

`AMBIGU = 403` · `SCOPED A = A` · `SCOPED B = B` · `PO GLOBAL = 403 (jamais de portée globale native pour Messaging)` · `PO SCOPED = tenant sélectionné` · aucun changement RBAC, aucun changement de règle métier de messagerie, aucun changement du serializer, aucun changement du contrat Socket.IO.
