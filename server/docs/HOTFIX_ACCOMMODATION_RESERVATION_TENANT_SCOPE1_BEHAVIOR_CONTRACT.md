# Contrat comportemental

- Staff : tenant actif obligatoire ; ressource hors tenant masquée en 404.
- PlatformOperator : global autorisé, scoped strictement isolé.
- Proprietaire/Client : ownership historique inchangé.
- Transitions, statuts, dates, pricing, facturation et locks : règles historiques inchangées.
- Refus tenant : avant tout appel du service de transition et donc avant tout effet de bord.

