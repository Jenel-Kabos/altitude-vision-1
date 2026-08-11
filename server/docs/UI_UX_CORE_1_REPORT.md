# UI-UX-CORE-1 — Rapport d'implémentation

Date : 10 août 2026.

## 1. Résultat et périmètre

Le sprint consolide le socle UI des dashboards sans modifier les règles métier, les API, les modèles, les autorisations, le tenant courant ni NAV-CORE. L'audit exhaustif préalable est conservé dans `UI_UX_CORE_1_AUDIT.md` : 73 routes dashboard/admin, 81 pages dashboard, deux shells actifs, un shell legacy mort, score initial 12,3/20.

La refonte est volontairement incrémentale : étendre le système existant et corriger les parcours représentatifs à plus forte valeur, sans réécrire les monolithes métier ni masquer leur dette.

## 2. Architecture et design system

`DashboardUI.jsx` reste l'unique point d'entrée du système dashboard. Les primitives ajoutées sont :

- `DashboardSection` pour la hiérarchie métier ;
- `DashboardKpiGrid` et `DashboardKpiCard` pour les indicateurs officiels ;
- `DashboardBadge` pour les statuts ;
- `DashboardTabs` pour les sections accessibles ;
- `DashboardSkeleton` pour le chargement ;
- `DashboardContextSwitcher` pour les profils multiples ;
- `DashboardActionMenu` pour réduire les actions concurrentes.

`DashboardKpis` est devenu un adaptateur de ces primitives : ses appels historiques restent compatibles. Le CSS dashboard centralise grille responsive, couleurs de statut, menu d'actions, skeleton, sections et focus. Lucide reste la convention d'icônes. Aucun package UI supplémentaire n'a été introduit.

## 3. Navigation et profils

Le shell propriétaire distingue désormais deux espaces lisibles :

- **Patrimoine immobilier** : portefeuille, vente, location, rendez-vous et paiements ;
- **Exploitation d'établissement** : établissements, hébergements et réservations.

Les options proviennent exclusivement des profils effectifs exposés par `AuthContext`. Un mono-profil voit directement son contexte ; un double profil peut basculer via le sélecteur. Le changement ne fait qu'ouvrir la route racine existante (`/mes-biens` ou `/mes-hotels`) et n'accorde aucun droit. Les liens communs messages/profil/sécurité restent visibles. NAV-CORE, les deep links et les destinations existantes ne sont pas modifiés.

## 4. Écrans refondus et workflows préservés

### Portefeuille établissements staff

Les 13 KPI backend sont séparés entre « Pilotage opérationnel » et « Situation financière ». Aucun calcul financier client n'a été ajouté. Chaque carte conserve une action primaire « Ouvrir » ; modifier, chambres, réservations, calendrier, finances et archivage sont regroupés dans un menu secondaire accessible. Les services, confirmations et règles d'archivage existants restent inchangés.

### Portefeuille établissements propriétaire

La fiche conserve les actions principales « Modifier la fiche » et « Catégories ». Tarifs, soumission, activation/désactivation, duplication et suppression sont regroupés dans le même pattern partagé. Le cycle de vie hôtelier et ses services n'ont pas été modifiés.

## 5. Responsive et accessibilité

- grille KPI adaptative, à deux colonnes sur petit écran ;
- sections et actions empilées sur mobile ;
- sélecteur de contexte explicitement nommé ;
- boutons d'action de 44 px minimum ;
- menu avec rôles `menu`/`menuitem`, `aria-expanded`, fermeture extérieure et touche Échap ;
- skeleton annoncé comme état de chargement ;
- mouvement désactivé avec `prefers-reduced-motion` ;
- focus et scroll horizontal des tables historiques conservés.

## 6. Sécurité et intégrité métier

Aucune donnée ou règle n'est calculée dans la couche UI. Aucun endpoint, modèle, contrôleur, middleware, permission, rôle, profil effectif, tenant, document ou notification n'a été modifié par UI-UX-CORE-1. Les vérifications d'accès restent serveur. Aucun mock métier, fallback trompeur ou KPI inventé n'a été ajouté.

## 7. Gates réellement exécutés

| Gate | Résultat frais | Détail |
| --- | --- | --- |
| Tests UI ciblés | PASS | 3 fichiers, 19 tests |
| Web Vitest complet | PASS | 76 fichiers, 513 tests |
| ESLint client | PASS avec dette | 0 erreur, 268 avertissements préexistants |
| Build Next.js | PASS | compilation, types, 142 pages statiques |
| ESLint serveur | PASS avec dette | 0 erreur, 123 avertissements préexistants |
| Backend Unit | ÉCHEC hors périmètre | 105 suites : 102 passent, 3 échouent ; 1207/1217 tests passent. Dix assertions de routes locatives reçoivent 404. Ces fichiers serveur étaient déjà modifiés dans le worktree avant ce sprint. |
| Backend Mongo complet | PASS | 65 suites, 618 tests, replica set local ; 843,7 s |
| Playwright desktop/mobile | BLOQUÉ environnement | première passe : `EADDRINUSE` sur `127.0.0.1:5051`. Relance isolée : serveurs résiduels sur 5051/3000, aucune progression ni sortie pendant plusieurs minutes ; arrêt propre, code 130. Aucun verdict fonctionnel n'est revendiqué. |
| Mobile Jest / TypeScript / Expo | N/A | aucun fichier, contrat, route ni navigation Mobile impacté |
| `git diff --check` | PASS | aucune erreur d'espacement ; avertissements CRLF sur des fichiers serveur antérieurs |

Les messages `TEST DATA COMMENTS ERROR`, navigation JSDOM et `scrollTo` observés pendant Vitest sont des sorties attendues de tests négatifs ; la suite termine à 513/513.

## 8. Dette restante et risques

1. `GestionLocativePage`, `UsersPanel`, `DocumentsPage` et `InternalMessagingPage` restent des monolithes à découper par sprints métier dédiés.
2. Les 32 overlays ad hoc et 23 confirm/prompt demandent une primitive Dialog contrôlée et une migration progressive.
3. Le shell staff conserve une configuration locale de navigation parallèle à NAV-CORE ; sa convergence nécessite un contrat de registre adapté aux groupes/labels UI.
4. Le shell legacy `components/layout/DashboardLayout.jsx` est non importé mais n'a pas été supprimé sans preuve de non-usage hors build.
5. Les avertissements ESLint historiques demeurent nombreux, sans erreur bloquante.
6. La certification globale reste conditionnée par les échecs Backend Unit du worktree serveur préexistant et par la remise à zéro contrôlée des serveurs E2E avant une nouvelle relance Playwright.

## 9. Fichiers UI-UX-CORE-1

### Créés

- `server/docs/UI_UX_CORE_1_AUDIT.md`
- `server/docs/UI_UX_CORE_1_REPORT.md`

### Modifiés

- `client/app/dashboard/dashboard.css`
- `client/lib/components/dashboard/DashboardUI.jsx`
- `client/lib/components/dashboard/DashboardKpis.jsx`
- `client/lib/pages/dashboard/OwnerDashboard.jsx`
- `client/lib/pages/dashboard/ManageHotelsPage.jsx`
- `client/lib/pages/dashboard/MyHotelsPage.jsx`
- `client/lib/__tests__/DashboardUI.test.jsx`
- `client/lib/__tests__/OwnerDashboardNavigation.test.jsx`
- `client/lib/__tests__/ManageHotelsPage.test.jsx`
- `client/lib/__tests__/MyHotelsPage.test.jsx`

## 10. Confirmations

- Aucun commit.
- Aucun push.
- Aucun déploiement.
- Aucune migration destructive.
- Aucune suppression ni modification de données.
- Aucun secret affiché ou ajouté.
