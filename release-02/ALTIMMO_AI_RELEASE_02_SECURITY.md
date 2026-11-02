# Contrôle sécurité de publication

- Aucun `.env`, clé DeepSeek, secret de paiement, jeton, sauvegarde ou donnée propriétaire ajouté au diff.
- Aucun identifiant utilisateur réel ni transcription personnelle ajouté.
- Le fichier local non suivi à variante Unicode n'est pas dans la branche distante.
- La présentation publique ne connaît aucune clé, ne lit pas MongoDB et ne déclenche pas de conversation.
- Les routes Advisor publiques testées refusent l'anonyme en 401 avant le contrôleur métier.
- Flags, allowlist, budget, rate limiting, garde-fous commerciaux et arrêt LLM restent côté serveur.
- IA-03 reste désactivé publiquement selon la réponse `enabled:false` observée.
- Aucun assouplissement de sécurité n'a été effectué pour la CI ou l'hébergement.

Limite : un test authentifié production n'a pas été tenté, faute d'autorisation pour utiliser un compte ou déclencher un fournisseur. La certification interne doit rester en provider simulé.
