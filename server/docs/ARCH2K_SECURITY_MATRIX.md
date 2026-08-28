# ARCH-2K — Matrice sécurité

| Edge | Auth | Tenant | Ownership | PlatformOperator | Finance | Sensitivity |
|---|---|---|---|---|---|---|
| Accommodation | Extérieure : Dashboard roles ; Reporting Direction | OUI, `tenantId` | OUI dans handler pour sélection propriétaire ; query applique l'ID reçu | OUI, global si opérateur non scopé | OUI, read-only | HIGH |
| Hotel | Extérieure + scopes/capabilities services | OUI, acteur/hôtel | OUI indirect : manager, assignment, Property | OUI, global ou tenant sélectionné | OUI, read-only et dashboard financier adjacent | CRITICAL |
| Location | Extérieure : `ROLES_GL` / Reporting Direction | OUI indirect via OrgUnit | OUI, `Property.owner∈scopeUserIds` | OUI, global si non scopé | OUI, read-only Paiement | MEDIUM-HIGH |

Rôles constatés : Dashboard rentals = `ROLES_GL`; Dashboard accommodations/hotels = `ROLES_ALTIMMO + Proprietaire`; Reporting = `Admin|GestionnaireImmobilier`, protégé et tenant-scopé sauf PlatformOperator autorisé en vue consolidée. Aucune capability n'est inventée. ARCH-2K ne modifie aucun contrôle.
