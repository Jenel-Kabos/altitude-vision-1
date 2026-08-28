# HOTFIX-INBOX-SECURITY-1 — MATRICE COMPORTEMENTALE (AVANT/APRÈS, PREUVE PAR TEST)

Preuve produite par `server/__tests__/emailRoutesAuth.test.js`, exécutée AVANT correctif (rouge, 11/15 échecs — la vulnérabilité prouvée) puis APRÈS correctif (verte, 15/15).

| Scénario | Avant correctif (observé) | Après correctif (observé) |
|---|---|---|
| GET `/api/emails` sans `Authorization` | 200, `Email.find` réellement appelé | 401, `Email.find` jamais appelé |
| POST `/api/emails` (création) sans `Authorization` | 201, `Email.create` réellement appelé | 401, `Email.create` jamais appelé |
| DELETE `/api/emails/:id` sans `Authorization` | 200, `Email.findByIdAndDelete` réellement appelé | 401, jamais appelé |
| POST `/api/emails/send` sans `Authorization` | 200 (stub, pas d'envoi réel — voir `ETAT_INITIAL.md`), `Email.findOne` réellement appelé | 401, jamais appelé |
| POST `/api/emails/sync-zoho` sans `Authorization` | 200 (stub, pas de sync réelle) | 401 |
| Token invalide (`Bearer invalide.token.ici`) | 200 (aucune vérification n'existait) | 401, `Email.find` jamais appelé |
| `Admin`/`Secretaire`/`Collaborateur` authentifiés (token valide, compte actif) | 200/201, comportement normal | **Identique** — 200/201, mêmes appels au modèle |
| `GestionnaireImmobilier`/`CommunityManager`/`Communicant`/`Client`/`Proprietaire` authentifiés | 200 (aucune restriction de rôle n'existait) | 403, `Email.find` jamais appelé |

## Effets de bord — confirmés bloqués pour les requêtes anonymes après correctif

Pour chaque route de mutation (`POST /`, `PUT /:id`, `DELETE /:id`, `PATCH /:id/toggle`, `PATCH /:id/notifications`, `POST /send`, `POST /sync-zoho`) : le test correspondant vérifie explicitement que la fonction Mongoose sous-jacente (`Email.create`/`findByIdAndUpdate`/`findByIdAndDelete`/`findOne`) **n'est jamais invoquée** lorsque la requête est anonyme — la mutation est bloquée avant d'atteindre le contrôleur métier, pas seulement masquée après coup.

## IMAP / SMTP — non affectés, confirmé sans nouveau test dédié

Aucun fichier du pipeline IMAP (`zohoImapService.js`) ni du service SMTP réel (`server/services/emailService.js`, utilisé par `internalMailController.js`/`tenantPortalEmailService.js`/`hotelReservationNotificationService.js`) n'a été modifié par ce hotfix — seul `server/routes/emailRoutes.js` (ajout de 2 lignes d'import + 1 ligne `router.use`) a changé. Le cron IMAP (`server.js:89-96`, `pollZohoInbox`) ne passe jamais par `emailRoutes.js` — il appelle directement `zohoImapService.js`, sans passer par une route HTTP. Aucune régression possible sur ce chemin par construction (fichiers disjoints).
