# RBAC-4 — MATRICE DE MIGRATION MOBILE

## Helper canonique

Un seul helper créé : `can(capability)` dans `altimmo-app/src/context/AuthContext.jsx`, exposé par `useAuth()`. Implémentation :

```js
const can = (capability) => Boolean(user?.capabilities?.includes(capability));
```

- Capacité absente, `user` null, ou `user.capabilities` non défini → `false` (fail closed).
- Aucune deuxième abstraction créée (`hasCapability`, `checkPermission`, `isAllowed` — mandat §14 respecté).
- Comportement identique au helper Web (`client/lib/context/AuthContext.jsx`, RBAC-3) — même contrat, implémentations séparées car ce sont deux runtimes distincts (React Native vs Next.js), pas un package partagé (mandat §50-51, hors scope).

## Constat central de l'audit — aucune surface de production à migrer

Contrairement au Web, où `staffCapabilities.js` avait deux consommateurs de production réels (`AdminDashboard.jsx`, `RoleDashboardOverview.jsx`) migrés dans RBAC-3, l'audit mobile (voir `RBAC4_MOBILE_CAPABILITY_DEBT_MATRIX.md`) a établi que :

- `altimmo-app/src/utils/staffCapabilities.js` (`CAPABILITIES_BY_ROLE`, `hasStaffCapability`) a **zéro consommateur de production**. Seul son propre fichier de test l'exerce, plus une mention en commentaire (non fonctionnelle) dans `HotelHousekeepingScreen.jsx`.
- Aucun check de rôle mobile ne cible `GestionnaireImmobilier`, `Secretaire`, `CommunityManager` ou `Communicant` — les seuls rôles staff référencés dans le code mobile sont `Admin`/`Collaborateur`, et leur usage est minime (`isAdmin`/`isCollaborateur` dans `AuthContext.jsx`, consommés par `ProfilScreen.jsx` pour la visibilité de "Mes biens" et par `canAdd`).
- Il n'existe **aucun écran ou menu staff opérationnel** sur mobile (pas de "Gestion locative", pas de "Modération", pas de tableau de bord staff) — l'application est structurellement orientée Client/Proprietaire.

**Conséquence** : il n'y a pas de check `role → capability` de production dont la migration produirait une parité stricte sans changement de comportement. Forcer une migration sur `canAdd` (le seul candidat de surface) changerait le comportement :

### `canAdd` — candidat rejeté pour ce sprint

`canAdd: ['admin', 'collaborateur', 'proprietaire'].includes(role)` (`AuthContext.jsx:240`, seul consommateur : `TabNavigator.jsx:40,71`, gate un onglet de navigation) mélange deux concepts distincts :
- `admin`/`collaborateur` → permission staff (capacité backend la plus proche : `properties.create`, détenue par `Admin`/`Collaborateur` via leurs jokers `*`/`legacy.full`, **et aussi par `GestionnaireImmobilier`**).
- `proprietaire` → identité métier externe (ownership), pas une capacité staff.

Remplacer la portion staff par `can('properties.create')` **étendrait** `canAdd` à `GestionnaireImmobilier`, qui n'y a jamais eu accès sur mobile jusqu'ici — un changement de comportement réel, non demandé, et non prouvé souhaité par un mandat produit explicite (mandat §29 : caractérisation avant migration, jamais "ça semble logique"). **Non migré dans ce sprint.** Documenté comme candidat nécessitant une décision produit explicite avant toute conversion (voir Dette restante, `RBAC4_MOBILE_CAPABILITY_DEBT_MATRIX.md`).

## Ce qui a été fait à la place

Le pilote de ce sprint est la **plumbing elle-même**, pas une conversion d'écran :

1. `capabilities` est déjà présent dans tous les payloads d'identité mobile (aucun changement backend nécessaire — RBAC-3 avait déjà enrichi les mêmes endpoints que le mobile appelle).
2. Le helper canonique `can(capability)` est câblé et testé (18 tests, `AuthContext.test.jsx`), prêt à être consommé dès qu'un vrai besoin de menu/action staff apparaîtra sur mobile.
3. Aucun mapping rôle→capacités recréé, aucune capacité inventée.

C'est un résultat honnête de l'audit, pas un raccourci : migrer une surface qui n'existe pas produirait soit un code mort (`can()` jamais appelé en dehors des tests), soit une migration forcée et risquée du seul candidat disponible (`canAdd`) sans preuve de parité.

## Identités métier externes préservées (mandat §23-27)

| Check | Fichier:ligne | Nature | Statut |
|---|---|---|---|
| `isProprietaire`, `isProprietaireImmobilier`, `isExploitantEtablissement` | `AuthContext.jsx:239,244-246`, consommés par `ProfilScreen.jsx:70-88` | Identité métier (rôle + `businessProfiles`), gate l'affichage de "Mes biens"/"Mes établissements" | **Conservé intact** — aucune conversion vers `can()`, ce n'est pas une permission staff |
| `isProprietaire` (variable locale) | `VisitesScreen.jsx:157` | Détermine quel endpoint appeler (`/visites/owner` vs `/visites/my`) — routing de données, pas une gate d'autorisation (le backend applique l'ownership indépendamment) | **Conservé intact** |
| `isProprietaire` | `RegisterScreen.jsx:226`, `CompleterProfilScreen.jsx:89` | Bascule de champs de formulaire à l'inscription/complétion de profil | **Conservé intact** |

Aucun de ces checks n'a été touché — ils pilotent une identité métier externe (mandat §23-27), pas une permission staff, et ne font donc pas partie du périmètre de migration RBAC-4.
