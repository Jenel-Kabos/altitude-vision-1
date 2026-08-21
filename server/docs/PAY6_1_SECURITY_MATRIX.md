# PAY-6.1 — Matrice sécurité

| Surface | AuthN | Contrôle propriétaire/staff | Tenant/établissement | IDOR | Données sensibles |
|---|---|---|---|---|---|
| Upload preuve | Oui | Payeur lié ou capacité create | Scope financier staff | Ressource chargée avant accès | Signature binaire, 8 Mio, privé |
| Lecture preuve | Oui | Payeur lié ou capacité view | Scope financier staff | Paiement ciblé contrôlé | Aucun URL/provider exposé |
| Rejet | Oui | Capacité confirm | Scope financier | Paiement ciblé contrôlé | Motif borné/normalisé, ledger |
| Génération reçu | Oui | Capacité confirm | Scope financier | Paiement ciblé contrôlé | PDF privé, hash SHA-256 |
| Lecture reçu | Oui | Payeur lié ou capacité view | Scope financier staff | Paiement ciblé contrôlé | `no-store`, `nosniff` |

Le `guestUser` de la réservation est copié vers `payer.userId`; il ne donne accès qu'au paiement correspondant. Un autre client ne passe pas ce contrôle et doit satisfaire le RBAC financier complet.
