# UI-UX-CORE-1 — Audit initial

Date : 10 août 2026. État observé avant toute modification UI de ce sprint.

## 1. Méthode et périmètre

L'inventaire a croisé les routes Next, leurs imports, les pages `client/lib/pages/dashboard`, les shells, NAV-CORE (`shared/navigation/registry.json`), les profils `UserBusinessProfile`, les services frontend, les protections de route, les tests et les composants partagés. Les recherches ont couvert headers, sidebars, KPI, cards, tableaux, filtres, formulaires, tabs, modales/drawers, pagination, états asynchrones, polices, icônes, graphiques et responsive.

Résultat brut : **73 routes dashboard/admin**, **81 composants de page dashboard**, **2 shells actifs** et **1 shell legacy non importé**. Plusieurs routes sont volontairement des alias vers un même écran ; le nombre d'expériences principales est inférieur au nombre de routes.

## 2. Socle transversal observé

| Sujet | État initial | Verdict |
| --- | --- | --- |
| Shell staff | `app/dashboard/layout.jsx` + `AdminDashboard.jsx`, responsive, focus trap mobile, RBAC par rôle | Solide mais navigation longue et config locale parallèle à NAV-CORE |
| Shell propriétaire/exploitant | `OwnerDashboard.jsx`, navigation filtrée par profils effectifs | Solide mais les deux profils sont filtrés dans une seule longue liste, sans contexte explicite |
| Shell legacy | `components/layout/DashboardLayout.jsx`, React Icons, 4 liens en dur | Mort/non importé ; dette à supprimer ultérieurement, pas pendant ce sprint sans preuve supplémentaire |
| Design system | `DashboardUI.jsx`, `DashboardKpis.jsx`, `DashboardBadge.jsx`, CSS dashboard | Bon embryon ; primitives manquantes et deux composants KPI concurrents |
| Adoption | Header 37 pages, toolbar 22, card 35, state 42, table container 8, pagination 9, KPI 5 | Adoption trop partielle |
| Icônes | Lucide dans 88 fichiers, React Icons dans 4 | Lucide est la convention dominante ; 4 écrans legacy à migrer progressivement |
| Graphiques | Recharts, Leaflet | Cohérents avec les besoins Reporting/ERP/cartographie |
| Polices | Cinzel, Cormorant Garamond et DM Sans chargées via `next/font` | Sources cohérentes ; nombreux `fontFamily` inline inutiles |
| Tokens | variables globales + Tailwind + variables dashboard | Palette existante exploitable ; rayons/ombres dashboard divergent encore du site public |
| Modales | 32 écrans avec overlays ad hoc, seulement 4 dialogues explicitement sémantiques | Risque clavier/focus élevé |
| Confirmations | 16 `window.confirm`, 7 `window.prompt` | Incohérent et peu accessible |
| Tableaux | 30 pages avec table brute ; 8 seulement dans la primitive commune | Responsive souvent réduit au scroll horizontal |
| États | patterns multiples : spinner, pulse, texte, toast, `DashboardState` | Normalisation nécessaire |
| Sécurité | appels via services authentifiés ; tenant décidé côté serveur | À préserver strictement ; aucun switch frontend ne peut accorder un accès |

## 3. Cartographie des routes et expériences

Légende : A Direction/Pilotage, B Opérations, C Patrimoine, D Exploitation, E Administration, F Analyse. Les colonnes « états » synthétisent L=loading, V=vide, E=erreur.

### A/F — Direction, ERP et Reporting

| Routes | Écran principal | Public | Objectif / données / actions | UI initiale | Note |
| --- | --- | --- | --- | --- | --- |
| `/dashboard` | `DashboardHome` | Staff selon layout | Santé multi-pôles, activité, GL, équipe, actions rapides ; 6 appels agrégés/conditionnels | 779 lignes, composants locaux, responsive complexe, L/E présents | 11/20 |
| `/dashboard/erp` | `ERPDashboardPage` | Admin | Vue executive, alertes, décisions, santé plateforme via 4 endpoints ERP | Primitives communes, KPI/table/états corrects | 16/20 |
| `/dashboard/reporting` | `ReportingDashboardPage` | Admin, Gestionnaire | Période, domaine, KPI, graphiques, export | Primitives communes, Recharts, filtres et L/E/V | 16/20 |

### B — Gestion locative et opérations immobilières

| Routes | Écran | Public / objectif | Contenu et état initial | Note |
| --- | --- | --- | --- | --- |
| `/dashboard/gestion-locative` | `GestionLocativePage` | Admin/GL/Secrétaire/Collab ; traiter biens, contrats, paiements, alertes | 2 755 lignes, 5 tables, 116 occurrences modales, duplication majeure ; L/E/V présents mais densité excessive | 7/20 |
| `/dashboard/gestion-locative/baux` | `RentalLeasesPage` | Même scope ; cycle de bail | Header/KPI/table/filtres/drawer lifecycle, responsive scroll | 15/20 |
| `/dashboard/gestion-locative/regularisation` | `RentalContractRegularizationPage` | Admin/GL/Collab ; dossiers historiques | Écran contrôlé, état vide/erreur, drawer de décision | 16/20 |
| `/dashboard/gestion-locative/locataires` | `RentalTenantsPage` | Même scope ; locataires et liens | Table, filtres, pagination, états partiels | 14/20 |
| `/dashboard/gestion-locative/paiements` | `RentalPaymentsPage` | Même scope ; encaissements/impayés | KPI réels, table, filtres et preuves | 15/20 |
| `/dashboard/gestion-locative/preavis` | `RentalNoticesPage` | Même scope ; préavis/sorties | Cartes/actions métier, L/E/V | 15/20 |
| `/dashboard/gestion-locative/maintenance` | `RentalMaintenancePage` | Même scope ; tickets | Cartes opérationnelles, filtres, actions de transition | 15/20 |
| `/dashboard/gestion-locative/documents` | redirection centre documentaire | Même scope | Alias vers `/dashboard/documents?pole=Altimmo&service=gestion_locative`, conforme DOC-ARCH | 18/20 |
| `/dashboard/dossiers-immobiliers` | `RealEstateApplicationsPage` | Staff immobilier ; offres/candidatures | Table, comparaison, pagination, modal dossier ; code très compressé | 13/20 |
| `/dashboard/visites` | `VisitesPage` | Staff ; planning et décisions | filtres/actions, nombreux blocs ad hoc | 12/20 |
| `/dashboard/paiements` | `PaiementsPage` | Staff ; paiements de visites | table/filtres/états legacy | 12/20 |
| `/dashboard/transactions` | `TransactionsPage` | Staff immobilier ; ventes/paiements | cards/tableaux/action de finalisation, styles inline massifs | 11/20 |

### C — Patrimoine immobilier et propriétaire

| Routes | Écran | Public / objectif | Contenu et état initial | Note |
| --- | --- | --- | --- | --- |
| `/mes-biens` et filtres vente/location | `OwnerPropertyManagement` | Profil `proprietaire_immobilier` ; patrimoine/annonces | Cartes de biens, publication, actions, L/E/V ; KPI patrimoine absent du haut de page | 12/20 |
| `/mes-biens/visites` | `OwnerVisitesPage` | Propriétaire ; rendez-vous | planning/actions, header legacy | 13/20 |
| `/mes-biens/paiements` | `MyPaymentsPage` | Propriétaire ; paiements | simple projection du composant commun | 15/20 |
| `/dashboard/properties`, `/dashboard/my-properties` | wrappers `ManagePropertiesPage` | Staff ; projection portefeuille | très gros écran, recherche, formulaires, 16 modales ; adoption DS minimale | 9/20 |
| `/dashboard/properties/:id` | `PropertyAssetCockpitPage` | Staff ; cycle de vie d'un actif | cockpit structuré, alertes, valorisation, maintenance | 16/20 |
| `/dashboard/properties/add` | `AddPropertyPage` | Staff autorisé | grand formulaire sectionné mais conventions historiques | 12/20 |
| `/dashboard/sales` | projection `ManagePropertiesPage` | Staff immobilier ; vente | alias filtré, aucune copie de Property | 14/20 |
| `/dashboard/rentals` | projection/location + onboarding | Staff immobilier ; location/activation GL | respecte PROPERTY-PORTFOLIO et GL-PROPERTY-FLOW | 15/20 |
| `/dashboard/proprietaires` | `PropertyOwnersPage` | Staff immobilier | délègue au composant existant | 13/20 |

### D — Établissements, Hôtel et Accommodation

| Routes | Écran | Objectif | Contenu et état initial | Note |
| --- | --- | --- | --- | --- |
| `/dashboard/etablissements`, `/dashboard/hotels` | `ManageHotelsPage` | portefeuille exploitable | 13 KPI en bloc, filtres, cartes avec 7 actions concurrentes | 13/20 |
| `/dashboard/etablissements/:id`, `/dashboard/hotels/:id` | `HotelDetailPage` | centre opérationnel d'un établissement | header, identité, raccourcis ; pas de vue « aujourd'hui » complète | 15/20 |
| `/dashboard/hotels/:id/rooms` | `RoomsPage` | chambres | table/actions/formulaire, L/E/V | 15/20 |
| `/dashboard/hotels/:id/room-categories` | `ManageRoomCategoriesPage` | catégories | cards/formulaire, états cohérents | 15/20 |
| `/dashboard/hotels/:id/rates` | `ManageHotelRatesPage` | tarifs | cards/formulaire, source backend | 15/20 |
| `/dashboard/hotels/:id/inventory` | `HotelInventoryCalendarPage` | disponibilités/calendrier | composant compact et spécialisé | 16/20 |
| `/dashboard/hotels/:id/staff` | `HotelStaffAssignmentsPage` | équipe/capacités | table, actions contrôlées, tenant-aware | 16/20 |
| `/dashboard/hotel-reservations` | `AdminHotelReservationsPage` | réservations | table/filtres/actions, bonnes primitives | 16/20 |
| `/dashboard/hotel-rooms` | `AdminRoomsOverviewPage` | occupation globale | table brute, responsive limité | 12/20 |
| `/dashboard/housekeeping` | `HousekeepingDashboardPage` | ménage/inspections | KPI/table/actions métier, L/E/V | 16/20 |
| `/dashboard/maintenance` | `MaintenanceDashboardPage` | interventions | KPI/table/actions métier | 16/20 |
| `/dashboard/hotel-finance` | `HotelFinanceDashboardPage` | paiements/factures/performance | KPI, table, scopes hôtel, sécurité backend | 17/20 |
| `/dashboard/hebergements` | `ManageAccommodationsPage` | logements indépendants | grille, filtres, création, archivage accessible partiellement | 15/20 |
| `/dashboard/hebergements/:id` | `AccommodationDetailPage` | exploitation d'un logement | page compacte et panels réutilisés | 16/20 |
| `/mes-hotels`, `/mes-hotels/reservations` | `MyHotelsPage`, `MyHotelReservationsPage` | profil exploitant | bonnes primitives mais pas de cockpit exploitation global | 15/20 |
| `/mes-hebergements` | `MyAccommodationsPage` | exploitant d'hébergement | écran ancien de 409 lignes, composants et états spécifiques | 11/20 |

Les routes plates `/dashboard/hotels/rates` et `/dashboard/hotels/room-categories` redirigent vers le portefeuille : elles évitent correctement une gestion globale ambiguë.

### B — CRM, Marketing et communications

| Routes | Écran | Objectif | État initial | Note |
| --- | --- | --- | --- | --- |
| `/dashboard/crm` | `CrmCustomersPage` + composants CRM | actions, customers, pipeline, automatisations | fonctionnel mais code très compressé, primitives dashboard peu utilisées | 13/20 |
| `/dashboard/crm/:id` | `CrmCustomer360Page` | Customer 360 | tabs/panels spécialisés, bonnes données | 14/20 |
| `/dashboard/altcom/marketing` | `MarketingDashboardPage` | campagnes/segments/templates | KPI/table/filtres via DS, états complets | 17/20 |
| `/dashboard/altcom` | `ManageAltcomPage` | projets/services | 712 lignes, tables/modales ad hoc | 10/20 |
| `/dashboard/events` | `ManageEventsPage` | événements | 770 lignes, multiples modes/actions | 10/20 |
| `/dashboard/quotes`, `/dashboard/devis` | devis/citations | opérations commerciales | tables, formulaires, modales hétérogènes | 11/20 |
| `/dashboard/messages` | `InternalMessagingPage` | boîte interne | 1 068 lignes, 11 modales, responsive spécialisé | 10/20 |
| `/dashboard/conversations` | `StaffInboxPage` | conversations clients | master/detail, responsive correct, header legacy | 14/20 |
| `/dashboard/contact-messages` | `ContactMessagesPage` | demandes entrantes | filtres/actions mais conventions legacy | 12/20 |
| `/dashboard/emails` | `ManageEmailsPage` | administration email | dense, 17 modales/overlays, 2 h1 | 9/20 |
| `/dashboard/publicites` | `PublicitesPage` | annonces sponsorisées | styles/actions historiques | 10/20 |

### E — Administration, modération, documents et audit

| Routes | Écran | Objectif | État initial | Note |
| --- | --- | --- | --- | --- |
| `/dashboard/users`, `/dashboard/active-users` | `UsersPanel` | users, rôles, profils | 943 lignes, emojis de rôle, 16 modales, hétérogène | 8/20 |
| `/dashboard/active-sessions` | `ActiveSessionsPage` | sécurité sessions | table/actions contrôlées, header legacy | 13/20 |
| `/dashboard/organization` | `OrganizationAdminPage` | hiérarchie | primitives communes, formulaires compacts | 16/20 |
| `/dashboard/tenants` | `PlatformTenantsPage` | tenants SaaS | primitives communes, opérations sensibles identifiables | 16/20 |
| `/dashboard/api-platform` | `ApiPlatformPage` | clés/webhooks/logs | primitives communes, avertissements secrets | 17/20 |
| `/dashboard/historique` | `HistoriquePage` | ActionLog | filtres/export, styles inline | 12/20 |
| `/dashboard/documents` | `DocumentsPage` | centre DOC-EVO unifié | complet mais 816 lignes, table et 7 modales ad hoc | 11/20 |
| `/dashboard/moderation/*` | 4 pages moderation | validation contrôlée | Property utilise DS ; autres pages encore legacy | 13/20 moyen |
| `/dashboard/litiges` | `LitigesPage` | incidents sensibles | 625 lignes, 7 modales, densité élevée | 10/20 |
| `/dashboard/export-marketing` | `ExportMarketingPage` | exports contrôlés | styles inline et états spécifiques | 11/20 |

Les quatre routes `/admin/messages|projets|properties|services` sont des entrées legacy hors shell `/dashboard`; elles importent les mêmes pages métier et constituent une dette de navigation, pas un moteur séparé.

## 4. Audit UX transversal (moyenne initiale)

| Critère | /20 | Constat |
| --- | --- | --- |
| Hiérarchie visuelle | 13 | bons écrans récents, titres/actions très variables ailleurs |
| Lisibilité | 14 | palette lisible, métadonnées parfois trop petites |
| Densité | 10 | GL, Users, Documents, Messages et événements surchargés |
| Cohérence | 9 | adoption partielle du DS et styles inline |
| Navigation | 12 | RBAC correct, sidebar staff très longue, pas de contexte multi-profil |
| Découvrabilité | 14 | beaucoup d'actions visibles, parfois trop |
| Actions concurrentes | 8 | jusqu'à 7 actions équivalentes sur les cartes établissements |
| Tableaux | 11 | filtres fréquents mais responsive souvent scroll-only |
| Formulaires | 12 | formulaires métier riches, sections et validation non uniformes |
| Feedback | 14 | toast et erreurs présents, conventions multiples |
| Empty/error/loading | 13 | couverture correcte, présentation non uniforme |
| Responsive | 12 | shells bons, tableaux et toolbars legacy faibles |
| Accessibilité | 11 | focus shell soigné ; modales, icon-only et prompts à reprendre |
| Icônes | 16 | Lucide largement dominant |
| Typographie | 12 | familles solides, graisses/inline trop variables |
| Couleurs/espacements | 12 | tokens présents, beaucoup de valeurs littérales |
| Pertinence métier | 16 | domaines bien séparés et sources backend respectées |

**Score global initial : 12,3/20.**

## 5. Duplications et dettes confirmées

1. `DashboardKpis` et les KPI locaux de plusieurs écrans représentent le même pattern.
2. Headers, badges, toolbars, états et tables sont encore recodés dans de nombreux fichiers.
3. Deux sidebars actives dupliquent shell, focus trap, branding, topbar et logout.
4. Le shell legacy `components/layout/DashboardLayout.jsx` mélange React Icons et liens codés en dur.
5. `GestionLocativePage`, `UsersPanel`, `DocumentsPage`, `InternalMessagingPage` sont des monolithes prioritaires pour des sprints de découpage dédiés.
6. 32 overlays ad hoc et 23 appels confirm/prompt empêchent une expérience modale uniforme.
7. La navigation staff reproduit rôles et routes localement ; NAV-CORE est utilisé pour quelques destinations seulement.
8. Le profil double propriétaire/exploitant est filtré correctement mais ne dispose pas d'un sélecteur de contexte explicite.

## 6. Décision d'architecture avant refonte

- Étendre `DashboardUI` au lieu de créer une bibliothèque parallèle.
- Conserver Lucide, Recharts, les polices et les tokens existants.
- Introduire des primitives réellement manquantes : section, badge, tabs, action menu, skeleton et context switcher.
- Faire de `DashboardKpis` un adaptateur du KPI commun pour préserver les appels existants.
- Refactoriser en priorité les expériences propriétaire et établissement, puis le shell/navigation et les écrans récents représentatifs. Les monolithes métier seront harmonisés par le CSS et les primitives sans réécriture risquée de leurs workflows.
- Le context switcher ne filtrera que l'interface à partir de `getEffectiveProfiles`; il n'enverra aucune autorisation et ne modifiera aucun tenant. Toute donnée reste filtrée par le backend.
- Aucun KPI, tendance ou revenu ne sera calculé ou inventé côté UI.

