# Property Lifecycle Final Certification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lever les réserves 03A-1 par des notifications idempotentes, six preuves de concurrence réelles et un build frontend certifié.

**Architecture:** Un service ciblé traduit les transitions déjà persistées en notifications `Notification` dédupliquées et limitées aux opérateurs `platform.commercial.manage` ou au propriétaire. Les tests replica-set pilotent directement les services transactionnels et la décision versionnée avec barrières contrôlées; le build reste inchangé et est rejoué avec accès réseau.

**Tech Stack:** Node.js, Express, Mongoose transactions, Jest, Vitest, Next.js.

**Spec:** `/Users/apple/.codex/attachments/1881318d-7b72-463e-b6f4-132489719c55/Texte collé.txt`

## Global Constraints

- Base exacte `1f59a70af67792cfb972e5d318d94acfdaecd7e1`.
- Aucun nouveau système de notification, aucune migration, aucune dépendance.
- `platform.commercial.manage` reste l’unique audience commerciale plateforme.
- Les notifications sont post-commit, best-effort et dédupliquées; elles ne retardent jamais la transition.
- Aucun changement permanent de typographie pour contourner le réseau.

## Review Focus

- Notification émise après échec métier : aucune persistance.
- Répétition/retry : une notification maximum par transition et destinataire.
- Retrait versus approbation dans les deux ordres : état final non public.
- Suspension versus décision commerciale : aucun écrasement tardif.
- Build connecté : distinguer erreur applicative et ressource externe.

---

### Task 1: Notifications métier idempotentes

**Files:**
- Create: `server/services/propertyPublicationNotificationService.js`
- Modify: `server/models/Notification.js`
- Modify: `server/services/notificationService.js`
- Modify: `server/controllers/propertyController.js`
- Modify: `server/controllers/propertyMobileController.js`
- Test: `server/__tests__/propertyPublicationNotifications03A2.mongo.integration.test.js`

**Interfaces:**
- Produces: `notifyCommercialOperators(event)`, `notifyPropertyOwner(event)`; chaque appel reçoit `property`, `transitionId/revisionId`, `actor`, `reason` et utilise un `dedupeKey` stable.

- [ ] Écrire les 12 tests RED de la matrice, destinataires, échec et déduplication.
- [ ] Vérifier les échecs fonctionnels.
- [ ] Ajouter les types/liens et le service de diffusion limité aux opérateurs actifs habilités.
- [ ] Déclencher les notifications seulement après mutation réussie, en best-effort traçable.
- [ ] Vérifier GREEN et commit `feat(real-estate): certify lifecycle notifications`.

### Task 2: Concurrence A–F

**Files:**
- Modify: `server/services/propertyPublicationLifecycleService.js`
- Modify: `server/services/commercialPublicationService.js`
- Test: `server/__tests__/propertyPublicationConcurrency03A2.mongo.integration.test.js`

**Interfaces:**
- Consumes: transitions transactionnelles et notifications Task 1.
- Produces: six scénarios nommés A–F, deux interleavings pour A/C, avec état Mongo, visibilité, autorité, historique et notifications vérifiés.

- [ ] Écrire les tests replica-set RED avec barrières/promesses contrôlées, sans temporisation arbitraire.
- [ ] Vérifier RED et classifier chaque anomalie.
- [ ] Ajouter uniquement les filtres conditionnels/idempotence nécessaires.
- [ ] Vérifier GREEN, les suites 03A-1 et commit `fix(real-estate): close lifecycle concurrency races`.

### Task 3: Build, non-régression et rapport

**Files:**
- Create: `/Users/apple/Documents/GitHub/altimmo-certification-evidence/GIT-INTEGRATION-03A-2/GIT_INTEGRATION_03A2_RESULT.md`

- [ ] Rejouer `npm run build:next` avec accès réseau une fois.
- [ ] Exécuter tests notifications, A–F, suites directement concernées, UI, architecture et scans d’exclusion/secrets.
- [ ] Revoir le diff complet, vérifier les dépôts protégés et corriger tout constat important en TDD.
- [ ] Rédiger le rapport, le SHA final et le verdict sans surévaluer une vérification incomplète.
