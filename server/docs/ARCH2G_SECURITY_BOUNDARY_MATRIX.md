# ARCH-2G — Frontières de sécurité

| Edge | Auth | Tenant | Ownership | PlatformOperator | Security boundary? | Move risk |
|---|---|---|---|---|---|---|
| Contrat | oui | oui | indirect | non | oui | HIGH |
| Devis | staff sur lectures/mutation | non | non | non | non pour l'accès modèle | LOW |
| Estimation | staff sur liste | non | non | non | partielle | MEDIUM |
| GestionDoc→Contrat | oui | oui | indirect | non | oui | HIGH |
| GestionDoc→Paiement | oui | oui | indirect | non | oui | CRITICAL |
| Locataire | oui | oui | indirect | non | oui | HIGH |
| Paiement | oui | oui | indirect | supporté | oui | CRITICAL |
| PlatformTenantDomain | oui | oui | non | oui | oui | CRITICAL |
| Proprietaire | oui | oui | indirect | non | oui | HIGH |
| Projet | non confirmé | non confirmé | non | non | inconnu | HIGH |
| Realisation | aucune sur fichier | non | non | non | ambiguë | HIGH |
| RentalManagement | oui | oui | oui | non | oui | CRITICAL |
| User | oui | oui | self/staff | indirect | oui | CRITICAL |
