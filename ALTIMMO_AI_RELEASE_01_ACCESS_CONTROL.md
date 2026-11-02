# Contrôle d’accès

Le changement de visibilité n’affaiblit pas le contrôle d’accès.

- Visiteur anonyme : aucun appel à `/advisor/status`, aucune conversation DeepSeek.
- Compte connecté : le client consulte le statut authentifié ; une réponse indisponible affiche la présentation/IA-03.
- Testeur : accès seulement si le backend valide activation globale, environnement et identifiant allowlisté.
- Routes : middleware d’authentification puis `requireAdvisorAccess` côté serveur.
- Coupe-circuit : `ALTIMMO_ADVISOR_LLM_STOP` et configuration LLM existante.
- Budget : compteur et abort testés ; fournisseur simulé par défaut.

L’intégration MongoDB confirme : anonyme refusé, compte non autorisé indisponible, isolation entre comptes, budget épuisé sans appel fournisseur, modes moteur/secours et autorisations corrects.

Important : le backend Render public répond actuellement 404 sur la route advisor ; le test interne hébergé n’est donc pas opérationnel tant que le backend fusionné n’est pas déployé séparément.
