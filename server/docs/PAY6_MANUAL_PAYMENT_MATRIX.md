# PAY-6 — Matrice paiements manuels

| Method | Initiator actuel | Initial status | Proof | Validator | Final action |
|---|---|---|---|---|---|
| `bank_transfer` | Staff finance | pending | ABSENT | Admin/Collaborateur/Secretaire avec scope hôtel | confirm puis allocation explicite |
| `cash` | Staff finance | pending, ou succeeded via route générique autorisée | non requise | même staff | confirm puis allocation explicite |
| `cheque` | Staff finance | pending | ABSENT | même staff | confirm puis allocation explicite |

Le client et le propriétaire ne peuvent actuellement ni déclarer ni confirmer via ces routes. Location, vente, visites et Yabetoo restent inchangés.
