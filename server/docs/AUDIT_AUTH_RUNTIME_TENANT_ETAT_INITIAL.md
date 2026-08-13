# AUDIT AUTH RUNTIME TENANT — ÉTAT INITIAL

Date : 2026-08-13  
Branche : `main`  
HEAD observé : `da3dfb7c4cc84040f327c2becb35a551b07328c2` (`Update Altimmo 20`)  
HEAD annoncé par la mission : `5a87cb4307d09ed7d10681dcdeaa7bd7f14c6ebc`

Le nouveau HEAD contient les modifications Altimmo et AUTH-1 précédemment présentes; le worktree était propre au début d'AUTH-1.1. Le fichier navigateur annoncé à environ 2 178 lignes n'est pas joint à cette mission. Le seul journal accessible est la pièce `53d4cc66-.../pasted-text.txt`, 53 lignes. Les nombres globaux sur 2 178 lignes sont donc **NON CONFIRMÉS**.

## 1. Résumé des logs disponibles

| Catégorie | Signatures regroupées | Occurrences visibles | URLs | Cause | Impact / priorité |
|---|---|---:|---|---|---|
| CSP | `overbridgenet.com/jsv8/offer` bloqué | 2 | domaine tiers | origine applicative non démontrée | isolé, P3 investigation poste/extensions |
| CORS / missing allowed header | preflight refuse `x-platform-tenant-id` | 4 | properties/latest, portfolio, events, reviews | frontend envoie le header tenant sur des lectures publiques; réponse déployée ne l'autorise pas | pages publiques cassées, P1 |
| NETWORK | `ERR_NETWORK` / `net::ERR_FAILED` | 8 symptômes secondaires | mêmes URLs | conséquence du preflight CORS | P1 |
| FRONTEND FALLBACK | données de secours événements | 1 | `/events` | conséquence réseau | P3 |
| 403 tenant | exemples fournis dans la mission, journal brut absent | NON CONFIRMÉ | users, action-logs/recent, conversations/count/unread | race runtime démontrée par le code | dashboard cassé, P1/P2 |

Aucun 401, 404, 409, 422, 500, timeout ou incident Socket.IO n'est démontrable dans les 53 lignes disponibles.

## 2. Endpoints 403 tracés

- `GET /api/users` : `DashboardHome` → `userService.getAllUsers` → Axios → `userRoutes` → `protect` → `restrictTo('Admin')` → `requireTenantScope` → `userController.getAllUsers`. Tenant obligatoire.
- `GET /api/action-logs/recent?limit=8` : `DashboardHome` → `actionLogService` → Axios → `actionLogRoutes` → `protect` → Admin → `requireTenantScope` → `getRecent`. Tenant obligatoire.
- `GET /api/conversations/count/unread` : `AdminDashboard` → `useDashboardBadges` → Axios → `conversationRoutes` → `protect` → `requireTenantScope` → `getUnreadCount`. Messagerie tenant-scoped.

Le message exact « Sélectionnez un tenant à administrer » n'est émis que pour un PlatformOperator actif en mode plateforme sans sélection. L'absence de tenant, et non un tenant tardif injecté, explique donc précisément ces 403.

## 3. Architecture tenant initiale

Source d'autorisation : `OrgMembership` actif → `OrgUnit` racine → `PlatformTenant` actif/trial; exception bornée legacy et identité `PlatformOperator`. Source de sélection frontend : clé globale `localStorage.platformOperatorTenantId`. Source de tenant ressource : champs/attributions métier contrôlés côté serveur. Ces trois notions sont distinctes.

Le backend résout automatiquement une membership unique pour un utilisateur ordinaire. Pour un opérateur, l'absence de header représente volontairement la vue plateforme, autorisée seulement sur quelques routes explicites; les modules administratifs ordinaires restent fail-closed.

## 4. Cycle AuthContext

`AuthContext` restaure uniquement `user` et `token`, puis expose `loading=false`. Il ne charge ni memberships ni tenant et ne possède aucun `tenantReady`. `DashboardLayout` rend alors `AdminDashboard`. Le sélecteur opérateur, enfant de la sidebar, charge ensuite `/platform-operators/me`, puis `/platform-tenants`. Pendant cette fenêtre, `DashboardHome` et `useDashboardBadges` ont déjà lancé leurs requêtes.

## 5. Cycle Axios initial

L'intercepteur lit à chaque requête `token` et la clé globale `platformOperatorTenantId`. Il joint le header à **toute** requête dès que la clé existe, y compris aux endpoints publics. Il ne valide ni l'identité propriétaire de la sélection, ni son appartenance à la liste chargée, ni le caractère tenant-scoped de la requête. Il ne nettoie pas cette clé lors d'un 401 ou logout.

## 6. Pages et appels concernés

Au montage du shell dashboard, `useDashboardBadges` lance sept compteurs en `Promise.allSettled`. `DashboardHome` lance jusqu'à six requêtes en `Promise.all`, dont users et action logs pour Admin. Les autres pages appellent leurs services dès leur propre montage. Aucune ne dépend d'un état tenant prêt.

## 7. Races confirmées

1. `user` restauré → dashboard rendu → appels scoped; en parallèle seulement, statut opérateur et tenants chargés.
2. Le mode « Vue plateforme » est une option valide du sélecteur, mais les enfants qui exigent un tenant restent montés et spamment des 403.
3. Une sélection locale ancienne est injectée avant validation et survit au logout/changement d'utilisateur.
4. Le changement de tenant force un reload complet; il évite certains caches, mais ne fournit pas de phase `tenantReady` au démarrage suivant.

## 8. Sécurité backend

Le backend est strict et correct sur les trois routes : tenant absent/inaccessible → 403. Il valide la sélection d'un membre contre ses memberships et celle d'un opérateur contre l'existence du tenant. Aucun relâchement n'est requis.

## 9. Priorités

- **P0 potentiel non observé** : héritage local d'un tenant entre utilisateurs; le backend empêche l'accès d'un non-opérateur, mais une nouvelle session opérateur pourrait hériter d'une sélection valide sans intention explicite.
- **P1 confirmé** : dashboard opérateur en vue plateforme appelle des routes qui exigent un tenant.
- **P1 confirmé (log disponible)** : header tenant envoyé sur quatre endpoints publics, causant un échec CORS sur le déploiement observé.
- **P2 confirmé** : absence de runtime tenant central, restauration/validation tardive et race avec les effets.
- **P3** : répétition polling/Promise.allSettled, logs 403 et UX sans écran bloquant de sélection.
- **P4** : sélection stockée sous une clé non liée à l'identité et changement par reload.

## 10. Incident overbridgenet séparé

La recherche statique ne trouve aucune référence `overbridgenet` ni `jsv8/offer` dans `client/` ou `server/`. Les frames `content.js`, `SlashCommand`, nom de script opaque et injection `VM...` suggèrent un contenu injecté hors bundle, mais son origine exacte est **NON CONFIRMÉE**. La CSP a correctement bloqué la connexion. Elle ne doit pas être élargie.

Aucune correction n'a été appliquée avant la création de ce document.
