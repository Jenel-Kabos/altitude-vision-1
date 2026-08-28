# MESSAGING-MESSAGE-READ-AUTHORITY-ASSESSMENT-1 — Couverture de tests existante

| Scenario | Covered? | Test file |
|---|---|---|
| `getMessages` — participant lit sa propre conversation | Non | Aucun |
| `getMessages` — non-participant Client lit une conversation étrangère | Non | Aucun |
| `getMessages` — staff même tenant, non-participant, conversation privée | Non | Aucun |
| `getMessages` — staff tenant différent | Non directement, mais couvert indirectement par la garde partagée `requireTenantScopeForStaffOrPlatformOperator` testée dans `messagingTenantAmbiguousStaff.mongo.integration.test.js` (HF-FINAL-01) pour la même garde appliquée à d'autres routes du même fichier | `messagingTenantAmbiguousStaff.mongo.integration.test.js` (indirect) |
| `getMessages` — staff sans tenant résolu | Idem — indirect via la même garde partagée | idem |
| `getMessages` — effet de bord `isRead` | Non | Aucun |
| `sendMessage` (voisin) — tenant ambigu | Oui | `messagingTenantAmbiguousStaff.mongo.integration.test.js` |
| `markAsRead`/`deleteMessage` (voisins) — ownership | Non testés explicitement dans une suite dédiée trouvée, mais protection déjà présente dans le code (ownership stricte, vérifiée par lecture) | `NON CONFIRMÉ` par un test automatisé dédié — risque de régression future non détecté si cette protection venait à être retirée |
| `downloadAttachment` (voisin) — participant/staff | Non testé explicitement dans une suite dédiée trouvée pour ce contrôle précis | `NON CONFIRMÉ` |

## Constat

`grep -rln "getMessages|messageController" __tests__/*.test.js` (hors le fichier temporaire de reproduction, supprimé) → **aucun résultat**. `messageController.js::getMessages` n'a **jamais** eu de test dédié dans ce projet, à aucun moment — ni positif, ni négatif. C'est un angle mort de couverture total, cohérent avec le fait que ce finding n'a été découvert que par inspection manuelle lors d'un autre hotfix (HF-FINAL-01), jamais par une suite automatisée.

## Gap principal

Absence totale de suite `*TenantScope*`/`*Authority*` dédiée à `messageController.getMessages`, alors que ce pattern de test existe systématiquement pour tous les domaines HZ-01→HZ-07 et pour HF-FINAL-01/RBAC-FINAL-01. Un futur hotfix devrait introduire une suite permanente couvrant au minimum les scénarios listés ci-dessus comme non couverts.
