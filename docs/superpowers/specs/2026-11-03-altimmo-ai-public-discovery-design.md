# Conception — découverte publique de l’assistant IA Altimmo

## Décision

Rendre l’assistant identifiable sur l’accueil, l’espace immobilier, la navigation et l’application mobile, sans créer un second agent. La route existante `/immobilier/assistant` devient la destination publique unique.

## Expériences

- **Visiteur / compte non autorisé** : page de présentation honnête, exemples non interactifs, statut « Bientôt disponible », liens vers les annonces et Altimmo. Aucun appel au conseiller DeepSeek.
- **IA-03 activé** : le formulaire de recherche déterministe existant reste disponible, sans régression.
- **Testeur autorisé** : le gate existant interroge le backend authentifié et ouvre le conseiller conversationnel existant.
- **Ouverture publique DeepSeek** : non implémentée et non activable par la seule couche de présentation.

## Architecture minimale

1. Un composant web public réutilisable `AssistantPublicDiscovery` alimente les emplacements de découverte et l’état désactivé de la route.
2. La page d’accueil et la page Altimmo ajoutent chacune un seul bloc contextuel.
3. Le sous-menu Altimmo ajoute une seule entrée « Assistant IA ».
4. Le mobile rend la carte existante toujours visible. Son libellé dépend de la disponibilité réelle.
5. L’écran mobile existant affiche la présentation lorsque IA-03 est désactivé ; le gate DeepSeek et les écrans conversationnels restent inchangés.

## Sécurité

La présentation ne connaît aucune clé, ne touche pas MongoDB et n’appelle aucune route de conversation. Les contrôles serveur `ALTIMMO_ADVISOR_ENABLED`, environnements autorisés, allowlist utilisateur, coupe-circuit LLM et budgets restent les seules autorités. Le mode public DeepSeek demeure absent.

## Accessibilité et performance

HTML sémantique, focus visible, liens réels, textes explicites, aucune fausse conversation, aucune animation lourde ni dépendance supplémentaire. La présentation est responsive et respecte les styles existants.

## Déploiement

Le changement web exige un nouveau déploiement Vercel. Le changement mobile exige au minimum une nouvelle livraison JavaScript compatible avec la politique EAS ; une compilation native reste recommandée avant Store. Aucun déploiement n’est exécuté dans cette mission.
