# INBOX-1 — MATRICE DES ENDPOINTS

## `server/routes/emailRoutes.js` (`/api/emails`) — ⚠️ AUCUNE AUTHENTIFICATION

| Method | Path | Controller | Auth | RBAC/capability | Tenant | Ownership | Risque |
|---|---|---|---|---|---|---|---|
| GET | `/` | `emailController` | **Aucune** | Aucune | Aucun | Aucun | **P0 — endpoint entièrement ouvert** |
| POST | `/` | idem | **Aucune** | Aucune | Aucun | Aucun | **P0** |
| GET | `/active` | idem | **Aucune** | Aucune | Aucun | Aucun | P0 |
| GET | `/stats/global` | idem | **Aucune** | Aucune | Aucun | Aucun | P0 |
| GET | `/notifications/quotes`, `/notifications/contact` | idem | **Aucune** | Aucune | Aucun | Aucun | P0 |
| GET | `/user/:userId` | idem | **Aucune** | Aucune | Aucun | Aucun | P0 |
| POST | `/send` | idem | **Aucune** | Aucune | Aucun | Aucun | **P0 — envoi d'email déclenchable sans authentification** |
| POST | `/sync-zoho` | idem | **Aucune** | Aucune | Aucun | Aucun | **P0 — synchronisation Zoho déclenchable sans authentification** |
| GET/PUT/DELETE | `/:id` | idem | **Aucune** | Aucune | Aucun | Aucun | P0 |
| PATCH | `/:id/toggle`, `/:id/notifications` | idem | **Aucune** | Aucune | Aucun | Aucun | P0 |

Confirmé par grep exhaustif : `emailController.js` ne référence jamais `req.user`. Ces routes gèrent la **configuration des comptes d'envoi** (adresses `@altitudevision.agency`), pas le contenu des emails reçus — mais restent un P0 par principe (surface d'attaque ouverte, capable de déclencher un envoi ou une synchronisation Zoho sans identité).

## `server/routes/companyEmailRoutes.js` (`/api/company-emails`)

| Method | Path | Auth | RBAC | Tenant | Ownership |
|---|---|---|---|---|---|
| Toutes routes | — | `protect` | `restrictTo(...STAFF_ALL)` global au routeur | Aucun | N/A (config globale) |
| POST/PUT/DELETE `/`, `/:id` | — | `protect` | `restrictTo('Admin')` supplémentaire | Aucun | N/A |

Rôle-liste (`STAFF_ALL`), pas de capacité nommée — cohérent avec le reste du projet pour ce type de ressource administrative globale.

## `server/routes/internalMailRoutes.js` (`/api/internal-mails`) — le pipeline audité

| Method | Path | Controller | Auth | RBAC | Tenant | Ownership |
|---|---|---|---|---|---|---|
| GET | `/count/unread`, `/received`, `/sent`, `/unread`, `/starred`, `/drafts`, `/trash` | `getUnreadCount`/`getInbox`/`getSent`/`getUnread`/`getStarred`/`getDrafts`/`getTrash` | `protect` uniquement | Aucune | Aucun | Requêtes pré-scopées `sender`/`receiver: req.user.id` — pas de paramètre `:userId`, donc pas d'IDOR possible ici |
| GET | `/:mailId/attachments/:attachmentIndex` | `downloadAttachment` | `protect` | Aucune | Aucun | **Vérifié** : `sender === userId \|\| receiver === userId`, sinon 403 |
| POST | `/` (upload 5 fichiers max) | `sendInternalMail` | `protect` | Aucune | Aucun | N/A (création) |
| POST/PUT/DELETE | `/drafts*` | `saveDraft`/`updateDraft`/`deleteDraft` | `protect` | Aucune | Aucun | Non détaillé par les agents — à revérifier avant INBOX-2 si un brouillon d'un autre utilisateur pourrait être modifié via `:draftId` |
| PATCH | `/:mailId/read\|unread\|star\|unstar\|trash\|restore` | — | `protect` | Aucune | Aucun | Non revérifié en détail pour chacune — pattern général confirmé correct sur `downloadAttachment`, à confirmer identique ailleurs avant INBOX-2 |
| DELETE | `/:mailId/permanent`, `/trash/empty` | — | `protect` | Aucune | Aucun | Idem |

**Aucun tenant** — `InternalMail` n'a pas de champ tenant, cohérent avec sa nature (boîte email par employé, pas par organisation cliente).

## `server/routes/conversationRoutes.js` / `messageRoutes.js` (chat interne — hors périmètre email mais audité pour ne rien confondre)

| Method | Path | Auth | RBAC | Tenant |
|---|---|---|---|---|
| GET | `/staff-inbox` | `protect`+`attachTenantContext` | `restrictTo(...ALL_STAFF)` | — |
| GET | `/count/unread` | idem | `requireTenantScopeForStaffOrPlatformOperator` | Oui |
| Reste des routes conversation/message | idem | Aucune (`protect` seul) | `assertResourceTenantOrUnattributed` en interne, appliqué seulement `if (req.platformTenant)` |

Ownership vérifiée dans les contrôleurs (`participant`/`isStaff`+tenant) — confirmé par tests dédiés (`conversationRoutes.test.js`, `conversationStaffInboxTenant.test.js`). **Nuance tenant** : `assertResourceTenantOrUnattributed` laisse passer les ressources `tenant: null` sans vérification stricte — comportement documenté et volontaire ("POST-E2E-1"), pas une régression, mais à garder en tête si ce système est un jour connecté à l'email.

## Constat central de sécurité pour INBOX-2+

Le pipeline email réellement utilisé (`internalMailRoutes.js`) a un modèle d'autorisation simple et **vérifié correct sur le chemin de téléchargement** (ownership sender/receiver). Le vrai P0 de cette matrice est **`emailRoutes.js`, totalement dépourvu d'authentification** — sans lien direct avec le rendu HTML/CID/pièces jointes visé par la roadmap produit, mais un risque de sécurité réel et immédiat, indépendant de toute décision d'architecture de viewers.
