# PAY-7.1 — Matrice API Yabetoo

| Action | Method | Endpoint | Auth | Required fields | Idempotency | Source officielle | Confirmé |
|---|---|---|---|---|---|---|---|
| create | POST | `/v1/payment-intents` | Bearer secret | `amount`, `currency`; description/metadata optionnels | SDK documenté, header REST NON CONFIRMÉ | `/en/payments/api/create` | Oui |
| confirm | POST | `/v1/payment-intents/:id/confirm` | Bearer secret | `client_secret`, `payment_method_data.type=momo`, `momo.country`, `momo.msisdn`, `momo.operator_name`; identité/email optionnels | NON CONFIRMÉ | `/en/payments/api/confirm` | Oui |
| retrieve/status | GET | `/v1/payment-intents/:id` | Bearer secret | id dans le chemin | N/A | index officiel API Reference « Get Payment Intent » | Endpoint oui ; schéma détaillé NON CONFIRMÉ |
| webhook | POST entrant | URL marchand | HMAC-SHA256 sur `timestamp.raw_body` | signature, timestamp, événement, id | `X-Yabetoo-Webhook-Id` + dédup locale | `/en/developer-tools/webhook/overview` | Oui |

## Écart de payload

| Champ | Code initial | Documentation actuelle | Action |
|---|---|---|---|
| amount/currency | CREATE | requis | conservé, entier positif/XAF |
| description/metadata | CREATE | optionnel | conservé |
| payment_method_data | CREATE | requis à CONFIRM | déplacé vers CONFIRM |
| customer | CREATE | non présent au contrat courant | supprimé ; champs optionnels au CONFIRM |
| client_secret | absent | requis à CONFIRM, retourné par CREATE | transmis en mémoire seulement |

Le `clientSecret` est un credential de confirmation retourné par CREATE. Il n'est ni loggé, ni renvoyé au client, ni persisté. Sa durée de vie n'est pas publiée : **NON CONFIRMÉ**.
