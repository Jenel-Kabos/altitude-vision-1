# PAY-7.1 — Matrice timeout Yabetoo

| Phase | Timeout | Provider peut avoir accepté ? | Retry immédiat ? | Reconciliation |
|---|---|---:|---:|---|
| CREATE | `provider_timeout_unknown` / `create_unknown` | Oui | Non | impossible sans référence ; traitement opérateur |
| CONFIRM | `provider_timeout_unknown` / `confirm_unknown` | Oui | Non | GET avec la référence persistée |
| STATUS | résultat local inchangé | sans objet | pas de mutation/recréation | prochain GET explicite |

Timeout HTTP explicite : `YABETOO_TIMEOUT_MS`, défaut opérationnel 15 000 ms faute de recommandation provider. Axios n'a aucun interceptor ni mécanisme de retry. Un timeout n'est jamais traduit en échec financier.
