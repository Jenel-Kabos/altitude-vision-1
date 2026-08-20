# HOTFIX-OWNER-CONTRACT-RESEND-1 — Rapport final

Date : 2026-08-20. Branche `main`. `HEAD` au démarrage : `3f7b59bfb92f51c7ccc6e73c57636affc8cb7782` (changement externe documenté dans `HOTFIX_OWNER_CONTRACT_RESEND1_ETAT_INITIAL.md` — commit de l'utilisateur contenant exactement le travail de la session précédente, rien de surprenant). Aucun commit créé pendant ce hotfix.

Aucun accès à la base MongoDB de production. Tout est prouvé par lecture de code + tests avec fixtures locales.

## Réponses aux 18 questions du mandat

**1. Quel endpoint échouait ?**
`POST /api/users/:id/renvoyer-contrat` (et, par le même mécanisme, toutes les autres routes `/api/users/:id/*` : `verify`, `suspend`, `activate`, `role`, `contract-document`, `GET/PUT/DELETE /:id`).

**2. Quel identifiant le frontend envoyait-il ?**
`target._id` — confirmé par lecture de `UsersPanel.jsx:360` (`api.post(\`/users/${target._id}/renvoyer-contrat\`, {})`), où `target` est l'objet `User` complet déjà reçu du tableau `GET /api/users` (donc bien un `User._id`, PAS un `Proprietaire._id` — il n'y a d'ailleurs aucune lecture du modèle `Proprietaire` nulle part sur ce chemin). Le frontend envoyait donc le bon identifiant dès le départ.

**3. Quel identifiant le backend attendait-il ?**
Également un `User._id` — `renvoyerContrat` fait `User.findById(req.params.id)`. Aucune divergence de type d'identifiant entre frontend et contrôleur.

**4. Où "Utilisateur introuvable." était-il généré ?**
Pas dans le contrôleur `renvoyerContrat` (qui ne s'exécutait même jamais). Dans `router.param('id', …)` (`server/routes/userRoutes.js`), le garde exécuté AVANT chaque route `/:id` : il testait `(req.tenantScopeUserIds || []).some(id => String(id) === String(userId))` et retournait `404 {message:'Utilisateur introuvable.'}` si absent — message strictement identique à celui du contrôleur, ce qui a nécessité une vérification par lecture de code (pas seulement le texte de l'erreur) pour localiser la vraie source.

**5. Le problème impliquait-il `OrgMembership` ?**
Oui, directement. `req.tenantScopeUserIds` (posé par `requireTenantScope`, monté sur tout le routeur) reste le scope **brut** `OrgMembership`-only (`getScopeUserIds`). huinlogistics n'a pas d'`OrgMembership` (établi dans HOTFIX-USERS-COUNT-1), donc absent de ce scope brut malgré son inclusion dans la LISTE via l'extension locale de `getAllUsers`.

**6. Le problème impliquait-il `User._id` vs `Proprietaire._id` ?**
Non — écarté par preuve directe (Q2/Q3) : aucune confusion de modèle, aucune lecture de `Proprietaire` sur ce chemin. Fausse piste explicitement exclue par le mandat, confirmée absente ici.

**7. HOTFIX-USERS-COUNT-1 était-il impliqué ?**
Oui, mais pas comme cause d'un bug qu'il aurait introduit par erreur — comme cause d'une **incomplétude assumée**. HOTFIX-USERS-COUNT-1 a délibérément étendu le scope UNIQUEMENT dans `getAllUsers`/`getAllOwners` (jamais dans la couche partagée `resolveTenantScope`, pour ne pas faire fuiter des comptes non affiliés dans le catalogue public de biens/hôtels — une régression réelle détectée et revertée pendant ce hotfix précédent, voir son rapport). Cette prudence, correcte pour la LECTURE, n'avait simplement pas été propagée aux routes d'ACTION `/:id`, qui utilisent un garde commun (`router.param`) distinct des contrôleurs de liste. Ce n'est pas une régression de HOTFIX-USERS-COUNT-1 mais sa suite logique manquante, maintenant complétée.

**8. Quelle est la relation canonique contrat → destinataire ?**
Le "contrat d'hébergement" n'est **pas** un document dans une collection séparée — c'est un ensemble de champs embarqués directement sur le modèle `User` (`contratAccepte`, `contratVersion`, `contratAccepteLe`, `contratPdfAsset`/`contratPdfUrl`, `contratIp` le cas échéant). La relation canonique est donc simplement : `User._id` (ressource autorisée par le scope tenant) → `user.email` (champ du même document, jamais une valeur externe). C'est exactement la même source que celle qui alimente déjà l'affichage de la modale (`target.contratVersion`, `target.contratAccepteLe`, etc., tous lus depuis le même objet `User`) — la modale et l'action ciblaient déjà la même identité canonique ; seule la porte d'accès (`router.param`) divergeait.

**9. Le destinataire est-il maintenant dérivé serveur-side ?**
Oui, et il l'était déjà avant ce hotfix — vérifié par lecture complète de `exports.renvoyerContrat` : `user.email` provient exclusivement de `User.findById(req.params.id)`, jamais de `req.body`. Aucun changement nécessaire sur ce point ; confirmé par test adversarial (Q13).

**10. Un email arbitraire peut-il être injecté ?**
Non — prouvé par test (voir Q13) : un `POST` avec `{email, userId, recipient}` pointant vers un autre Proprietaire n'a aucun effet, le mail part toujours vers `user.email` de la ressource résolue par l'URL. Le contrôleur ne lit jamais ces champs du body.

**11. Le cas Proprietaire signup sans OrgMembership passe-t-il ?**
Oui — `hotfixOwnerContractResend1.mongo.integration.test.js`, describe "scénario réel" : `POST /:id/renvoyer-contrat` sur un Proprietaire non affilié → `200`, service mail appelé une fois avec `recipient === proprietaire.email`. Confirmé échouer AVANT correctif (`404`) via `git stash` de vérification, passer APRÈS.

**12. Les règles tenant sont-elles conservées ?**
Oui — le correctif réutilise la fonction canonique de HOTFIX-USERS-COUNT-1 (`expandScopeWithUnaffiliatedUsersIfSoleTenant`, exportée depuis `userController.js`, jamais réimplémentée), qui reste strictement bornée au cas `tenantCount === 1`. Test dédié : dès qu'un second tenant existe, AdminB ne peut pas renvoyer le contrat d'un Proprietaire non affilié au Tenant A (`404`, aucun appel au service mail).

**13. Les tests de sécurité passent-ils ?**
Oui — 8/8 dans le nouveau fichier : scénario réel (4 tests), injection de destinataire arbitraire (1 test), isolation cross-tenant (1 test), IAM/non-régression (2 tests : `Collaborateur` → 403, compte non-Proprietaire → 400). Plus 129/129 sur les 6 suites de certification cross-tenant existantes + le test HOTFIX-USERS-COUNT-1, et 224/225 sur le balayage de 16 fichiers tenant/org (le seul échec, `Conversations unread 403 signal distinct`, reproduit identique sur le code d'avant ce hotfix — préexistant, non lié).

**14. Un vrai email a-t-il été envoyé ?**
Non — le service mail (`sendEmailWithAttachment`) est intégralement mocké dans les tests (`jest.mock('../services/emailService', …)`), conformément au mandat. Aucun email réel n'a été émis pendant cette session.

**15. Un vrai email a-t-il été reçu ?**
NON CONFIRMÉ / non applicable — aucun envoi réel n'a été tenté (voir Q14). Distinction explicitement maintenue entre requête acceptée (prouvé : `200` + mock appelé avec le bon destinataire), remise SMTP (non testée, hors périmètre d'un test automatisé) et réception en boîte réelle (non vérifiable sans accès à la boîte `huinlogistics@gmail.com`, hors périmètre).

**16. Quels fichiers ont changé ?**
- `server/controllers/userController.js` — export de `expandScopeWithUnaffiliatedUsersIfSoleTenant` (fonction déjà existante depuis HOTFIX-USERS-COUNT-1, simplement rendue réutilisable).
- `server/routes/userRoutes.js` — `router.param('id', …)` utilise désormais cette même fonction canonique au lieu du scope brut `req.tenantScopeUserIds`.
- `server/__tests__/hotfixOwnerContractResend1.mongo.integration.test.js` (nouveau, 8 tests).
- `server/docs/HOTFIX_OWNER_CONTRACT_RESEND1_ETAT_INITIAL.md`, `HOTFIX_OWNER_CONTRACT_RESEND1_REPORT.md` (nouveaux).
Aucun fichier frontend, mobile, ou hors du périmètre `/dashboard/users` + contrat propriétaire n'a été touché.

**17. Quels gates passent ?**

| Gate | Résultat |
|---|---|
| Test dédié `hotfixOwnerContractResend1` | 8/8 ✅ (4/8 échouent bien sur le code d'avant, vérifié par `git stash`) |
| Test dédié `hotfixUsersCount1` (non-régression) | 7/7 ✅ |
| Suites certification cross-tenant (6 fichiers) | 114/114 ✅ |
| Balayage régression tenant/org (16 fichiers) | 224/225 ✅ (1 échec préexistant confirmé identique sans ce hotfix) |
| Server unit (`npm run test:unit`) | 1425/1425 ✅ |
| Server lint (fichiers touchés) | 0 erreur ✅ |
| Client tests (`npm test -- --run`) | 588/588 (89 suites) ✅ (aucun fichier client modifié) |
| Client lint | 0 erreur (warnings baseline inchangés) ✅ |
| `git diff --check` | exit 0 ✅ |

**18. Verdict final ?**
**CORRECTIF CERTIFIÉ — rupture d'identité entre chemin de lecture et chemin d'action identifiée et corrigée au point unique (`router.param('id', …)`), aucune injection de destinataire possible (confirmé, pas seulement supposé), sécurité tenant multi-tenant préservée et testée adversairement, aucune régression détectée.**

## Ce qui reste explicitement NON CONFIRMÉ

- La réception réelle d'un email par `huinlogistics@gmail.com` (aucun envoi réel tenté, hors périmètre du mandat qui interdit d'envoyer un vrai email en test automatisé).
- Le comportement visuel exact du bouton "Renvoyer par email" en production après ce correctif (non testable sans session navigateur réelle ; preuve apportée uniquement backend/intégration Mongo, comme pour HOTFIX-USERS-COUNT-1).

## STOP

Conformément au mandat (§19) : aucune action supplémentaire au-delà de ce correctif et de ce rapport. Pas de PAY-5, pas de refonte IAM, pas de modification MTN/Airtel, pas de refonte du dashboard utilisateurs, pas de nouvelle fonctionnalité. En attente de validation explicite.
