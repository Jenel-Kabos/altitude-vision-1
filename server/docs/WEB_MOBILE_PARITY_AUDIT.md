# MOB-GAP-1 — Audit exhaustif de parité Web / Mobile

Date de certification : 5 août 2026  
Périmètre : `server/`, `client/`, `altimmo-app/`  
Nature : audit documentaire et exécutable, sans modification de workflow métier.

## 1. Méthodologie et preuves

L'audit combine quatre niveaux :

1. extraction statique de tous les montages Express, déclarations de routes, pages Next.js, routes React Navigation et appels `api.*` natifs ;
2. lecture manuelle des navigateurs, services, écrans, contrôleurs, modèles, RBAC, notifications, uploads, paiements et documents ;
3. vérification de l'atteignabilité des écrans et des appels réellement utilisés ;
4. exécution des tests, linters, compilateurs, Expo Doctor et export Android.

Les inventaires bruts sont conservés dans [MOB_GAP_INVENTORY.json](./MOB_GAP_INVENTORY.json), généré par [audit-web-mobile-parity.js](../scripts/audit-web-mobile-parity.js). Le script est statique, n'importe aucun module applicatif, ne contacte aucun service et ne modifie aucune donnée.

### Volumétrie vérifiée

- 48 routeurs Express montés dans `server/server.js` ;
- 489 routes HTTP montées résolues avec méthode, chemin, fichier, chaîne middleware et rôles statiquement visibles ;
- 151 routes Next.js `page.*` ;
- 37 fichiers d'écran React Native ;
- 46 enregistrements de routes natives ;
- 82 appels `api.get/post/put/patch/delete` natifs hors tests ;
- 63 fonctions métier classifiées dans la matrice.

La recherche brute trouve davantage d'occurrences `router.*` (helpers, routeurs internes et formes multilignes). La certification porte sur les routes effectivement reliées à l'un des 48 montages ; les chaînes non résolues restent visibles via leur fichier dans l'inventaire et ont été relues par domaine.

## 2. Architecture comparée

### API commune

Express/Mongoose reste la source de vérité. Web et Mobile utilisent le même JWT et majoritairement les mêmes endpoints. Le RBAC est côté serveur (`protect`, `restrictTo`, capacités hôtelières et relations owner/tenant). Les modèles structurants sont `User`, `Property`, `RentalManagement`, `Contrat`, `Proprietaire`, `Locataire`, `PropertyAsset`, `Accommodation`, `Hotel`, `HotelReservation`, les modèles financiers et documentaires.

### Web

Next.js 15 expose 151 pages et un back-office dense. Les services Web représentent 466 appels API statiques. Le Web couvre le public, les espaces personnels et presque tout le staff : gestion locative, patrimoine, hébergements, hôtellerie, finance, documents, communication et événementiel.

### Mobile natif

Expo SDK 52 / React Native 0.76 utilise React Navigation, Axios, Secure Store, Expo Notifications, document/image picker, partage, WebView et Socket.IO. Les tabs sont Annonces, Publier conditionnel, Carte, Messages, Visites et Profil. L'application est réellement riche sur immobilier public, publication, visites, messagerie, candidatures, transactions et hôtellerie ciblée ; elle n'est pas un miroir du back-office.

Playwright « mobile » du Web n'est jamais compté comme test React Native. La preuve native vient exclusivement de Jest/Testing Library, TypeScript, Expo Doctor et export Android.

## 3. Résumé de la matrice

Sur 63 fonctions :

| Parité | Nombre |
|---|---:|
| complète | 4 |
| quasi complète | 15 |
| partielle | 11 |
| consultation uniquement | 1 |
| Mobile absent | 16 |
| navigation manquante | 4 |
| workflow incomplet | 2 |
| API incompatible Mobile | 1 |
| volontairement Web-only | 8 |
| Web absent | 1 |

La matrice détaillée et machine-readable est [web-mobile-parity-matrix.json](./web-mobile-parity-matrix.json).

## 4. Écrans Mobile

L'inventaire détaillé est [MOBILE_SCREEN_INVENTORY.md](./MOBILE_SCREEN_INVENTORY.md).

### Présents

- auth, profil et sécurité ;
- annonces, recherche, carte, détail, recommandations, favoris, avis et signalement ;
- publication vente/location/hébergement/hôtel ;
- visites ;
- conversations, chat, pièces jointes et notifications ;
- offres/candidatures, pièces, suivi, retrait et réservation ;
- transactions, Mobile Money et virement ;
- réservation hôtelière client, mes réservations et annulation ;
- affectation chambre, check-in/out et inventaire hôtelier léger.

### Partiels

- visites : paiement et workflow terrain complet non certifiés ;
- propriétaire : résumé locatif, mais aucun cockpit patrimoine complet ;
- transactions : initiation présente, documents/remboursements incomplets ;
- hôtel client : réservation présente, aucun paiement ;
- hôtel staff : pas de housekeeping/inspection/maintenance ;
- notifications : plusieurs types sans destination native ;
- hébergement indépendant : découverte/publication présentes, réservation absente.

### Fichiers non navigables

Aucun écran mort confirmé. `OnboardingScreen` est rendu directement avant le navigateur. `HotelEstablishmentScreen` est une branche interne de `AddAccommodationScreen`.

### Service Mobile orphelin

`altimmo-app/src/services/reviewService.js` n'est importé par aucun écran, hook ou contexte. Les avis utilisent directement `api` dans `DetailAnnonceScreen`. Recommandation : supprimer ou réintégrer lors d'un sprint de nettoyage, après vérification produit ; aucune suppression faite pendant cet audit.

## 5. Écarts critiques par domaine

### Portail locataire — P0

Le backend et le Web couvrent tableau de bord, bail, échéancier, paiements, quittances, maintenance avec photos, documents, préavis, inspection et caution. Aucun navigateur, écran ou service natif dédié n'existe. C'est le plus grand écart personnel et le premier domaine fonctionnel à construire après le socle navigation.

### Hébergements indépendants — P0

Le Mobile sait afficher et publier un hébergement, mais ne possède aucun équivalent du parcours réservation indépendante, « mes réservations », paiement, annulation et remboursement. Les écrans hôtel ne sont pas réutilisables tels quels : modèles et endpoints diffèrent.

### Hôtellerie — P0/P1

La réservation client et les opérations réception sont substantielles. Le paiement hôtel est explicitement absent (`HotelBookingScreen` annonce qu'aucun paiement n'est prélevé). Housekeeping, inspection et maintenance existent côté API/Web mais aucun écran natif ne les consomme. Finance avancée doit rester Web-only.

### Patrimoine propriétaire — P1

`MesAnnoncesScreen` mélange inventaire personnel et résumé de biens gérés, sans offrir cycle de vie, valorisation, revenus/dépenses, carnet d'entretien, documents ni alertes du cockpit Web.

### Documents — P0/P1

Il n'existe aucun écran natif de documents personnels. Les téléchargements Web reposent sur blob/URL navigateur ; React Native requiert un téléchargement vers espace local privé, vérification MIME/nom, aperçu et partage explicite. Le centre administratif global reste Web-only.

### Communication et événementiel — P2

Altcom et Mila Events sont Web/API uniquement. Ce n'est pas bloquant avant le CRM immobilier ; un sprint distinct doit précéder toute duplication.

## 6. Écarts par audience

### Public / Client

Points forts : découverte immobilière, candidatures, visites, messagerie, transactions, hôtel. P0 : paiement visite, hébergement indépendant complet, paiement/remboursement hôtel et documents financiers.

### Locataire

Dette P0 presque totale : aucune surface native personnelle malgré un backend mature. Les notifications de loyer/contrat ne disposent pas de cible valide.

### Propriétaire

Publication et annonces personnelles sont solides. Les biens gérés sont seulement consultables/réactifs. Patrimoine, revenus, entretien, documents et analytics restent absents.

### Staff

Le Mobile doit se limiter au terrain : visites, réception, chambre, check-in/out, housekeeping, inspection, maintenance et alertes. Modération exhaustive, contrats complexes, configuration, finance et administration restent légitimement Web-only.

## 7. Audit des contrats API Mobile

| Classe d'écart | Conclusion |
|---|---|
| UI manquante seulement | portail locataire (hors documents/paiement), patrimoine en lecture, housekeeping/inspection/maintenance |
| API manquante/adaptation | projections « mes tâches », destinations de notifications, agrégats patrimoine compacts |
| API incompatible Mobile | téléchargements blob/stream, certaines pièces documentaires, retours paiement navigateur |
| navigation manquante | candidatures, réservations, contrats, loyers, documents, maintenance, remboursements |
| permission manquante | aucun contournement détecté ; les nouveaux écrans devront conserver les contrôles relationnels serveur |
| workflow incomplet | paiements visite/hôtel, hébergement indépendant, documents personnels |
| Web-only volontaire | finance avancée, admin, configuration, modération, contrats staff, centre documentaire global |

Les listes Web utilisent parfois des réponses très riches ou `limit=1000`; elles ne doivent pas être copiées sur Mobile. Les nouvelles projections doivent être paginées, compactes et stables. Les uploads existants `multipart/form-data` sont compatibles React Native, sous réserve de normaliser URI, MIME, taille et timeout.

## 8. Paiements

| Flux | Consultation Mobile | Initiation | Confirmation | Upload | Historique | Remboursement | Document |
|---|---:|---:|---:|---:|---:|---:|---:|
| Visite | oui | non certifiée | statut partiel | non | via visites | non | non |
| Transaction immobilière | oui | oui | polling oui | virement oui | oui | non | non |
| Location | résumé propriétaire seulement | non | non | non | non locataire | non | non |
| Hébergement indépendant | non | non | non | non | non | non | non |
| Hôtel | réservation oui | non | non | non | réservation oui | non | non |

Conclusion : il serait faux d'annoncer une parité paiement Mobile. Seule la transaction immobilière possède un parcours d'initiation identifiable ; aucun flux n'offre encore la chaîne homogène initiation → confirmation → historique → remboursement → document.

## 9. Documents

Le Mobile ne sait pas lister, filtrer, ouvrir, prévisualiser, télécharger ou partager les baux, quittances, états des lieux, factures et remboursements personnels. `expo-file-system`, `expo-sharing` et `expo-document-picker` sont installés, mais aucune surface documentaire métier ne les orchestre. Il faut distinguer :

- documents personnels : à créer ;
- documents financiers : à créer ;
- dossier métier simplifié : utile P1 ;
- centre administratif global : Web-only.

## 10. Notifications et deep links

### Valides ou avec fallback utile

- messages → conversation ou tab Messages ;
- visites → tab Visites ;
- transactions/paiements génériques → Transactions ;
- compte et modération d'annonce → Profil/Annonces.

### Liens morts ou fallbacks trompeurs

- `quote_received`, `quote_status`, `quote_response` → `null` ;
- `contrat_new`, `contrat_updated`, `loyer_paye`, `loyer_en_retard` → `null` ;
- notifications `real_estate_application_*` et `real_estate_reservation_*` produites par le serveur mais absentes de `TYPE_TO_SCREEN` ;
- notifications locatives redirigées vers `MesAnnonces`, y compris celles pertinentes pour un locataire ;
- maintenance locative → annonce propriétaire au lieu d'un ticket/dossier ;
- aucun mapping dédié hôtel, hébergement, document, remboursement, housekeeping ou inspection.

Le deep linking déclaré ne couvre réellement que annonces, visites, messages, profil, dossiers immobiliers et callbacks paiement. Android n'auto-vérifie que `/annonces`; les autres chemins HTTPS ne sont donc pas certifiés comme universal links Android.

## 11. API backend orphelines côté Mobile

La majorité des 489 routes montées n'est pas consommée par les 82 appels natifs. Les ensembles fonctionnels orphelins les plus importants sont :

- tenant portal, rental documents, rental maintenance staff et cycle de vie complet ;
- property assets/patrimoine ;
- accommodation reservations et paiements/remboursements ;
- housekeeping, inspections, maintenance hôtelière et finance hôtel ;
- documents financiers et dossiers globaux ;
- propriétaires/locataires/contrats/paiements du back-office ;
- Altcom, Mila Events, devis, portfolio et projets ;
- administration, modération avancée, audit/action logs et configuration.

« Orpheline côté Mobile » ne signifie pas inutile : huit familles sont explicitement Web-only dans la matrice.

## 12. Couverture de tests

### Web

- Vitest complet : 74 fichiers, 500 tests réussis ;
- Playwright desktop/mobile Web : présent dans `client/e2e`, non assimilé au natif ;
- build Next.js : réussi, 134 pages générées ;
- ESLint : 0 erreur, 267 avertissements.

### Backend

- tests unitaires : 103 suites, 1 203 tests réussis ;
- MongoDB global : 49 suites, 400 tests réussis en 421,071 s (`jest-exit=0`, durée orchestrateur 426 103 ms) ;
- forte couverture financière, hôtelière, locative et documentaire au niveau API ;
- ESLint : 0 erreur, 109 avertissements ;
- syntaxe Node exhaustive : anomalie préexistante détectée dans `server/utils/generateToken.js` (apostrophe non échappée dans une chaîne). Le fichier est exclu explicitement d'ESLint et n'est importé nulle part ; il n'affecte pas les 1 203 tests, mais la commande globale échoue. Non corrigé, car hors périmètre documentaire.

### Mobile natif

Tests dédiés : auth context, API, socket, notifications, visites, mappers, publication vente/location/hébergement/hôtel, réservation hôtel et opérations hôtel. Il n'existe aucun test pour un portail locataire, patrimoine ou documents puisqu'aucun écran correspondant n'existe.

- Jest : 20 suites, 211 tests réussis ; avertissements React `act(...)` non bloquants ;
- TypeScript : réussi ;
- contrôle syntaxique Mobile : 140 fichiers, 0 erreur ;
- ESLint Mobile : 0 erreur, 71 avertissements ;
- Expo Doctor : 18/18 contrôles réussis ;
- export Android : réussi, bundle Hermes de 6,29 MB, 54 assets, sortie temporaire `/tmp/altimmo-mob-gap-export`.

## 13. Priorités

- **P0** : socle navigation/deep links, portail locataire essentiel, hébergement indépendant, paiements personnels, documents critiques, housekeeping/inspection/maintenance terrain.
- **P1** : patrimoine propriétaire, préavis/caution/inspection, documents étendus, inventaire hôtel enrichi, calendrier hébergement.
- **P2** : Altcom/Mila client, projections et confort métier.
- **P3** : préférences et raffinements UX.
- **Hors roadmap Mobile** : back-office lourd listé dans l'inventaire des écrans.

## 14. Roadmap et décision avant CRM

La roadmap détaillée est [MOBILE_PARITY_ROADMAP.md](./MOBILE_PARITY_ROADMAP.md). Premier sprint recommandé : **MOBILE-NAV-1**, immédiatement suivi de **GL-MOBILE-1**. Le CRM backend peut ensuite démarrer en parallèle des sprints fonctionnels, mais aucun CRM Mobile terrain ne doit précéder la stabilisation des destinations, permissions et documents personnels.

## 15. Risques résiduels et dettes

- absence de tests E2E natifs sur appareil ;
- associated domains iOS déclarés, mais validation du fichier AASA externe non prouvée hors dépôt ;
- seul `/annonces` est couvert par l'intent filter Android ;
- absence de registre partagé serveur/mobile des types de notification ;
- service `reviewService.js` orphelin ;
- nombreuses API Web renvoient des projections trop lourdes pour un usage Mobile direct ;
- parcours paiement dépendants de fournisseurs externes, non certifiables entièrement hors environnement de paiement ;
- dette de warnings lint et données Browserslist/Expo à mesurer dans les commandes finales.
- utilitaire backend mort `server/utils/generateToken.js` syntaxiquement invalide et exclu d'ESLint ;

## 16. Garanties de mission

Aucun workflow métier n'a été modifié. Aucun commit, push, migration, suppression de donnée ou création de fonctionnalité métier n'a été effectué.
