# Audit du déploiement actuel

Audit réalisé le 3 novembre 2026, sans mutation des services.

| Élément | État vérifié |
|---|---|
| GitHub `main` | `46ed3cce32acfb255f207de1428f66685f3d3a98` |
| PR #31 | fusionnée le 2 novembre 2026 à 22:58:17 UTC |
| Frontend | Vercel, déploiement GitHub `7505583581`, état `success`, même SHA |
| Domaine | `altitudevision.agency` redirige en 308 vers `www`; réponse 200, en-têtes Vercel |
| Route web assistant | 200 sur `/immobilier/assistant` |
| Backend | Render confirmé par `x-render-origin-server`; `/api/health` répond 200 |
| IA-03 public | `/api/altimmo/assistant/status` répond 200 avec `enabled:false` |
| Conseiller DeepSeek déployé | **non** : `/api/altimmo/advisor/status` répond 404, même sans considérer l’authentification |
| Netlify | configuration historique dans le dépôt, mais aucun indice runtime : le frontend réel est Vercel |
| Prévisualisation | déploiement Vercel Preview du commit PR `a0e7a2f…` recensé par GitHub |

## CI GitHub

Les workflows du commit fusionné (`E2E`, `Lint & Format Check`) sont en échec. Tous les jobs retournent zéro étape, y compris lint, tests, type-check et mobile : ils n’ont donc pas exécuté le code. Cette signature confirme que le blocage de lancement/facturation signalé reste actif ou équivalent. Les tests locaux ne remplacent pas cette CI.

## Conclusion de compatibilité

Le frontend fusionné est déployé, mais le backend public ne contient pas la route du conseiller fusionné. L’expérience DeepSeek interne ne peut donc pas fonctionner sur l’hébergement réel actuel. La présente branche n’essaie pas de contourner ce décalage : elle affiche la découverte publique et garde DeepSeek fermé.
