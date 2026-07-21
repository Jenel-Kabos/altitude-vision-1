# Architecture fonctionnelle Altimmo v2 (Sprint 0)

**Statut : sprint d'architecture fonctionnelle et UX uniquement.** Aucun
modèle, aucune API métier n'a été modifié. Aucune donnée n'a été migrée.
Ce document est la référence pour les sprints suivants (RoomCategory,
réservations, dashboards spécialisés).

## Principe fondamental

`Property` reste **uniquement** : le bien physique, la localisation, les
médias, le propriétaire, la visibilité, la modération. Toutes les règles
métier (prix de vente, loyer, tarifs, chambres…) vivent dans des modules
spécialisés — jamais dans `Property` lui-même.

---

## 1. Domaines métier

### Domaine 1 — Immobilier (publication d'annonces)

| Sous-domaine | Modèles |
|---|---|
| Vente | `Property` (status=vente) + `SaleManagement` |
| Location | `Property` (status=location) + `RentalManagement` (fiche) |
| Hébergement | `Property` (status=hebergement) + `Accommodation` + `RatePlan` |

Aucun écran Hôtel dans ce domaine — l'établissement hôtelier (`Hotel`) est
un domaine séparé (voir Domaine 3), même si `Accommodation.accommodationType
= 'hotel'` reste techniquement un des 8 types d'hébergement possibles.

### Domaine 2 — Gestion locative (workflow du bail actif)

Totalement séparé de la publication. Contient conceptuellement : baux,
locataires, paiements, préavis, sorties, maintenance, documents, historique.

**Invariant clé** : une annonce Location n'apparaît dans ce domaine **que
si** `RentalManagement.managementActivated === true`. Ce champ (ajouté lors
de l'audit de sécurité qui a précédé ce sprint) distingue :
- une simple fiche d'annonce, créée via `POST /api/rental-properties`
  (`managementActivated: false` par défaut) ;
- un dossier réellement activé, via `POST /api/rental-management`
  (l'écran d'activation existant) ou implicitement dès qu'un `Contrat` de
  bail réel est créé (`contratController.syncLeaseOccupation`).

`rentalManagementController.list`/`stats` ne comptent/listent que les
dossiers `managementActivated: true` par défaut — une annonce publiée ne
gonfle jamais les statistiques de gestion locative.

### Domaine 3 — Hôtellerie (établissement)

```
Hotel (existant)
  ↓
RoomCategory (prévu, PAS créé dans ce sprint)
  ↓
RatePlan (existant, référence aujourd'hui uniquement Accommodation)
```

**`RoomCategory` remplacera l'actuelle logique de tarif unique porté par
`RatePlan`** : aujourd'hui, un hébergement de type hôtel n'a qu'un seul
`RatePlan` (comme n'importe quel autre logement meublé) ; demain,
`RoomCategory` portera plusieurs catégories de chambres, chacune avec sa
propre quantité et son propre `RatePlan`. Non implémenté dans ce sprint —
seule l'architecture de navigation est préparée (pages vides, voir §3).

Futurs modules préparés mais **non implémentés** : Réservations,
Disponibilités, Clients, Check-in/Check-out, Personnel, Housekeeping,
Facturation.

### Domaine 4 — Services transverses

Documents, Messagerie, Emails, Notifications, Historique, Export,
Paramètres — déjà indépendants de tout domaine immobilier particulier
(vérifié : `documents`, `messages`, `conversations`, `emails`,
`historique`, `export-marketing` sont des modules génériques partagés par
tous les pôles Altitude Vision, pas seulement Altimmo). Aucun changement
nécessaire ici — la séparation existait déjà.

---

## 2. Dashboard Admin — nouvelle navigation

`client/lib/pages/dashboard/AdminDashboard.jsx` (`NAV_SECTIONS`) :

```
Tableau de bord                                          /dashboard
Immobilier
  Toutes les annonces                                    /dashboard/properties
  Vente                                                   /dashboard/properties?status=vente
  Location                                                /dashboard/properties?status=location
  Hébergement                                             /dashboard/properties?status=hebergement
  Estimations                                             /dashboard/estimations
  Devis locatif                                           /dashboard/devis
  Visites                                                 /dashboard/visites
  Paiements visites                                       /dashboard/paiements
  Propriétaires (page vide, préparation)                  /dashboard/proprietaires
Gestion locative
  Vue d'ensemble (existante, fonctionnelle)                /dashboard/gestion-locative
  Baux (page vide, préparation)                            /dashboard/gestion-locative/baux
  Locataires (page vide, préparation)                      /dashboard/gestion-locative/locataires
  Paiements (page vide, préparation)                       /dashboard/gestion-locative/paiements
  Préavis (page vide, préparation)                         /dashboard/gestion-locative/preavis
  Maintenance (page vide, préparation)                     /dashboard/gestion-locative/maintenance
  Documents (existante, générique)                         /dashboard/documents
Hôtellerie
  Établissements (page vide, préparation)                  /dashboard/hotels
  Catégories de chambres (page vide, préparation Sprint C)  /dashboard/hotels/room-categories
  Tarifs (page vide, préparation)                          /dashboard/hotels/rates
Mila Events (conservé)                                     /dashboard/events
Altcom (conservé)                                          /dashboard/altcom
Modération (conservé)
Administration (conservé)
Communications (conservé)
```

**Filtre `?status=`** : les liens Vente/Location/Hébergement pointent vers
la MÊME page (`ManagePropertiesPage.jsx`, aucune nouvelle route), avec un
filtre 100% frontend lu depuis l'URL — `getAllProperties()` renvoie
toujours l'intégralité de la liste, aucun appel API modifié. Le titre de la
page s'adapte (`Vente`/`Location`/`Hébergement`/`Toutes les annonces`).

**Correction de bug appliquée pendant ce sprint** : une section dont aucun
lien n'est visible pour le rôle courant (ex. "Gestion locative" pour un
`CommunityManager`) affichait quand même son en-tête, orphelin, sans rien
en dessous — bug préexistant, révélé par l'ajout des nouveaux domaines.
Corrigé : une section vide pour le rôle courant ne s'affiche plus du tout.

**Pages vides créées** (composant partagé `ComingSoonPage.jsx`, message
"Disponible dans le Sprint B2/C" selon le module) : `ManageHotelsPage`,
`HotelDetailPage`, `ManageRoomCategoriesPage`, `ManageHotelRatesPage`,
`RentalLeasesPage`, `RentalTenantsPage`, `RentalPaymentsPage`,
`RentalNoticesPage`, `RentalMaintenancePage`, `PropertyOwnersPage`.

---

## 3. Dashboard Propriétaire — nouvelle navigation

`client/lib/pages/dashboard/OwnerDashboard.jsx` (`NAV_LINKS`) :

```
Mes annonces
  Toutes mes annonces                    /mes-biens
  Vente                                   /mes-biens?status=vente
  Location                                /mes-biens?status=location
  Hébergement                             /mes-hebergements (page dédiée existante, inchangée)
Mes hôtels (page vide, préparation)       /mes-hotels
Mes rendez-vous                           /mes-biens/visites
Mes paiements (page vide, préparation)    /mes-biens/paiements
Mes messages                              /messages
Mon profil                                /profile
Sécurité (conservé)                       /mes-biens/securite
```

**Limite assumée** : contrairement à `ManagePropertiesPage.jsx` (dashboard
admin), `OwnerPropertyManagement.jsx` (page `/mes-biens`) n'a **pas** reçu
le filtre `?status=` dans ce sprint — c'est un composant plus ancien, non
audité en profondeur, qui ne réutilise pas encore
`SalePropertyForm`/`RentalPropertyForm` (limitation déjà documentée au
Sprint A). Modifier son filtrage sans l'auditer d'abord aurait dépassé le
périmètre "architecture/UX seulement" de ce sprint. Les liens Vente/Location
pointent donc vers `/mes-biens` sans filtre actif pour l'instant — à
compléter dans un sprint dédié à l'audit de ce composant.

---

## 4. Property Wizard

`client/lib/components/dashboard/PropertyWizard.jsx` (nouveau) remplace le
sélecteur à 3 cartes qui était directement intégré dans
`ManagePropertiesPage.jsx` (Sprint A).

```
Étape 1 — Que souhaitez-vous publier ?
  ○ Vente  ○ Location  ○ Hébergement

Étape 2 — (uniquement si Hébergement) Quel type ?
  ○ Appartement meublé  ○ Villa  ○ Maison  ○ Studio
  ○ Hôtel  ○ Résidence hôtelière  ○ Chambre d'hôtes

Étape 3 — le formulaire adapté se charge automatiquement
```

L'utilisateur ne voit jamais deux formulaires concurrents : un seul
composant est monté à la fois (`SalePropertyForm` XOR `RentalPropertyForm`
XOR `PropertyForm`), les autres sont totalement démontés — pas de fuite de
champs possible entre types.

**Décision Hôtel** : choisir "Hôtel" à l'étape 2 préremplit
`accommodationType='hotel'` et charge `PropertyForm` (comme les 6 autres
types) — c'est le flux Hôtel déjà fonctionnel et testé du Sprint Hôtel
précédent (section "Établissement hôtelier" intégrée). Le nouveau
`HotelPropertyForm.jsx` est **préparé mais non câblé** dans le wizard : il
existe comme stub pour le Sprint C (quand `RoomCategory` justifiera un
formulaire dédié), afin de ne prendre aucun risque de régression sur le
flux Hôtel déjà en production.

---

## 5. Formulaires

| Formulaire | Statut | Utilisé par |
|---|---|---|
| `SalePropertyForm.jsx` | Conservé, inchangé | PropertyWizard (Vente) |
| `RentalPropertyForm.jsx` | Conservé, inchangé | PropertyWizard (Location) |
| `PropertyForm.jsx` (`enableHebergement`) | Conservé, inchangé | PropertyWizard (Hébergement, tous types dont Hôtel) |
| `HotelPropertyForm.jsx` | **Nouveau, préparé uniquement** — non câblé | Aucun (Sprint C) |

`RoomCategory` n'existe pas et n'a pas été créé — voir Domaine 3.

---

## 6. Navigation publique

Remplace le lien générique "Toutes les annonces" du menu Altimmo
(`client/lib/components/layout/Header.jsx`, seul header réellement monté
par `ClientLayout.jsx` — `Navbar.jsx` (react-router-dom) est du code mort
non utilisé, non touché) :

```
Altimmo (menu déroulant)
  Acheter     → /immobilier/acheter    (redirige vers /immobilier/annonces?status=vente)
  Louer       → /immobilier/louer      (redirige vers /immobilier/annonces?status=location)
  Séjourner   → /immobilier/sejourner  (page d'atterrissage avec 4 catégories)
    Appartements → /immobilier/annonces?status=hebergement&type=appartement_meuble
    Villas       → /immobilier/annonces?status=hebergement&type=villa_meublee
    Studios      → /immobilier/annonces?status=hebergement&type=studio_meuble
    Hôtels       → /immobilier/annonces?status=hebergement&type=hotel
  App Altimmo (conservé) → /altimmo/application
```

**Réutilisation totale de l'existant** : `AltimmoAnnonces.jsx` (le listing
public) lisait déjà `?status=` et `?type=` depuis l'URL avant ce sprint —
aucune modification de ce composant n'a été nécessaire. Les routes
`/immobilier/acheter` et `/immobilier/louer` sont de simples redirections
serveur (`next/navigation.redirect`) vers le listing existant. La page
Séjourner (`SejournerLandingPage.jsx`, nouvelle) est la seule page
réellement nouvelle — un simple sélecteur de catégorie qui renvoie ensuite
vers le même listing filtré.

**Découverte d'audit** : deux arborescences publiques parallèles existent
déjà (`/altimmo/*` et `/immobilier/*`), toutes deux rendant `AltimmoPage`
avec des métadonnées SEO différentes (alias intentionnel, pas un doublon
accidentel). Le header live ne linke que vers `/immobilier` — c'est donc là
qu'ont été ajoutées les nouvelles routes. `/altimmo/*` reste inchangé.

**Pages Hôtel publiques** : aucune n'existe — un hôtel apparaît uniquement
comme une carte d'hébergement individuelle dans le listing filtré
`?type=hotel`, jamais comme fiche d'établissement dédiée (conforme à la
consigne "réutiliser temporairement les composants existants").

---

## 7. Matrice des permissions

Source unique : `server/utils/roles.js` (backend) et son miroir
`AdminDashboard.jsx` (frontend, constantes locales `ALL_STAFF`,
`ROLES_ALTIMMO`, `ROLES_GL`, `ROLES_MOD`, etc. — vérifiées identiques).

| Rôle | Immobilier (voir/publier annonces) | Gestion locative (baux actifs) | Hôtellerie (établissements) | Modération | Administration | Mes annonces (proprio) |
|---|---|---|---|---|---|---|
| **Admin** | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| **Collaborateur** (legacy) | ✓ | ✓ | ✓ | ✓ | — | — |
| **GestionnaireImmobilier** | ✓ | ✓ | ✓ | — | — | — |
| **CommunityManager** | ✓ | — | ✓ | — | — | — |
| **Secretaire** | — | ✓ | — | — | — | — |
| **Communicant** | — | — | — | — | — | — |
| **Proprietaire** | — | consultation/requêtes seulement (`/owner/*`) | — (Mes hôtels : nav seulement) | — | — | ✓ |
| **Client** | — | — | — | — | — | — |

**Détail des rôles par page** :

| Page | Rôles autorisés |
|---|---|
| `/dashboard/properties` (Immobilier) | `ROLES_ALTIMMO` = Admin, Collaborateur, GestionnaireImmobilier, CommunityManager |
| `/dashboard/gestion-locative*` | `ROLES_GL` = Admin, Collaborateur, GestionnaireImmobilier, Secretaire |
| `/dashboard/hotels*` | `ROLES_ALTIMMO` (mêmes rôles que Immobilier — un hôtel est une annonce hébergement) |
| `/dashboard/moderation/properties`, `/reviews` | `ROLES_MODERATION` = Admin, Collaborateur |
| `/dashboard/moderation/hebergement` | `ROLES_MODERATION` (**harmonisé**, voir ci-dessous) |
| `/dashboard/users`, `/active-sessions`, `/historique`, `/export-marketing`, `/publicites` | Admin uniquement |
| `/dashboard/litiges` | `ROLES_LITIGES` = Admin, Collaborateur, GestionnaireImmobilier |
| `/dashboard/documents`, `/emails` | `ROLES_DOCS` = Admin, Collaborateur, GestionnaireImmobilier, Secretaire |
| `/mes-biens`, `/mes-hebergements`, `/mes-hotels`, `/mes-biens/*` | Proprietaire uniquement (redirection sinon, `DashboardLayout`) |

**Harmonisation appliquée** (justifiée, périmètre inchangé pour les 4
autres rôles) : le lien "Modération Hébergement" utilisait `ROLES_ALTIMMO`
(incluait à tort `GestionnaireImmobilier` et `CommunityManager`) alors que
ses deux liens voisins ("Modération Biens", "Modération Avis")
utilisent `ROLES_MODERATION` (Admin, Collaborateur uniquement). Corrigé
pour la cohérence — signalé dès l'audit de sécurité précédent ce sprint.
Aucune autre permission métier modifiée.

---

## 8. Fichiers modifiés/créés (Sprint 0)

**Backend** : aucun (contrainte explicite du sprint).

**Frontend — nouveau** :
- `components/dashboard/PropertyWizard.jsx`, `ComingSoonPage.jsx`, `HotelPropertyForm.jsx`
- `pages/dashboard/ManageHotelsPage.jsx`, `HotelDetailPage.jsx`, `ManageRoomCategoriesPage.jsx`, `ManageHotelRatesPage.jsx`
- `pages/dashboard/RentalLeasesPage.jsx`, `RentalTenantsPage.jsx`, `RentalPaymentsPage.jsx`, `RentalNoticesPage.jsx`, `RentalMaintenancePage.jsx`
- `pages/dashboard/PropertyOwnersPage.jsx`, `MyHotelsPage.jsx`, `MyPaymentsPage.jsx`
- `pages/SejournerLandingPage.jsx`
- Routes `app/dashboard/hotels/*`, `app/dashboard/gestion-locative/{baux,locataires,paiements,preavis,maintenance}`, `app/dashboard/proprietaires`, `app/mes-hotels`, `app/mes-biens/paiements`, `app/immobilier/{acheter,louer,sejourner}`
- Tests : `AdminDashboardDomains.test.jsx`, `HeaderPublicNavigation.test.jsx`

**Frontend — modifié** :
- `pages/dashboard/AdminDashboard.jsx` (nav réorganisée + fix section orpheline)
- `pages/dashboard/OwnerDashboard.jsx` (nav réorganisée)
- `pages/dashboard/ManagePropertiesPage.jsx` (filtre `?status=`, intégration PropertyWizard, fix race condition sur `filteredProperties`)
- `components/layout/Header.jsx` (menu Altimmo → Acheter/Louer/Séjourner)
- `__tests__/ManagePropertiesPage.test.jsx`, `OwnerDashboardNavigation.test.jsx`

---

## 9. Limites de ce sprint

- Pages "vides" (13 au total) affichent un message de préparation — aucune
  logique métier, aucune donnée réelle.
- `OwnerPropertyManagement.jsx` n'a pas reçu le filtre `?status=` (voir §3).
- `HotelPropertyForm.jsx` existe mais n'est câblé nulle part.
- Aucun `RoomCategory`, aucune réservation, aucun calendrier, aucune
  chambre physique.
- La distinction annonce/bail actif (`managementActivated`) existait déjà
  avant ce sprint (introduite lors de l'audit de sécurité précédent) — ce
  sprint ne fait qu'aligner la navigation dessus.
