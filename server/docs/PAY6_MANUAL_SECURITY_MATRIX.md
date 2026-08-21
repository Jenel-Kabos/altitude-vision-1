# PAY-6 — Matrice sécurité

| Threat | Protection | État/test |
|---|---|---|
| Confirmation forgée | capability + scope tenant/hôtel | tests autorisation existants |
| Fausse preuve | aucune preuve acceptée actuellement | fail-closed, fonctionnalité absente |
| IDOR/cross-tenant | `financialAuthorizationService` | tests Financial Security/F2.6 |
| Double approval | filtre atomique pending + ledger idempotent | F2.2 Mongo |
| Montant/overpayment | entier XAF ; allocation bornée par solde | F2.2 Mongo |
| Validator forgé | actor vient de `req.user` | contrôleur |
| URL publique | aucune preuve stockée | pipeline privé à construire |
| Delete confirmed | aucune route delete | prouvé par routes |
| Double allocation | transaction + soldes atomiques | F2.2 Mongo |

Réserve : la création générique accepte `confirmed=true` uniquement après contrôle `PAYMENT_CONFIRM`; ce comportement historique ne constitue pas le workflow de preuve/contre-validation demandé pour virement/chèque.
