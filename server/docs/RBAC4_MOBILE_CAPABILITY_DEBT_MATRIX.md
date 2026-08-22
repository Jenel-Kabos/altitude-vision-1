# RBAC-4 — MATRICE DE DETTE : CAPACITÉS MOBILE

## `altimmo-app/src/utils/staffCapabilities.js` — audit complet

Contenu intégral (25 lignes) : `CAPABILITIES_BY_ROLE` (Object.freeze), miroir manuel et explicitement documenté (commentaire "SYNC-2A") de `server/utils/iamArchitecture.js` `DEFAULT_CAPABILITIES` et de `client/lib/utils/staffCapabilities.js` `CAPABILITIES_BY_ROLE` — les trois copies sont **strictement identiques** champ par champ (mêmes rôles, mêmes capacités, même ordre) au moment de cet audit. Exporte aussi `hasStaffCapability(user, capability)`.

### Imports / consommateurs — recherche exhaustive dans `altimmo-app/`

| Fichier | Type d'usage | Classement |
|---|---|---|
| `src/utils/__tests__/staffCapabilities.test.js` | Import direct, teste `CAPABILITIES_BY_ROLE`/`hasStaffCapability` | **TEST UNIQUEMENT** |
| `src/screens/Hotels/HotelHousekeepingScreen.jsx:30` | **Commentaire seul** ("projection IAM-3 (`staffCapabilities.js`, rôles globaux)") expliquant pourquoi cet écran n'utilise **pas** ce fichier (les capacités hôtelières par établissement sont un système séparé, `HotelStaffAssignment`) | **AUCUN USAGE RÉEL** — mention documentaire, pas un import |

**Aucun autre fichier** du dépôt (écrans, navigation, composants, services) n'importe `hasStaffCapability` ni `CAPABILITIES_BY_ROLE`.

### Classement final

| Export | Statut |
|---|---|
| `hasStaffCapability` | **CODE MORT EN PRODUCTION** — zéro consommateur de production, uniquement testé par son propre fichier de test |
| `CAPABILITIES_BY_ROLE` | **CODE MORT EN PRODUCTION** — même constat |

### Suppression envisagée mais non exécutée

Preuve de code mort réunie (grep exhaustif, zéro consommateur de production). Conformément au mandat §21, **la suppression est possible en théorie** mais n'a pas été exécutée dans ce sprint :
- Le mandat RBAC-4 ne demande pas explicitement de nettoyage (§20 demande l'audit et la documentation, §21 pose une condition — "si le mandat local l'autorise" — que ce sprint ne lève pas explicitement).
- La suppression toucherait aussi son fichier de test (`staffCapabilities.test.js`), ce qui est une action de nettoyage distincte de la migration de consommation.
- **Recommandation explicite pour RBAC-5** : supprimer `altimmo-app/src/utils/staffCapabilities.js` et `src/utils/__tests__/staffCapabilities.test.js` ensemble, en même temps que l'équivalent Web (`client/lib/utils/staffCapabilities.js` + son test), puisque les deux copies sont dans le même état (code mort en production, testées isolément) — voir aussi `RBAC3_WEB_MIGRATION_MATRIX.md`.

## Autres checks de rôle mobile — classement

| Check | Fichier:ligne | Nature | Classement |
|---|---|---|---|
| `isAdmin`, `isCollaborateur` | `AuthContext.jsx:237-238` | Dérivés du rôle, exposés au contexte | **BUSINESS ROLE CHECK LÉGITIME (usage restreint)** — consommés uniquement par `ProfilScreen.jsx` (visibilité "Mes biens" pour Admin) et `canAdd` |
| `canAdd` | `AuthContext.jsx:240`, consommé par `TabNavigator.jsx:40,71` | Mixte : rôle staff (`admin`,`collaborateur`) + identité métier (`proprietaire`) | **RBAC-5 CANDIDATE** — migration vers `can('properties.create')` possible mais **changerait le comportement** (étendrait l'accès à `GestionnaireImmobilier`, jamais accordé sur mobile jusqu'ici) ; nécessite une décision produit explicite avant conversion, non exécutée dans ce sprint |
| `isProprietaire`, `isProprietaireImmobilier`, `isExploitantEtablissement` | `AuthContext.jsx:239,244-246` | Identité métier externe (rôle + `businessProfiles`) | **PROFILE CHECK LÉGITIME** — hors périmètre capacités staff, ne pas migrer |
| `isProprietaire` (variable locale) | `VisitesScreen.jsx:157`, `RegisterScreen.jsx:226`, `CompleterProfilScreen.jsx:89` | Routing de données / branchement de formulaire selon l'identité | **BUSINESS ROLE CHECK LÉGITIME** — hors périmètre |

## Constat structurel

Le mobile n'a, à ce jour, **aucune surface staff opérationnelle** (pas de tableau de bord, pas de menu Gestion locative/Modération/Hôtellerie staff) — contrairement au Web qui possède `AdminDashboard.jsx`/`RoleDashboardOverview.jsx`. `staffCapabilities.js` mobile a donc probablement été préparé en anticipation d'une future fonctionnalité staff mobile qui n'a jamais été construite. Le helper `can(capability)` ajouté par RBAC-4 est prêt à être utilisé dès qu'une telle surface apparaîtra, sans qu'aucune nouvelle plomberie ne soit nécessaire.
