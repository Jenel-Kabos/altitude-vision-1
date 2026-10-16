# F-U2.12 — Préparation à la préproduction

**Statut : certifié localement, non déployé, non activé.** Aucun commit, push,
déploiement, migration, changement de variable ou mouvement financier réel.
Complète le plan de bascule `F-U2.11-LEGACY-PENALTY-TRANSITION-PLAN.md` et la
matrice `docs/compliance/F-U2.12-RENTAL-COMPLIANCE-MATRIX.md`.

## 1. Architecture consolidée

```
Contrat (bail, avenants, natureCharges, ordreImputation)
  └─ rentCalendarService.conventionalRentPlan  (base 30, entrée, sortie, avenant)
       └─ rentBillingService  ── facture émise (organisation / mandat)
                              └─ échéance de SUIVI (bailleur sans organisation, jamais émise)
FinancialPayment → PaymentAllocation → FinancialDocument (noyau F-U2)
  └─ rentImputationService (instruction > clause > loyer d'abord)  ← source unique
       ├─ rentCollectionService (pénalité 3 % prévisionnelle, dossiers, signalements)
       ├─ autonomousBillingService (1 %, abonnements, devis)
       └─ ownerFundsService (commission 10 % hors charges)
DirectRentReceipt (encaissement direct : DECLARED → … → CONFIRMED) → base du 1 %
RENT_PENALTY_ENGINE (LEGACY | CANONICAL | autre = aucun) → un seul moteur de pénalités
```

## 2. Fonctionnalités prêtes (certifiées localement)

- Calendrier : exigibilité le 30 / dernier jour de février, tolérance au 5, retard au 6, dossier au 25.
- Prorata base 30 : entrée (tous mois, février compris), entrée le 31, sortie fondée, changement de loyer, charges périodiques.
- Imputation validée ; pénalité de 3 % prévisionnelle avec corrections tracées.
- Signalements, reports, projets de mise en demeure (jamais envoyés).
- Bailleurs sans organisation : échéances de suivi, loyers reçus, circuit de preuve, 1 % après confirmation indépendante.
- 1 % tous titulaires (individuel, organisation), toutes formules ; non-cumul avec 10 %.
- Commission de 10 % hors charges.

## 3. Fonctionnalités bloquées (volontairement)

| Fonction | Blocage | Levée |
|---|---|---|
| Exigibilité de la pénalité | `RENT_PENALTY_LEGAL_BASIS_NOT_VALIDATED` | validation juridique |
| Envoi de mise en demeure | `FORMAL_NOTICE_LEGAL_VALIDATION_MISSING` | validation juridique |
| Facture sans clause de prorata | `RENT_PRORATION_CLAUSE_REQUIRED` | clause dans le bail |
| Sortie en cours de mois sans décision | `RENT_EXIT_DECISION_REQUIRED` | décision de sortie |
| Avenants incohérents / 2 changements dans le mois | `RENT_CHANGE_CALCULATION_AMBIGUOUS` | correction des avenants |
| Charges de nature inconnue sur mois partiel | `RENT_CHARGES_PRORATA_RULE_UNDECIDED` | renseigner `natureCharges` |
| Commission sans part loyer déterminable | `COLLECTION_RENT_SHARE_UNDETERMINED` | affectation ou part loyer vérifiée |
| Biens clôturés pouvant changer la formule | `AUTONOMOUS_CLASSIFICATION_AMBIGUOUS` | décision de comptage |
| Justificatifs fichiers d'encaissement | non implémenté (références seulement) | stockage admissible |
| Facture légale pour bailleur sans organisation | `RENT_TRACKING_OBLIGATION_NOT_ISSUABLE` | émetteur habilité |

## 4. Risques techniques

- Ancien moteur de pénalités actif par défaut (`LEGACY`) jusqu'à la bascule.
- Anciennes instances backend ignorant le sélecteur (voir plan F-U2.11 §9).
- Avenants historiques incomplets → blocages à la facturation.
- Cycle canonique : parcourt toutes les échéances non soldées à chaque exécution (volumétrie à mesurer en préproduction).
- Encaissement direct contesté après facturation du 1 % : ajustement en attente de décision (pas d'avoir automatique).

## 5. Risques juridiques

Voir la matrice : pénalité, mise en demeure, convention 30 jours (février),
révision de loyer, imputation légale, CGV du 1 %, valeur probante des
références, conservation des données.

## 6. Migrations nécessaires

Aucune migration destructive. Champs ajoutés facultatifs :
`Contrat.natureCharges`, `Contrat.ordreImputation` (défaut `null`).
Nouvelles collections : `rentleaseexits`, `directrentreceipts` (+ F-U2.9–F-U2.11 :
`autonomousvariablefeeaccruals`, `portfolioquotes`, `portfolioclassificationsnapshots`,
`rentlatepenaltyassessments`, `rentpaymentdifficultyreports`, `rentcollectioncases`).
Aucune facture historique n'est recalculée. Renseigner `natureCharges` des
baux existants : opération de données 🔒 distincte, non requise pour les mois complets.

## 7. Synchronisation des index 🔒

`syncIndexes()` modèle par modèle, après sauvegarde :
`RentLeaseExit` (`{lease}` unique), `DirectRentReceipt` (`{payment}` unique,
`{evidenceKeys}` unique partiel), plus la liste du plan F-U2.11 §10
(dont `SubscriptionTariff` `{plan, formula, version}` qui remplace l'ancien index).

## 8. Variables d'environnement

| Variable | Préproduction | Production (inchangée) |
|---|---|---|
| `RENT_PENALTY_ENGINE` | `CANONICAL` (test de bascule) puis `LEGACY` (test de retour) | absente (= LEGACY) jusqu'à décision |
| `DISABLE_SCHEDULED_JOBS` | `1` sauf fenêtres de test du cycle | inchangée |
| Fournisseurs e-mail / SMS / paiement | **désactivés ou bac à sable** | inchangés |

## 9. Tests complémentaires nécessaires en préproduction

- Copie anonymisée de la base : exécution du cycle canonique (`CANONICAL`), mesure du temps, contrôle des requêtes d'anomalie (plan F-U2.11 §3).
- Recensement des baux : clause de prorata, nature des charges, avenants incomplets.
- Échantillon de bailleurs sans organisation : parcours déclaration → confirmation locataire.
- Vérification qu'aucun e-mail/SMS réel ne part (fournisseurs en bac à sable).
- E2E navigateur des écrans Échéances (locataire), Recouvrement (propriétaire, gestionnaire), Revue des encaissements (plateforme).

## 10. Plan de vérification en préproduction

1. Déployer le code avec `RENT_PENALTY_ENGINE` absent : vérifier comportement inchangé.
2. Synchroniser les index ; exécuter les requêtes « avant ».
3. Passer à `CANONICAL` ; exécuter le cycle ; vérifier gardes, notifications dédupliquées, aucun envoi externe.
4. Revenir à `LEGACY` ; vérifier qu'aucune double pénalité n'apparaît.
5. Archiver journaux et résultats ; rapport de préproduction.

## 11. Conditions de bascule ultérieure en production 🔒

- Rapport de préproduction sans anomalie.
- Validations juridiques des règles exigées (matrice).
- Décision écrite du propriétaire de la plateforme.
- Procédure du plan F-U2.11 (§5 à §12), y compris retour arrière.
