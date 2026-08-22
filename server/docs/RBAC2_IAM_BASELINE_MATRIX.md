# RBAC-2 — Matrice de référence `iamArchitecture.js`

## Structure du fichier (`server/utils/iamArchitecture.js`, avant RBAC-2)

| Export | Type | Rôle |
|---|---|---|
| `ACCOUNT_FAMILIES` | objet figé | `ADMIN`/`STAFF`/`OWNER`/`CLIENT`/`LEGACY` — classification large, affichage/analytics uniquement |
| `STAFF_FUNCTIONS` | objet figé | Sous-catégorisation des rôles `STAFF` (`SECRETARY`, `REAL_ESTATE_MANAGER`, `COMMUNITY_MANAGER`, `COMMUNICATION`, `LEGACY_FULL`) |
| `DEFAULT_CAPABILITIES` | objet figé, rôle → `string[]` | **Le cœur du système** — capacités par défaut par rôle |
| `ROLE_PROJECTION` | objet figé, rôle → `{accountFamily, staffFunction}` | Projection rôle → famille/fonction |
| `projectLegacyRole(role)` | fonction pure | Combine `ROLE_PROJECTION` + `DEFAULT_CAPABILITIES` en un seul objet |
| `hasDefaultCapability(role, capability)` | fonction pure | **Le seul point d'enforcement réel**, consommé par `capabilityMiddleware.requireCapability` |

## Capacités existantes (avant RBAC-2) — inventaire exact par rôle

| Rôle | Capacités |
|---|---|
| `Admin` | `['*']` (joker — toute capacité) |
| `Secretaire` | `documents.read`, `documents.manage`, `payments.read`, `payments.manage`, `clients.read`, `owners.read`, `tenants.read`, `leases.read`, `properties.read` |
| `GestionnaireImmobilier` | `properties.read`, `properties.create`, `properties.update`, `owners.read`, `tenants.read`, `tenants.manage`, `visits.read`, `visits.manage`, `rental.read`, `rental.manage`, `leases.read`, `leases.manage`, `maintenance.read`, `maintenance.manage`, `notice.read`, `notice.manage`, `occupancy.read`, `occupancy.manage`, `payment.status` |
| `CommunityManager` | `altcom.read`, `altcom.manage`, `events.read`, `events.manage`, `media.read`, `media.manage` |
| `Communicant` | `messages.read`, `messages.manage`, `visits.read` |
| `Collaborateur` | `['legacy.full']` (joker — toute capacité, legacy) |
| `Proprietaire` | `properties.own`, `accommodation.own` |
| `Client` | `client.self` |
| `User` | `client.self` |
| `Prestataire` | `provider.self` |

**53 capacités nommées distinctes** au total (hors les deux jokers `*`/`legacy.full`), avant ajout du registre `ADMIN_ONLY_CAPABILITIES` de RBAC-2.

## `requireCapability(...)` (`server/middleware/capabilityMiddleware.js`) — comportement avant RBAC-2

```js
const requireCapability = (...acceptedCapabilities) => (req, res, next) => {
  const role = req.user?.role;
  if (role && acceptedCapabilities.some(capability => hasDefaultCapability(role, capability))) return next();
  res.status(403);
  throw new Error(`Accès refusé : capacité requise (${acceptedCapabilities.join(' ou ')}).`);
};
```

- **Ordre avec `protect`** : toujours utilisé APRÈS `auth.protect` (jamais seul — vérifié sur les 10 fichiers consommateurs).
- **Tenant middleware** : `requireCapability` ne fait rien vis-à-vis du tenant — les routes qui en ont besoin composent `protect` + `requireTenantScope`/`assertResourceTenantOrUnattributed` + `requireCapability` séparément (vérifié sur `rentalManagementRoutes.js`, `contratRoutes.js`, `locataireRoutes.js`).
- **Résolution du rôle** : `req.user?.role` — jamais une valeur de session/token distincte.
- **Erreur HTTP** : 403 dans tous les cas (jamais 401 — l'authentification est déjà garantie par `protect` en amont).
- **Comportement Admin** : bypass total via le joker `'*'` dans `hasDefaultCapability`.
- **Rôle inconnu (avant RBAC-2 et après)** : `DEFAULT_CAPABILITIES[role] || []` → tableau vide → `false` → 403. **Fail closed, déjà correct avant RBAC-2.**
- **Existait-il une `requireCapabilityForStaff` ?** Oui — variante qui laisse passer (`next()`) tout rôle hors du set `STAFF_ROLES` local (`new Set(['Admin','Collaborateur','Secretaire','GestionnaireImmobilier','CommunityManager','Communicant'])`, hardcodé, pas importé de `roles.js`), pour les routes où la capacité ne s'applique qu'aux membres du staff (les non-staff continuent vers un autre contrôle, ex. ownership). Non modifiée par RBAC-2 — hors périmètre de la route pilote choisie.

## Consommateurs réels (10 fichiers de routes, confirmés par RBAC-1 et re-vérifiés)

`rentalManagementRoutes.js`, `documentRoutes.js`, `eventRoutes.js`, `visiteRoutes.js`, `rentalMaintenanceRoutes.js`, `altcomRoutes.js`, `gestionDocumentRoutes.js`, `locataireRoutes.js`, `contratRoutes.js`, `paiementRoutes.js`. **+1 depuis RBAC-2** : `propertyAssetRoutes.js` (route pilote migrée).

## Tests existants (avant RBAC-2)

`server/__tests__/iamArchitecture.test.js` — couvrait `projectLegacyRole` (6 rôles) et `hasDefaultCapability` (séparation des responsabilités staff, 10 assertions). **Ne couvrait aucun cas limite** (rôle inconnu, capacité inconnue, `Admin`/`Collaborateur` en détail) — comblé par RBAC-2 (11 nouveaux tests, voir `RBAC2_SECURITY_MATRIX.md`).

## Fallback / comportement rôle inconnu (audité, pas modifié)

`hasDefaultCapability(undefined, cap)`, `hasDefaultCapability(null, cap)`, `hasDefaultCapability('RoleInexistant', cap)` retournent tous `false` — déjà fail-closed avant RBAC-2, confirmé par test désormais explicite. **Aucune modification de ce comportement.**

## Verdict de l'audit (mandat §8)

**Oui, `iamArchitecture.js` peut réellement devenir la source canonique des capacités STAFF**, sans casser les systèmes spécialisés :
- Il ne prétend déjà à rien d'autre qu'une "projection additive" (commentaire d'origine, ligne 1-2) — n'a jamais eu la prétention de remplacer tenant/ownership/HotelStaffAssignment/PlatformOperator/financialAuthorizationService.
- Il est déjà réellement câblé et testé sur 10 domaines.
- Sa structure (`role → string[]`) est triviale à étendre (ajouter une capacité à un rôle) sans rien casser ailleurs.
- Sa seule vraie lacune avant RBAC-2 était l'absence de validation des capacités demandées par les routes — corrigée sans changer sa forme.

**Aucun `iamArchitectureV2.js` n'a été créé.**
