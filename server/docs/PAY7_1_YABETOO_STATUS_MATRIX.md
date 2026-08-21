# PAY-7.1 — Matrice statuts Yabetoo

| Yabetoo status | Local status | Terminal | Retry allowed | Source |
|---|---|---:|---:|---|
| `succeeded` | `Payé` / `payé`, state `succeeded` | Oui | Non | confirm/webhook officiels |
| `failed` | `Échoué` / réponse `échoué`, state `failed` | Oui | seulement nouvelle intention explicitement conçue ultérieurement | webhook officiel |
| `expired` | échec terminal, state `failed` | Oui | idem | exemple confirm officiel |
| autre/absent | état métier non payé, state `pending` | Non confirmé | Non | fail-closed |
| timeout réseau | état `*_unknown` | Non | Non | politique locale sûre |

Les noms locaux `creating`, `create_unknown`, `confirming`, `confirm_unknown` décrivent le workflow interne, pas des statuts inventés du provider.
