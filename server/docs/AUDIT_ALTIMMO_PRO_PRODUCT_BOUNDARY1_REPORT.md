# AUDIT-ALTIMMO-PRO-PRODUCT-BOUNDARY-1 — Rapport final

## 1. Executive Summary

SPRINT : **AUDIT-ALTIMMO-PRO-PRODUCT-BOUNDARY-1**  
MODE : **READ-ONLY**  
VERDICT : **A — ALTIMMO PRO DEDICATED APP WITH SHARED PLATFORM RECOMMENDED**

RECOMMENDED PRODUCT MODEL : une plateforme commune, quatre expériences explicitement bornées.

| Élément | Décision |
|---|---|
| ALTIMMO MARKETPLACE | Découverte, publication, recherche, favoris, visites et conversion |
| ALTIMMO PRO | SaaS de gestion directe du portefeuille propriétaire |
| AGENCY MANAGEMENT | Back-office de gestion déléguée, encaissement agence et settlement |
| TENANT EXPERIENCE | Portail locataire conservé dans Altimmo Marketplace |
| DEDICATED ALTIMMO PRO APP | **YES** |
| DEDICATED ALTIMMO PRO WEB | **YES** |
| SHARED BACKEND | **YES** |
| SHARED AUTH | **YES** |
| SHARED DATABASE | **YES**, avec frontières logiques et autorisations par ressource |
| SECOND BACKEND | **NOT JUSTIFIED** |
| PROPERTY/LISTING BOUNDARY | **DEBT** |
| RENTALMANAGEMENT REUSE | **PARTIAL** |
| OWNER_MANAGED | **ADAPTATION REQUIRED** |
| AGENCY_MANAGED | **SUPPORTED, ADAPTATION REQUIRED pour le mode explicite** |
| MANAGEMENT MODE | **REQUIRED et historisé** |
| 10% AGENCY COMMISSION | **AGENCY_MANAGED ONLY** |
| 3% LATE PENALTY | Représentable et calculée actuellement ; bénéficiaire non confirmé |
| OWNER SETTLEMENT | **AGENCY_MANAGED ONLY lorsque l'agence détient les fonds** |
| PRO SUBSCRIPTION | **SEPARATE FINANCIAL DOMAIN** |

| Score | Valeur |
|---|---:|
| BACKEND REUSE | **84/100** |
| AUTH REUSE | **88/100** |
| RENTAL DOMAIN REUSE | **70/100** |
| MOBILE CODE REUSE | **58/100** |
| WEB CODE REUSE | **72/100** |
| MULTI-TENANT READINESS | **64/100** |
| ALTIMMO PRO PRODUCT READINESS | **57/100** |
| OPTION A — CURRENT APP | **6.1/10** |
| OPTION B — DEDICATED APP + SHARED BACKEND | **8.6/10** |
| OPTION C — FULL SEPARATION | **3.4/10** |

P0 : **0 incident actuel démontré ; 5 prérequis bloquants pour lancer le produit.**  
P1 : **6 capacités post-MVP prioritaires.**  
P2 : **6 capacités d'industrialisation.**  
NEXT SPRINT : **ALTIMMO-PRO-FOUNDATION-CONTRACT-1**  
COMMIT : **NO** — PUSH : **NO** — DEPLOY : **NO**

## 2. Git Baseline

- Branche : `main`.
- HEAD audité : `49f12d787b1011d16f9682cedefb81b377823e4d`.
- Worktree initial non vierge : six fichiers suivis modifiés et neuf fichiers non suivis issus des travaux certifiés sur les portails financiers propriétaire/locataire.
- `git diff --check` initial : vert.
- Ces travaux préexistants ont été préservés. Aucun fichier applicatif n'a été modifié par cet audit.

## 3. Previous Certified State

Les rapports `AUDIT_RENTAL_TENANT_OWNER_PORTALS1_REPORT.md`, `HOTFIX_RENTAL_TENANT_OWNER_FINANCIAL_PORTALS1_REPORT.md` et `RENTAL_OWNER_SETTLEMENT_CONTRACT1_REPORT.md` ont été lus intégralement.

État repris : portail locataire Web/Mobile fonctionnel ; portail propriétaire Web désormais doté d'une vue de paiements bruts, mais mobile propriétaire incomplet ; aucun settlement propriétaire ; aucune commission locative récurrente implémentée. `managementFee` est un frais fixe interne, et `Contrat.commissionAgence` appartient au bloc vente. La décision settlement restait explicitement ouverte.

## 4. Product Vision

Altitude Vision doit rester une plateforme, pas devenir trois backends. Ses produits répondent néanmoins à trois intentions distinctes : trouver/publier un bien, gérer soi-même un patrimoine, ou déléguer la gestion à l'agence. La quatrième expérience, celle du locataire en cours de bail, réutilise son identité Marketplace et son portail existant.

## 5. Current Architecture

Le monorepo contient un backend Express/Mongoose partagé, un client Web Next, une application Expo et un très petit module `shared/navigation`. L'API expose déjà immobilier, gestion locative, contrats, paiements, documents, maintenance, portail locataire, notifications et conversations. Le partage est donc réel côté plateforme, encore faible côté contrats clients.

## 6. Marketplace Boundary

Le Marketplace possède la recherche publique, les annonces, la modération, favoris, visites, demandes et conversion. Il peut créer le bien initial et déclencher sa publication, mais ne doit pas devenir l'interface quotidienne de comptabilité et d'exploitation du propriétaire Pro.

## 7. Altimmo Pro Boundary

Altimmo Pro possède l'expérience de gestion directe : portefeuille privé, locataires, baux, échéances, encaissements déclarés, reçus, documents, maintenance et reporting propriétaire. Il ne possède ni les pouvoirs Admin, ni les opérations financières de l'agence, ni la modération Marketplace.

## 8. Agency Management Boundary

Le back-office agence conserve onboarding délégué, opérations staff, gestion des mandats, encaissement pour compte de tiers, commission de 10 %, rapprochement et settlement. Cette frontière requiert une preuve de mandat et de garde des fonds, pas seulement un rôle utilisateur.

## 9. Property vs Listing

`Property` est aujourd'hui à la fois actif physique et annonce : caractéristiques du bien, propriétaire, images et cycle d'actif cohabitent avec publication, modération, vues, likes et partage. `internalManagedOnly` et `isPublished` permettent déjà un actif privé, mais ne suppriment pas la dette conceptuelle.

Recommandation : conserver les identifiants et données actuels au MVP, puis extraire progressivement une projection/ressource Listing liée à Property. Ne pas dupliquer Property pour publier un bien Pro.

## 10. RentalManagement

`RentalManagement` est unique par Property et porte occupation, loyer, charges, dépôt, mandat, workflow et données de publication locative. Il constitue le meilleur agrégat réutilisable, mais ses routes et capacités sont principalement orientées staff/agence. Réutilisation : **partielle**, avec autorité propriétaire et mode explicites.

## 11. Management Modes

Deux modes canoniques sont requis : `OWNER_MANAGED` et `AGENCY_MANAGED`. Un simple champ mutable est insuffisant : les droits, l'encaisseur, la commission et le settlement doivent être rattachés à une période effective. Il faut un historique append-only ou une version de mandat avec `effectiveFrom/effectiveTo`, acteur, raison et snapshot financier.

## 12. User/Auth

Le même `User`, le même JWT et les mêmes mécanismes OAuth peuvent servir les clients Marketplace, Pro et agence. Un propriétaire peut aussi être client ou locataire ; deux comptes créeraient incohérences, doublons et difficultés d'offboarding. Les destinations et sessions doivent changer selon l'application et les entitlements, pas l'identité.

## 13. Roles vs Entitlements

`User.role`, les profils métiers et les capabilities décrivent l'autorité. `PlatformTenantSubscription` et `PlatformTenantFeature` prouvent qu'une couche commerciale distincte existe déjà, mais son enforcement fonctionnel est incomplet et son sujet est organisationnel. Un entitlement Pro doit être vérifié côté backend sur les routes Pro ; il ne doit jamais être déduit du rôle `Proprietaire`.

## 14. Tenant Architecture

Dans le code, `PlatformTenant` signifie organisation SaaS, tandis que `Locataire` signifie occupant. Transformer automatiquement chaque propriétaire en PlatformTenant serait une rupture sémantique et opérationnelle. Pour un propriétaire individuel, l'entitlement peut cibler l'identité/portfolio ; une société ou équipe peut opter explicitement pour une organisation. La résolution tenant actuelle doit rester intacte.

## 15. Owner Portfolio

Le portefeuille multi-biens existe via `Property.owner` et `RentalManagement.owner`. Il fonctionne aujourd'hui, mais certaines lectures sont non bornées et les projections financières préchargent contrats/gestions. Il est acceptable au MVP ; une cible de 100+ biens exige pagination, filtres, index caractérisés et agrégats de synthèse.

## 16. Building/Units

Aucun modèle immobilier Building/Unit ni relation immeuble→lot robuste n'a été trouvé. Chaque appartement peut être un Property autonome, sans rollup d'immeuble. C'est une dette P1, non un P0 si le MVP vise propriétaires individuels et petits portefeuilles plutôt que grands immeubles.

## 17. Locataire

`Locataire` est réutilisable : son lien optionnel et explicitement approuvé vers `User` évite de confondre compte et dossier locatif. Sa portée tenant est actuellement dérivée par relations et routes staff ; les nouvelles écritures owner-managed devront prouver l'appartenance du dossier au portefeuille autorisé.

## 18. Contrat

`Contrat` est réutilisable pour le bail et possède cycle, avenants, caution, états des lieux et contrainte d'un contrat ouvert par bien/type. Il porte encore des champs de vente et une référence `Proprietaire` legacy. Les routes actuelles exigent des capabilities staff : Altimmo Pro nécessite des cas d'usage propriétaire dédiés, pas un appel aux routes Admin.

## 19. Payments

`Paiement` représente une échéance et son état agrégé. Il peut être réutilisé, mais ne distingue pas qui collecte, qui détient les fonds, qui constate le paiement et pour quel mode de gestion. Ces dimensions doivent être explicites avant d'en déduire commission ou settlement.

## 20. Receipts

`RentalPaymentReceipt` offre granularité, paiements partiels, idempotence et annulation sans suppression. Il est une base solide. Son champ `auteur` seul ne suffit pas à qualifier encaisseur, bénéficiaire, canal et garde des fonds ; adaptation requise. Une quittance locataire n'est jamais un relevé de payout propriétaire.

## 21. Maintenance

Le modèle relie Property, Locataire, owner, acteur, assignation et pièces jointes. Le domaine est réutilisable ; les routes actuelles imposent contexte tenant et capabilities staff. Des commandes owner-authority séparées sont nécessaires, avec contrôle du bien et restrictions d'assignation.

## 22. Documents

Contrats, quittances, preuves et pièces privées sont réutilisables. Les serializers évitent d'exposer directement les clés de stockage et fournissent des endpoints autorisés. Altimmo Pro doit conserver ces contrôles et introduire une taxonomie de visibilité propriétaire/locataire/agence, sans URL permanente.

## 23. Notifications

Le registre couvre déjà paiements, quittances, maintenance, bail et propriétaire. La même infrastructure peut notifier plusieurs applications en ciblant utilisateur, type, ressource et destination. Elle doit ajouter une stratégie de deep links par client et ne jamais utiliser le nom d'application comme frontière d'autorisation.

## 24. Messaging

Conversation est fondée sur participants et possède un tenant PlatformTenant optionnel. Le domaine est réutilisable, sous réserve d'autoriser chaque conversation par relation métier (bien/bail/mandat), et non par simple présence dans le carnet d'adresses.

## 25. Tenant Portal

Le portail locataire existant est réutilisable sans troisième application : dashboard, baux, paiements, documents, préavis et maintenance. Il reste dans Altimmo Marketplace, avec deep links depuis notifications. Le lancement Pro ne doit pas déplacer le locataire dans un produit de gestionnaire.

## 26. Financial Boundaries

Quatre flux doivent rester distincts : loyer dû, encaissement réel, commission/settlement agence, et abonnement SaaS Pro. Ils peuvent partager identité et infrastructure, mais pas le même ledger ni les mêmes statuts.

## 27. Agency Commission

La règle produit imposée est 10 % du loyer **réellement encaissé**, uniquement en `AGENCY_MANAGED`. Elle doit être versionnée/snapshotée par période de mandat. Ni `managementFee`, ni le champ vente `commissionAgence`, ni le rôle Admin ne prouvent cette commission.

## 28. Penalties

Le modèle sait représenter la pénalité de 3 % et le service existant sait la calculer. Le bénéficiaire économique de cette pénalité n'est pas confirmé. Il faut décider si elle revient au propriétaire, à l'agence, ou est partagée avant d'établir net et settlement.

## 29. Settlement

Settlement est absent et ne doit exister que lorsque l'agence détient effectivement les fonds. En owner-managed avec paiement direct au propriétaire, le système enregistre l'échéance et la preuve mais ne fabrique aucun payout agence→propriétaire.

## 30. SaaS Billing

L'abonnement Pro est un domaine financier séparé du loyer. Il facture l'accès/les quotas au produit, n'altère pas Paiement locatif et ne déclenche pas de quittance. Le socle PlatformTenantSubscription est inspirant mais ne couvre pas encore proprement le propriétaire individuel.

## 31. Shared Backend

Le backend partagé est viable et recommandé : domaines, modèles, auth, stockage privé, notifications et contrôles tenant existent déjà. La bonne séparation est par modules applicatifs et routes owner-authority/staff-authority, non par copie de serveur.

## 32. Database Strategy

Même cluster et mêmes collections canoniques, avec références stables, index et politique d'accès par ressource. Une base séparée créerait synchronisation Property/User/Contrat et double source de vérité. Des collections futures distinctes pour Listing, entitlement ou settlement ne signifient pas une base séparée.

## 33. API Boundary

Créer à terme une surface versionnée `/api/pro/v1/...` ou équivalente, adossée à des services de domaine communs. Les clients Pro ne doivent appeler aucune route Admin. L'API de production peut rester la même ; le versioning devient nécessaire avant publication externe et cycles mobiles indépendants.

## 34. Mobile Architecture

Une application Expo Pro dédiée est justifiée par navigation, densité opérationnelle, permissions et cadence produit différentes. Elle partage identité, API et composants génériques, pas l'arborescence complète de `altimmo-app`. Le tenant reste dans l'app Marketplace.

## 35. Code Sharing

Copier `altimmo-app` n'est pas une architecture acceptable. Le monorepo doit extraire progressivement des packages tels que `shared-domain-contracts`, `shared-api-client`, `shared-auth-session`, `shared-design-tokens`, `shared-notification-links` et, seulement quand réellement génériques, `shared-mobile-ui`. Aujourd'hui `shared` ne contient que la navigation.

## 36. Web Architecture

Un Web Pro dédié est recommandé : la gestion de documents, tableaux, exports et portefeuilles exige un poste de travail responsive. Il peut être un nouveau shell/segment du client Web au départ, avec frontière de navigation et bundles explicites ; un dépôt/backend séparé n'est pas requis.

## 37. Security Boundary

L'application cliente n'est jamais une frontière de sécurité. Chaque lecture/commande Pro doit vérifier identité, entitlement, relation owner→Property/RentalManagement, mode effectif et droit d'action. Les opérateurs plateforme restent distincts, et le contexte PlatformTenant ne doit pas être contourné.

## 38. Owner Teams

OrgUnit/OrgMembership peuvent soutenir des équipes futures. Il manque toutefois le rattachement canonique du portefeuille et des délégations fines. Les équipes ne sont pas requises pour le MVP individuel ; elles sont P1 pour petites agences/sociétés patrimoniales.

## 39. Transitions Between Modes

`OWNER_MANAGED → AGENCY_MANAGED` et retour sont possibles, mais par commande contrôlée à date d'effet : clôture des pouvoirs précédents, snapshot des soldes, mandat, encaisseur, commission et audit. L'historique financier antérieur reste attaché à son mode d'origine ; aucune commission rétroactive.

## 40. Data Ownership

| Donnée | Propriétaire métier | Autorités d'écriture |
|---|---|---|
| User/identité | Plateforme/utilisateur | utilisateur + IAM plateforme |
| Property actif | Propriétaire | owner-authority ou agence mandatée |
| Listing | Publisher/Marketplace | propriétaire autorisé + modération |
| RentalManagement | Portefeuille/mandat | selon mode effectif |
| Bail/dossier locataire | Relation locative | owner ou agence mandatée ; locataire limité |
| Encaissement | Partie qui le constate | encaisseur autorisé, trace immuable |
| Settlement | Agence détenant les fonds | workflow financier agence uniquement |
| Abonnement Pro | Fournisseur SaaS | billing/entitlement plateforme |

## 41. Offboarding

La fin d'abonnement Pro doit retirer les commandes premium, pas supprimer biens, baux, preuves ou obligations légales. Prévoir grâce puis lecture/export, rétention documentée et réactivation. La fin d'un mandat agence exige handover, solde, révocation des droits et conservation de l'historique.

## 42. MVP

Cible : propriétaire individuel ou petit portefeuille gérant directement des biens résidentiels déjà présents ou ajoutés en privé. Fonctions bloquantes avant lancement :

1. contrat de mode historisé et transitions ;
2. routes owner-authority sécurisées ;
3. actif privé publiable sans duplication ;
4. paiements/reçus qualifiant encaisseur et garde des fonds ;
5. entitlement Pro backend-enforced et offboarding sûr.

Le MVP comprend portefeuille, locataires, baux, échéancier, enregistrement de paiements, quittances, documents, maintenance et synthèse simple.

## 43. P1/P2

P1 (6) : Building/Unit ; équipes et délégations ; exports/reporting avancés ; onboarding agence depuis Pro ; rapprochement bancaire ; notifications/deep links multi-app industrialisés.

P2 (6) : API partenaires ; automatisations comptables ; règles tarifaires/quotas avancées ; marque blanche ; analytics de portefeuille ; intégrations bancaires/fournisseurs élargies.

## 44. Option Comparison

| Critère | A — Pro dans app actuelle | B — clients Pro dédiés, plateforme partagée | C — séparation complète |
|---|---:|---:|---:|
| Clarté produit/UX | 4 | 9 | 9 |
| Réutilisation backend/domaines | 9 | 9 | 3 |
| Sécurité des frontières | 6 | 8 | 7 |
| Coût et délai | 8 | 7 | 2 |
| Cohérence des données | 9 | 9 | 3 |
| Évolutivité commerciale | 5 | 9 | 8 |
| Complexité opérationnelle | 8 | 7 | 2 |
| **Score pondéré /10** | **6.1** | **8.6** | **3.4** |

L'option B sépare l'expérience sans inventer de synchronisation inter-backends.

## 45. Readiness Scores

| Axe | Score | Motif principal |
|---|---:|---|
| Backend reuse | 84 | Couverture métier riche, services/routes à borner par autorité |
| Auth reuse | 88 | Identité, JWT, OAuth, capabilities et profils communs |
| Rental domain reuse | 70 | Agrégats solides, sémantique agence encore dominante |
| Mobile code reuse | 58 | Infrastructure réutilisable, écrans et navigation très Marketplace |
| Web code reuse | 72 | Dashboard/services réutilisables, shell Pro à isoler |
| Multi-tenant readiness | 64 | Organisation robuste, sujet propriétaire individuel non résolu |
| Product readiness | 57 | Portail brut présent, modes/entitlements/finance Pro incomplets |

## 46. Product Boundary Matrix

| Capacité | Marketplace | Altimmo Pro | Agence | Portail locataire |
|---|---|---|---|---|
| Recherche/publication | Principal | Déclenche publication | Modère/opère | Lecture |
| Portefeuille privé | Minimal | Principal | Mandaté seulement | Non |
| Bail/échéances | Conversion/lecture | Owner-managed | Agency-managed | Ses données |
| Encaissement | Paiement initié | Constat direct owner | Collecte agence | Paie/consulte |
| Commission/settlement | Non | Non en direct | Principal | Non |
| Abonnement Pro | Non | Principal | Éventuel plan distinct | Non |

## 47. Shared Backend Matrix

| Domaine | Partage | Adaptation requise |
|---|---|---|
| User/Auth | Oui | Audience/app destination, entitlement |
| Property | Oui | Séparer progressivement Listing |
| RentalManagement | Oui, partiel | mode et autorité historisés |
| Locataire/Contrat | Oui | commandes owner-authority |
| Paiement/Receipt | Oui, partiel | encaisseur, custody, mode |
| Maintenance/Documents | Oui | visibilité et routes owner |
| Notifications/Messaging | Oui | deep links et relation métier |
| Subscription | Fondation seulement | sujet individuel + enforcement |

## 48. Financial Matrix

| Flux | OWNER_MANAGED | AGENCY_MANAGED | Abonnement Pro |
|---|---|---|---|
| Loyer | dû au propriétaire | dû au propriétaire | Sans objet |
| Détention fonds | propriétaire/direct | agence si mandat l'autorise | plateforme SaaS |
| Commission 10 % | Jamais | sur encaissé réel uniquement | Jamais |
| Pénalité 3 % | Représentable ; bénéficiaire à décider | idem | Jamais |
| Settlement | Aucun payout artificiel | Oui si agence détient fonds | Non |
| Document | reçu/quittance locative | reçu + futur relevé settlement distinct | facture SaaS distincte |

## 49. Security Matrix

| Action owner-managed | Identité | Entitlement | Ownership | Mode effectif | Tenant/mandat | Backend enforced |
|---|---:|---:|---:|---:|---:|---:|
| Lire portefeuille | Oui | Oui | Oui | Non | Si organisation | Oui |
| Modifier bien | Oui | Oui | Oui | Oui | Oui | Oui |
| Créer bail/locataire | Oui | Oui | Oui | Oui | Oui | Oui |
| Constater paiement | Oui | Oui | Oui | Oui | Custody/acteur | Oui |
| Publier annonce | Oui | Selon plan | Oui | Politique publication | Modération | Oui |
| Déclencher settlement | Oui | Sans objet | Insuffisant | Agency only | Garde fonds | Oui |

## 50. Risks

| Rang | Risque | Niveau | Réponse |
|---:|---|---|---|
| 1 | Rôle propriétaire utilisé comme abonnement/pouvoir global | Critique produit/sécurité | entitlement + ownership serveur |
| 2 | Changement de mode rétroactif | Critique financier | historique effectif et snapshots |
| 3 | Paiement direct traité comme fonds agence | Critique financier | custody/collector explicites |
| 4 | Property copié pour publier | Élevé data | actif canonique + Listing/projection |
| 5 | Routes Admin réutilisées par Pro | Élevé sécurité | API owner-authority dédiée |
| 6 | Propriétaire forcé en PlatformTenant | Élevé architecture | sujet individuel ou opt-in organisation |
| 7 | Copie de l'app mobile | Moyen maintenabilité | packages partagés progressifs |
| 8 | Portefeuille non borné | Moyen scalabilité | pagination/index/agrégats |

Plus gros risque produit : mélanger gestion autonome et délégation au point de rendre la promesse Pro illisible. Plus gros risque architecture : coder l'application avant le contrat de mode. Plus gros risque sécurité : autoriser par rôle ou écran. Plus gros risque financier : commission/settlement sur un paiement que l'agence n'a jamais détenu. Plus gros risque de duplication : cloner Property, User ou le backend pour servir la nouvelle interface.

## 51. Recommended Architecture

```text
Altimmo Marketplace Web/Mobile ─┐
Altimmo Pro Web/Mobile ─────────┼─> API partagée, modules d'application bornés
Back-office Agence ─────────────┤        │
Portail Locataire Marketplace ──┘        ├─ Identity/IAM + Entitlements
                                         ├─ Property + future Listing
                                         ├─ Rental domain + mode history
                                         ├─ Payments/Receipts
                                         └─ Mongo partagé
```

Décision : clients Pro dédiés dans le monorepo, backend et données partagés, API propriétaire distincte, modèles canoniques réutilisés/adaptés. Aucun microservice ni second backend n'est justifié.

## 52. Roadmap

1. **Foundation contract** : formaliser modes, autorités, custody, entitlement subject et transitions.
2. **Owner API** : cas d'usage propriétaire sécurisés, projections et pagination.
3. **Pro Web MVP** : portefeuille, bail, échéances, documents, maintenance.
4. **Pro Mobile MVP** : opérations essentielles, notifications et deep links.
5. **Agency transition/settlement** : mandat, 10 %, custody, settlement idempotent.
6. **Scale** : Building/Unit, équipes, reporting, rapprochement et packages partagés stabilisés.

## 53. Settlement Dependency

Le settlement agence peut reprendre avant Altimmo Pro complet, mais pas avant cinq décisions/invariants : mode effectif historisé ; preuve que l'agence détient les fonds ; taux 10 % versionné et snapshoté sur l'encaissement ; bénéficiaire de la pénalité 3 % décidé ; workflow payout/retry/idempotence/audit défini. Il ne dépend ni des apps Pro dédiées, ni de Building/Unit, ni des équipes, mais dépend directement de cette frontière financière.

## 54. Mandatory Answers

1. Branche : `main`. 2. HEAD : `49f12d787b1011d16f9682cedefb81b377823e4d`. 3. Worktree : non vierge, travaux préexistants préservés. 4. Diff-check initial : vert. 5. Trois rapports précédents lus : oui. 6. Code modifié : non.

7. Property = actif **et** listing aujourd'hui. 8. Dette Property/Listing : oui. 9. RentalManagement réutilisable : partiellement. 10. Owner-managed : oui après adaptation. 11. Agency-managed : oui, déjà dominant. 12. ManagementMode nécessaire : oui. 13. Simple champ suffisant : non. 14. Historique nécessaire : oui. 15. Contrat : oui, adaptation d'autorité. 16. Locataire : oui. 17. Paiement : partiellement. 18. RentalPaymentReceipt : oui, adaptation custody. 19. Maintenance : oui, nouvelles commandes owner. 20. Documents : oui. 21. Notifications : oui. 22. Messaging : oui avec relation métier. 23. Tenant portal : oui.

24. Même User : oui, recommandé. 25. Auth partagée : oui. 26. Deux comptes : non. 27. Rôle ≠ abonnement : confirmé. 28. Entitlement layer : nécessaire. 29. Enforcement : backend, puis UI informative. 30. Propriétaire Pro devient tenant : non automatiquement. 31. Tenant actuel : organisation SaaS PlatformTenant ; Locataire est l'occupant. 32. Risque de modification : élevé, fuite cross-tenant et rupture IAM. 33. Backend partagé : viable. 34. Backend séparé : non justifié. 35. DB partagée : viable. 36. DB séparée : non justifiée. 37. Application dédiée : oui. 38. Web Pro dédié : oui. 39. Mobile Pro dédié : oui. 40. Code mobile partageable : partiellement. 41. Copier altimmo-app : non. 42. Packages partagés : oui, progressivement. 43. Packages : contrats domaine, client API, auth/session, design tokens, liens notifications, UI générique.

44. Marketplace et Pro partagent Property : oui, actif canonique. 45. Bien non publié gérable : oui via `internalManagedOnly`/publication désactivée. 46. Dette bloquante si montée en complexité : annonce imbriquée dans Property. 47. Publication ultérieure : oui. 48. Sans duplication : oui, par Listing/projection liée. 49. Owner→agency : oui. 50. Historique préservable : oui si transition effective append-only. 51. Agency→owner : oui. 52. Commission historique : oui par snapshot/période. 53. 10 % agency-managed seulement : oui. 54. 3 % représentable : oui. 55. Bénéficiaire pénalité confirmé : **NO**. 56. Settlement owner-managed direct : non. 57. Settlement agency-managed avec fonds agence : oui. 58. Abonnement Pro séparé du loyer : oui.

59. Multi-biens scalable : partiellement, pagination requise à grande échelle. 60. Building/Unit actuel : absent. 61. Dette Building/Unit : oui. 62. Owner teams : infrastructure organisationnelle partielle, produit non supporté. 63. Nécessaire MVP : non. 64. Cible MVP : propriétaire individuel/petit portefeuille résidentiel. 65. Fonctions bloquantes : modes, owner API, actif privé publiable, finance qualifiée, entitlement. 66. P1 : six éléments listés section 43. 67. P2 : six éléments listés section 43. 68. Marketplace à simplifier : oui, recentrer sa navigation sur découverte/conversion et portail locataire. 69. App locataire séparée : non. 70. Back-office agence séparé : oui, comme expérience. 71. Pro appelle routes Admin : non. 72. Nouvelles routes owner-authority : oui. 73. Sécurité backend-enforced : oui. 74. Entitlement backend-enforced : oui. 75. Deep links futurs : schéma/app links par produit avec fallback Web. 76. Notifications multi-app : oui. 77. Même API production : oui. 78. Versioning API : oui avant clients indépendants. 79. Monorepo : recommandé. 80. Restructuration immédiate : non ; extraction progressive.

81. Backend reuse : 84. 82. Auth reuse : 88. 83. Rental reuse : 70. 84. Mobile reuse : 58. 85. Web reuse : 72. 86. Multi-tenant : 64. 87. Product readiness : 57. 88. Option A : 6.1/10. 89. Option B : 8.6/10. 90. Option C : 3.4/10. 91. Architecture : clients Pro dédiés + plateforme partagée. 92. Pourquoi : frontière UX forte, domaines communs et absence de justification data/opérationnelle pour dupliquer. 93. Risque produit : confusion autonome/délégué. 94. Risque architecture : mode tardif ou mutable. 95. Risque sécurité : autorisation par rôle/client. 96. Risque financier : faux settlement. 97. Risque duplication : Property/backend clonés. 98. Minimum settlement : cinq invariants section 53. 99. Reprise avant Pro complet : oui, après ces invariants. 100. Prochain sprint : `ALTIMMO-PRO-FOUNDATION-CONTRACT-1`. 101. Roadmap ≤6 phases : oui, six.

102. Nouveau modèle : non. 103. Nouveau package : non. 104. Migration : non. 105. Code métier modifié : non. 106. Tests modifiés : non. 107. Commit : non. 108. Push : non. 109. Deploy : non. 110. Rapport créé : oui, celui-ci uniquement. 111. Verdict final : A.

## 55. Final Verdict

**A — ALTIMMO PRO DEDICATED APP WITH SHARED PLATFORM RECOMMENDED.**

Altitude Pro mérite des expériences Web et Mobile dédiées parce que son intention, sa navigation et son modèle commercial diffèrent nettement du Marketplace. Le backend, l'identité et la base ne doivent pas être dupliqués : les domaines existants sont suffisamment riches pour être adaptés par frontières d'autorité et non réécrits.

La décision de lancement reste conditionnée par le contrat de fondation : modes historisés, owner-authority backend, entitlement distinct du rôle, Property publiable sans copie, et sémantique financière de custody. Aucun code Altimmo Pro, modèle, package, migration, test, commit, push ou déploiement n'a été réalisé pendant cet audit.
