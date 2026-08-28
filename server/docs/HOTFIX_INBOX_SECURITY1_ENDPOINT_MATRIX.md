# HOTFIX-INBOX-SECURITY-1 — MATRICE DES ENDPOINTS

Modèle : `Email` (`server/models/Email.js`) — comptes email d'entreprise et configuration de notifications, **distinct** du modèle `CompanyEmail` (utilisé par `companyEmailRoutes.js`, non consommé par le frontend actuel) et **distinct** d'`InternalMail` (boîte de réception réelle, hors périmètre de ce hotfix).

| Method | Path | Handler | Current auth | Caller | Data accessed | Side effects | Expected access (preuve) |
|---|---|---|---|---|---|---|---|
| GET | `/active` | `getActiveEmails` | Aucune | `emailService.js` → `ManageEmailsPage.jsx` | Liste `Email` actifs | Lecture seule | **B — STAFF PRIVATE** (`ROLES_DOCS`, preuve : gate menu `AdminDashboard.jsx:165`) |
| GET | `/stats/global` | `getGlobalStats` | Aucune | idem | Agrégats `Email` | Lecture seule | B |
| GET | `/notifications/quotes` | `getQuoteNotificationEmails` | Aucune | idem | Liste `Email` filtrée | Lecture seule | B |
| GET | `/notifications/contact` | `getContactNotificationEmails` | Aucune | idem | idem | Lecture seule | B |
| GET | `/user/:userId` | `getEmailsByUser` | Aucune | idem | `Email` filtrés par `assignedTo` | Lecture seule | B |
| GET | `/` | `getAllEmails` | Aucune | idem | Tous les `Email` | Lecture seule | B |
| POST | `/` | `createEmail` | Aucune | idem | — | **Création** `Email` | B |
| POST | `/send` | `sendEmailViaZoho` | Aucune | idem | Lecture `Email` par `fromEmail` | **Stub — incrémente un compteur, n'envoie aucun email réel** (voir `ETAT_INITIAL.md`) | B |
| POST | `/sync-zoho` | `syncWithZoho` | Aucune | idem | — | **Stub — aucune synchronisation réelle** | B |
| GET | `/:id` | `getEmailById` | Aucune | idem | Un `Email` par ID | Lecture seule | B |
| PUT | `/:id` | `updateEmail` | Aucune | idem | — | **Modification** `Email` | B |
| DELETE | `/:id` | `deleteEmail` | Aucune | idem | — | **Suppression** `Email` | B |
| PATCH | `/:id/toggle` | `toggleEmailStatus` | Aucune | idem | — | **Modification** (`isActive`) | B |
| PATCH | `/:id/notifications` | `updateNotifications` | Aucune | idem | — | **Modification** (config notifications) | B |

## Callers — modèle d'authentification

**Un seul caller identifié pour les 14 routes** : `client/lib/services/emailService.js`, utilisé exclusivement par `client/lib/pages/dashboard/ManageEmailsPage.jsx` (`/dashboard/emails`). Modèle d'authentification du caller : **JWT User** — l'instance `api` (axios) du frontend attache déjà `Authorization: Bearer <token>` sur toutes les requêtes (comportement standard de ce projet, confirmé par le fait que toutes les autres routes staff du même frontend en dépendent). **Aucun cron, aucun service interne, aucun webhook, aucun mobile n'appelle ces routes** (recherche exhaustive : `grep -rn "'/emails\b"` dans `server/`, `altimmo-app/` — zéro résultat en dehors de `emailRoutes.js` lui-même et de sa documentation).

**Conséquence directe** : ajouter `protect` ne peut casser aucun système interne/webhook/cron — le seul consommateur est déjà un utilisateur staff authentifié dans le navigateur, dont le token est déjà envoyé mais actuellement jamais vérifié.

## Classification par route (catégories du mandat §10)

**Toutes les 14 routes : catégorie B — STAFF PRIVATE.** Aucune route système (C), aucun callback externe (D), aucune route publique intentionnelle prouvée (E), aucune route ambiguë (F). Le mandat §11 (routes système/cron/webhook) ne s'applique à aucune route de ce fichier — confirmé par l'absence totale de tout autre caller que le frontend staff.

## Politique choisie (dérivée de la preuve, pas inventée)

`protect` + `restrictTo(...ROLES_DOCS)` sur l'ensemble des 14 routes, uniformément — `ROLES_DOCS` étant déjà la constante canonique existante (RBAC-5, `server/utils/roles.js`) et déjà la politique affichée par le menu frontend consommant exactement ces routes. Aucune distinction lecture/écriture par sous-groupe de rôle n'est appliquée (contrairement à `companyEmailRoutes.js` qui réserve certaines mutations à `Admin` seul) car **aucune preuve n'existe** que cette distinction s'applique au modèle `Email` spécifiquement — inventer une telle distinction violerait le mandat §2/§3 ("ne pas inventer une politique métier"). Si un futur audit produit ou UX prouve qu'une restriction plus fine est nécessaire (ex. suppression réservée à Admin), elle devra être introduite séparément, avec sa propre preuve.
