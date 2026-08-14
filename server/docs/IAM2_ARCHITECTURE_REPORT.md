# IAM-2 — RAPPORT D’ARCHITECTURE UTILISATEURS, DASHBOARDS ET DÉLÉGATION

Date : 2026-08-14  
Branche : `main`  
HEAD audité : `c523b3118549da770bc761d5e7b93de8deb58605` (`Update Altimmo 21`)  
Périmètre : serveur et client web uniquement; aucun changement mobile, production, tenant réel ou Cloudinary.

## 1. Résumé exécutif

L’architecture viable conserve `User` comme identité unique et sépare quatre dimensions : fonction staff legacy, profils métier cumulables, memberships tenant et ownership/capacités locales. Une projection canonique additive et testée a été ajoutée, ainsi qu’une destination post-authentification unique. Aucune migration destructive de rôle, JWT, tenant ou ownership n’a été faite.

La cible fine n’est pas encore appliquée comme garde d’autorisation : les groupes legacy mélangent parfois lecture et mutation. Leur remplacement immédiat aurait cassé des parcours documentés. Un STOP architectural protège donc cette étape et impose une migration route par route.

## 2. Architecture utilisateur avant

`User.role` porte une valeur exclusive parmi `User`, `Client`, `Proprietaire`, `Collaborateur`, `Secretaire`, `GestionnaireImmobilier`, `CommunityManager`, `Communicant`, `Admin`, `Prestataire`. En parallèle, `UserBusinessProfile` porte déjà des identités cumulables (`proprietaire_immobilier`, `exploitant_etablissement`, `locataire`). `OrgMembership`, `PlatformOperator`, l’ownership des ressources et `HotelStaffAssignment` complètent l’autorisation.

## 3. Architecture cible

La cible est une composition, pas un nouvel enum exclusif :

`User → famille de compte + fonction staff éventuelle + profils métier[] + memberships[] + ownerships[] + délégations locales[]`.

Un utilisateur peut donc être à la fois propriétaire immobilier, exploitant de plusieurs établissements et locataire, sans changement artificiel de rôle.

## 4. Décisions prises

- conserver intégralement les rôles et tokens legacy;
- considérer le backend comme source de vérité;
- réutiliser `UserBusinessProfile`, `OrgMembership` et `HotelStaffAssignment`;
- introduire une projection pure, sans l’utiliser prématurément comme garde;
- centraliser la destination web après login, inscription et vérification;
- différer tout resserrement qui demande de scinder lecture et mutation.

## 5. Admin

Admin reste l’administrateur métier complet. Il est présent dans les groupes opérationnels actuels et la projection lui attribue `*`. Ce caractère complet ne contourne ni authentification, ni contexte tenant, ni contrôle d’intégrité, ni scope hôtelier lorsque la route l’exige.

## 6. Staff

Le staff partage `/dashboard`. Les fonctions spécialisées demeurent encodées par les rôles legacy. La projection fournit une nomenclature de capacités testable, mais l’enforcement actuel reste celui des routes et de `server/utils/roles.js`.

## 7. Secrétaire

Cible : documents et paiements en lecture/gestion, sans gestion immobilière générale. État réel : le rôle appartient encore à `ROLES_GL`; il dispose donc de davantage d’opérations GL que la cible. Non corrigé dans IAM-2 car les routes mêlent consultation et mutation.

## 8. Gestionnaire immobilier

Cible : biens, visites, location, baux et maintenance, avec lecture documentaire/financière minimale. État réel : le rôle appartient aussi aux groupes documentaires. Le retrait global casserait des lectures utiles; la séparation `read/manage` reste requise.

## 9. Community Manager

Cible : Altcom/Mila et événements, sans administration immobilière. La modération reste bien réservée à Admin/Collaborateur, mais `ROLES_ALTIMMO` autorise encore certaines opérations immobilières/hôtelières. Cette dette n’a pas été masquée par un simple changement de menu.

## 10. Propriétaire immobilier

Le propriétaire peut soumettre et gérer ses biens, visites et parcours vente/location selon les routes existantes. `Property.owner` est la preuve d’ownership opérationnelle. Les mandats et fiches `Proprietaire` restent des objets métier distincts : aucune fusion automatique n’est sûre.

## 11. Propriétaire hébergement

Le profil `exploitant_etablissement` est cumulable. L’utilisateur peut posséder/créer plusieurs hébergements ou hôtels. Le portefeuille est déterminé par `createdBy`, `manager` legacy et les assignments locaux, pas par un tenant dédié à chaque établissement.

## 12. Maison meublée

La maison meublée est une ressource/mode d’exploitation, jamais un rôle. Le parcours existe dans le portefeuille hébergement, mais son cockpit opérationnel est moins riche que celui d’un hôtel. La parité complète n’est pas confirmée.

## 13. Hôtel

L’hôtel dispose d’un modèle multi-établissements et d’un ABAC local via `HotelStaffAssignment` : rôle local et capacités par hôtel. Cette délégation est la brique cible à réutiliser. `Hotel.manager` reste nécessaire à la compatibilité.

## 14. Client

Client conserve un compte transversal : compte, favoris, visites et réservations. Il n’existe pas encore d’overview client unique couvrant tous les services; cette fonctionnalité n’est donc pas déclarée conforme.

## 15. Client/Locataire

Locataire est une identité métier rattachée facultativement et de façon unique par `Locataire.user`. Le portail résout l’identité depuis `req.user`; un identifiant fourni par le navigateur n’est jamais une preuve d’identité. Un Client peut ainsi devenir locataire sans perdre ses autres usages.

## 16. Dashboards

- staff/Admin : `/dashboard`;
- propriétaire immobilier : `/mes-biens`;
- exploitant : `/mes-hotels` et `/mes-hebergements`;
- locataire : `/espace-locataire`;
- autres comptes : surface publique et compte.

`OwnerDashboard` sait déjà adapter ses contextes aux profils métier. Le shell staff reste partagé et ses menus dupliquent encore certains groupes de rôles backend.

## 17. Permissions

La projection introduite documente les capacités par défaut (`documents.read/manage`, `payments.read/manage`, `properties.*`, `rental.*`, `altcom.manage`, etc.). Elle est volontairement non normative : l’appeler pour cacher un menu ne crée pas une autorisation et ne remplace pas les gardes backend.

## 18. Tenant

Le tenant est une frontière SaaS portée par `PlatformTenant`/`OrgMembership`; ce n’est ni un hôtel ni une maison. Les travaux AUTH-1.1 présents dans le HEAD centralisent le contexte tenant runtime. IAM-2 n’a changé ni membership ni sélection tenant.

## 19. PlatformOperator

`PlatformOperator` est distinct de `User` et d’Admin métier. Un opérateur actif doit toujours sélectionner un tenant valide pour les routes scoped. Aucun privilège global implicite n’a été ajouté.

## 20. Ownership

Relations conservées : `Property.owner`, `Proprietaire.user`, `Accommodation.createdBy`, `Hotel.createdBy`, `Hotel.manager`, `HotelStaffAssignment.user/hotel` et `Locataire.user`. Elles répondent à des usages différents et ne doivent pas être consolidées sans migration explicite et réversible.

## 21. Backend

Ajout de `server/utils/iamArchitecture.js`, projection pure rôle → famille/fonction/capacités. Aucun schéma, contrôleur, JWT ou middleware d’autorisation n’a été modifié. Des tests unitaires verrouillent la compatibilité des dix rôles et l’absence de privilège implicite.

## 22. Frontend

Ajout de `client/lib/navigation/postAuthDestination.js`. Login, inscription et vérification email utilisent désormais la même règle. Aucun écran mobile n’a été lu ou modifié dans le cadre des corrections.

## 23. Bugs trouvés

- P1 : après vérification email, un Propriétaire était envoyé vers `/dashboard`, réservé au staff;
- P2 : Secrétaire trop large via `ROLES_GL`;
- P2 : Gestionnaire trop large côté documents administratifs;
- P2 : CommunityManager trop large via `ROLES_ALTIMMO`;
- P3 : listes de rôles dupliquées entre sidebar et backend;
- P3 : absence d’overview client unifié et spécialisation incomplète des dashboards.

## 24. Bugs corrigés

Le routage post-authentification est unifié et la vérification email envoie maintenant Propriétaire vers `/mes-biens`. La projection canonique élimine l’ambiguïté documentaire sur les familles/fonctions futures. Les trois écarts P2 ne sont pas déclarés corrigés.

## 25. Migration / compatibilité

Phase suivante recommandée : ajouter des capacités staff optionnelles héritant des défauts legacy, séparer chaque route composite en lecture/mutation, migrer une verticale à la fois avec tests négatifs, puis basculer menus et endpoints. La dépréciation de rôles ne peut intervenir qu’après couverture web et mobile exhaustive.

## 26. Tests

- ciblés serveur IAM/auth/lease : 3 suites, 39 tests passés;
- ciblés client destination/inscription : 2 fichiers, 24 tests passés;
- transverses IAM serveur : 10 suites, 188 tests passés;
- client complet : 78 fichiers, 529 tests passés;
- serveur complet : 115 suites, 1 303 tests passés;
- Mongo isolé : 82 suites, 860 tests passés sur replica set mémoire, arrêté proprement.

Aucune donnée métier réelle n’a été créée par IAM-2.

## 27. Gates

- lint serveur : PASS, 0 erreur, 128 avertissements existants;
- lint client : PASS, 0 erreur, 269 avertissements existants;
- build Next : PASS, 142 routes;
- tests client : PASS, 529/529;
- tests serveur unitaires : PASS, 115 suites et 1 303 tests;
- tests Mongo isolés : PASS, 82 suites et 860 tests (replica set mémoire uniquement).

Les scripts agrégés racine incluent `altimmo-app`; ils n’ont pas été utilisés afin de respecter l’interdiction explicite de toucher au mobile. Les gates serveur/client équivalentes ont été lancées directement.

## 28. Dette restante

Créer une matrice de capacités réellement appliquée; scinder lecture/mutation; retirer les duplications frontend; spécialiser les overviews; compléter le cockpit maison meublée; expliciter le futur de `Collaborateur`, `Communicant`, `Prestataire` et `User` legacy.

## 29. Risques

Risque principal : une restriction globale par rôle provoquerait des 403 sur des lectures légitimes. À l’inverse, une navigation seule laisserait les endpoints trop permissifs. La migration doit donc commencer au backend, préserver tenant/ownership, puis aligner le frontend.

## 30. Diagrammes

```text
User
 ├─ role legacy ──> projection famille/fonction/capacités par défaut
 ├─ UserBusinessProfile[] ──> propriétaire / exploitant / locataire
 ├─ OrgMembership[] ──> périmètre tenant
 ├─ ownership[] ──> Property / Accommodation / Hotel / Locataire
 └─ HotelStaffAssignment[] ──> capacités locales par hôtel
```

```text
Authentification ──> destination canonique
  staff/Admin ─────> /dashboard
  Proprietaire ────> /mes-biens
  autre ───────────> /
```

## 31. Git

Le travail a commencé sur `main` au HEAD `c523b3118549da770bc761d5e7b93de8deb58605`, différent du HEAD demandé mais contenant AUTH-1.1. Le worktree était propre au preflight. Aucun commit, push, merge, rebase, tag ou déploiement n’a été effectué.
