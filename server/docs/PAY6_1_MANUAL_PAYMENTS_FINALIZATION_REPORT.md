# PAY-6.1 — Rapport de finalisation des paiements manuels

## Verdict

**CERTIFIÉ VERT — implémentation PAY-6.1 complète et réserve externe du runner levée.**

La preuve privée, le rejet audité et le reçu de paiement distinct sont intégrés au Financial Core existant. Aucun commit, push ou déploiement n'a été effectué.

## Réalisation

- Justificatif JPEG/PNG/PDF privé, limite 8 Mio, contrôle MIME + signature binaire, un seul actif et remplacement uniquement en `pending`.
- Rejet manuel `pending → failed`, motif obligatoire, acteur/date/motif et événement append-only `payment.rejected`.
- Arbitrage confirmation/rejet par filtre atomique de statut ; les états terminaux ne régressent pas.
- Reçu PDF distinct de la facture, uniquement après `succeeded` et allocation active.
- Numéro stable `REC-*` par la séquence existante, index unique paiement et numéro, snapshot des allocations, hash SHA-256 et modèle immuable.
- Accès preuve/reçu réservé au payeur lié ou au staff financièrement autorisé dans l'établissement.
- PAY-5/PAY-6 préexistants préservés ; aucune logique Airtel, MTN, allocation ou facture remplacée.

## Routes

- `POST /api/financial/payments/:paymentId/proof`
- `GET /api/financial/payments/:paymentId/proof`
- `POST /api/financial/payments/:paymentId/reject`
- `POST /api/financial/payments/:paymentId/receipt`
- `GET /api/financial/payments/:paymentId/receipt`

Les actions de rejet et génération exigent `Idempotency-Key` lorsque la route l'utilise pour l'opération financière.

## Preuves disponibles

- Tests PAY-6.1 unitaires : 6/6 verts.
- Tests PAY-6.1 Mongo replica : 4/4 verts, incluant double rejet, approve-vs-reject, reçu concurrent et persistance après reversal.
- Sélection Financial/PAY : 53/53 verte.
- Sélection Mongo Financial Core + F2.2 + F2.3 + PAY-6.1 : 24/24 verte.
- Suite serveur hors intégrations Mongo/replica : 1 445/1 445 verte.
- Lint : 0 erreur ; 106 avertissements préexistants.
- `git diff --check` : vert.

## Gate serveur global

Le run Jest réellement exhaustif a rencontré un échec hors périmètre dans `platformAdmin1.adversarial.mongo.integration.test.js` : le test attend 403 sur Conversations unread pour un opérateur sans tenant et reçoit 200. Aucun fichier de ce module n'est modifié par PAY-6.1. Le run a ensuite été interrompu faute de progression, après consignation de cet échec. Le verdict ne peut donc pas être « CERTIFIÉ VERT » global malgré tous les gates PAY-6.1 et Financial demandés qui sont verts.

### Re-certification après HOTFIX-CONVERSATIONS-UNREAD-SCOPE-1

L'échec Conversations est corrigé : le scénario Platform Operator sans tenant retourne désormais 403 avec `PLATFORM_OPERATOR_TENANT_SELECTION_REQUIRED`, et les tests ciblés sont verts. La réserve externe PAY-6.1 n'est cependant pas levée au sens strict : le runner Mongo exhaustif partagé termine à 93/94 suites et 937/938 tests à cause d'un conflit d'index `Litige.reference = null` hors périmètre. La suite concernée repasse isolément à 14/14, mais la commande exhaustive conserve un exit code 1. Aucun code PAY-6.1 n'a été modifié pendant ce hotfix.

Le micro-hotfix Litige suivant corrige et caractérise cet index (absent/null autorisés, doublon textuel toujours refusé). Sa relance exhaustive conserve toutefois un exit code 1 dont l'échec final est non confirmé à cause d'une sortie terminal tronquée. La réserve PAY-6.1 ne peut donc toujours pas être levée sur la base du gate global ; aucun code PAY-6.1 n'a été modifié.

### Certification finale du runner — 2026-08-21

La capture complète suivante est verte : 95/95 suites Mongo, 939/939 tests, exit 0. Les gates PAY-6.1/Financial ont également été rejoués à 13/13 suites et 133/133 tests verts. **La réserve externe de PAY-6.1 liée au runner Mongo exhaustif est levée.** Aucun code PAY-6.1 n'a été modifié pendant cette re-certification.

## Limites assumées

- Aucun écran frontend/mobile ajouté, hors périmètre demandé.
- Aucun envoi email automatique du reçu ajouté.
- Une séquence peut contenir un trou si l'upload privé échoue après réservation du numéro ; aucun numéro déjà émis n'est réutilisé, ce qui préserve l'unicité comptable.
