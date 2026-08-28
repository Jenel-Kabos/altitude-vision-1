# Contrat RBAC

| Endpoint | Role | Allowed before | Allowed after | Source |
|---|---|---|---|---|
| GET list | Admin, Collaborateur, GestionnaireImmobilier, CommunityManager | oui | oui | `auth.protect` + `isStaff` |
| GET list | PlatformOperator actif (rôle Admin) | oui | oui | contexte opérateur canonique |
| GET list | Proprietaire | oui, scope owner | oui, identique | branche `query.owner` |
| GET list | Client | oui, scope guest | oui, identique | branche `query.guest` |
| GET list | autre rôle authentifié | oui, scope guest historique | oui, identique | branche `else query.guest` |
| GET list | anonymous | non | non | `auth.protect` |

Le middleware ajouté ne requiert un tenant que pour `ALL_STAFF` ou PlatformOperator. Il ne modifie donc aucun droit self-service. Aucun rôle ajouté/retiré, aucune permission modifiée.
