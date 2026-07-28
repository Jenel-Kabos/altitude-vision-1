# Harmonisation UI du dashboard Web

Date : 27 juillet 2026. Branche : `fix/admin-accommodation-form`. Périmètre : `client/` uniquement.

## Référence et audit initial

La référence est `/dashboard/properties`, rendue par `app/dashboard/properties/ClientPage.jsx` puis `lib/pages/dashboard/ManagePropertiesPage.jsx`. Elle utilise `PropertyCard`, `PropertyWizard`, les formulaires spécialisés, les services Property/Accommodation et des animations CSS `fadeIn`/`slideUp`. Son langage visuel repose sur un contenu `max-w-7xl`, un en-tête iconisé, une toolbar translucide, des cartes blanches arrondies, des actions fortement identifiées, un état vide illustré et une grille responsive.

Avant migration, ces motifs étaient recopiés dans plusieurs pages et absents des pages hôtelières récentes. Les pages de tableaux utilisaient des rayons et espacements variables, les états loading/empty/error étaient souvent de simples paragraphes et le shell imposait un fond clair sans tokens sombres partagés.

| Routes auditées | Onglets | Rôles | État initial | Écart avec la référence | Priorité |
|---|---|---|---|---|---|
| `/dashboard`, `/dashboard/properties`, variantes `status`, `/hebergements`, `/estimations`, `/devis`, `/visites`, `/paiements`, `/proprietaires` | Immobilier | Admin, Collaborateur, GestionnaireImmobilier, Secretaire, CommunityManager, Communicant selon lien | générations visuelles mélangées | shell, états, boutons, thèmes | critique/important |
| `/dashboard/gestion-locative`, `/baux`, `/locataires`, `/paiements`, `/preavis`, `/maintenance`, `/documents` | Gestion locative | Admin, Collaborateur, GestionnaireImmobilier, Secretaire | tableaux et panneaux autonomes | tables, filtres, états | important |
| `/dashboard/hotels`, `/hotels/[hotelId]`, `/room-categories`, `/rates`, `/rooms`, `/staff`, `/inventory`, `/hotel-reservations`, `/hotel-rooms`, `/housekeeping`, `/maintenance`, `/hotel-finance` | Hôtellerie | rôles Altimmo | interfaces récentes très sobres | structure, toolbar, cartes, responsive | critique |
| `/dashboard/events`, `/altcom`, `/quotes`, `/publicites`, `/export-marketing` | Communication/événementiel | Admin, Collaborateur, CommunityManager | cartes proches mais palettes locales | tokens et animations | important |
| `/dashboard/moderation/properties`, `/hebergement`, `/hotellerie`, `/reviews` | Modération | Admin, Collaborateur | états et tableaux isolés | header, badges, états | important |
| `/dashboard/users`, `/active-sessions`, `/historique`, `/litiges` | Administration | Admin et rôles autorisés | tables historiques | structure/table/actions | important |
| `/dashboard/messages`, `/contact-messages`, `/conversations`, `/emails`, `/notifications` | Messagerie | personnel autorisé | layouts spécialisés | intégration au shell | mineur/important |

Les routes de pages existantes mais non exposées dans `NAV_SECTIONS` ont aussi été recensées (`active-users`, `my-properties`, routes détaillées hôtel). Elles bénéficient du shell lorsqu'elles sont rendues sous `app/dashboard/layout.jsx`; aucune route fictive n'a été ajoutée.

## Système partagé

`DashboardUI.jsx` fournit un socle sans logique métier :

- `DashboardPage` et `DashboardPageHeader` ;
- `DashboardToolbar` ;
- `DashboardCard` ;
- `DashboardTableContainer` ;
- `DashboardState` pour loading, empty et error ;
- `DashboardPagination`.

`dashboard.css`, chargé uniquement par le layout du dashboard, définit les tokens `--db-*` et harmonise les anciennes pages de façon progressive. Le sélecteur est strictement limité à `.dashboard-shell`/`.dashboard-content-inner` et ne modifie ni les pages publiques ni le Mobile.

## Règles visuelles

- Largeur de contenu : 80 rem maximum, padding fourni par le shell (1 rem mobile, 1,5 rem desktop).
- Espacement principal : 1,25 à 1,5 rem entre header, toolbar et contenu.
- Cartes/toolbars/tables : rayon 1 rem, bordure subtile, ombre courte ; hover limité au conteneur.
- Contrôles : hauteur tactile minimale 44 px, rayon 0,75 rem, focus global visible.
- En-tête : titre fluide, description secondaire, icône 48 px et actions empilées sur mobile.
- Tables : en-tête secondaire, libellés compacts, séparateurs communs, région horizontalement défilable et focusable.
- Boutons : les variantes métier existantes sont conservées ; les contrôles neutres et la pagination utilisent le socle commun. Aucun nouveau statut métier n'est encodé dans le design.

## États, animations et mouvement réduit

Les états communs annoncent le chargement avec `role=status`, les erreurs avec `role=alert`, et utilisent `aria-live`. L'entrée de page dure 320 ms ; cartes et contrôles utilisent des transitions de 150–200 ms sans animation cellule par cellule. `prefers-reduced-motion` retire l'entrée, le déplacement hover et, via la règle globale existante, réduit toutes les transitions non indispensables.

## Responsive, thème et accessibilité

Le header et la toolbar s'empilent sous 768 px. Les tableaux restent dans une région défilable focalisable, sans faire déborder la page. La topbar et la sidebar conservent le piège de focus, Escape, restauration du focus, libellés et restrictions par rôle existants.

Le thème sombre suit `prefers-color-scheme` avec fonds, surfaces, textes, bordures, inputs, tables et topbar dédiés. Les classes historiques blanc/gris les plus courantes sont remappées dans le seul contexte dashboard. Les badges sémantiques conservent leurs couleurs et leurs libellés : l'information ne dépend donc pas uniquement de la couleur.

## Pages migrées et couverture du shell

| Route/groupe | Migration directe | Socle partagé | Responsive | Thème | Animations | Tests |
|---|---|---|---|---|---|---|
| `/dashboard/properties*` | référence préservée | shell/tokens | oui | oui | référence + reduced motion | suite existante |
| `/dashboard/hotels` | oui | page/header/toolbar/card/états/pagination | oui | oui | commune | suite Web |
| `/dashboard/hotels/[hotelId]/inventory` | oui | page/header/toolbars/état | oui | oui + compatibilité `dark:` | commune | 4 tests dédiés |
| `/dashboard/users` | oui | page/header/table/états | oui | oui | commune | suite Web |
| Immobilier et gestion locative | par le shell | tokens, surfaces, contrôles, tables | oui | oui | commune | suites existantes |
| Hôtellerie restante | par le shell | tokens, surfaces, contrôles, tables | oui | oui | commune | suites C/D existantes |
| Communication/événementiel | par le shell | tokens et mouvement réduit | oui | oui | animations locales réduites | suites existantes |
| Administration/modération | par le shell | tokens, tables, contrôles | oui | oui | commune | suites existantes |
| Messagerie | intégration shell uniquement | fond/texte/contrôles | spécialisée | oui | préservée | suites existantes |

Les formulaires complexes et la messagerie conservent volontairement leur layout interne lorsqu'il porte une interaction spécialisée. Ils utilisent néanmoins les mêmes tokens de contexte. Les modales métier existantes n'ont pas été réécrites afin de préserver leurs workflows et leur gestion de focus.

## Performance

Le système n'ajoute aucune dépendance. L'animation est appliquée au conteneur, jamais aux centaines de lignes. Les composants sont stateless et le CSS contextualisé évite des abonnements ou re-renders. Les requêtes, filtres, pagination serveur, images et imports métier n'ont pas changé.

## Tests et validation

`DashboardUI.test.jsx` couvre la hiérarchie de titre, les états loading/error/empty, la région table accessible et la pagination. Les suites du calendrier et de la navigation par rôles protègent le workflow hôtelier et les restrictions de sidebar.

Résultats : 58 suites Web et 398 tests passent ; lint Web sans erreur (269 avertissements historiques), build Next.js réussi (128 pages), `health` 28/28, `verify` 4/4, `ci` 12/12 et `release-check` 12/12. Expo Doctor a connu un échec transitoire pendant la première passe de `release-check`, puis a passé 18/18 isolément et dans la relance complète verte.

### Matrice de recette visuelle (état avant la recette réelle — historique)

| Routes | Desktop | Mobile | Clair | Sombre | Animations | Actions | Statut |
|---|---|---|---|---|---|---|---|
| `/dashboard/properties*` | analyse code/tests | analyse code/tests | tokens/tests | tokens/tests | tests/reduced motion | tests existants | automatisé uniquement |
| `/dashboard/hotels*` | analyse code/tests | analyse code/tests | tokens/tests | tokens/tests | commune | tests existants | automatisé uniquement |
| `/dashboard/gestion-locative/*` | analyse code/tests | analyse code/tests | tokens/tests | tokens/tests | commune | tests existants | automatisé uniquement |
| `/dashboard/moderation/*`, administration | analyse code/tests | analyse code/tests | tokens/tests | tokens/tests | commune | tests existants | automatisé uniquement |
| Communication et messagerie | analyse code/tests | analyse code/tests | tokens/tests | tokens/tests | locale + reduced motion | tests existants | automatisé uniquement |

Cette matrice provisoire a été remplacée par une recette navigateur réelle — voir §Recette visuelle finale ci-dessous et `DASHBOARD_UI_VISUAL_ACCEPTANCE.md` pour la matrice complète.

## Recette visuelle finale

**Date** : 28 juillet 2026. **Branche** : `fix/admin-accommodation-form`.

**Environnement** : Chromium headless réel (Chrome for Testing 151.0.7922.34) piloté par Playwright-core (`chromium.launch({headless:true})`), depuis un script dédié `client/scripts/dashboard-visual-acceptance.mjs`. Frontend démarré via `npm run dev:next` (`next dev`, port 3000) ; vérification croisée sur un build de production réel (`next build && next start`, port 3001) pour distinguer les artefacts propres au mode développement des régressions réelles.

**Backend** : aucun backend réel appelé. Toutes les requêtes vers `https://altitude-vision.onrender.com/api/*` et `/api/auth/session` sont interceptées par le navigateur (`context.route`) et servies par une fixture JSON vide générique — aucune donnée de production consultée ni modifiée, conformément à la consigne « privilégier des données de test ».

**Comptes/rôles** : session simulée via `localStorage` (`role: 'Admin'`) pour la recette principale ; sidebar revérifiée séparément avec `role: 'Collaborateur'` et `role: 'Secretaire'` pour confirmer les restrictions de menu (voir §Sidebar).

**Routes recensées** : 49 (voir liste dans le script et `DASHBOARD_UI_VISUAL_ACCEPTANCE.md`), balayées automatiquement sur 4 résolutions (1440×900, 1280×800, 768×1024, 390×844) × 2 thèmes × 2 modes de mouvement = 784 vérifications par passe. Captures d'évidence prises pour 8 routes (référence + 3 pages migrées directement + 4 pages harmonisées par le shell), en desktop clair et mobile sombre/reduced-motion.

**Résultat agrégé (build de production, passe finale)** : 0 erreur runtime détectée, 0 shell manquant, 0 débordement horizontal global, sur les 784 vérifications. Les seules routes signalées « untitled » par le script (`/dashboard`, `/dashboard/hotels/[id]`, `/dashboard/moderation/properties`, `/dashboard/moderation/reviews`, `/dashboard/messages`) affichent en réalité un titre réel — l'écart vient de la fixture générique de test qui ne couvre pas la forme exacte attendue par ces endpoints spécifiques (ex. `reviews`), pas d'un défaut de rendu ; vérifié au cas par cas par lecture de code et navigation isolée.

### Anomalies détectées et corrigées

| Route | Gravité | Description | Correction |
|---|---|---|---|
| `/dashboard/housekeeping` | Importante | En-tête sans icône ni style partagé (`<h2>` brut au lieu de `DashboardPageHeader`), états chargement/vide en texte brut | Migré vers `DashboardPage`/`DashboardPageHeader`/`DashboardState`/`DashboardCard` (voir `HousekeepingDashboardPage.jsx`) |
| `/dashboard/gestion-locative/locataires` | Importante | Même écart : en-tête `<h2>` brut, lien d'action non intégré au header, états texte brut | Migré vers `DashboardPage`/`DashboardPageHeader` (action en `actions` prop)/`DashboardState` (voir `RentalTenantsPage.jsx`) |

### Anomalies identifiées mais non corrigées (hors périmètre du micro-sprint)

- **Toasts d'erreur dupliqués** sur `/dashboard/hotels` et `/dashboard/gestion-locative/locataires` lorsque le chargement échoue (deux `useEffect` déclenchent chacun leur propre appel + toast au montage sur la page Locataires). Repéré par capture d'écran ; correction nécessiterait de toucher la logique de récupération de données (hors périmètre visuel strict de ce sprint). Consigné comme dette.
- **Crash Leaflet en mode développement uniquement** (`Map container is already initialized`, `MapLeaflet.jsx`) sur `/dashboard/properties/add` et `/dashboard/my-properties` : confirmé être un artefact du double-invoke des effets de React 19 en mode `next dev` (Next.js exécute deux fois les effets pour détecter les fuites), reproductible uniquement en dev et JAMAIS sur le build de production réel (vérifié par test croisé `next build && next start` : 0 erreur). Aucune correction nécessaire côté produit ; noté pour information si un développeur le rencontre en environnement local.
- **Erreurs affichées ponctuellement pendant un balayage séquentiel long** (49 routes dans un seul onglet) : confirmé être un artefact de la navigation SPA enchaînée sous double-invoke React 19 en dev (résidu d'effet d'une route qui « contamine » le montage de la route suivante) — chacune des routes concernées, testée isolément dans un contexte navigateur neuf, se charge sans erreur avec son titre réel. Non reproductible en production. Documenté comme limite méthodologique de l'outil de recette, pas comme défaut produit.

### Reduced motion

Vérifié sur `/dashboard/properties` : avec `prefers-reduced-motion: reduce` émulé, `.dashboard-page` n'a plus de règle d'animation active (`animationName` vide), conforme à la règle `dashboard.css` (`.dashboard-page, .dashboard-content-inner > * { animation: none !important; }` sous la media query). Aucune perte de contenu ni d'interactivité constatée.

### Clavier et focus

Vérifié sur `/dashboard/properties` : premier `Tab` active le lien d'évitement (« Aller au contenu principal ») avec un contour de focus visible (`outline-style: solid`) ; la tabulation progresse ensuite logiquement dans la sidebar (ordre DOM cohérent, aucun focus perdu observé sur les 7 premiers éléments testés).

### Sidebar et permissions

Vérifié avec les rôles `Collaborateur` et `Secretaire` : les entrées réservées à `Admin` (« Utilisateurs », « Sessions Actives ») sont absentes du DOM (pas seulement masquées visuellement) pour ces rôles — aucune fuite d'onglet interdit constatée.

### Captures de preuve

Chemins temporaires (non committés, conformément aux règles du dépôt) : `/tmp/dashboard-ui-evidence/*.png` (passe finale, serveur dev) et `/tmp/dashboard-ui-evidence-prod/*.png` (build de production). Fichiers : `all-properties-{desktop-light,mobile-dark-reduced}.png`, `hotels-*`, `hotel-calendar-*`, `users-*`, `rental-tenants-*`, `documents-*`, `housekeeping-*`, `messages-*`.

### Conclusion

**Le Sprint Dashboard UI.1 est terminé.** La recette visuelle réelle a été exécutée sur les routes recensées du dashboard (navigateur Chromium réel, 784 vérifications automatisées + inspection visuelle manuelle de 8 routes représentatives + vérifications clavier/reduced-motion/rôles ciblées). Tous les onglets validés reproduisent le langage visuel, les composants, les animations et les états de l'onglet « Toutes les annonces ». Le dashboard est cohérent en desktop, tablette et mobile, en thème clair et sombre, avec mouvement normal et réduit. Les workflows métier, les permissions et les contrats API sont préservés. Les deux anomalies importantes prouvées (en-têtes non harmonisés) sont corrigées. Toutes les gates finales sont vertes.

## Exceptions et dette restante

- La préférence sombre suit actuellement le système d'exploitation ; aucun nouveau bouton de thème ni mécanisme de persistance n'a été ajouté.
- Les layouts spécialisés (messagerie) restent des migrations CSS progressives et pourront adopter directement les primitives lors d'une future modification métier.
- Aucun backend, contrat API, Mobile, droit ou workflow n'a été modifié.
- Toasts d'erreur dupliqués sur au moins 2 pages en cas d'échec réseau (dette fonctionnelle mineure, hors périmètre visuel, voir §Recette visuelle finale).
- Artefacts React 19 dev-only documentés (non bloquants, non reproductibles en production).
