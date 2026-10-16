# F-U2.11 — Plan de transition des pénalités locatives

**Statut : préparé et certifié localement — NON exécuté.** Chaque étape marquée
🔒 exige une autorisation explicite du propriétaire de la plateforme. Une
certification locale n'autorise aucun déploiement.

Objectif : un seul moteur de pénalités actif à tout instant, sans perte
d'historique, sans double pénalité, réversible.

## 1. Inventaire des points d'entrée historiques

| Point d'entrée | Fichier | Déclenchement | Effet |
|---|---|---|---|
| Job `rental-penalties-alerts` (06:00, Africa/Brazzaville) | `server/services/scheduledJobs/jobRegistry.js` → `rentalHandler` | cron (`node-cron`), bail `ScheduledJobLease` | `verifierPaiementsEnRetard()` + `runRentalFinancialAutomations()` |
| `POST /api/paiements/calculer-penalites` | `routes/paiementRoutes.js` → `paiementController.calculerPenalites` | opérateur plateforme (`platform.finance.manage`), **global** | `verifierPaiementsEnRetard()` |
| `POST /api/paiements/location/calculer-penalites` (individuel) | `routes/paiementLocationRoutes.js` | propriétaire individuel | `verifierPaiementsEnRetard({ contratIds })` |
| `POST /api/paiements/location/calculer-penalites` (tenant) | `routes/paiementLocationRoutes.js` | organisation | `verifierPaiementsEnRetard({ contratIds })` |
| Alertes de retard `rental_payment_overdue` | `services/rentalFinancialAutomationService.js` (`checkRentalPaymentOverdues`) | même job | notifications staff + propriétaire selon `Paiement.jourEcheance` |

Démarrage : `server/server.js` → `registerScheduledJobs()` (désactivable par
`DISABLE_SCHEDULED_JOBS=1`). Environnements : toute instance backend démarrée
sans ce drapeau — Render (production) ; local si démarré sans le drapeau.

**Choke point unique** : les quatre entrées de pénalité passent toutes par
`alerteService.verifierPaiementsEnRetard`.

## 2. Données et dépendances de l'ancien moteur

Écritures (`Paiement`) : `statut` → `en_retard`, `retardJours`,
`penaliteAppliquee`, `penaliteMontant` (3 % du **montant total**),
`montantTotal`, `penaltyEmailDelivery` (clé idempotente, statut d'envoi).
E-mail réel : `zohoMailService.sendEmail` (« Loyer en retard — pénalité 3 % »).

Lecteurs (lecture seule, inchangés) : portail locataire
(`tenantPortalService`), projections (`rentalPaymentProjectionService`),
propriétaire (`rentalOwnerFinancialService`), quittances PDF (`pdfService`),
reporting (`rentalReportQueryService`), dossiers (`gestionLocativeDossierAdapter`),
statistiques (`paiementController.getStats`), mention sur reçu
(`paiementController` — « Pénalité de retard incluse »).

Le portail locataire continue d'afficher l'historique `Paiement` ; les
échéances canoniques sont dans l'onglet « Échéances ». Aucun lecteur ne
dépend de la création de NOUVELLES pénalités historiques.

## 3. Données historiques à préserver (jamais modifiées)

- `Paiement.penaliteAppliquee/penaliteMontant/montantTotal/penaltyEmailDelivery`.
- Reçus et quittances déjà émis mentionnant une pénalité.
- Aucune pénalité historique n'est recalculée, annulée ni remboursée.
  Rapprochement : `RentLatePenaltyAssessment.legacyPenalty` (statut
  `LEGACY_PENALTY_EXISTS`) relie l'échéance canonique au `Paiement` pénalisé.

Requêtes de rapprochement (lecture seule, à exécuter 🔒 sur une copie ou en lecture) :

```js
// Pénalités historiques non réglées / réglées
db.paiements.countDocuments({ penaliteAppliquee: true, statut: { $in: ['impayé', 'en_retard', 'partiel'] } })
db.paiements.countDocuments({ penaliteAppliquee: true, statut: 'payé' })
// Échéances canoniques rattachées à une pénalité historique
db.rentlatepenaltyassessments.find({ status: 'LEGACY_PENALTY_EXISTS' })
// Anomalie : deux moteurs sur une même échéance (doit être vide)
db.rentlatepenaltyassessments.find({ 'legacyPenalty.paiement': { $ne: null }, status: { $ne: 'LEGACY_PENALTY_EXISTS' } })
```

Toute anomalie → rapport de réconciliation + plan de correction soumis à une
autorisation distincte (aucune correction automatique).

## 4. Configuration du nouveau moteur

`RENT_PENALTY_ENGINE` (variable d'environnement backend) :

| Valeur | Ancien moteur (4 entrées + alertes `jourEcheance`) | Cycle canonique `rental-collection-cycle` (06:30) |
|---|---|---|
| absente / `LEGACY` (défaut) | actif (comportement actuel) | inerte |
| `CANONICAL` | inerte (retour `skipped`) | actif |
| autre valeur | inerte | inerte (fermeture sûre) |

Gardes par échéance (indépendantes de la variable) :
- canonique : `Paiement` déjà pénalisé pour (bail, mois) → `LEGACY_PENALTY_EXISTS`, 0 FCFA ;
- historique : échéance déjà évaluée par le canonique → aucune pénalité historique.

Le cycle canonique n'envoie aucun e-mail, aucun SMS, aucune mise en demeure
(projets uniquement) ; notifications in-app/push dédupliquées.

## 5. Conditions préalables à la bascule 🔒

1. Décision écrite du propriétaire de la plateforme (bascule + date).
2. Validation juridique de la pénalité de 3 % — sinon le moteur canonique ne
   produit que des montants **prévisionnels** (comportement voulu ; l'ancien
   moteur, lui, appliquait la pénalité au montant dû).
3. Communication aux locataires/propriétaires : fin des e-mails « pénalité 3 % ».
4. Factures de loyer canoniques émises pour les baux concernés (sinon le
   moteur canonique n'a aucune échéance à suivre).
5. Sauvegarde de la base (point de restauration).

## 6. Vérifications avant activation

- `npm run certify:financial`, `npm run certify:rental`, `npm run architecture:check` verts sur le commit déployé.
- Index synchronisés (§10).
- Requêtes §3 exécutées, résultats archivés (photographie « avant »).
- Une seule version du backend en service (§9).

## 7. Désactivation de l'ancien moteur 🔒

Déployer d'abord ce code **avec `RENT_PENALTY_ENGINE` absent** (= LEGACY) :
aucun changement de comportement. Vérifier les journaux du 06:00 suivant.

## 8. Activation du nouveau 🔒

Positionner `RENT_PENALTY_ENGINE=CANONICAL` sur Render (redéploiement →
redémarrage de toutes les instances). Une seule variable désactive l'ancien
et active le nouveau : pas de fenêtre où les deux sont actifs dans une même
version du code.

## 9. Prévention des doubles traitements

- Une version : une variable → un moteur.
- Instances concurrentes : bail `ScheduledJobLease` par job (un exécutant).
- **Anciennes versions encore en service** (déploiement en cours, instance
  non recyclée, worker isolé, environnement de préproduction pointant sur la
  base de production) : elles ignorent la variable et peuvent exécuter
  l'ancien moteur. Mitigation : vérifier qu'aucune instance de l'ancien commit
  ne tourne (tableau de bord Render : instances / déploiements), suspendre les
  environnements secondaires reliés à la base de production, attendre la fin
  du déploiement avant 06:00 ; la garde canonique rattache toute pénalité
  historique tardive (`legacyPenalty.detectedAt`) sans en calculer une seconde.
- Index uniques : une évaluation et un dossier par échéance.

## 10. Synchronisation des index 🔒

Collections nouvelles ou modifiées (F-U2.9 → F-U2.11) :
`rentlatepenaltyassessments` (`{rentDocument, kind}` unique),
`rentpaymentdifficultyreports` (`{rentDocument, locataire}` unique),
`rentcollectioncases` (`{rentDocument}` unique),
`autonomousvariablefeeaccruals` (`{allocation, kind}` unique),
`portfolioquotes`, `portfolioclassificationsnapshots`,
`subscriptiontariffs` (`{plan, formula, version}` unique — remplace l'ancien index).
Exécuter `Model.syncIndexes()` modèle par modèle, hors pic, après sauvegarde.

## 11. Vérifications après bascule

- Journal 06:00 : `⚠️ [Alerte] ancien moteur de pénalités inactif (moteur : CANONICAL)`.
- Journal 06:30 : `✅ [Recouvrement] … échéance(s)`.
- Aucun nouvel envoi `penaltyEmailDelivery` après la bascule :
  `db.paiements.countDocuments({ 'penaltyEmailDelivery.claimedAt': { $gt: <bascule> } }) === 0`.
- Requête d'anomalie §3 vide ; pas de doublon de notification (index `dedupeKey`).

## 12. Retour arrière 🔒

Remettre `RENT_PENALTY_ENGINE=LEGACY` (ou supprimer la variable) et
redéployer. Effets : le cycle canonique s'arrête ; l'ancien moteur reprend ;
ses gardes ignorent les échéances déjà évaluées par le canonique (aucune
double pénalité). Les évaluations, signalements et dossiers canoniques sont
conservés. Arrêt d'urgence des deux moteurs : valeur `OFF` (ou
`DISABLE_SCHEDULED_JOBS=1`, qui arrête tous les jobs).

## 13. Risques résiduels

- Ancienne version encore active (§9).
- Baux sans facture canonique : plus aucun suivi de retard après bascule.
- Pénalités canoniques **prévisionnelles** tant que la base juridique n'est pas
  validée (pas de montant réclamé), contrairement à l'ancien moteur.
- Affichages historiques (« Pénalité 3 % ») restent visibles sur les anciens
  paiements : attendu, mais à expliquer aux utilisateurs.
- Prorata de février (règle déduite) : émission bloquée jusqu'à validation.
- Encaissements déclarés par les bailleurs sans organisation : hors base du 1 %.

## 14. Autorisations nécessaires

| Étape | Autorisation |
|---|---|
| Commit / push / déploiement du code | propriétaire de la plateforme |
| Synchronisation des index en production | propriétaire de la plateforme |
| `RENT_PENALTY_ENGINE=CANONICAL` | propriétaire de la plateforme |
| Exigibilité de la pénalité | validation juridique + contractuelle |
| Envoi réel d'une mise en demeure | validation juridique (modèle, émetteur, canal, délais, preuve) |
| Correction d'une anomalie historique | autorisation distincte, au cas par cas |
