# UX-OWNER-1 — État initial (avant toute modification)

Date : 2026-08-18. Branche `main`.

## 1. Baseline Git

```
git status --short
 M server/docs/HOTFIX_MSG_STAFF_INBOX1_REPORT.md   (session précédente, hotfix messagerie, non lié)
git branch --show-current   → main
git rev-parse HEAD          → 1462ea748cd032523c575a4387ae7048a99e9c21
git diff --check            → exit 0
git diff --stat             → server/docs/HOTFIX_MSG_STAFF_INBOX1_REPORT.md | 6 ++
```
`HEAD` a déjà changé une fois pendant la session précédente (documenté dans `HOTFIX_MSG_STAFF_INBOX1_REPORT.md` — commit externe `1462ea7` "Update Altimmo 27", auteur `Altitudevision`, capturant le travail de cette même session, jamais un `git commit` exécuté par l'agent). Aucun nouveau changement de HEAD constaté au lancement de UX-OWNER-1. Aucun travail préexistant supprimé, réinitialisé ou écrasé.

## 2. Rapports lus en amont

- `DASH1_REPORT.md` — dispatcher `/dashboard` par profil staff ; non directement lié au shell Owner mais confirme que les shells Staff et Owner sont deux architectures distinctes.
- `DASH2_OWNER_REPORT.md` — sas `/mon-espace-proprietaire`, portefeuilles `/mes-biens` (immobilier) et `/mes-hotels` (exploitation), résolution de profils métier effectifs, ownership `Property.owner`/`Accommodation.createdBy`/`Hotel.manager`. Le shell propriétaire est décrit comme « déjà partagé » — confirmé : `OwnerDashboard.jsx`, réutilisé par toutes les routes Owner.
- `PROPERTY_PORTFOLIO_1_REPORT.md` — concerne le dashboard STAFF « Tous les biens », sans rapport direct avec le shell/formulaire Owner, mais confirme `Property`/`Accommodation`/`Hotel` comme sources de vérité distinctes, jamais dupliquées.
- `PROPERTY_TRANSACTION_ARCHITECTURE.md` (Sprint A) — **document clé** : sépare déjà `SalePropertyForm.jsx`/`RentalPropertyForm.jsx` (Admin, nouveaux) du `PropertyForm.jsx` legacy, avec `SaleManagement`/`RentalManagement` en satellites 1-1 de `Property`. Confirme que `PropertyForm.jsx` reste utilisé par `OwnerPropertyManagement.jsx`/`MyPropertiesPage.jsx` (mentionné explicitement comme non touché par ce sprint-là) — c'est exactement le formulaire Owner actuel, vérifié par audit direct (§8 ci-dessous).
- `IAM3_STAFF_PERMISSIONS_REPORT.md` — confirme que les routes self-service propriétaire restent préservées séparément des capabilities staff (`requireCapabilityForStaff`) — aucune régression IAM attendue de ce sprint.

Aucun rapport dédié préexistant au shell/header Owner ou au formulaire Owner n'a été trouvé — ce sprint est le premier audit dédié à cette surface précise.

## 3. Parcours propriétaire réel tracé

```
Login Proprietaire
→ getPostAuthDestination → /mon-espace-proprietaire (sas, DASH-2)
→ OwnerContextLanding.jsx résout businessProfiles
→ profil immobilier seul (ou multi) → /mes-biens
→ client/app/mes-biens/layout.jsx → OwnerDashboard.jsx (shell)
→ client/app/mes-biens/page.jsx → ClientPage.jsx (dynamic import ssr:false)
→ OwnerPropertyManagement.jsx (546 lignes) — vue liste + KPI
→ clic "Ajouter un bien" → state local view='add' (inline, PAS de modal/route séparée)
→ PropertyManagementForm (wrapper local, lignes 54-164) → PropertyForm.jsx (legacy, 1209 lignes)
→ soumission → POST /api/properties (legacy, autorisé pour role Proprietaire)
→ retour vue liste (view='list') → carte affichée avec statut
→ modification éventuelle → même PropertyForm.jsx, view='edit'
```

## 4. Shell Owner — architecture

`OwnerDashboard.jsx` (`client/lib/pages/dashboard/OwnerDashboard.jsx`) est réutilisé identiquement par **toutes** les routes Owner :
- `client/app/mes-biens/layout.jsx` → `/mes-biens`, `/mes-biens/visites`, `/mes-biens/paiements`, `/mes-biens/securite`, `/mes-biens/[...slug]`
- `client/app/mes-hotels/layout.jsx` → `/mes-hotels` et toutes ses sous-routes établissement
- `client/app/mes-hebergements/layout.jsx` → `/mes-hebergements/*`

`/mon-espace-proprietaire` (`OwnerContextLanding.jsx`) n'utilise PAS `OwnerDashboard` — conteneur propre (`min-h-screen bg-slate-50 p-4 sm:p-8`), écran transitoire de résolution/redirection.

## 5. Cause racine du chevauchement header — tracée précisément

Le header global (`client/lib/components/layout/Header.jsx`) :
- `position: fixed; top:0; left:0; right:0; z-index:50` (`Header.jsx:404-413`).
- Hauteur réellement responsive, calculée localement dans ce fichier uniquement (`Header.jsx:362-364`) : mobile `58px`, tablette `64px`, `lg` `68px`, `xl` `76px` — **valeurs jamais exportées ni centralisées ailleurs**.

`client/app/ClientLayout.jsx` (lignes 10-12, 22-24) : le `<Header/>` global n'est **omis** que pour les chemins commençant par `/dashboard` ou `/admin` (`noHeaderFooter`). `<main id="main-content">` ne porte **aucun** `padding-top`/`margin-top`/spacer compensant la hauteur du header.

`OwnerDashboard.jsx` — root `<div className="flex min-h-screen" ...>` (ligne 125) : **aucun offset**. Sidebar (`fixed md:sticky top-0 ... z-50 md:z-auto`, lignes 133-135) et main content (`flex-1 p-4 md:p-6 overflow-y-auto`, ligne 272 — un padding uniforme de confort, pas un offset de header) démarrent tous deux à `top:0`.

**Divergence exacte** : les routes `/mes-biens`, `/mes-hotels`, `/mes-hebergements` ne sont **pas** dans la liste d'exclusion `noHeaderFooter` de `ClientLayout.jsx` — contrairement à `/dashboard*`/`/admin*`, qui ont leur propre en-tête dédié et sont donc exclus du header global. `OwnerDashboard.jsx` a été conçu comme un shell plein-écran autonome (sans en-tête desktop propre — seule une topbar `md:hidden` existe, ligne 256) qui suppose implicitement posséder tout le viewport depuis `top:0`. Résultat : le header global fixe (58-76px, z-index 50) se superpose aux ~58-76px supérieurs du contenu Owner (KPI, sidebar) sur toutes les largeurs d'écran ≥768px, exactement le bug démontré par la capture d'écran.

## 6. Rayon d'impact du correctif

Toute correction touchant `ClientLayout.jsx` (ajout des préfixes Owner à `noHeaderFooter`) affecte **uniformément** `/mes-biens`, `/mes-hotels`, `/mes-hebergements` (même shell `OwnerDashboard`, même bug, même correctif) — cohérent avec le mandat §5 (« un correctif partagé ne doit pas réparer `/mes-biens` tout en cassant `/mes-hotels` »). `/mon-espace-proprietaire` (shell distinct, écran transitoire) est également concerné par le même défaut d'exclusion mais avec un rayon d'impact moindre (écran de redirection bref).

**Deux options de correction identifiées** :
- **(a)** Ajouter les préfixes de routes Owner à `noHeaderFooter` dans `ClientLayout.jsx` — cohérent avec le traitement déjà appliqué à `/dashboard`/`/admin` (shells autonomes avec leur propre chrome). Risque minimal, un seul fichier, un seul array à étendre.
- **(b)** Faire réserver à `OwnerDashboard.jsx` un `padding-top`/`margin-top` égal à la hauteur réelle du header — nécessite de centraliser d'abord les valeurs responsives actuellement locales à `Header.jsx:362-364` (aucune source partagée n'existe), risque de désynchronisation future entre les deux fichiers.

**Option retenue : (a)**, strictement analogue au traitement déjà réservé à `/dashboard`/`/admin`, sans introduire de nouvelle dépendance entre `Header.jsx` et `OwnerDashboard.jsx`.

## 7. Sidebar Owner

`OwnerDashboard.jsx` : mobile — `fixed top-0 h-[100dvh] z-50`, drawer off-canvas via `translate-x`, backdrop `bg-black/60 z-40`, déclenché par une topbar mobile propre (`sticky top-0 z-30`). Desktop (`md:`) — `md:sticky top-0 md:z-auto`. Fonctionne correctement en interne (alignement sidebar/main cohérent, pas de bug propre à la sidebar) — seul le manque d'offset vis-à-vis du header global l'affecte, résolu par le même correctif que §6. **Aucune réécriture de la sidebar** — conforme au mandat §7 (« ne refais pas la sidebar si elle fonctionne »).

## 8. Formulaire Owner actuel — architecture exacte

`OwnerPropertyManagement.jsx` → composant local `PropertyManagementForm` (lignes 54-164, wrapper d'état) → **`client/lib/components/dashboard/PropertyForm.jsx`** (legacy, 1209 lignes, contrôlé par `formData`/`setFormData` du parent, `enableHebergement` non transmis → Owner ne voit jamais la branche Hébergement).

Problèmes identifiés (détaillés dans `UX_OWNER1_PROPERTY_FORM_MATRIX.md`) :
- Aucun composant de design system (`Input`/`Select`/`Textarea` génériques) — chaque champ réécrit sa propre chaîne Tailwind, y compris en dupliquant des classes déjà présentes ailleurs dans le même fichier.
- **Zéro classe `dark:`** dans tout le fichier — le formulaire est actuellement mono-thème clair, sans variante sombre nulle part.
- **Aucune erreur de validation par champ ne s'affiche côté Owner** : `PropertyManagementForm`/`OwnerPropertyManagement.jsx` ne construit ni ne transmet jamais de prop `errors` à `PropertyForm` (contrairement à la branche Hébergement d'Admin, qui, elle, passe `validateHebergement`) — un échec de validation ne remonte que via un `toast.error` générique, jamais localisé au champ fautif.
- Upload d'images : simple `<input type="file">` HTML stylé, sans drag-and-drop (identique aux formulaires Admin — pas une régression Owner spécifique, juste un manque partagé).
- Texte d'aide `text-xs text-gray-500` répété des dizaines de fois — contraste limite WCAG AA pour du texte de petite taille, sans alternative.

## 9. Formulaires Admin Vente/Location — architecture exacte

`client/lib/components/dashboard/SalePropertyForm.jsx` (349 lignes) et `RentalPropertyForm.jsx` (382 lignes), self-contained (état local, pas `formData`/`setFormData` du parent), montés conditionnellement (jamais simultanément) depuis `ManagePropertiesPage.jsx` selon le choix Vente/Location/Hébergement d'un sélecteur à 3 cartes. Structure en sections nommées (Informations générales, Localisation, Caractéristiques, Situation juridique/Loyer et charges, Prix/Caution, Médias, Publication), validation locale par champ avec message inline (`text-xs text-red-600`), constante `inputClass` partagée en tête de fichier (déduplication déjà réelle, contrairement au `PropertyForm.jsx` legacy qui répète chaque classe individuellement). **Également zéro classe `dark:`** — pas une régression à introduire, un défaut déjà partagé par tout le périmètre formulaire immobilier.

Chacun de ces deux formulaires appelle son propre service dédié (`salePropertyService.js`/`rentalPropertyService.js`) vers `POST/PUT /api/sale-properties`/`/api/rental-properties`.

## 10. Autorisations backend — vérification critique avant toute réutilisation

```
server/routes/salePropertyRoutes.js:8   router.use(auth.protect, auth.restrictTo(...ROLES_ALTIMMO));
server/routes/rentalPropertyRoutes.js:8 router.use(auth.protect, auth.restrictTo(...ROLES_ALTIMMO));
```
`ROLES_ALTIMMO` = `Admin, Collaborateur, GestionnaireImmobilier, CommunityManager` — **`Proprietaire` n'y figure jamais**. Les routes Admin Vente/Location sont donc **structurellement inaccessibles** au propriétaire — pointer le formulaire Owner vers ces endpoints donnerait au propriétaire une capacité Admin par la bande (violation directe du mandat §1/§16).

```
server/routes/propertyRoutes.js:97-98   POST   .restrictTo(...STAFF_CM, 'Proprietaire')
server/routes/propertyRoutes.js:170-171 PUT    .restrictTo('Admin', 'Proprietaire')
```
La route legacy `/api/properties` (POST/PUT), déjà utilisée par `PropertyForm.jsx`/`OwnerPropertyManagement.jsx`, autorise explicitement `Proprietaire` — c'est la **seule** route backend légitime pour la création/édition Owner.

**Conséquence architecturale directe** : le socle partagé ne peut PAS être « pointer Owner vers les mêmes endpoints qu'Admin ». La réutilisation doit porter sur l'UI/la structure/la validation des formulaires `SalePropertyForm.jsx`/`RentalPropertyForm.jsx` (déjà bien architecturés, déjà séparés par type de transaction — exactement la structure cible du mandat §14), tout en conservant, pour le mode Owner, l'appel au service `propertyService` existant (`POST/PUT /api/properties`), jamais `salePropertyService`/`rentalPropertyService`.

## 11. Property.js — source de vérité (relevé exhaustif)

Voir `server/models/Property.js` (304 lignes) — champs pertinents pour Vente/Location : `title`, `pole` (enum Altimmo/MilaEvents/Altcom), `description`, `type` (enum 9 valeurs), `status` (enum `vente|location|hebergement`), `price`, `honoraires`, `fraisVisite`, `address.{street,neighborhood,arrondissement,city}`, `latitude`/`longitude`, `images[]`, `bedrooms`, `bathrooms`, `surface`, `livingRooms`, `kitchens`, `constructionType`, `amenities[]`, `availability` (enum 7 valeurs), `cautionMultiplicateur`, `profilsLocataireRecherches[]` (enum 5), `documentsRequis[]` (enum 6), `owner`, `statusAdmin` (enum, modération — jamais exposé en écriture aux formulaires, contrôlé serveur). Aucun champ hébergement (capacité, check-in, etc.) sur `Property` — ils vivent sur `Accommodation`, hors périmètre Vente/Location.

**Champs Admin-only identifiés par nature** (jamais exposés à Owner) : `statusAdmin` (modération, écrit serveur uniquement), `commission d'agence` (`SaleManagement.agencyCommission`, satellite Vente — champ interne, déjà exclu de la sérialisation publique par `PROPERTY_TRANSACTION_ARCHITECTURE.md` §« Exposition publique »). Le reste des champs des sections des formulaires Admin Vente/Location est de nature factuelle (adresse, prix, caractéristiques) et déjà exposé à Owner aujourd'hui via `PropertyForm.jsx` — aucune capacité Admin nouvelle à retirer au-delà de `agencyCommission`.

## 12. Architecture retenue (à détailler dans le rapport final après implémentation)

`SalePropertyForm.jsx`/`RentalPropertyForm.jsx` reçoivent un prop `mode` (`'admin' | 'owner'`, défaut `'admin'` — comportement Admin strictement inchangé) qui :
- bascule l'appel API vers `propertyService` (`POST/PUT /api/properties`) au lieu de `salePropertyService`/`rentalPropertyService` quand `mode === 'owner'` ;
- masque le champ `agencyCommission` (Admin-only) quand `mode === 'owner'` ;
- conserve à l'identique sections, validation, upload, styles pour les deux modes (pas de duplication de JSX, uniquement des branches conditionnelles ciblées).

`OwnerPropertyManagement.jsx` ajoute un choix Vente/Location (2 cartes, pas de carte Hébergement — Owner n'y a jamais accès, `enableHebergement` déjà `false`) avant de monter `SalePropertyForm mode="owner"`/`RentalPropertyForm mode="owner"`. `PropertyForm.jsx` legacy reste le chemin d'édition pour les biens `status === 'hebergement'` préexistants (même précédent qu'Admin dans `ManagePropertiesPage.jsx`), non touché.

Détails d'implémentation, avant/après, tests et gates : voir `UX_OWNER1_REPORT.md`.
