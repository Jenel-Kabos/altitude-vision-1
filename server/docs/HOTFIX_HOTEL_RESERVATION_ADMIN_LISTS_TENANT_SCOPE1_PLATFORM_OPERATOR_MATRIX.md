# HZ-05 — Matrice PlatformOperator

| Mode | `/admin/list` | `total` | `/status/pending` |
|---|---|---|---|
| Global | A+B (5) | 5 | tous pending A+B (3) |
| Scoped A | A (2) | 2 | pending A (1) |
| Scoped B | B (3) | 3 | pending B (2) |

Cette matrice est prouvée runtime. Le middleware canonique autorise explicitement le mode platform-wide et le contrôleur n'ajoute le filtre Mongo que lorsqu'un `req.platformTenant` a effectivement été résolu.
