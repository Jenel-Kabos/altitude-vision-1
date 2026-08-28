# HOTFIX-INBOX-SECURITY-1 — ÉTAT INITIAL

Branche : `main`. HEAD : `a04055f62952c782b92aeef2f100824a17a5f645` — inchangé depuis INBOX-1.

`git status --short` (99 lignes) : même chantier externe non lié à cette session déjà documenté dans `INBOX1_ETAT_INITIAL.md` (`ARCH2A/2B/2C1/2C2`, `messageSerializer.js`, `notificationObservationPort.js`, plusieurs contrôleurs modifiés dont `internalMailController.js`/`conversationController.js`) — **rien de ce travail n'est touché par ce hotfix**. `git diff --check` : exit 0 (seuls deux avertissements CRLF/LF bénins préexistants sur des fichiers non touchés par ce hotfix).

## Revalidation du finding INBOX-1 (obligatoire avant correction)

Confirmé sur le HEAD actuel, par lecture directe :

1. `server/routes/emailRoutes.js` — **14 routes, zéro middleware** (`protect`, `restrictTo`, `requireCapability`, tenant) sur aucune d'entre elles.
2. `server/controllers/emailController.js` — **zéro référence à `req.user`** sur les 14 handlers (grep exhaustif, aucun résultat).
3. Montage dans `server/server.js:551` : `app.use("/api/emails", emailRoutes)`.
4. **Aucune protection en amont n'existe** : `server.js` ne définit **aucun** `app.use(protect)` global à aucun endroit (recherche exhaustive de `app.use(authController...`, `app.use(...protect...)` — zéro résultat) ; seuls les autres routeurs (`companyEmailRoutes`, `internalMailRoutes`, etc.) appliquent chacun leur propre `protect` localement. Le pattern architectural de ce projet est **protection par routeur**, jamais globale — confirmé cohérent avec le reste du code, pas une anomalie isolée à corriger différemment ici.
5. **Le finding INBOX-1 est donc intégralement confirmé, pas reclassifié** : aucune protection parente n'existe, `emailRoutes.js` est réellement et entièrement non authentifié.

## Découverte supplémentaire pendant la revalidation — calibrage de la sévérité (mandat §13)

`emailController.js::sendEmailViaZoho`/`syncWithZoho` (les deux routes d'action `/send`/`/sync-zoho`) sont des **stubs non implémentés** :
```js
// TODO: Intégrer l'API Zoho Mail ici
// const zoho = require('../utils/zohoMailer');
// await zoho.send({ from: fromEmail, to: toEmail, subject, html: content });
```
Ils ne déclenchent **aucun envoi ni synchronisation réels** — seulement un `$inc` de compteur et une réponse simulée. **Ceci est un homonyme trompeur** : le VRAI système d'envoi Zoho (`server/services/emailService.js::sendEmailViaZoho`/`syncWithZoho`), utilisé par `internalMailController.js`, `tenantPortalEmailService.js`, `hotelReservationNotificationService.js`, est une fonction **complètement différente et non exposée par ces routes** — confirmé par lecture des deux fichiers, ce ne sont pas les mêmes fonctions malgré le nom identique.

**Conclusion sur la sévérité réelle** : l'exposition anonyme de `emailRoutes.js` ne permet **pas** de déclencher un envoi d'email réel ni une synchronisation Zoho réelle (mandat §13 : ne pas exagérer). Le risque réel et actionnable est le **CRUD complet non authentifié sur le modèle `Email`** (lecture/création/modification/suppression des comptes email d'entreprise et de leur configuration de notifications) — un vrai problème de sécurité, mais de nature différente de "envoi d'email arbitraire".

## Preuve du contrat déjà attendu (pas une invention)

`client/lib/pages/dashboard/AdminDashboard.jsx:165` — l'entrée de menu "Gestion des Emails" (`/dashboard/emails`, la seule page consommant ces routes via `client/lib/services/emailService.js`) est déjà gatée par `roles: ROLES_DOCS` (= `CANONICAL_DOC_STAFF_ROLES` = `['Admin', 'Secretaire', 'Collaborateur']`, constante déjà canonique depuis RBAC-5). **C'est la politique déjà voulue par le produit, jamais appliquée côté backend** — la correction de ce hotfix consiste à faire respecter côté serveur ce que le frontend affirme déjà côté menu, pas à inventer une nouvelle règle.
