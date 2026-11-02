# Diagnostic Render prioritaire

Service public sondé : `https://altitude-vision.onrender.com`, confirmé par `x-render-origin-server: Render`.

| Contrat | Résultat non authentifié |
|---|---:|
| `GET /api/health` | 200 |
| `GET /api/altimmo/assistant/status` | 200, `enabled:false` |
| `GET /api/altimmo/advisor/status` | 401, token absent |
| `GET /api/altimmo/advisor/conversations/probe` | 401, token absent |
| `POST /api/altimmo/advisor/conversations/probe/turns` avec `{}` | 401, token absent |
| `OPTIONS` sur la route de tour | 204 |

Le GET de statut est bien un contrat GET dans la source ; son 401 actuel prouve que la route Advisor est montée et que le middleware `protect` s'exécute. Le POST de conversation atteint également l'authentification avant toute opération, sans appel DeepSeek.

La 404 constatée dans RELEASE-01 n'est plus reproductible. Elle correspondait à une surface déployée ne servant pas encore ces routes, ou à une transition de déploiement, mais l'accès public ne permet pas de départager ces causes historiques. Le SHA Render exact, la branche, le root directory, les commandes et les logs ne sont pas exposés par les endpoints publics ; ils restent à confirmer dans le tableau Render. La présence du comportement introduit par `b3f99334` prouve seulement que ce code, ou un équivalent, est actuellement actif — pas le SHA intégral déployé.
