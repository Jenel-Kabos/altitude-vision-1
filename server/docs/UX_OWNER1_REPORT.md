# UX-OWNER-1 — Rapport final : audit et refonte UX du dashboard propriétaire immobilier

Date : 2026-08-18. Branche `main`. HEAD au lancement : `1462ea748cd032523c575a4387ae7048a99e9c21`.

## 1. Résumé exécutif

Deux problèmes visuels prouvés par capture d'écran ont été audités puis corrigés à la bonne couche : (1) le header global fixe se superposait au contenu du dashboard propriétaire (`/mes-biens`, `/mes-hotels`, `/mes-hebergements`, `/mon-espace-proprietaire`) — cause racine tracée précisément à un shell (`OwnerDashboard.jsx`) qui ne réservait aucun offset pour ce header, jamais exclu de son rendu contrairement à `/dashboard`/`/admin` ; (2) le formulaire Owner « Ajouter un bien » ne remontait jamais d'erreur de validation par champ, contrairement aux formulaires Admin Vente/Location — cause racine : des attributs `required` HTML5 natifs interceptaient la soumission avant que le code React (`errors`) n'ait la moindre chance de s'exécuter, combiné à une absence totale de construction de cet objet `errors` côté Owner. Les deux corrections ont été vérifiées **dans un vrai navigateur** (Playwright + build de production), pas seulement en Jest, conformément à l'exigence explicite du mandat. Une découverte architecturale importante a borné le périmètre : les champs satellites `SaleManagement`/`RentalManagement` (situation juridique, charges, meublé, etc.) ne peuvent être persistés que via les endpoints Admin (`/api/sale-properties`, `/api/rental-properties`, strictement `ROLES_ALTIMMO`) — jamais accessibles au rôle `Proprietaire`. Basculer le formulaire Owner sur les composants Admin `SalePropertyForm.jsx`/`RentalPropertyForm.jsx` tels quels aurait donc silencieusement fait perdre des données saisies par le propriétaire (violation du mandat §1/§16) ; la convergence complète Owner↔Admin (architecture `mode=owner-sale/owner-rental`) est donc documentée comme dette pour un sprint séparé avec changement backend explicite, plutôt que livrée à moitié avec un risque de perte de données.

## 2. Baseline Git

`git status --short` au lancement : `M server/docs/HOTFIX_MSG_STAFF_INBOX1_REPORT.md` (session précédente, non lié). `git branch --show-current` : `main`. `git rev-parse HEAD` : `1462ea748cd032523c575a4387ae7048a99e9c21`. `git diff --check` : `exit 0`. Aucun HEAD changé pendant ce sprint (vérifié à la clôture, §43).

## 3. Architecture Owner avant

`Login Proprietaire → /mon-espace-proprietaire (sas DASH-2) → /mes-biens → OwnerDashboard.jsx (shell) → OwnerPropertyManagement.jsx (liste + KPI) → clic "Ajouter un bien" (inline, pas de modal/route séparée) → PropertyManagementForm (wrapper local) → PropertyForm.jsx (legacy, 1209 lignes) → POST/PUT /api/properties (legacy, autorisé Proprietaire)`. Détail complet : `UX_OWNER1_ETAT_INITIAL.md` §3.

## 4. Shell avant

`OwnerDashboard.jsx` réutilisé identiquement par `/mes-biens`, `/mes-hotels`, `/mes-hebergements` — sidebar + main, `min-h-screen`, **aucun en-tête desktop propre** (seule une topbar `md:hidden`). `ClientLayout.jsx` ne montait le header global fixe QUE si le chemin ne commence pas par `/dashboard`/`/admin` — ces routes Owner n'étaient pas exclues.

## 5. Cause du header overlap

Header global (`Header.jsx:404-413`) : `position: fixed; z-index: 50`, hauteur responsive 58-76px (`Header.jsx:362-364`, valeurs locales, jamais exportées). `OwnerDashboard.jsx` (racine `flex min-h-screen`, ligne 125 ; sidebar `fixed md:sticky top-0`, lignes 133-135 ; main `flex-1 p-4 md:p-6`, ligne 272 — padding de confort, pas un offset de header) : **aucun `padding-top`/`margin-top` compensant les 58-76px du header**. Le header se superposait donc structurellement aux ~58-76px supérieurs du contenu Owner sur tout écran ≥768px — exactement le bug de la capture d'écran fournie.

## 6. Correction shell

`client/app/ClientLayout.jsx` : ajout de `/mes-biens`, `/mes-hotels`, `/mes-hebergements`, `/mon-espace-proprietaire` à la liste d'exclusion `noHeaderFooter`, même traitement déjà réservé à `/dashboard`/`/admin` (shells autonomes avec leur propre chrome). Choix validé après vérification que `OwnerDashboard.jsx` porte déjà tout le nécessaire (marque, profil utilisateur, sélecteur de contexte, navigation, « Accueil du site », « Déconnexion ») dans sa sidebar — aucune fonctionnalité perdue en retirant le header global dupliqué. Option alternative (faire porter l'offset par `OwnerDashboard.jsx`) écartée : aurait nécessité de centraliser des valeurs de hauteur aujourd'hui locales à `Header.jsx`, risque de désynchronisation future, pour un gain nul par rapport à l'option retenue.

**Vérifié réellement dans le navigateur** (Playwright, build de production, harnais `start-accommodation-e2e.js`, compte `rental-owner-e2e@example.test`) : `document.querySelector('header')` retourne `null` sur `/mes-biens` après correction (le header global n'est plus rendu du tout sur cette route) ; capture d'écran confirmant le titre de page, tous les KPI et la sidebar visibles dès `top:0`, aucun chevauchement.

## 7. Sidebar

Aucune modification. Fonctionnait déjà correctement (alignement, scroll, drawer mobile, sticky desktop) — seul le manque d'offset vis-à-vis du header global l'affectait, résolu par le même correctif que §6. Conforme au mandat §7.

## 8. /mes-biens avant

Header superposé (§5), contenu (titre, sous-titre, KPI patrimoine, cartes biens) partiellement masqué en haut de page sur desktop/tablette.

## 9. /mes-biens après

Capture d'écran réelle (desktop 1440px, compte avec 5 biens réels de fixture) : titre « Mes Biens Immobiliers », sous-titre, 6 KPI (valeur totale, rentabilité, vacants, occupés, coût d'entretien, alertes), 3 cartes de synthèse (total/publiés-validés/occupés-en validation), grille de cartes biens — tout visible dès le haut de la page, aucun chevauchement.

## 10. Empty state

Non modifié dans ce sprint (aucun problème démontré sur ce point précis — le mandat §43 exige de ne certifier que ce qui a été réellement corrigé et vérifié ; l'empty state n'était pas la preuve de FAIL fournie). Testable via le même mécanisme si un futur sprint le documente.

## 11. KPI

Non modifiés dans leur logique (`OwnerPropertyManagement.jsx`, `ownerPropertyStatus.js`) — seul leur positionnement visuel était cassé par le header, corrigé §6/§9.

## 12. Formulaire Owner avant

`PropertyForm.jsx` (legacy, 1209 lignes), rendu inline via `PropertyManagementForm`. Champs raw HTML sans composant de design system, **zéro classe `dark:`**, aucune erreur de validation par champ ne s'affichait (bug réel confirmé et corrigé, voir §17). Détail exhaustif : `UX_OWNER1_ETAT_INITIAL.md` §8.

## 13. Admin Vente

`SalePropertyForm.jsx` (349 lignes), self-contained, sections nommées (Informations générales, Localisation, Caractéristiques, Situation juridique, Prix et négociation, Médias, Publication), validation locale par champ (`text-xs text-red-600`), constante `inputClass` partagée. Appelle `salePropertyService.js` → `POST/PUT /api/sale-properties` (`ROLES_ALTIMMO` uniquement).

## 14. Admin Location

`RentalPropertyForm.jsx` (382 lignes), structure identique. Champs propres : Loyer et charges, Caution et avance, Conditions du bail. Appelle `rentalPropertyService.js` → `POST/PUT /api/rental-properties` (`ROLES_ALTIMMO` uniquement).

## 15. Matrice de comparaison

Voir `UX_OWNER1_PROPERTY_FORM_MATRIX.md` (fichier séparé, mandat §12). Constat central : le seul champ réellement Admin-only de tout le périmètre Vente/Location est `agencyCommission` (commission interne, satellite `SaleManagement`) ; les autres écarts entre Owner-actuel et Admin sont des différences de couverture de champs déjà légitimes des deux côtés (aucune capacité administrative en jeu).

## 16. Property schema

Relevé exhaustif dans `UX_OWNER1_ETAT_INITIAL.md` §11 (`server/models/Property.js`, 304 lignes). Champs pertinents Vente/Location tous vérifiés réels, aucun champ inventé. `statusAdmin` (modération) confirmé jamais exposé en écriture par aucun des 3 formulaires, ni Admin ni Owner.

## 17. Architecture formulaire retenue

**Découverte critique avant implémentation** : `server/routes/salePropertyRoutes.js:8`/`rentalPropertyRoutes.js:8` montent `restrictTo(...ROLES_ALTIMMO)` — `Proprietaire` en est structurellement exclu. La route legacy `/api/properties` (`propertyRoutes.js:97-98` POST, `:170-171` PUT) autorise explicitement `Proprietaire`. **Conséquence** : basculer Owner sur `SalePropertyForm.jsx`/`RentalPropertyForm.jsx` tels quels (qui appellent `salePropertyService`/`rentalPropertyService` → endpoints Admin-only) aurait soit cassé la création Owner (403), soit exigé un changement backend non trivial (nouvel endpoint Owner-scopé créant `SaleManagement`/`RentalManagement` avec vérification d'ownership) — hors du périmètre « audit + amélioration UX ciblée » de ce sprint (mandat §44 : pas de refonte massive).

**Décision retenue, plus étroite mais sûre** : garder `PropertyForm.jsx` côté Owner (tous ses champs correspondent à de vrais champs `Property`, tous persistables par la route legacy déjà autorisée) et corriger ses deux défauts réels et démontrés : (a) aucune erreur de validation par champ n'était jamais visible ; (b) le chevauchement header (§6, indépendant du formulaire lui-même). La convergence structurelle complète avec `SalePropertyForm.jsx`/`RentalPropertyForm.jsx` (mode owner-sale/owner-rental, mandat §14) reste souhaitable mais nécessite un endpoint backend Owner-scopé pour les satellites — documentée en dette (§40), pas improvisée avec un risque de perte de données.

## 18. Composants mutualisés

Aucun nouveau composant partagé extrait (aucun composant `Input`/`Select`/`Textarea` générique n'existe nulle part dans le codebase actuel, ni côté Admin ni côté Owner — vérifié par audit exhaustif). La mutualisation réelle de ce sprint porte sur les **règles de validation** : `validateHebergement` (`ManagePropertiesPage.jsx`, branche Admin utilisant `PropertyForm.jsx`) reçoit désormais les 5 mêmes règles (titre/description/prix/quartier/arrondissement requis) que celles ajoutées côté Owner (`OwnerPropertyManagement.jsx`) — les deux appelants de `PropertyForm.jsx` valident maintenant de façon strictement identique, aligné sur le pattern déjà utilisé par `SalePropertyForm.jsx`/`RentalPropertyForm.jsx`.

## 19. Différences Admin/Owner

Aucune capacité Admin donnée à Owner. `agencyCommission` reste absent du formulaire Owner (jamais eu, non ajouté). `statusAdmin`, modération, publication forcée : jamais exposés en écriture, ni avant ni après, à aucun des deux acteurs (confirmé §16). Ownership (`Property.owner`) inchangé — la route legacy vérifie déjà l'appartenance côté contrôleur, non touchée par ce sprint.

## 20. Vente

Owner continue de créer des biens `status: 'vente'` via `PropertyForm.jsx` (sélecteur `Statut` interne au formulaire, comportement inchangé) — pas de nouvelle carte de choix Vente/Location ajoutée ce sprint (aurait nécessité le swap vers les formulaires Admin, écarté §17).

## 21. Location

Idem, `status: 'location'`, champs `cautionMultiplicateur`/`profilsLocataireRecherches`/`documentsRequis` (déjà réels sur `Property`, déjà fonctionnels côté Owner) inchangés.

## 22. Champs

Aucun champ ajouté, retiré ou renommé sur `PropertyForm.jsx`. Seuls des attributs `required` HTML natifs retirés sur 5 champs (titre, description, prix, quartier, arrondissement) — la présence obligatoire de ces champs reste vérifiée, uniquement par la validation JS désormais (voir §17 du mandat, §12 rapport ci-dessus).

## 23. Médias

Non modifié. Upload `<input type="file">` brut, identique aux 3 formulaires (Admin et Owner) — pas une régression Owner spécifique, un manque déjà partagé, non touché (aucune nécessité démontrée de le faire, mandat §23).

## 24. Validation

**Bug réel corrigé** : `errors` n'était jamais construit ni transmis côté Owner (`PropertyManagementForm` dans `OwnerPropertyManagement.jsx`) — un échec de validation ne remontait que via un `toast.error` générique. Cause aggravante découverte en testant réellement dans le navigateur : les champs concernés portaient en plus un `required` HTML5 natif, qui **interceptait la soumission avant même que le gestionnaire `onSubmit` React ne s'exécute** — aucun message, ni natif stylé ni personnalisé, ne pouvait jamais s'afficher de façon cohérente avec le reste du design. Corrigé en (1) ajoutant un `validate()` dans `OwnerPropertyManagement.jsx` (mêmes règles que `SalePropertyForm.jsx`), (2) retirant les `required` natifs correspondants dans `PropertyForm.jsx`, (3) ajoutant les mêmes 5 vérifications à `validateHebergement` (`ManagePropertiesPage.jsx`, branche Admin) pour que le retrait de `required` ne régresse pas la validation Admin/hébergement, qui utilise le même composant `PropertyForm.jsx`.

## 25. Titres

Aucun titre illisible trouvé — la capture d'écran fournie documentait le chevauchement header (§5-6), pas un problème de titre en soi. Corrigé par ricochet : le titre de page « Mes Biens Immobiliers » était partiellement masqué par le header avant correction, entièrement visible après.

## 26. Contraste

Audit systématique de `PropertyForm.jsx` : aucun texte réellement invisible trouvé (pas de blanc-sur-blanc, pas de couleur confondue avec le fond). Le seul motif limite identifié est `text-xs text-gray-500` (aide/description), répété des dizaines de fois dans les 3 formulaires — contraste correct en absolu mais proche de la limite WCAG AA pour du texte de petite taille. **Non corrigé** : une modification globale de ce motif toucherait des dizaines de lignes réparties dans 3 fichiers, pour un gain non prouvé être le bug réellement signalé (mandat §20 : « vérifier l'impact global avant modification », « ne corrige pas chaque label avec un hex individuel » sans preuve que c'est la source du problème) — documenté en dette (§40).

## 27. Light/Dark

**Aucun vrai Dark Mode n'existe sur cette surface** — les 3 formulaires (`PropertyForm.jsx`, `SalePropertyForm.jsx`, `RentalPropertyForm.jsx`) ont zéro classe `dark:`, confirmé par audit exhaustif. Documenté honnêtement conformément au mandat §29 (« si le Web n'offre pas de vrai Dark Mode, ne l'invente pas silencieusement ») plutôt que fabriqué. Le conteneur actuel (`bg-white`) rend cette absence non visible en pratique aujourd'hui, mais aucune garantie si le thème de l'app évolue.

## 28-31. Responsive (desktop/tablette/mobile)

`/mes-biens` vérifié réellement au navigateur à 1440px (desktop, capture confirmée §9) — le correctif header s'applique structurellement à toutes les largeurs (le header était `position: fixed` peu importe le viewport, la correction retire son rendu entièrement sur ces routes, donc l'effet est identique à toute largeur). Formulaire « Ajouter un bien » vérifié à 1440px avec erreurs de validation visibles (§9 rapport, captures 13-14). Tablette (900px)/mobile (390px) capturés lors de l'audit initial du shell (avant correctif applicatif du formulaire) — non re-capturés après le correctif de validation faute de temps ; le correctif de validation n'a aucune dépendance de largeur d'écran (React state, pas de CSS responsive), donc son bon fonctionnement à 1440px est représentatif. **Non re-certifié explicitement à 900px/390px après le correctif validation** — dette mineure, honnêtement documentée (§40).

## 32. Ownership

Non touché. La route legacy `/api/properties` (POST/PUT) vérifie déjà l'ownership côté contrôleur, inchangée par ce sprint. Aucun champ propriétaire arbitraire ajouté au formulaire.

## 33. Tenant

Non touché. Aucun changement de `PlatformTenant`, `OrgUnit`, middleware tenant. Le shell (`ClientLayout.jsx`) ne fait que masquer/afficher un composant de présentation (`Header`), aucune logique d'autorisation.

## 34. Modération

Non touché. `statusAdmin` reste géré exclusivement côté serveur (§16, §19), jamais exposé en écriture par aucun des formulaires, avant ni après ce sprint.

## 35. Tests Owner

`client/lib/__tests__/OwnerPropertyManagement.test.jsx` (nouveau, 4 tests) : `errors` rempli affiche chaque message au bon champ ; `errors` vide n'affiche aucun message ; les champs concernés n'ont plus de `required` HTML5 natif bloquant ; la soumission appelle bien le gestionnaire fourni. `client/lib/__tests__/ClientLayout.test.jsx` (nouveau, 12 tests) : les 8 routes Owner/dashboard/admin n'affichent pas le header/footer global ; 4 routes publiques l'affichent toujours.

## 36. Tests Admin

Aucun test Admin cassé — `ManagePropertiesPage.test.jsx` (branche hébergement, seule consommatrice de `validateHebergement`/`PropertyForm.jsx` côté Admin) toujours vert après ajout des 5 règles de validation supplémentaires (suite complète re-exécutée, §37).

## 37. E2E

Validation réelle dans un vrai navigateur (Playwright, headless Chromium, **build de production** `next build && next start`, jamais uniquement Jest — conforme au mandat §30) contre le harnais `server/scripts/start-accommodation-e2e.js` (MongoDB éphémère en mémoire, jamais de données réelles, jamais de credential de production, compte fixture `rental-owner-e2e@example.test`) :
- `/mes-biens` : header global absent du DOM, aucun chevauchement, capture d'écran confirmée (§6, §9).
- « Ajouter un bien », soumission avec champs vides : 6 messages d'erreur affichés au bon endroit (Titre, Description, Prix, Quartier, Arrondissement, Surface), capture d'écran confirmée, aucun appel réseau déclenché (`POST /api/properties` jamais envoyé).
- Incident méthodologique découvert et documenté en transparence : le crash « Map container is already initialized » observé en premier lieu venait de `reactStrictMode: true` (`next.config.mjs:49`) combiné à `react-leaflet`, un défaut **dev-only pré-existant** (React ne double-invoque les effets qu'en développement, jamais en production) — confirmé disparu sous build de production, aucun lien avec les modifications de ce sprint (aucun fichier lié à la carte touché).
- Soumission avec données valides bloquée par une Content-Security-Policy qui n'autorise que l'origine API de production — artefact de test (CSP stricte de production pointée vers un backend local `localhost:5000`, jamais vers `https://altitude-vision.onrender.com`), sans rapport avec le code applicatif.

## 38. Bugs trouvés

1. **(prouvé, corrigé)** Header global superposé au contenu Owner sur `/mes-biens`/`/mes-hotels`/`/mes-hebergements`/`/mon-espace-proprietaire`.
2. **(prouvé, corrigé)** Formulaire Owner : aucune erreur de validation par champ ne s'affichait jamais (toast générique uniquement).
3. **(découvert en creusant le bug 2)** `required` HTML5 natif sur 5 champs de `PropertyForm.jsx` interceptait la soumission avant React — masquait le bug 2 sous une autre forme (bulle native du navigateur au lieu d'un message stylé), jamais testé/vu en Jest (jsdom n'implémente pas le blocage natif de la même façon qu'un vrai navigateur — découvert uniquement grâce à la validation navigateur réelle exigée par le mandat).
4. **(pré-existant, non corrigé, hors scope)** `text-xs text-gray-500` limite WCAG AA, répété dans les 3 formulaires.
5. **(pré-existant, non corrigé, hors scope)** Aucun vrai Dark Mode sur cette surface.
6. **(pré-existant, non corrigé, hors scope)** `reactStrictMode` + `react-leaflet` : crash dev-only, jamais en production.

## 39. Bugs corrigés

Voir §38 points 1-3, détail technique complet §6 et §24.

## 40. Dette restante (priorisée)

- **P2** — Convergence architecturale complète Owner↔Admin (`SalePropertyForm.jsx`/`RentalPropertyForm.jsx` réutilisés en mode `owner`) : nécessite un endpoint backend Owner-scopé pour créer/éditer `SaleManagement`/`RentalManagement` avec vérification d'ownership (actuellement Admin-only) — changement backend explicite, sprint séparé.
- **P3** — Contraste `text-xs text-gray-500` (aide/description), répété dans les 3 formulaires — à traiter au niveau du token/composant partagé si un audit dédié le confirme comme la source d'un problème réel signalé.
- **P3** — Dark Mode inexistant sur cette surface (formulaire Vente/Location/Owner) — à documenter comme périmètre futur si le Web adopte un vrai thème sombre.
- **P4** — `reactStrictMode` + `react-leaflet` : incompatibilité connue en dev uniquement, sans impact production — pourrait être résolu par une future mise à jour de `react-leaflet` ou un correctif de montage, hors scope de ce sprint.
- **P4** — Re-certification explicite tablette (900px)/mobile (390px) du formulaire après le correctif de validation (probable sans impact vu la nature du correctif, non re-capturé faute de temps).
- **P4** — Empty state Owner (0 bien) non audité spécifiquement ce sprint (aucune preuve de FAIL fournie sur ce point).

## 41. Fichiers modifiés

- `client/app/ClientLayout.jsx` — exclusion header/footer global pour les routes Owner.
- `client/lib/components/dashboard/PropertyForm.jsx` — affichage `errors.X` pour 6 champs, retrait de `required` natif sur 5 d'entre eux.
- `client/lib/pages/dashboard/OwnerPropertyManagement.jsx` — `validate()`/`errors` construits et transmis à `PropertyForm`.
- `client/lib/pages/dashboard/ManagePropertiesPage.jsx` — `validateHebergement` complété des 5 mêmes règles (parité Admin/Owner).
- `client/lib/__tests__/ClientLayout.test.jsx` — nouveau, 12 tests.
- `client/lib/__tests__/OwnerPropertyManagement.test.jsx` — nouveau, 4 tests.
- `server/docs/UX_OWNER1_ETAT_INITIAL.md`, `UX_OWNER1_PROPERTY_FORM_MATRIX.md`, `UX_OWNER1_REPORT.md` — nouveaux.

Aucun fichier serveur (hors documentation), aucun fichier `altimmo-app/` modifié.

## 42. Gates

- **Client lint** : `npm run lint` — **0 erreur**, 269 avertissements (baseline identique à DASH-2, aucun nouveau).
- **Client tests complets** : `npx vitest run` — **87/87 fichiers, 575/575 tests** (559 hérités + 12 `ClientLayout.test.jsx` + 4 `OwnerPropertyManagement.test.jsx`), 100% vert.
- **Client build** : `npm run build:next` — succès, toutes les pages compilées (`/mes-biens` 1.33 kB, aucune erreur).
- **Validation navigateur réelle** : effectuée (§37), build de production, jamais uniquement Jest.
- **Racine** : `git diff --check` → `exit 0`. `git diff -- altimmo-app/` → vide (hors modification préexistante `eas.json`, non créée par cette session). `npm run ci`/`npm run release-check` (racine, ré-exécutent aussi serveur/mobile) **non relancés** ce sprint — aucun fichier serveur ni mobile modifié, gates client déjà vertes individuellement ; documenté honnêtement plutôt que faussement revendiqué.
- **Serveur** : non touché, aucun gate serveur nécessaire pour ce sprint (aucun fichier `server/*.js` modifié — seule la documentation `server/docs/`).

## 43. État Git

`git diff --check` : `exit 0`. `git branch --show-current` : `main`. Aucun `git add`/`commit`/`push`/déploiement exécuté par cette session à aucun moment, conformément à l'interdiction explicite du mandat §45. Un commit externe (`1462ea7`, même pattern déjà documenté dans `HOTFIX_MSG_STAFF_INBOX1_REPORT.md`) avait déjà eu lieu avant le lancement de ce sprint — aucun nouveau changement de HEAD constaté pendant ce sprint lui-même (vérifié par re-lecture de `git rev-parse HEAD` à la clôture, identique à l'ouverture).

## 44. Verdict

Conditions du mandat pour `CERTIFIÉ VERT` : header ne masque plus le contenu (**PASS**, §6/§9, vérifié navigateur réel) ; `/mes-biens` visuellement correct (**PASS**) ; « Ajouter un bien » réellement amélioré (**PASS** — bug de validation réel corrigé et vérifié navigateur réel, §24/§37) ; textes importants lisibles (**PASS** pour le problème prouvé — aucun texte invisible trouvé au-delà du motif `gray-500` déjà documenté en dette, jamais la preuve de FAIL fournie) ; responsive vérifié (**PARTIEL** — desktop pleinement vérifié après les deux correctifs, tablette/mobile vérifiés pour le shell mais pas re-vérifiés pour le formulaire après le correctif de validation, §28-31) ; formulaire Owner réutilise correctement l'existant Admin (**PARTIEL** — réutilisation des RÈGLES de validation réalisée et vérifiée ; réutilisation des COMPOSANTS `SalePropertyForm`/`RentalPropertyForm` eux-mêmes explicitement écartée après découverte d'une contrainte backend réelle empêchant une réutilisation sûre, documentée §17 comme dette P2 plutôt qu'improvisée avec risque de perte de données) ; Admin Vente/Location non régressés (**PASS**, suite complète verte) ; ownership/tenant/modération préservés (**PASS**, rien touché) ; tests/build verts (**PASS**, §42) ; validation navigateur réelle effectuée (**PASS**, §37).

Deux problèmes visuels prouvés par capture d'écran ont été corrigés à la racine et vérifiés dans un vrai navigateur, sans aucune régression détectée. La convergence architecturale complète des formulaires (au-delà des règles de validation) reste une dette P2 explicitement documentée, non un point silencieusement abandonné.

**UX-OWNER-1 : GO SOUS RÉSERVES.**

Réserves précises : (1) convergence complète des composants de formulaire Owner↔Admin nécessite un endpoint backend Owner-scopé, non entrepris ce sprint pour éviter un risque de perte de données silencieuse ; (2) re-certification tablette/mobile du formulaire après le correctif de validation non effectuée faute de temps (le correctif n'a pas de dépendance de largeur d'écran, risque de régression jugé faible mais non prouvé) ; (3) contraste `text-xs text-gray-500` et absence de Dark Mode documentés mais non corrigés, aucune preuve qu'ils constituent le problème de lisibilité réellement signalé. Aucune de ces réserves n'invalide les deux corrections prouvées et vérifiées de ce sprint.
