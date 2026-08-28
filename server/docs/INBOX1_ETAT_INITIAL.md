# INBOX-1 — ÉTAT INITIAL

Branche : `main`. HEAD : `a04055f62952c782b92aeef2f100824a17a5f645` ("Update Altimmo 40") — inchangé depuis les hotfix Google Auth précédents de cette session.

`git diff --check` : exit 0 (avertissements CRLF/LF bénins sur deux fichiers déjà présents, non liés à un problème de contenu).

## Travail en cours non lié à cette session — préservé intégralement

`git status --short` (74 lignes) révèle un chantier d'architecture backend clairement identifiable, en cours ailleurs, **directement pertinent pour ce périmètre d'audit** car il touche plusieurs fichiers du domaine messagerie :

- Modifiés : `server/controllers/conversationController.js`, `server/controllers/internalMailController.js`, `server/controllers/messageController.js`, ainsi que plusieurs autres contrôleurs (litige, locataire, paiement, proprietaire, rentalDocument, rentalMaintenance, signalement, tenantPortal), `server/server.js`, `server/services/crmAutomationEngine.js`, `server/services/notificationService.js`.
- Nouveaux fichiers non suivis : `server/architecture/` (répertoire complet), `server/scripts/check-architecture.js`, `server/services/messageSerializer.js`, `server/services/notificationObservationPort.js`, `server/services/storage/documentStreamingService.js`, `server/__tests__/architectureBoundaries.test.js`, `server/__tests__/messageSerializer.test.js`, `server/__tests__/documentStreamingService.test.js`, `server/__tests__/notificationObservationPort.test.js`.
- Documentation associée : `server/docs/ARCH2A_*.md`, `ARCH2B_*.md`, `ARCH2C1_*.md`, `ARCH2C2_*.md` (28 documents) — un sprint de refactor architectural (limites service/controller, désaccouplement notification, sérialisation de messages, streaming de documents) manifestement en cours, avec son propre script `npm run architecture:check`.

**Conséquence pour cet audit** : INBOX-1 doit auditer l'état RÉEL actuellement sur disque, y compris ces modifications non commitées (elles constituent le code réel exécuté aujourd'hui), sans jamais les modifier ni les considérer comme hors sujet — au contraire, `messageSerializer.js`/`notificationObservationPort.js`/`documentStreamingService.js` semblent directement pertinents pour le pipeline de messagerie/pièces jointes audité ici. **Rien de ce chantier n'est modifié par INBOX-1.**

Egalement présents, sans rapport avec ce domaine : `altimmo-app/build-1787511872437.apk` (artefact de test mobile), les documents `HOTFIX_MOB_GOOGLE_AUTH2/3/4_*.md` (sprints Google Auth de cette même session, terminés).

## Périmètre d'INBOX-1

Audit pur, en lecture seule, du pipeline email complet (IMAP → parsing MIME → stockage → API → frontend boîte de réception), incluant la matrice des pièces jointes, le modèle de menace HTML/sécurité, l'inventaire des endpoints, l'audit frontend, et une évaluation (sans implémentation) d'une architecture cible de viewers. Aucun viewer implémenté, aucune bibliothèque ajoutée, aucune règle métier modifiée, aucun endpoint modifié sans nécessité d'audit, aucune migration Mongo, aucun commit/push/déploiement.
