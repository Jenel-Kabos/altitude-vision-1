# HOTFIX-MOB-PROFILE-MY-PROPERTIES-LINK-1 — État initial

Date : 2026-08-21. Branche `main`. `HEAD` = `3cd0f1c88be339261f7404bb9b6512f32479191c`, worktree propre avant toute modification (`git status --short` vide, `git diff --check` exit 0).

## 1. L'écran "Mes biens" existe déjà — preuve

- **Fichier** : `altimmo-app/src/screens/MesBiens/MesAnnoncesScreen.jsx`
- **Route** : `MesAnnonces`
- **Navigator** : `ProfilStack` (`altimmo-app/src/navigation/stacks/ProfilStack.jsx:5,42`) — même stack que `ProfilScreen`, donc `navigation.navigate('MesAnnonces')` suffit (pas de navigator imbriqué à traverser).
- **Service/API** : `GET /properties/my-properties` + `GET /rental-management/owner/my` (lecture), `DELETE /properties/:id` (suppression) — aucun nouvel appel introduit.
- **Empty state** : gère déjà son propre `EmptyState` (`import EmptyState from '../../components/ui/EmptyState'`, ligne 433) — non modifié, non dupliqué.
- **Déjà utilisé ailleurs** : oui — un lien vers cette même route existe déjà dans `ProfilScreen.jsx` (voir §2).

**Aucune nouvelle page, aucune nouvelle route API n'est nécessaire.**

## 2. Découverte critique : l'entrée existe déjà, mais sa visibilité est cassée

`ProfilScreen.jsx` contient déjà une section **"Mes biens"** (titre de section, ligne 233), séparée de la section "Activité" et positionnée juste au-dessus, avec une ligne **"Mes annonces"** (`icon="business-outline"`, ligne 237-242) qui appelle exactement `navigation.navigate('MesAnnonces')`.

Ce n'est donc **pas le cas A ("entrée jamais ajoutée")** — l'entrée existe déjà, correctement câblée vers le bon écran.

### Cause exacte (preuve, pas supposition)

```js
// ProfilScreen.jsx:70-79
const role          = user?.role?.toLowerCase();
const isProprietaire = role === 'proprietaire';
...
const showImmoSection = businessProfiles === null ? isProprietaire : isProprietaireImmobilier;
...
const canSeeMyBiens  = showImmoSection || showEtablissementSection || isAdmin;
```

`isProprietaireImmobilier` ne vient PAS du rôle brut de l'utilisateur (`User.role`) mais d'un système de profils métiers dérivés côté backend (`server/services/userBusinessProfileService.js`, fonction `deriveProfilesFromExistingData`) :

```js
// server/services/userBusinessProfileService.js
const [proprieteImmo, ...] = await Promise.all([
  Property.exists({ owner: userId, status: { $in: ['vente', 'location'] } }),
  ...
]);
if (proprieteImmo) derived.add('proprietaire_immobilier');
```

**`proprietaire_immobilier` n'est accordé que si l'utilisateur possède déjà au moins un bien Vente/Location en base.** Le code lui-même documente explicitement ce choix : *"un rôle 'Proprietaire' seul ne suffit plus à décider"*.

Conséquence prouvée : `businessProfiles === null` (chargement en cours) retombe correctement sur `isProprietaire` (filet de sécurité déjà présent), **mais une fois `businessProfiles` chargé (`[]` si aucun bien existant), la condition bascule intégralement sur `isProprietaireImmobilier` et ignore `isProprietaire`.** Un compte de rôle `Proprietaire` fraîchement créé, ou n'ayant simplement pas encore de bien Vente/Location enregistré, se voit donc **priver de la section "Mes biens" entière** — alors que c'est précisément ce compte qui a le plus besoin d'accéder à `MesAnnonces` (pour vérifier l'état de ses annonces ou comprendre où en est sa première publication).

### Classification (mandat §6)

**Cause B (entrée masquée par mauvaise condition de rôle) combinée à D (mauvais helper de permissions)** : la condition de visibilité utilise un signal dérivé de l'usage (a-t-il déjà un bien publié ?) au lieu du rôle canonique déclaré (`User.role === 'Proprietaire'`), pour une section qui devrait précisément rester accessible à TOUT compte de rôle Proprietaire, y compris ceux sans bien encore publié.

## 3. Rôle réel — valeur canonique

`User.role` stocke la valeur littérale `'Proprietaire'` (voir `server/models/User.js:46`, enum incluant `'Proprietaire'` sans accent pour compatibilité frontend — commentaire explicite dans le modèle). `ProfilScreen.jsx` compare déjà `user?.role?.toLowerCase() === 'proprietaire'` — c'est la constante canonique réutilisée, aucune chaîne inventée.

## 4. Décision — RÉUTILISER, PAS DUPLIQUER (mandat §15, RÈGLE FINALE)

Le mandat demande d'ajouter une entrée "Mes biens" dans la section Activité. Mais l'audit prouve qu'une entrée identique (même écran, même route) existe déjà juste au-dessus, seulement mal gatée. Ajouter une seconde entrée dans Activité créerait exactement le doublon interdit par le mandat lui-même (§15 : *"Vérifier qu'il n'existe pas déjà un raccourci invisible ou conditionnel vers le même écran. Ne crée pas deux chemins identiques dans Profil."*).

**Décision** : corriger la condition de visibilité de la section "Mes biens" existante (`showImmoSection`) pour qu'un compte de rôle `Proprietaire` la voie TOUJOURS, en plus du cas déjà couvert (profil métier dérivé). Aucune nouvelle ligne de menu, aucun nouveau composant, aucune duplication.

```diff
- const showImmoSection = businessProfiles === null ? isProprietaire : isProprietaireImmobilier;
+ const showImmoSection = businessProfiles === null ? isProprietaire : (isProprietaire || isProprietaireImmobilier);
```

Effet : un compte `role === 'Proprietaire'` voit toujours "Mes biens" → "Mes annonces" (le vrai bug corrigé) ; un compte d'un autre rôle possédant déjà un bien (cas dérivé légitime, ex. historique) continue de la voir également (non régressé) ; Admin continue de tout voir (`|| isAdmin`, inchangé) ; un compte Client/User/GestionnaireImmobilier sans rôle Proprietaire et sans bien dérivé continue de NE PAS la voir (non régressé — aucune preuve que ces rôles doivent y accéder).

`showEtablissementSection` (hébergement) n'est pas touché — hors périmètre du mandat, aucun bug prouvé sur ce chemin.

## 5. Plan

1. Corriger `showImmoSection` dans `ProfilScreen.jsx` (1 ligne).
2. Ajouter des tests ciblés prouvant : (a) un Proprietaire sans bien dérivé voit désormais "Mes biens"/"Mes annonces" ; (b) le press appelle `navigation.navigate('MesAnnonces')` ; (c) les autres entrées de Profil (Activité : Espace locataire, Mes documents, Mes favoris, Mes transactions) restent inchangées ; (d) un rôle Client sans profil dérivé ne voit toujours pas la section.
3. Gates mobile complets + documentation finale.
