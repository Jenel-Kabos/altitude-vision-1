# F-U2.13 — Matrice d'audit des règles locatives (avant → après)

Constat d'audit (F-U2.9 à F-U2.12) : toutes les règles de recouvrement étaient
**globales**, codées dans `rentCalendarService` / `rentCollectionConstants` et
appliquées à toute échéance (`rentBillingService`, `rentCollectionService`),
y compris aux échéances de suivi des bailleurs autonomes et aux biens
d'organisations sans mandat. L'ancien moteur (`alerteService`) appliquait 3 %
à tout `Paiement` en retard.

| Règle | Avant F-U2.13 | Source | Remplaçable par contrat | Isolée par mode | Risque financier avant | Après F-U2.13 |
|---|---|---|---|---|---|---|
| Terme échu / exigibilité le 30 (fév. dernier jour) | Globale (`rentCalendar`) | Constante | Oui | Non | Factures datées et « en retard » pour des baux à échoir | Politique `due` ; absente → aucune échéance (`dueDate` null) |
| Tolérance jusqu'au 5 | Globale | Constante | Oui | Non | Retard présumé au 6 pour tout bail | Politique `grace` ; absente → fin du jour d'échéance |
| Pénalité 3 % | Globale (canonique) + ancien moteur sur tout `Paiement` | Constante | Oui (taux propre) | Non | Pénalités imposées aux bailleurs autonomes | Politique `penalty` ; Altitude : seulement après acceptation du locataire ; ancien moteur : seulement si la politique stipule une pénalité |
| Déclenchement au 6 | Globale | Constante | Oui | Non | idem | Lendemain de la fin de tolérance stipulée |
| Signalement avant le 25 suspensif | Globale | Constante | Oui | Non | Suspension présumée | `formalNotice.suspendOnDifficultyReport` explicite ; sinon `NOT_APPLICABLE` |
| Mise en demeure au 25 | Globale | Constante | Oui | Non | Projets de mise en demeure pour tout bail | Politique `formalNotice` ; absente → aucun dossier ; Altitude sans acceptation → `blocked_policy` |
| Report approuvé suspensif | Global | Code | Oui | Non | — | `suspendOnApprovedDeferral` explicite |
| Prorata 30 jours | Global | Constante | Oui | Non | Prorata imposé | Politique `prorata` ; absente → mois partiel bloqué (`RENT_PRORATA_POLICY_MISSING`) |
| Imputation | Défaut global « loyer d'abord » + clause bail | Code + bail | Oui | Partielle | Faible | Politique `imputation` > clause du bail > défaut technique (calcul des assiettes 1 %/10 %) |
| Révision de loyer en cours de mois | Fractions /30 globales | Constante | Oui | Non | Prorata imposé | Exige la convention de prorata de la politique |
| Sortie anticipée | Fondement exigé (F-U2.12) ; prorata /30 global | Décision de sortie | Oui | Partielle | Faible | Prorata seulement avec convention de la politique ; fondement toujours exigé |
| Charges | Nature (F-U2.12) | Bail | Oui | Oui | Faible | Inchangé (prorata soumis à la convention de la politique) |
| 1 % gestion autonome | Exclusion si mandat actif à la date d'encaissement | Mandat | — | Partielle | Cumul 1 %/10 % possible lors d'un changement de mode | Régime de la **période du loyer** (`delegatedCoverageAt`), commun avec le 10 % |
| 10 % gestion déléguée | Mandat opérable à la date d'encaissement | Mandat | — | Partielle | Commission sur un loyer d'une période autonome | Refus si la période n'est pas couverte (`COLLECTION_PERIOD_OUTSIDE_MANDATE`) |
| Encaissement direct déclaré | Payé immédiatement (F-U2.11) puis 1 % après confirmation (F-U2.12) | Code | — | — | Créance soldée par simple déclaration | Paiement `pending` non affecté ; confirmation indépendante = paiement confirmé + affectation ; contestation = contrepassation |
| Biens clôturés (abonnement) | Non décidé | Politique de comptage | — | — | Formule erronée | Exclu à partir de la date effective ; période déjà commencée comptée ; date inconnue → à décider |
