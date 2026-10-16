# F-U2.12 — Matrice de conformité des règles locatives et financières

**Aucune règle de ce tableau n'est déclarée juridiquement conforme.** La
conformité au droit applicable en République du Congo (bail d'habitation,
obligations, recouvrement, protection des données, réglementation des
paiements) n'a pas été vérifiée par un juriste. « État technique » décrit
uniquement l'implémentation locale certifiée par tests.

| Règle | Décision métier | Base contractuelle nécessaire | Validation juridique | État technique | Condition d'activation | Risque résiduel |
|---|---|---|---|---|---|---|
| Prorata base 30 jours | Validée | Clause de prorata citée (`prorataClauseReference`) — exigée à la génération | À obtenir (validité de la convention 30 j) | Implémenté, testé (28/29/30/31 j) | Clause présente dans les baux ; décision de bascule | Bail sans clause → facture refusée (blocage opérationnel) |
| Février (base 30, jours manquants en fin de mois) | Validée | Même clause, mentionnant février | À obtenir (28 → 3/30 facture des jours inexistants) | Implémenté (15 000 / 10 000) | Idem | Contestation possible d'un locataire entrant le 28 |
| Le 31 | Validée : couvert sans supplément ; entrée le 31 → aucune créance | Clause conseillée | À obtenir | Implémenté | Idem | Faible |
| Paiement à terme échu (exigible le 30 / dernier jour de février) | Validée | Clause d'échéance | À obtenir | Implémenté | Idem | Baux historiques stipulant d'autres échéances : à recenser |
| Tolérance jusqu'au 5 inclus | Validée | Clause | À obtenir | Implémenté (fin du 5, Africa/Brazzaville) | Idem | Faible |
| Pénalité 3 % du loyer impayé au 5 | Validée (calcul) | Clause pénale | **Requise** (taux, caractère de clause pénale, proportionnalité) | Prévisionnelle uniquement (`SIMULATED`), exigibilité refusée | Validation juridique + clause | Ancien moteur encore actif par défaut (3 % du total) |
| Sorties anticipées | Validée : prorata seulement sur fondement | Clause, accord de sortie, ou texte | Requise pour chaque fondement « LEGAL_PROVISION » | Implémenté (`RentLeaseExit`, dates distinctes) | Décision de sortie saisie par un acteur habilité | Saisie erronée de la date de fin d'obligation (non modifiable : correction = procédure à définir) |
| Changement de loyer en cours de mois | Validée : fractions /30 | Avenant (`avenants` type loyer) | Révision de loyer encadrée par la loi : à vérifier | Implémenté ; incohérence → blocage | Avenants complets (avant/après/date) | Avenants historiques incomplets → blocage |
| Charges | Validée : prorata seulement si proratisables | Nature des charges dans le bail (`natureCharges`) | Régularisation des charges au réel : à vérifier | Forfait/provision prorata ; réel/individualisées/exceptionnelles hors facture mensuelle ; inconnue + mois partiel → blocage | Renseigner la nature des charges des baux | Charges au réel non facturées par ce moteur (régularisation non implémentée) |
| Imputation des paiements partiels | Validée : instruction > clause > loyer d'abord | Clause d'imputation facultative (`ordreImputation`) | Règles légales d'imputation : à vérifier | Implémenté (source unique `rentImputationService`) | — | Imputation légale impérative éventuelle non codée |
| Report d'échéance | Validée : suspension jusqu'à l'échéance du report | — | À vérifier | Implémenté | — | Faible |
| Mise en demeure | Validée (préparation au 25) | Mandat de représentation si mandataire | **Requise** (modèle, émetteur, canal, délais, preuve de remise) | Projet uniquement, envoi refusé | Validation juridique complète | Aucun envoi tant que non validé |
| Gestion autonome | Validée | Conditions générales d'abonnement | À vérifier (CGV) | Implémenté | Tarifs officiels activés en production | — |
| Gestion déléguée | Validée (10 %) | Mandat de gestion | Mandat : à vérifier | Implémenté (F-U1) | — | — |
| Frais variables 1 % | Validée : tous formules, y compris bailleurs `tenant:null` | CGV / conditions d'abonnement | À vérifier (CGV) | Implémenté : base = loyer encaissé et confirmé, hors charges/pénalités ; jamais avec 10 % | Tarifs + abonnements actifs | Encaissements non déclarés par le bailleur : non détectables |
| Commission 10 % | Validée : hors charges | Mandat | — | **Corrigé F-U2.12** : base = part loyer (imputation partagée) ; part loyer indéterminable → refus | — | Paiement sans bail renseigné ni allocation : base brute (signalée `GROSS_LEASE_UNKNOWN`) |
| Justificatifs d'encaissement direct | Validée : déclaration ≠ confirmation | CGV (obligation de déclarer) | Valeur probante des références : à vérifier | Références uniquement ; confirmation par le locataire ou revue plateforme ; jamais par le bailleur | — | Stockage de fichiers non admissible (bloqué) |
| Conservation des données | À décider | — | **Requise** (durées de conservation comptable, données personnelles) | Aucun fichier stocké ; références et historiques en base | Politique de conservation | Durée de conservation non définie |
