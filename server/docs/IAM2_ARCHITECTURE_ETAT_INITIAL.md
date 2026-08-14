# IAM-2 — ARCHITECTURE ÉTAT INITIAL

Date : 2026-08-14  
Branche : `main`  
HEAD observé : `c523b3118549da770bc761d5e7b93de8deb58605` (`Update Altimmo 21`)  
HEAD demandé : `da3dfb7c4cc84040f327c2becb35a551b07328c2`

Le nouveau commit contient les changements AUTH-1.1. Le worktree était propre au début d'IAM-2.

## Architecture actuelle

`User.role` est un RBAC legacy à valeur unique. Les identités cumulables sont déjà représentées hors de ce champ par `UserBusinessProfile` (`proprietaire_immobilier`, `exploitant_etablissement`, `locataire`), avec dérivation rétrocompatible depuis les ressources existantes. Les tenants sont autorisés par `OrgMembership`; `PlatformOperator` est une identité plateforme distincte avec capacités. L'hôtellerie applique un ABAC local par `HotelStaffAssignment` et capacités. Les ressources conservent leur ownership (`Property.owner`, `Hotel.createdBy/manager`, `Accommodation.createdBy`).

## Architecture cible

Conserver `User` comme identité unique et séparer : rôle staff legacy, profils métier cumulables, membership tenant, capacités locales et ownership. Ne pas ajouter un `accountType` exclusif : un même utilisateur peut être propriétaire immobilier, exploitant hôtelier et locataire. La cible est donc une union de profils/capacités, pas une nouvelle enum exclusive.

## Matrice d'écart

| Architecture actuelle | Cible | Écart | Risque | Migration |
|---|---|---|---|---|
| `User.role` unique | famille + fonction staff | rôle mélange famille/fonction | migration destructive JWT/UI/mobile | conserver, ajouter projection canonique |
| groupes `STAFF_*`/`ROLES_*` | capacités read/manage | lecture et mutation parfois fusionnées | retrait brutal casse GL/docs | phase progressive route par route |
| `UserBusinessProfile` | profils cumulables | déjà adapté | faible | étendre sans toucher `role` |
| `HotelStaffAssignment` | ABAC établissement | déjà adapté | faible | réutiliser |
| `Property.owner` | ownership immobilier | déjà adapté | fusion avec `Proprietaire.user` dangereuse | conserver les deux relations |
| `Hotel`/`Accommodation.createdBy` | portefeuille hébergement | ownership réparti | établissement ≠ tenant | conserver, unifier uniquement la projection UI |
| sidebars par listes de rôles | navigation par capacités | duplication frontend/backend | dérive d'autorisation | manifeste partagé conceptuellement, backend reste source de sécurité |

## Rôles actuels

`User`, `Client`, `Proprietaire`, `Collaborateur`, `Secretaire`, `GestionnaireImmobilier`, `CommunityManager`, `Communicant`, `Admin`, `Prestataire`. `Collaborateur` est legacy à accès large. `Communicant` est une fonction messages/RDV distincte de la cible minimale, à conserver pour compatibilité.

## Dashboards actuels

| Identité | Dashboard actuel | Cible | Écart |
|---|---|---|---|
| Admin/staff | `/dashboard`, shell commun filtré par rôle | shell commun + modules/capacités | overview non spécialisé |
| propriétaire immobilier | `/mes-biens` + OwnerDashboard | patrimoine dédié | partiellement réalisé |
| exploitant établissement | `/mes-hotels`, `/mes-hebergements`, même shell propriétaire | sélection puis modules adaptés | hôtel avancé existe; maison meublée moins complète |
| Client | site public, compte, favoris, visites, réservations | overview multi-services | pas d'overview client unifié |
| Client lié Locataire | `/espace-locataire` | même compte + identité locataire | conforme |

`/admin/*` subsiste comme surface legacy. Le login route Admin/staff vers `/dashboard`, Proprietaire vers `/mes-biens`, autres vers `/`. La vérification email route par erreur Proprietaire vers `/dashboard`, inaccessible à ce rôle.

## Permissions actuelles

Admin est inclus dans tous les groupes métier, mais reste soumis à tenant, ABAC hôtel, intégrité et invariants financiers. Secrétaire : documents/paiements, mais aussi `ROLES_GL` (trop large). Gestionnaire : GL/visites/maintenance, mais aussi `STAFF_DOC`/`ROLES_DOCS` (plus large que la cible) et certaines lectures financières. CommunityManager : Altcom/Mila, mais aussi création/listing opérationnel immobilier/hébergement via `ROLES_ALTIMMO`; la modération est heureusement limitée à `ROLES_MODERATION` (Admin/Collaborateur).

## Staff actuel

Les groupes de rôles sont centralisés dans `server/utils/roles.js`, mais le frontend les recopie dans `AdminDashboard.jsx`. Il n'existe pas de délégation générique de capacités staff. La finance hôtelière et les assignments hôtel possèdent déjà des moteurs fins qu'il ne faut pas dupliquer.

## Propriétaires

`Property.owner → User` prouve le propriétaire opérationnel du bien/compte. `Proprietaire.user → User` rattache une fiche métier GL, parfois via compte technique; il ne remplace pas `Property.owner`. L'auteur de l'annonce, le destinataire des notifications et l'ayant droit doivent rester résolus par le workflow concerné, pas par fusion automatique de ces champs.

## Hébergement

Un compte peut créer plusieurs `Accommodation` et `Hotel`. `HotelStaffAssignment` relie un utilisateur à plusieurs hôtels avec rôle local/capacités; `Hotel.manager` fournit la compatibilité legacy. Maison meublée et hôtel sont des ressources/modes d'exploitation, jamais des rôles ni des tenants.

## Clients et Locataire

Le rôle Client couvre les usages multi-services. `Locataire.user` est une identité métier optionnelle, unique et explicitement rattachée. Le portail résout toujours depuis `req.user`; aucun `locataireId` navigateur ne devient preuve d'identité.

## Tenant et PlatformOperator

Tenant = périmètre organisationnel SaaS; établissement = ressource métier. AUTH-1.1 centralise et valide la sélection opérateur. PlatformOperator ne signifie pas Admin global implicite : les routes scoped exigent toujours un tenant sélectionné.

## Matrice de capacités cible issue du code

| Capacité | Admin | Secrétaire | Gestionnaire | Community Manager |
|---|---:|---:|---:|---:|
| users/staff/settings/audit manage | oui | non | non | non |
| properties read/create/update | oui | lecture utile | oui | communication seulement |
| properties moderate | oui | non | fonction immo selon décision future | non |
| visits read/manage | oui | lecture/RDV | oui | non |
| rental/leases/maintenance manage | oui | non | oui | non |
| documents read/manage | oui | oui | lecture métier minimale | non |
| payments read/manage | oui | oui | statut seulement | non |
| transactions/financial manage | oui | non | non | non |
| accommodation/hotel manage | oui + scopes | non | selon assignment | non |
| altcom/events manage | oui | non | non | oui |

Cette matrice est une cible; les cases « lecture utile/statut » exigent de séparer endpoints de lecture et mutation avant enforcement.

## Écarts et risques

- **P0 non trouvé** : aucun nouveau bypass tenant/ownership démontré.
- **P1** : routage post-vérification email Proprietaire vers dashboard staff.
- **P2** : secrétaire peut appeler les mutations GL générales; gestionnaire accède au centre documentaire administratif.
- **P2** : CommunityManager peut créer/éditer certains biens/hôtels au titre de `ROLES_ALTIMMO`, au-delà de la communication cible.
- **P3** : menus dupliquent les listes backend; dashboard staff non spécialisé.
- **P4** : `User`, `Communicant`, `Prestataire`, `Collaborateur` legacy ne correspondent pas directement aux cinq familles cibles.

## STOP architectural

Modifier maintenant `User.role`, JWT, memberships, `Property.owner`, `Proprietaire.user` ou ownership hôtel serait fondamental et destructif. IAM-2 n'effectuera pas cette transformation. Le resserrement secrétaire/gestionnaire exige d'abord des capacités distinctes `*.read`/`*.manage` et une migration route par route avec tests métier, car les groupes actuels servent simultanément lecture et mutation.

## Plan de migration proposé

- **Phase A — compatibilité** : projection pure rôle → famille/fonction/capacités par défaut; corriger routage/menus manifestement faux; aucun schéma modifié.
- **Phase B — représentation** : capacités staff optionnelles et auditées, héritant des défauts de rôle; profils métier restent dans `UserBusinessProfile`.
- **Phase C — migration progressive** : remplacer chaque `restrictTo(group)` composite par capacité + tenant + scope de ressource, en séparant lecture/mutation.
- **Phase D — legacy** : seulement après couverture web/mobile exhaustive, déprécier `Collaborateur`/`Communicant` ou l'enum unique; jamais dans IAM-2.

Aucune correction significative n'a été appliquée avant ce rapport.
