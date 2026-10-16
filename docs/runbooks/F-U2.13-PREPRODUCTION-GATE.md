# F-U2.13 — Porte de préproduction

**Statut : certifié localement — ni déployé, ni activé.** Prolonge
`F-U2.11-LEGACY-PENALTY-TRANSITION-PLAN.md` et `F-U2.12-PREPRODUCTION-READINESS.md`.
🔒 = autorisation explicite requise.

## 1. Architecture contractuelle

Un moteur technique commun ; une politique contractuelle **par bail et par période** :

- `LeaseContractualPolicy` (versionnée, immuable) — `ALTITUDE_DELEGATED`
  (gestion déléguée à Altitude Vision : conditions fixées par la plateforme,
  opposables après acceptation du locataire) ou `OWNER_AUTONOMOUS`
  (conditions propres au bail ; rien n'est présumé).
- Résolution `leasePolicyService.resolvePolicyForPeriod` : mode de gestion au
  début de la période (`delegatedCoverageAt`, mandataire PLATFORM ⇒ Altitude),
  version en vigueur, cohérence mandat/type ; sinon `POLICY_UNRESOLVED`.
- La politique résolue est figée sur l'échéance (`metadata.policy`).
- `LeasePolicyConsent` : présentation (empreinte SHA-256, jeton à usage unique
  24 h) puis acceptation explicite authentifiée ; `SIGNATURE_PENDING`.
- Le moteur canonique (`rentCollectionService`) lit dates, pénalité,
  mise en demeure et suspensions dans la politique ; l'ancien moteur
  (`alerteService`) ne pénalise que si la politique stipule une pénalité
  (et, pour Altitude, après acceptation).

## 2. Modèles et index 🔒

Nouveaux : `leasecontractualpolicies` (`{lease, version}` unique,
`{lease, effectiveFrom}`), `leasepolicyconsents` (`{policy, signer}` unique).
Rappel F-U2.9–F-U2.12 : `rentleaseexits`, `directrentreceipts`,
`rentlatepenaltyassessments`, `rentcollectioncases`,
`rentpaymentdifficultyreports`, `autonomousvariablefeeaccruals`,
`portfolioquotes`, `portfolioclassificationsnapshots`, `subscriptiontariffs`
(`{plan, formula, version}` remplace l'ancien index). `syncIndexes()` après sauvegarde.

## 3. Migrations nécessaires

Aucune migration de données. Champs ajoutés facultatifs. **Aucune politique ni
aucun consentement n'est créé automatiquement pour les baux existants.**

## 4. Compatibilité des baux historiques

Après déploiement, un bail sans politique est `POLICY_UNRESOLVED` :
- suivi des loyers mensuels conservé (factures/échéances de mois complets) ;
- **aucune** échéance, tolérance, pénalité, mise en demeure ni prorata présumés ;
- l'ancien moteur cesse d'appliquer la pénalité de 3 % à ces baux.

Procédure de régularisation 🔒 :
1. Inventaire : baux, mode de gestion, mandats, documents contractuels connus, preuves d'acceptation existantes.
2. Gestion autonome : le bailleur ou l'organisation saisit les conditions de **son** bail (politique `OWNER_AUTONOMOUS`), à effet au plus tôt au début du mois courant — jamais rétroactif.
3. Gestion déléguée à Altitude Vision : création de la politique `ALTITUDE_DELEGATED` par la plateforme, puis acceptation par chaque locataire ; sans acceptation, ni pénalité ni mise en demeure (`POLICY_CONSENT_MISSING`, `blocked_policy`).
4. Aucune pénalité nouvelle sur les périodes passées.

## 5. Stratégie de consentement

Acceptation explicite (`accept === true`), après consultation du document
complet (jeton + empreinte), horodatage serveur, signataire = compte lié au
locataire du bail, preuve immuable, rejeu refusé. L'opérateur plateforme ne
peut ni consulter ni accepter au nom du locataire. Signature qualifiée :
**non disponible** (`SIGNATURE_PENDING`).

## 6. Vérification des mandats

Mode de gestion d'une période = mandat de gestion déléguée activé, version en
vigueur au début de la période, non révoqué/expiré avant. Même règle pour la
politique applicable, l'exclusion du 1 % et l'éligibilité à la commission de 10 %.

## 7. Encaissements directs

Déclaration = paiement `pending` non affecté (créance non soldée ; mise en
demeure suspendue et pénalité `PENDING_RECEIPT_CONFIRMATION`). Confirmation
indépendante (locataire ou revue plateforme) = paiement confirmé daté de la
réception + écriture ledger + affectation, en une transaction. Contestation
après confirmation = contrepassation tracée. Le bailleur ne peut pas annuler
un encaissement confirmé.

## 8. Commissions

1 % : loyers confirmés des périodes en gestion autonome. 10 % : loyers des
périodes couvertes par le mandat (`COLLECTION_PERIOD_OUTSIDE_MANDATE` sinon).
Une même période relève d'un seul régime.

## 9. Biens clôturés

Exclus à partir de la date effective de clôture (vente/archivage) ou de
désactivation ; la période déjà commencée reste comptée ; date inconnue →
`COUNTING_RULE_UNDECIDED` si la formule en dépend ; réactivation comptée.

## 10. Moteurs de pénalités

`RENT_PENALTY_ENGINE` inchangé (LEGACY par défaut). Les deux moteurs sont
désormais soumis à la politique du bail. Gardes par échéance F-U2.11 conservées.

## 11. Anciennes instances backend

Une instance exécutant un commit antérieur appliquerait encore 3 % à tous les
`Paiement` en retard (ancien moteur non gardé) : vérifier sur Render qu'aucune
instance de l'ancien commit ne reste active avant 06:00 ; suspendre les
environnements secondaires reliés à la base de production.

## 12. Tests E2E

Non exécutés dans ce lot : la suite Playwright démarre serveur, base et
navigateurs (voir rapport). Scénarios à couvrir : onglet « Conditions »
(consultation/acceptation), « Échéances », recouvrement propriétaire,
revue des encaissements directs.

## 13. Tests de release

`certify:release` (1–2 h) non exécuté dans ce lot : à lancer sur la machine de
préproduction avant toute décision de déploiement.

## 14. Rollback 🔒

Redéployer le commit précédent ; les collections ajoutées sont ignorées par
l'ancien code ; aucune donnée historique n'a été modifiée. Attention : retour à
l'ancien comportement global de l'ancien moteur (pénalités imposées à tous les
baux) — à éviter, ou arrêter les deux moteurs (`RENT_PENALTY_ENGINE=OFF`).

## 15. Blocages juridiques

Pénalité de 3 % (clause pénale), modalités de signature électronique,
acceptation du bail, procédure de mise en demeure, imputation légale,
conservation des preuves, pouvoir de représentation d'Altitude Vision, droit
congolais applicable. Aucune règle n'est déclarée juridiquement conforme.

## 16. Autorisations nécessaires

Commit/push/déploiement ; synchronisation des index ; création des politiques
Altitude des baux délégués et campagne d'acceptation ; saisie des conditions
des baux autonomes ; choix du moteur ; activation du job `rental-collection-cycle`.
