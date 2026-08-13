# PLATFORM-ADMIN-BOOTSTRAP-1 — Audit du mécanisme de bootstrap existant

Date : 2026-08-12
Dépôt : `/Users/apple/Documents/GitHub/altitude-vision-1`
Documents de référence : `PLATFORM_ADMIN_1_AUDIT.md`, `PLATFORM_ADMIN_1_REPORT.md`, `PLATFORM_ADMIN_CERT_1_AUDIT.md`, `PLATFORM_ADMIN_CERT_1_REPORT.md`

## Réponses aux 14 questions d'audit

**1. Comment un PlatformOperator est-il actuellement créé ?**
Uniquement via `server/services/platformOperator/platformOperatorService.js:grantOperator({userId, capabilities, actor, reason, req})`. Aucune autre voie de création dans le code (confirmé par `grep -rn "new PlatformOperator" server/` : un seul site, dans `grantOperator`).

**2. Qui peut le créer ?**
Deux appelants existent : (a) `server/scripts/bootstrapPlatformOperator.js` (CLI, non exposé HTTP) ; (b) `POST /api/platform-operators` (`platformOperatorController.grantOperator`), gardé par `auth.restrictTo('Admin')` + `requireOperatorCapability('platform.operators.manage')` — c'est-à-dire qu'il faut **déjà** être un PlatformOperator actif avec cette capacité pour en créer un nouveau. Ce qui confirme le problème de bootstrap initial (§7 de la mission) : le tout premier PlatformOperator ne peut PAS être créé via la route HTTP, faute d'opérateur existant pour l'autoriser.

**3. Une route HTTP existe-t-elle ?**
Oui pour la gouvernance courante (`POST /api/platform-operators`), mais elle est structurellement inutilisable pour le bootstrap initial (voir §2). Aucune route `POST /platform-operators/bootstrap` ou équivalent n'existe (vérifié par `grep -rn "bootstrap" server/routes/`) — le risque du mission §18 ("route HTTP de bootstrap exposée publiquement") **n'existe pas** dans ce dépôt.

**4. Un script existe-t-il ?**
Oui : `server/scripts/bootstrapPlatformOperator.js`, créé lors de PLATFORM-ADMIN-1, jamais exécuté depuis (aucun PlatformOperator réel n'existe dans aucune base à ce jour, confirmé par l'absence de toute trace d'exécution dans les rapports précédents).

**5. Existe-t-il un bootstrap implicite ?**
Non. Aucun mécanisme de type "premier utilisateur = opérateur", "premier Admin = opérateur", ou promotion basée sur un email/rôle codé en dur n'existe (confirmé par recherche globale `role === 'Admin'`/`isSuperAdmin`/`isAdmin` menée exhaustivement dans PLATFORM-ADMIN-CERT-1 §Part B — aucun résultat de ce type).

**6. Existe-t-il un risque d'auto-promotion ?**
Non — `grantOperator` vérifie explicitement `String(userId) === String(actor._id)` et refuse (`PLATFORM_OPERATOR_SELF_ACTION_FORBIDDEN`, testé dans PLATFORM-ADMIN-1, 25 tests). Le script CLI ajoute une garde redondante équivalente (`--grantedBy` doit être distinct de `--email`).

**7. Existe-t-il un risque de promotion par simple Admin ?**
Non pour la route HTTP (gardée par capacité, pas par rôle seul). Pour le script CLI : `--grantedBy` doit référencer un compte `role: 'Admin'` existant — c'est un choix de conception assumé (le bootstrap initial doit être endossé par un humain déjà en position de confiance Admin, puisqu'aucun PlatformOperator ne peut exister pour jouer ce rôle au tout premier bootstrap), documenté explicitement dans le script. Ce n'est pas un contournement de l'architecture PlatformOperator — c'est la seule porte d'entrée possible, volontairement restreinte au CLI local, jamais exposée en HTTP.

**8. Existe-t-il une protection contre le doublon ?**
Oui, à deux niveaux : (a) contrainte MongoDB `unique: true` sur `PlatformOperator.user` (`models/PlatformOperator.js:23`) — garantit qu'au plus un document existe par utilisateur, y compris sous concurrence ; (b) `grantOperator` réutilise le document existant (`findOne` puis mutation) plutôt que d'en créer un second lorsqu'un document déjà présent est trouvé de façon séquentielle. **Gap identifié** : sous concurrence réelle (deux appels simultanés pour un utilisateur sans document existant), le second `.save()` échouera avec une erreur MongoDB E11000 brute, non transformée en `PlatformOperatorError` propre — la garantie d'unicité tient (jamais deux documents), mais l'erreur n'est pas gracieuse. Corrigé dans ce sprint (voir Threat Model).

**9. Existe-t-il une notion de capabilities ?**
Oui, 29 capacités `platform.*` dans `constants/platformOperatorConstants.js`, granulaires, jamais un mode `['*']`. `grantOperator` valide chaque capacité demandée contre cette liste fermée.

**10. Comment la révocation fonctionne-t-elle ?**
`revokeOperator` — statut passe à `revoked`, jamais de suppression physique, `revokedBy`/`revokedAt`/`revokeReason` enregistrés. **Terminal par la voie `reactivateOperator`** (qui refuse explicitement un statut `revoked`) — mais `grantOperator` peut légitimement re-promouvoir un utilisateur précédemment révoqué via une **nouvelle décision explicite** (nouveau `grantedBy`/`grantedAt`/`grantReason`), ce qui est le comportement voulu et documenté (pas une résurrection silencieuse — chaque nouvel octroi crée une trace ActionLog distincte).

**11. Comment la suspension fonctionne-t-elle ?**
`suspendOperator` — statut passe à `suspended`, réversible via `reactivateOperator` uniquement (jamais `revoked → active` par cette voie).

**12. Comment l'action est-elle auditée ?**
Chaque transition (`granted`/`suspended`/`reactivated`/`revoked`) appelle `logAction` (réutilise `ActionLog`/`actionLogService.js` existant, `module: 'PlatformAdmin'`, `scopeMode: 'platform'`) — acteur, cible, motif, avant/après (JSON). Non bloquant (`.catch(() => {})`) — un échec d'audit n'empêche jamais l'opération elle-même de réussir, cohérent avec le reste du dépôt.

**13. Peut-on identifier l'auteur du bootstrap initial ?**
Oui — `grantedBy` sur le document `PlatformOperator` ET l'entrée `ActionLog` associée référencent explicitement le compte `--grantedBy` fourni au script. Aucun acteur système anonyme/fictif n'est jamais utilisé.

**14. Comment récupérer proprement un bootstrap mal attribué ?**
Via `revokeOperator` (HTTP, nécessite déjà un opérateur actif avec `platform.operators.manage` — donc un SECOND opérateur doit exister, ou le même compte fraîchement bootstrappé doit lui-même détenir cette capacité pour se corriger — auto-révocation explicitement interdite, donc un opérateur seul et mal attribué ne peut pas s'auto-corriger via HTTP). En pratique, une correction d'un bootstrap initial erroné nécessiterait soit un second bootstrap CLI (créant un second opérateur temporaire pour effectuer la révocation via HTTP), soit une intervention manuelle en base documentée séparément — **dette de procédure identifiée, hors périmètre de correction automatique dans ce sprint** (documentée dans le runbook §Rollback).

## Threat Model — gaps trouvés et corrigés

### Gap 1 — Sécurité d'environnement insuffisante dans le script CLI

`connectDB()` (`config/db.js`) se connecte inconditionnellement à `process.env.MONGO_URI`, sans distinction environnement. La seule garde existante dans `bootstrapPlatformOperator.js` est `NODE_ENV === 'production'` — un `NODE_ENV` mal positionné ou absent alors que `MONGO_URI` pointe vers un cluster Atlas réel contournerait totalement cette garde. **Corrigé** : ajout d'une confirmation basée sur la réalité de la connexion (nom de base de données réellement résolu par Mongoose), jamais sur une variable d'environnement potentiellement incorrecte — voir le runbook.

### Gap 2 — Erreur de concurrence non gracieuse

Décrit en §8. **Corrigé** : `grantOperator` capture désormais l'erreur MongoDB E11000 sur la création (jamais sur la mise à jour d'un document déjà chargé) et la retraduit en `PlatformOperatorError` explicite, sans jamais créer de second document.

## Conclusion de l'audit préalable

L'architecture existante est saine et n'a nécessité aucune reconstruction — seulement un durcissement ciblé de la sécurité d'environnement et de la robustesse de concurrence du script déjà écrit lors de PLATFORM-ADMIN-1. Aucune seconde architecture PlatformOperator n'a été créée.
