# SECURITY-FINAL-CLOSURE-BLOCKERS-HOTFIX-1 — Matrice des effets de bord

| Blocker | Effet de bord vérifié | Résultat sur refus | Preuve |
|---|---|---|---|
| FCA1-01 | `Contrat` créé sur la Property cross-tenant | Aucun document créé | test 2 |
| FCA1-01 | `Paiement`/échéancier généré | 0 document (`Paiement.countDocuments({})` = 0) | test 2 |
| FCA1-01 | `Property.availability` du bien cross-tenant | Inchangée (`Disponible`) | test 2 |
| FCA1-01 | Gestion Locative activée (`ensureRentalManagementActive`) | Jamais appelée (authority avant side effect) | conception + test 2 |
| FCA1-02 | `Reservation.status` | Reste `active` (pas `cancelled`) | test 6 |
| FCA1-02 | `Property.availability` du bien réservé | Reste `Réservé` (pas libérée) | test 6 |
| FCA1-02 | `workflow.releaseReservation` | Jamais appelé sur refus (authority avant side effect) | conception + test 6 |
| FCA1-02 | Notifications (client/propriétaire) | Aucune envoyée sur refus (conséquence directe de l'absence d'appel à `releaseReservation`) | conception |

## Effets de bord sur accès AUTORISÉ (comportement historique préservé)

| Blocker | Effet de bord | Résultat | Preuve |
|---|---|---|---|
| FCA1-01 | `Contrat` + échéancier créés sur Property du même tenant | Comportement historique inchangé | test 1 |
| FCA1-02 | `Reservation.status → cancelled`, notifications envoyées | Comportement historique inchangé | test 5 |

## Ordre authority-before-side-effect (§9/§18 du mandat)

Les deux correctifs insèrent la vérification tenant **immédiatement après le chargement de la ressource et avant toute écriture** :
- FCA1-01 : juste après `Property.findById`, avant la comparaison de statut, la vérification de réservation/disponibilité, l'activation de la Gestion Locative, et `Contrat.create`.
- FCA1-02 : juste après le calcul de `allowed`/`isClientOrOwner`, avant la validation du motif et `workflow.releaseReservation`.

Aucune écriture, notification, ou document n'est produit avant que l'autorité ne soit confirmée.
