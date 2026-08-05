# GL-MOBILE-1 — Audit initial Web / API / Mobile

Date : 2026-08-05

## Backend existant

Le portail locataire dispose déjà d'un périmètre API protégé par `auth.protect`, monté sous `/api/tenant-portal`. Toutes les lectures résolvent le dossier locataire depuis l'utilisateur authentifié ; aucun identifiant de locataire fourni par le client n'est accepté pour accéder aux données.

| Verbe | Route | Donnée/action | Réutilisable Mobile |
|---|---|---|---|
| GET | `/dashboard` | Synthèse calculée côté serveur | oui |
| GET | `/me` | Profil locataire autorisé | oui |
| GET | `/lease`, `/leases` | Bail actif et historique | oui, exposition GL-LIFE à compléter |
| GET | `/payments` | Échéancier, totaux et pagination | oui |
| GET | `/documents` | Coffre documentaire filtré et paginé | oui |
| GET | `/documents/:id/download` | Contrôle d'accès puis redirection Cloudinary | navigateur seulement en l'état |
| GET | `/notice` | Préavis et historique calculés côté serveur | oui |
| GET | `/maintenance` | Tickets et pagination | oui |
| POST | `/maintenance` | Création avec 0 à 5 photos | oui |
| GET | `/link-status` | État du rattachement | oui |
| POST | `/activate`, `/request-link` | Activation et demande de rattachement | oui |

Les règles de paiement, de jours restants, d'accès documentaire, de préavis, de cycle locatif et de transition maintenance restent dans `tenantPortalService`, `tenantLinkService`, `rentalMaintenanceService` et GL-LIFE-1.

## Référence Web

`TenantPortalPage` et `useTenantPortal` consomment les routes ci-dessus sans recréer de décision métier. Le portail Web comporte sept sections : tableau de bord, baux, paiements, documents, préavis, maintenance et profil. Il permet la création d'une demande de maintenance et le téléchargement des documents.

Limites constatées dans l'exposition actuelle :

- `publicLease()` ne retourne pas `cycleVie`, `cycleHistory`, `avenants`, `caution`, `etatsDesLieux`, les liens de renouvellement ni le propriétaire ; les données existent pourtant dans `Contrat`.
- le téléchargement répond par une redirection HTTP. Un navigateur authentifié peut la suivre via Axios/Blob, mais `Linking.openURL()` ne peut pas joindre le jeton mobile à l'endpoint protégé.
- les reçus/quittances sont déjà inclus dans `Contrat.documents`; aucune route ou règle supplémentaire n'est nécessaire.

## Mobile existant

- React Navigation 6 avec un stack Profil ; aucun écran locataire.
- SDK NAV-CORE-1 et registre partagé présents, mais aucune destination locataire.
- Axios injecte le JWT depuis SecureStore et normalise les erreurs réseau.
- cache mémoire TTL existant, actuellement utilisé pour les lectures publiques et les visites.
- composants réutilisables : `PageHeader`, `Card`, `Button`, `EmptyState`, `Skeleton`, thème clair/sombre, ImagePicker, FileSystem et Sharing.
- aucune logique d'écriture hors connexion ; les mutations échouent déjà proprement en cas d'absence réseau.

## Notifications et navigation

Les types `tenant_*` existent dans le modèle et sont produits par les services métier. Ils ne sont pas encore associés à des destinations NAV-CORE-1. Le Mobile contient encore un fallback historique par type pour les notifications non locatives ; les notifications locatives seront reliées exclusivement par `destination` et le registre.

## Décisions d'architecture

1. Étendre uniquement le DTO autorisé du bail, sans modifier les transitions ou calculs métier.
2. Conserver l'endpoint documentaire et lui ajouter une représentation JSON opt-in pour les clients natifs ; le contrôle d'accès reste identique.
3. Créer un service Mobile miroir des appels Web, avec cache en lecture seule et invalidation après création de maintenance.
4. Créer un portail natif unique à sections, puis déclarer plusieurs destinations du registre pointant vers cet écran avec un paramètre `section`.
5. Ne jamais mettre en cache une mutation et ne jamais autoriser une création de maintenance depuis une donnée hors connexion.
6. Réutiliser les données et statuts tels que fournis par le serveur ; le Mobile ne calcule ni reste à payer, ni durée, ni prochaine échéance.

