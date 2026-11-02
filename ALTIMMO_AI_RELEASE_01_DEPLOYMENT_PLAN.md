# Plan de déploiement et brouillon de PR

## Ordre contrôlé

1. Corriger le blocage de facturation GitHub et obtenir une CI réellement exécutée.
2. Ouvrir une PR de cette branche locale vers `main`; faire vérifier diff, captures et tests.
3. Déployer la présentation web avec IA-03 public désactivé et DeepSeek fermé.
4. Vérifier accueil, Altimmo, navigation, route publique et absence d’appels advisor anonymes.
5. Déployer séparément le backend fusionné sur un environnement interne, coupe-circuit LLM actif.
6. Tester le compte allowlisté en fournisseur simulé, puis seulement après autorisation explicite envisager DeepSeek.
7. Valider Android sur device et iOS natif avant toute livraison Store/OTA.

## Retour arrière

Revenir au commit précédant cette branche côté frontend/mobile. Aucun rollback de base ni migration n’est requis. Le coupe-circuit serveur reste actif indépendamment de l’interface.

## Brouillon de description PR

**Résumé** : rend l’Assistant immobilier IA Altimmo découvrable publiquement sur web et mobile sans ouvrir DeepSeek. Réutilise le gate, IA-03 et l’agent existants.

**Tests** : 111 tests pertinents, build Next.js, lint web/mobile, type-check mobile.

**Flags/permissions** : inchangés ; activation globale, environnements, allowlist, budget et LLM stop restent côté serveur. Ouverture publique non implémentée.

**Risques** : backend Render en retard (route advisor 404), CI GitHub non exécutée, mémoire processus, SSE production et iOS non certifiés.

**Rollback** : revert des commits de présentation ; aucune migration.

## Commandes de vérification après checkout

```bash
cd client && npm ci && npm run build:next
cd ../altimmo-app && npm ci && npm run lint && npm run typecheck
cd ../server && npm ci
```
