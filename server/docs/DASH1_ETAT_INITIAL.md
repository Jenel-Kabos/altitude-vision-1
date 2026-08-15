# DASH-1 — État initial des dashboards

Date : 2026-08-14  
Branche/HEAD : `main` / `0cebcd5bbd180ff8a7814139a0f4a42dade9d2ba`  
Preflight : worktree propre, `git diff --check` PASS.

## 1. Arbre des dashboards actuels

- `/dashboard/**` : shell `AdminDashboard`, réservé aux six rôles staff; 62 pages applicatives environ.
- `/mes-biens/**` : shell `OwnerDashboard`, patrimoine immobilier.
- `/mes-hotels/**` : même shell propriétaire, portefeuille hôtelier et réservations.
- `/mes-hebergements` : même shell propriétaire, maisons/appartements meublés.
- `/espace-locataire` : portail locataire autonome.
- `/favoris`, `/mes-visites`, `/mes-reservations-hotel`, `/messages`, `/profile` : surfaces Client dispersées, sans overview commune.
- `client/lib/components/layout/DashboardLayout.jsx` et `client/lib/pages/DashboardPage.jsx` : ancien shell React Router non monté par l’App Router.

Le dépôt contient 160 fichiers `page.jsx`; le build de référence expose 142 routes, l’écart provenant notamment des routes dynamiques/catch-all et de la structure App Router.

## 2. Routes par profil

| Profil | Destination initiale | Surface réelle | État initial |
|---|---|---|---|
| Admin | `/dashboard` | overview globale + tous modules staff | canonique mais overview surchargée |
| Secrétaire | `/dashboard` | même overview globale | P1 : appels et contenus hors métier |
| Gestionnaire immobilier | `/dashboard` | même overview globale | P1 : appels et contenus hors métier |
| Community Manager | `/dashboard` | même overview globale | P1 : appels et contenus hors métier |
| Propriétaire immobilier | `/mes-biens` | patrimoine, visites, paiements | canonique |
| Exploitant établissement | `/mes-biens` par rôle legacy | switch manuel vers hôtels/hébergements | P1 : mauvaise entrée pour exploitant pur |
| Client | `/` | favoris/visites/réservations dispersés | P1 : aucun dashboard |
| Client lié Locataire | `/` puis accès manuel | `/espace-locataire` | P2 : accès conditionnel peu visible |

## 3. Sidebars

`AdminDashboard.jsx` contient une navigation staff unique filtrée soit par capability IAM-3, soit par tableaux de rôles legacy. La partie migrée IAM-3 est cohérente, mais CRM et communications restent exposés à `ALL_STAFF` sans preuve exhaustive de besoin. `OwnerDashboard.jsx` filtre patrimoine/exploitation avec les profils métier et offre un sélecteur de contexte. Aucun sidebar Client n’existe.

## 4. Layouts

Le shell staff et le shell propriétaire fournissent navigation responsive, topbar mobile, focus initial, fermeture Escape et inert du panneau masqué. Les trois layouts propriétaire réutilisent correctement `OwnerDashboard`. `/espace-locataire` n’a pas de layout dédié. Les dashboards privés utilisent majoritairement `noIndex`; quelques pages anciennes n’emploient qu’un titre simple.

## 5. Duplications

- `/dashboard/etablissements` et `/dashboard/hotels` montent tous deux `ManageHotelsPage`.
- `/dashboard/etablissements/[hotelId]` et `/dashboard/hotels/[hotelId]` montent tous deux `HotelDetailPage`.
- `/dashboard/gestion-locative/documents` redirige vers le centre documentaire canonique.
- `/dashboard/hotels/rates` et `/dashboard/hotels/room-categories` sont des redirections/compatibilités vers les vues par établissement.
- `DashboardLayout.jsx` et `DashboardPage.jsx` sous `client/lib` sont des vestiges React Router non montés.
- `/communication/**` est un alias public d’Altcom; `/evenementiel/**` un alias public de Mila Events.

## 6. Routes legacy

- **CANONIQUE** : `/dashboard`, `/dashboard/etablissements`, `/dashboard/hotels/[hotelId]/**`, `/mes-biens`, `/mes-hotels`, `/mes-hebergements`, `/espace-locataire`.
- **ALIAS ACTIF** : `/dashboard/hotels`, `/dashboard/etablissements/[hotelId]`, `/communication/**`, `/evenementiel/**`.
- **LEGACY ACTIF** : certaines pages `/dashboard/hotel-*` globales conservées pour compatibilité opérationnelle.
- **LEGACY NON MONTÉ** : `client/lib/components/layout/DashboardLayout.jsx`, `client/lib/pages/DashboardPage.jsx`.

Aucune suppression n’est justifiée dans DASH-1.

## 7. APIs utilisées

L’overview staff appelle simultanément `/dashboard/stats`, devis, événements, alertes paiements, utilisateurs et logs. Le backend `/dashboard/stats` accepte tout `STAFF_ALL` et renvoie des agrégats globaux Altimmo/Mila/Altcom/Users, sans projection par métier. Les pages propriétaires utilisent les endpoints ownership `my-properties`, `my-hotels`, `my-accommodations`, visites/paiements propriétaires et réservations. Le portail locataire résout l’identité côté backend depuis l’utilisateur connecté.

## 8. Capabilities

La sidebar réutilise `hasStaffCapability` pour documents, paiements, GL, baux, locataires, visites, maintenance, préavis, Altcom et événements. Des liens secondaires restent basés sur des rôles. Le backend IAM-3 demeure la sécurité normative; masquer un lien n’accorde ni ne retire une permission API.

## 9. Écarts UX

- une seconde navigation interne dans `DashboardHome` concurrence la sidebar principale;
- message générique faux pour tous les collaborateurs (« ajouter mais pas modifier »);
- dashboard entier bloqué par un `Promise.all` comprenant des API secondaires;
- une erreur principale remplace toute l’overview;
- Client sans accueil, hiérarchie ni empty states communs;
- exploitant pur envoyé vers le contexte patrimoine avant de pouvoir changer de contexte.

## 10. Écarts métier

- Secrétaire voit des statistiques Altimmo/Mila/Altcom plutôt que documents/paiements;
- Gestionnaire ne reçoit pas une vue opérationnelle GL;
- Community Manager voit des agrégats utilisateurs/immobilier;
- Admin ne dispose pas d’une carte lisible de tous les domaines dans son accueil;
- maison meublée et hôtel sont des ressources distinctes, mais leur entrée post-auth n’est pas spécialisée;
- absence d’overview Client reliant immobilier, hébergement et portail locataire conditionnel.

## 11. P0/P1/P2/P3/P4

- **P0** : aucun bypass backend démontré; IAM-3 reste effectif.
- **P1** : overview Staff unique et appels hors capability; Client sans dashboard; exploitant pur mal routé.
- **P2** : navigation Admin incomplète pour finance/notifications; Client/Locataire peu découvrable; portfolio établissements sans accueil opérationnel commun.
- **P3** : `Promise.all` massif, erreur globale, navigation interne redondante, metadata privée incohérente.
- **P4** : aliases hôteliers et vestiges React Router.

## 12. Stratégie cible

Conserver les shells responsive éprouvés. Introduire un dispatcher d’overview par profil, alimenter les modules Staff depuis `staffCapabilities.js`, réserver les agrégats globaux réels à Admin, créer un espace Client commun et centraliser le routage post-auth avec les profils métier lorsqu’ils sont disponibles. Ne pas inventer de KPI; afficher des raccourcis et tâches dont les routes existent. Conserver toutes les gardes backend, ownership, tenant et établissement.
