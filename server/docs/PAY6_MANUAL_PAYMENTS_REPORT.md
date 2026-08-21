# PAY-6 — Paiements manuels — Rapport final

## Verdict

**GO SOUS RÉSERVES — PAY-6 NON CERTIFIÉ VERT.**

Le noyau manuel est robuste et déjà fonctionnel pour les trois méthodes, mais le mandat complet n'est pas satisfait : preuve privée, rejet audité et reçu de paiement dédié sont absents. Aucun faux mécanisme n'a été ajouté.

## Réponses essentielles

- Avant PAY-6 : cash actif ; virement/chèque partiels ; modèle `FinancialPayment`, aucun nouveau modèle.
- Méthodes : `cash`, `bank_transfer`, `cheque`; provider toujours `manual`.
- Virement/chèque initiaux : `pending`; une preuve ne confirme rien car aucun upload n'existe.
- Validation : Admin, Collaborateur, Secretaire dans le scope hôtel ; Client/Proprietaire non.
- Montant : fourni à la route mais validé entier/XAF ; la protection d'overpayment est canonique à l'allocation. Politique existante inchangée.
- Statut/validator/provider sensibles ne sont pas repris librement du payload du flux hôtel.
- Concurrence : confirmation et allocation atomiques/idempotentes ; ledger unique testé.
- Paiement partiel et reversal d'allocation supportés ; suppression physique absente.
- Reçu dédié : absent ; facture PDF non présentée comme reçu.
- Readiness hôtel reste method/provider agnostic et dépend des allocations.
- Location, vente, visites, Yabetoo, MTN et Airtel inchangés. Tenant security inchangée.

## Gates

Les suites existantes F2.2/F2.3/Financial Core et serveur étaient vertes au démarrage du sprint précédent ; PAY-6 n'a modifié aucun code exécutable. `git diff --check` final est vert.

## Suite nécessaire

Construire un rattachement de preuve via le stockage privé existant avec MIME/taille contrôlés, un service atomique de rejet pending→failed avec actor/reason/ledger, puis un reçu canonique post-confirmation. Ajouter ensuite les tests Mongo adversariaux demandés avant certification.

Aucun commit, push ou déploiement.
