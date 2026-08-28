# ARCH-2G — Risque métier

| Edge | Domaines réels | Sensibilité | Blast radius |
|---|---|---|---|
| Contrat | immobilier, location, documents | HIGH | HIGH |
| Devis | CRM/commercial, notifications/email | MEDIUM | MEDIUM |
| Estimation | immobilier, CRM, documents/uploads, notifications | HIGH | HIGH |
| GestionDoc→Contrat | location, documents légaux | HIGH | HIGH |
| GestionDoc→Paiement | finance, paiement, documents légaux | CRITICAL | CRITICAL |
| Locataire | location, IAM | HIGH | HIGH |
| Paiement | location, finance, paiement | CRITICAL | CRITICAL |
| PlatformTenantDomain | SaaS tenant/IAM | CRITICAL | CRITICAL |
| Proprietaire | immobilier, location | HIGH | HIGH |
| Projet | legacy Altcom non monté | NON CONFIRMÉ | MEDIUM |
| Realisation | portfolio legacy non monté | NON CONFIRMÉ | MEDIUM |
| RentalManagement | gestion locative, ownership | CRITICAL | CRITICAL |
| User | IAM, business profiles, tenant | CRITICAL | CRITICAL |

Aucune edge ne concerne directement hôtel, messaging ou moderation/publication. Aucun appel Socket.IO n'a été trouvé dans ces usages. Cloudinary est présent uniquement dans le flux Estimation.
