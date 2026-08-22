# HOTFIX-RBAC-TRANSACTIONS-ACCESS-1 — MATRICE DE SÉCURITÉ

## Principe : aucune permission backend modifiée

Ce hotfix ne modifie **aucun fichier `server/`**. `transactionRoutes.js`, `transactionController.js`, `paiementTransactionController.js` sont restés inchangés pendant tout l'audit et la correction. Le frontend a été aligné sur un contrat backend déjà en production, jamais l'inverse.

## Matrice de sécurité par action et par rôle

| Rôle | Lecture liste/stats | Finaliser | Annuler | Valider/rejeter virement | Lecture ciblée par ID (détail/paiements/justificatif) |
|---|---|---|---|---|---|
| Admin | ALLOWED | ALLOWED | ALLOWED | ALLOWED | ALLOWED |
| Collaborateur | ALLOWED (inchangé) | ALLOWED (inchangé) | ALLOWED (inchangé) | **DENIED (corrigé — bouton retiré)** | ALLOWED (inchangé) |
| Secretaire | **ALLOWED (corrigé)** | **ALLOWED (corrigé)** | **ALLOWED (corrigé)** | DENIED (inchangé) | ALLOWED (inchangé, `ALL_STAFF`) |
| GestionnaireImmobilier | DENIED (inchangé) | DENIED (inchangé) | DENIED (inchangé) | DENIED (inchangé) | ALLOWED (inchangé, `ALL_STAFF`) |
| CommunityManager | DENIED (inchangé) | DENIED (inchangé) | DENIED (inchangé) | DENIED (inchangé) | ALLOWED (inchangé, `ALL_STAFF`) |
| Communicant | DENIED (inchangé) | DENIED (inchangé) | DENIED (inchangé) | DENIED (inchangé) | ALLOWED (inchangé, `ALL_STAFF`) |

## Preuve que le backend reste l'autorité — même après correction frontend

- Un `Secretaire` qui contournerait l'UI pour appeler `POST /transactions/:id/finalize` obtenait déjà un 200 **avant** ce hotfix (le bouton était juste caché) — aucune élévation de privilège introduite, une action déjà autorisée est désormais visible.
- Un `Collaborateur` qui appellerait directement `PATCH /transactions/:txId/paiements/:pId/valider` reçoit toujours un 403 (`adminOnly`, non modifié) — le hotfix retire simplement le bouton qui menait à un échec garanti, une amélioration UX pure, jamais un changement de sécurité.
- Un `GestionnaireImmobilier`/`CommunityManager`/`Communicant` reste exclu de `GET /transactions`/`GET /transactions/stats`/finalize/cancel/validation — comportement inchangé, backend jamais touché.

## `payments.reverse` — non concerné, régression vérifiée

`transactionRoutes.js` n'importe ni n'utilise `requireCapability`/`payments.reverse` (domaine Gestion Locative, `paiementRoutes.js`, entièrement séparé — confirmé par `server/docs/PAY1_ARCHITECTURE_REPORT.md`). Par prudence, le test de régression `"IAM-3 : GestionnaireImmobilier ne peut pas annuler un encaissement"` (`rentalPaymentReceiptsAndCancellation.mongo.integration.test.js`) a été rejoué : **vert**, `GestionnaireImmobilier` reste refusé sur `payments.reverse`, aucun impact de ce hotfix sur ce contrat certifié RBAC-2.

## Mass assignment / falsification

Aucun des trois endpoints d'écriture concernés (`finalize`, `cancel`, `valider virement`) n'accepte de champ client contrôlant l'autorisation (`validatedBy`, `status`, `provider`, `payoutPaidBy` ou équivalent) — les corps de requête envoyés par la page (`{}` pour finalize, `{ reason }` pour cancel, `{ action }` pour valider) ne contiennent que des données métier, jamais un rôle ou une capacité. Le rôle appliqué est toujours `req.user.role` posé par `protect` depuis le JWT vérifié, jamais un champ du body — comportement backend hérité, non modifié, cohérent avec le principe déjà prouvé par RBAC-3 (tests adversariaux `propertyAssetRoutes.mongo.integration.test.js`) sur un domaine différent mais avec le même mécanisme `restrictTo`/`protect`.

## Ownership / ressource — ligne read confirmée correcte, non modifiée

`getTransaction`/`getPaiements`/`downloadProof` appliquent déjà `isOwner || isStaff` (`ALL_STAFF` = les 6 rôles) — un utilisateur A ne peut jamais accéder à la transaction B d'un autre client via ces routes, indépendamment de ce hotfix (aucun fichier contrôleur touché).

## Tenant / PlatformOperator — non concernés

`transactionRoutes.js` n'importe aucun middleware tenant (`requireTenantScope` absent), et aucune route de ce domaine ne concerne `PlatformOperator`. Non modifié, non applicable.

## `financialAuthorizationService` — confirmé non concerné

Zéro occurrence dans `transactionController.js`/`paiementTransactionController.js` — ce domaine (`Transaction`/`PaiementTransaction`, immobilier) est structurellement distinct du Financial Core hôtelier. Aucun risque de contournement d'une couche financière spécialisée par ce hotfix.

## Capacités backend — source canonique inchangée

`server/utils/iamArchitecture.js`, `server/utils/roles.js` (`STAFF_DOC`), aucun modifié. `canManageTransactions`/`isAdmin` sont deux expressions booléennes locales à `TransactionsPage.jsx`, pas un mapping `{role: [capabilities]}` généralisé — même patron que `canManageStaffImmo`/`isAdmin` déjà introduit dans `GestionLocativePage.jsx` par le hotfix précédent, cohérent, pas une nouvelle architecture.
