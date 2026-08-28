# Contrat RBAC avant/après

| Endpoint | Role | Read | Create | Update | Delete | Source |
|---|---|---:|---:|---:|---:|---|
| availability public | public | oui | non | N/A | non | route publique |
| availability-blocks GET | tout rôle authentifié | oui | non | N/A | non | `auth.protect`, absence volontaire de guard additionnel |
| reservation-calendar GET | Admin, Collaborateur, GestionnaireImmobilier, CommunityManager | oui | non | N/A | non | `isStaff` dans le contrôleur |
| reservation-calendar GET | Proprietaire possédant la ressource | oui | non | N/A | non | `isOwnerOfAccommodation` |
| availability-blocks POST | mêmes quatre rôles staff | non | oui | N/A | non | `isStaff` |
| availability-blocks POST | Proprietaire possédant la ressource | non | oui | N/A | non | ownership |
| availability-blocks DELETE | mêmes quatre rôles staff | non | non | N/A | oui | `isStaff` |
| availability-blocks DELETE | Proprietaire possédant la ressource | non | non | N/A | oui | ownership |

Le contrat après correctif est strictement identique. Aucun rôle ajouté ou supprimé ; seule la ressource accessible par un staff tenant-scoped est restreinte. PlatformOperator global et scoped conservent leur contrat canonique.
