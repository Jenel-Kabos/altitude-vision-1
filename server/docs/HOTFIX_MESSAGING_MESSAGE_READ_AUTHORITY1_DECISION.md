# HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1 — Décision

## Verdict : **A. CERTIFIÉ VERT**

## Justification (critères du mandat, §63)

| Critère de préservation | Statut |
|---|---|
| Reproduction rouge archivée en permanence | ✅ `messageReadAuthority.mongo.integration.test.js`, 14 tests, conservé |
| Client/Proprietaire non-participant refusés | ✅ tests 1, 2 |
| Cross-tenant non autorisé refusé | ✅ test 3, test 9 |
| Autorité staff tenant-wide sur conversation privée d'un collègue PRÉSERVÉE (pas fermée, pas inventée) | ✅ test 5, documenté explicitement dans `_EXISTING_CONTRACT.md` et `_AUTHORITY_MATRIX.md` |
| Autorité Admin préservée | ✅ test 6 |
| Autorité PlatformOperator (scopé) préservée | ✅ test 7 |
| HF-FINAL-01 intact (non modifié, non affaibli) | ✅ tests 8, 9, 10 ; middleware non touché ; 24/24 HF-FINAL-01 dédié |
| Lecture refusée ne modifie pas `isRead` | ✅ test dédié, PASS |
| Lecture autorisée conserve le comportement historique de `isRead` | ✅ test dédié, PASS (jamais rouge) |
| Payload/serializer/attachments/RBAC/middleware tenant inchangés | ✅ `_NON_REGRESSION.md`, `_DIFF_SCOPE.md` |
| Aucune nouvelle politique Messaging inventée | ✅ réutilisation verbatim de `assertConversationAccess`, prouvée par 4 sites d'appel préexistants |
| HEAD git inchangé, aucun commit/push | ✅ `a04055f62952c782b92aeef2f100824a17a5f645` avant/après |
| Toutes les portes obligatoires vertes | ✅ voir `_GATE_MATRIX.md` — Mongo exhaustif 112/112 suites, 1177/1177 tests |

## Ce que ce hotfix corrige

`GET /api/messages/:conversationId` exige désormais la même autorité Messaging canonique que les 4 fonctions sœurs de `conversationController.js` : tenant résolu-ou-non-attribué **ET** (staff du tenant **OU** participant réel). Avant ce hotfix, seule la première moitié de cette condition était appliquée, et uniquement pour les acteurs ayant un `req.platformTenant` résolu (jamais Client/Proprietaire) — permettant à tout utilisateur authentifié connaissant un `conversationId` de lire son contenu et d'en altérer `isRead`, indépendamment de toute participation ou autorité staff.

## Ce que ce hotfix préserve délibérément (et pourquoi ce n'est pas un gap résiduel)

L'autorité « tout staff du tenant peut lire toute conversation de ce tenant, y compris une conversation privée d'un collègue » est un comportement déjà en production, indépendamment implémenté 4 fois avant ce hotfix, documenté explicitement dans l'historique du projet (`HOTFIX_MSG_STAFF_INBOX1_REPORT.md`). Le mandat interdit explicitement d'inventer une nouvelle politique Messaging ; fermer ce cas aurait constitué exactement cela. Ce point est documenté, testé (test 5, jamais rouge), et n'est **pas** ambigu au sens du §65 du mandat (qui exigerait un `BLOCKED` en cas de doute réel) : la preuve est positive et multiple, pas une simple absence de contre-preuve.

## Suite recommandée (non démarrée dans ce mandat, conformément au §67)

`TENANT-SCOPE-HORIZONTAL-CLOSURE-REAUDIT-1` reste la suite logique de cette série de hotfix, mais son démarrage relève d'une décision ultérieure explicite, hors du périmètre de ce mandat.
