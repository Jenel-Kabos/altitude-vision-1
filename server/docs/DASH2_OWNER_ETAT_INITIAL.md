# DASH-2 — État initial des espaces propriétaires

Date : 2026-08-14  
Branche/HEAD : `main` / `0cebcd5bbd180ff8a7814139a0f4a42dade9d2ba`  
Contexte : DASH-1 non commité intégralement conservé; `git diff --check` PASS.

## 1. Architecture propriétaire actuelle

Un seul `User` utilise un shell `OwnerDashboard` commun. Les profils effectifs `proprietaire_immobilier` et `exploitant_etablissement` sont chargés après authentification par `AuthContext` depuis `/api/user-business-profiles/:userId`. Le shell filtre ensuite sa navigation et permet le basculement Patrimoine/Exploitation.

## 2. `/mes-biens`

`OwnerPropertyManagement` charge en parallèle `GET /properties/my-properties` et `GET /rental-management/owner/my`. Il réutilise le dashboard patrimonial backend, le cockpit par bien, les visites, les paiements autorisés et les demandes de transition RentalManagement. Les compteurs locaux confondent toutefois « total » et « publiés », et la carte expose surtout `availability` plutôt qu’un statut métier projeté.

## 3. `/mes-hotels`

`MyHotelsPage` charge `GET /hotels/mine`, propose CRUD/soumission, puis navigue vers les routes par `hotelId`. Malgré le libellé « Mes établissements », les maisons meublées de `/accommodations/mine` ne figurent pas dans cette vue portefeuille.

## 4. Profils dans le payload auth

Le JWT et le payload login portent essentiellement identité/rôle; les profils effectifs ne sont pas garantis. DASH-1 sait exploiter `businessProfiles`/`effectiveProfiles` s’ils sont présents, sinon redirige vers `/mes-biens`. `AuthContext` charge ensuite les profils depuis l’API, trop tard pour la première destination.

## 5. Ownership immobilier

Source : `Property.owner`. La liste owner filtre directement `{ owner: req.user.id }`. Les lectures/mutations unitaires comparent l’owner et appliquent tenant pour Admin non-owner. Le portfolio patrimonial backend reçoit `ownerId` pour les non-staff.

## 6. Ownership hébergement

Maison meublée : `Accommodation.createdBy`, adossée à une `Property.owner`. Hôtel : `Hotel.manager` et accès délégué via `HotelStaffAssignment`; les contrôleurs appliquent `assertHotelAccess`. Les URLs frontend ne constituent jamais une autorisation.

## 7. Établissements

Les hôtels sont listés en une requête batchée avec complétude. Les hébergements sont listés en une requête mais calculent encore leurs tarifs/complétude par accommodation côté serveur. Aucun contexte établissement persistant n’existe; la ressource courante est portée par l’URL `hotelId` ou `accommodationId`.

## 8. Hôtel vs maison meublée

Un hôtel est un `Hotel` avec chambres, catégories, inventaire, housekeeping, inspections et noyau financier. Une maison meublée est une `Accommodation` non `hotel`, avec rate plans, disponibilité/blocages et réservations. Ce sont des établissements, pas des tenants ni des rôles.

## 9. APIs

- profils : `GET /user-business-profiles/:userId`;
- biens : `GET /properties/my-properties`;
- GL propriétaire : `GET /rental-management/owner/my`;
- patrimoine : `GET /property-assets/portfolio/dashboard`;
- hôtels : `GET /hotels/mine`;
- maisons : `GET /accommodations/mine`;
- réservations hôtels : services existants dédiés.

Aucune API agrégée commune aux deux types d’établissement n’existe.

## 10. Routing

Le rôle `Proprietaire` déclenche immédiatement une destination. Si le payload contient un hint exploitant pur, `/mes-hotels`; sinon `/mes-biens`. L’API de profils, pourtant fondée sur les ressources réelles, n’est pas attendue avant ce choix.

## 11. Duplications

Le shell est partagé, ce qui évite deux navigations propriétaires. En revanche, le portefeuille exploitation est séparé entre `/mes-hotels` et `/mes-hebergements`; le premier porte un libellé global sans montrer les maisons. Les compteurs de `/mes-biens` doublonnent partiellement le portfolio patrimonial backend.

## 12. P0/P1/P2/P3/P4

- **P0** : aucun cross-resource démontré; ownership backend testé et présent.
- **P1** : exploitant pur sans hints envoyé vers un patrimoine vide.
- **P2** : multi-activité sans sas initial; portefeuille établissements incomplet; statut global du bien peu lisible.
- **P3** : compteurs immobiliers ambigus; deux appels de portefeuille hébergement nécessaires, mais pas de N+1 frontend.
- **P4** : alias historiques `/dashboard/etablissements` et `/dashboard/hotels` hors correction DASH-2.

## 13. Proposition cible

Créer un sas canonique `/mon-espace-proprietaire` qui attend les profils effectifs déjà résolus depuis les ressources réelles. Un seul profil redirige vers son univers; le multi-activité affiche un choix explicite; aucun profil affiche un empty state sûr. Conserver le shell partagé. Étendre `/mes-hotels` en portefeuille léger hôtels + maisons avec exactement deux requêtes agrégées. Ajouter une projection UI pure du statut immobilier à partir des champs existants et de RentalManagement, sans nouvel enum serveur.
