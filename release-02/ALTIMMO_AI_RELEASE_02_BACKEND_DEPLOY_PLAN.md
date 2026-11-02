# Plan contrôlé de déploiement backend

Le backend n'est pas modifié par la PR #32. Avant toute nouvelle opération Render :

1. Dans Render, relever service, dépôt, branche, SHA du dernier succès, root directory, build et start command.
2. Comparer le SHA à `46ed3cce32acfb255f207de1428f66685f3d3a98`; ne pas redéployer si ce SHA est déjà certifié.
3. Vérifier uniquement la présence, sans afficher les valeurs, de MongoDB, JWT et configuration Advisor.
4. Maintenir `ALTIMMO_ADVISOR_ENABLED` fermé hors environnement interne, le coupe-circuit LLM actif, l'allowlist minimale et les plafonds budgétaires.
5. Exécuter health, IA-03 status, Advisor status sans jeton (401), compte non autorisé, puis compte interne avec fournisseur simulé.
6. Vérifier recherche/compare IA-03, isolation des conversations, limites de débit, budget épuisé et absence d'appel fournisseur réel.
7. Arrêter si le health échoue, si une route publique contourne l'authentification, si le provider réel est sollicité, si une variable manque ou si une migration est demandée.

Rollback : remettre le déploiement Render précédemment réussi, conserver les flags fermés et revérifier health/IA-03. Aucun rollback MongoDB n'est prévu ni autorisé. Le déploiement lui-même exige une autorisation Direction distincte.
