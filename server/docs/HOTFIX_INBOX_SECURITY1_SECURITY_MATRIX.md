# HOTFIX-INBOX-SECURITY-1 — MATRICE DE SÉCURITÉ

## Périmètre du correctif

Un seul fichier de production modifié : `server/routes/emailRoutes.js` (+3 lignes : 2 imports, 1 `router.use`). Aucun autre fichier (contrôleur, modèle, service, route, middleware, frontend, mobile) n'a été touché.

## Dimensions de sécurité — état avant/après

| Dimension | Avant | Après | Preuve |
|---|---|---|---|
| **Authentification** | Absente sur les 14 routes | `protect` sur les 14 routes | `emailRoutesAuth.test.js` — 401 sans token / token invalide |
| **Autorisation (rôle)** | Absente | `restrictTo(...ROLES_DOCS)` = `Admin`, `Secretaire`, `Collaborateur` | Test `.each` — 403 pour les 5 rôles hors périmètre |
| **Tenant scoping** | N/A — modèle `Email` n'a pas de champ tenant | N/A — inchangé | Lecture du schéma `server/models/Email.js` : aucun champ tenant |
| **Ownership** | N/A — modèle `Email` = configuration globale d'entreprise, pas de notion de propriétaire par document | N/A — inchangé | Lecture du schéma + des 14 handlers : aucun contrôle `req.user.id === doc.owner` nulle part, ni avant ni après (cohérent avec un modèle de config globale) |
| **PlatformOperator** | Non applicable à ce modèle | Inchangé | Aucune référence à `PlatformOperator` dans `emailController.js`/`emailRoutes.js` |
| **IMAP (`zohoImapService.js`)** | Non modifié | Non modifié | Fichier non touché ; le cron (`server.js:89-96`) appelle directement le service, jamais via `emailRoutes.js` |
| **SMTP réel (`server/services/emailService.js`)** | Non modifié | Non modifié | Fichier non touché ; utilisé par `internalMailController.js`/`tenantPortalEmailService.js`/`hotelReservationNotificationService.js`, aucun de ces appelants ne passe par `emailRoutes.js` |
| **Stub `sendEmailViaZoho`/`syncWithZoho` (emailController.js)** | Accessible anonymement, mais inerte (pas d'envoi réel, incrémente un compteur) | Nécessite désormais `ROLES_DOCS` authentifié | Confirmé code source : aucun appel réseau Zoho dans ces deux handlers |
| **Nouvelle route exposée** | — | Aucune | Diff de `emailRoutes.js` : uniquement ajout de middleware, aucune route ajoutée/retirée/renommée |
| **Mutation de production** | — | Aucune | Aucune commande git exécutée (add/commit/push), aucun accès à la base de production, aucune variable d'environnement modifiée |
| **Régression sur `CompanyEmail`/`companyEmailRoutes.js`** | Non concerné | Non concerné | Fichier distinct, non lu au-delà de la comparaison de pattern, non modifié |
| **Régression sur `InternalMail`/messagerie interne** | Non concerné | Non concerné | Hors périmètre du mandat, aucun fichier touché |

## Risque résiduel connu (hors périmètre de ce hotfix, déjà documenté par INBOX-1)

- Prévisualisation directe (`window.open`) des pièces jointes `.html`/`.svg` dans `messageService.js:117-122` ne repasse pas par `SafeHtmlEmailViewer`/DOMPurify — risque distinct, sur un système distinct (`InternalMail`, pas `Email`), candidat pour `HOTFIX-INBOX-SECURITY-2`, non traité ici par mandat explicite.
- `companyEmailRoutes.js`/`CompanyEmail` — infrastructure parallèle apparemment sans consommateur frontend, non auditée en profondeur, non modifiée, aucune preuve qu'elle présente le même problème (elle a déjà `protect`+`restrictTo`).

## Verdict de cette dimension

Aucune régression identifiée sur aucun axe de sécurité listé au mandat. Le changement est strictement additif (fermeture d'un accès anonyme) et strictement local à un seul fichier et un seul modèle.
