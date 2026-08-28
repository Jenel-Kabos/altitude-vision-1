# RELEASE-CONSOLIDATION-SECURITY-1 — Plan de rollback (documentation uniquement)

## Backend (Render)

Rollback via redéploiement de la révision précédente (commit/version précédent sur Render). Aucune migration n'a été appliquée par cette release (voir `_DIFF_CLASSIFICATION.md`), donc un rollback applicatif backend est **sûr et suffisant** — pas de désynchronisation de schéma à gérer. Le nouveau modèle `ImapSyncCheckpoint` est additif : une version antérieure du code l'ignorera simplement sans erreur si la collection existe déjà en base (elle ne sera pas lue).

## Frontend (Netlify)

Rollback via le déploiement précédent conservé par Netlify ("previous deploy" / rollback natif de la plateforme). Aucune dépendance destructive côté frontend.

## Base de données (Mongo)

**Aucun rollback destructif proposé par défaut.** Cette release n'introduit aucune migration ni modification de schéma existant — seule une nouvelle collection additive (`ImapSyncCheckpoint`) apparaît. Un rollback applicatif (revenir au code précédent) suffit ; il n'y a pas besoin de toucher aux données. Si la collection `ImapSyncCheckpoint` doit être nettoyée après un rollback (optionnel, non urgent), cela devra être décidé et exécuté manuellement par un humain — **jamais automatiquement, et jamais par ce mandat**.

## Mobile

Sans objet pour cette release (aucun changement mobile déployé, voir `_DEPLOYMENT_PLAN.md` — `NOT PART OF THIS RELEASE` par défaut).

## Ordre de rollback recommandé (inverse du déploiement)

1. Frontend → version précédente (Netlify).
2. Backend → version précédente (Render).
3. Aucune action base de données requise dans le cas général.

Rien de ce plan n'a été exécuté — document préparatoire uniquement, pour une éventuelle phase `RELEASE-PUSH-DEPLOY-1` future.
