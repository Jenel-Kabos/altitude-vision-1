# Contrat comportemental

- Réponses et payloads autorisés : inchangés.
- Ressource cross-tenant : 404 `NOT_FOUND`, conformément au masquage canonique par query scopée.
- Staff sans tenant : 403 par middleware canonique.
- Same-tenant Admin et autres capacités métier légitimes : inchangés.
- PlatformOperator global/scoped : inchangé hors fermeture du cross-tenant scoped.
- Ownership Proprietaire : inchangé ; il n'est pas remplacé par une simple appartenance tenant.
- Concurrence : mutex/night locks et transactions existants non refactorés.
- Route publique d'availability : inchangée.
- Update block : NON APPLICABLE, aucun endpoint vivant.
