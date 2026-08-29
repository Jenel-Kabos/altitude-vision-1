# HOTFIX-MOBILE-DUAL-ROLE-VISITS-VIEWS-1 — Rapport final

## Verdict

**A. MOBILE DUAL-ROLE VISITS CONTRACT — HOTFIX CERTIFIED GREEN.**

Le compte réel `Proprietaire`, qui peut également agir comme client, dispose maintenant de deux contextes distincts : **Mes demandes** (`GET /visites/my`) et **Mes biens** (`GET /visites/owner`). Les listes ne sont ni fusionnées ni dédupliquées. Les contrats et queries backend n'ont pas été modifiés.

## Baseline et périmètre

- HEAD initial et final : `4cc40f85e6cdc5a8da469be8f9e3bc795750a1e5` (`main`).
- Worktree initial préexistant préservé : `navigationSdk.js`, `DetailAnnonceScreen.jsx`, `propertyMapper.js`, son test, ainsi que les rapports non suivis déjà présents.
- Hotfixes Ads Fetch/Cache, Recommended Image Layout, AdCarousel Image Layout, Favorites/Property Share et Dashboard Dark Form Contrast préservés.
- Aucun fichier backend fonctionnel, web ou Mongo modifié. Aucun token, guard, statut ou contrat API modifié.
- Aucun commit, push ou déploiement.

## Cause et correction

Écran exact : `altimmo-app/src/screens/Visites/VisitesScreen.jsx`.

Ancienne condition : `user.role === 'Proprietaire' ? '/visites/owner' : '/visites/my'`. Elle forçait tout compte `Proprietaire` sur la vue des biens, alors que le modèle IAM ne possède qu'un rôle global singulier et qu'un utilisateur authentifié peut aussi demander une visite comme client.

Nouveau modèle UX :

- `Client` : titre **Mes demandes de visite**, vue unique `/visites/my` ; un paramètre owner est ignoré.
- `Proprietaire` : titre neutre **Visites**, sélecteur explicite **Mes demandes** / **Mes biens**.
- Contexte par défaut d'un propriétaire : **Mes demandes**, adapté à l'arrivée depuis une planification ou une notification client.
- Accès propriétaire explicite possible avec `route.params.visitContext='owner'`.
- **Mes demandes** appelle uniquement `/visites/my` ; **Mes biens** appelle uniquement `/visites/owner`.
- Les clés cache restent naturellement distinctes : `visites:/visites/my` et `visites:/visites/owner`.
- Le pull-to-refresh recharge uniquement le contexte actif.
- `useFocusEffect` revalide uniquement le contexte actif au refocus, sans double fetch simultané.
- À chaque changement de contexte, la liste visible est vidée avant le nouveau fetch et l'onglet revient sur **À venir**, empêchant tout mélange transitoire.

Le système ne stocke pas `user.roles` : il stocke un seul `user.role`. Il n'existe donc pas de catégorie IAM fiable « Proprietaire-only incapable d'agir comme client ». Le flux propriétaire strict est néanmoins couvert par le contexte **Mes biens** et son endpoint fermé `/owner`. Cette décision respecte l'exception du mandat : le rôle `Proprietaire` possède réellement l'usage client dans le système.

## Libellés et contrats conservés

- Empty state client à venir : **Aucune visite à venir** / **Demandez une visite depuis une annonce.**
- Empty state propriétaire à venir : **Aucune demande de visite à venir**.
- Passées : **Aucune visite passée** ou **Aucune demande de visite passée**, selon le contexte.
- Les filtres **À venir / Passées** et `isActive` sont inchangés.
- Les statuts `confirmee`, `en_cours`, `terminee`, annulations, refus et absences sont inchangés.
- `/visites/my` modifié : **NON**.
- `/visites/owner` modifié ou élargi : **NON**.
- Query propriétaire élargie : **NON**.
- Notification/deeplink modifié : **NON** ; les notifications existantes ouvrent `Visites` et tombent par défaut sur **Mes demandes**, conformément à la préférence client. Aucun `visitId` ou contexte fiable imposant une autre modification n'a été démontré.

## RED → GREEN permanent

RED exact, avant correction : le test d'un utilisateur `role=Proprietaire` attendait **Mes demandes** et un appel `/visites/my`. Il échouait avec `Unable to find "Mes demandes"`; le rendu affichait **Visites de mes biens** et appelait exclusivement `/visites/owner`.

GREEN : `VisitesScreenDualRole.test.jsx`, **10/10** :

1. dual-role, contexte client par défaut → `/my` ;
2. contexte **Mes biens** → `/owner` ;
3. retour **Mes demandes** sans mélange ;
4. Client → `/my`, sans onglet propriétaire ;
5. contexte propriétaire explicite → `/owner` ;
6. empty state client ;
7. empty state propriétaire ;
8. classification À venir/Passées intacte ;
9. refresh limité au contexte actif ;
10. paramètre owner fail-closed pour Client.

Le cas confirmé client est rendu dans **À venir** et la visite d'un bien possédé est rendue dans **Mes biens** dans les tests. Aucun changement de statut ou de classification.

## Gates

| Gate | Résultat |
|---|---|
| Test RED | Échec fonctionnel attendu démontré |
| Tests dual-role ciblés GREEN | 1 suite, 10/10 |
| Suite mobile complète | 55 suites, 460/460 |
| Tests backend Visites ciblés | 4 suites, 62/62 |
| Syntaxe mobile | 199 fichiers, PASS |
| Lint mobile | PASS, 0 erreur ; 118 avertissements préexistants |
| TypeScript mobile | PASS |
| Architecture | PASS ; 0 nouvelle violation |
| Expo Doctor | 20/21 ; échec limité à 5 écarts de versions patch Expo hors périmètre |
| `git diff --check` | PASS |

Le premier lancement des tests backend ciblés a été bloqué par la sandbox (`listen EPERM` sur le port local Supertest). La relance autorisée hors sandbox a produit 62/62 tests verts ; ce n'était pas un défaut applicatif.

## Validation Samsung SM-S918B

- Device réel détecté en USB, état ADB `device`; serial masqué `R5C••••Y2JZ`.
- Package `com.altitudevision.altimmo`, version `1.0.1`, versionCode `2`, build `DEBUGGABLE`, dev-client relié à Metro.
- Ouverture Visites : titre **Visites**, sélecteur **Mes demandes / Mes biens**, onglets **À venir / Passées**.
- **Mes demandes → À venir** : **VILLA MEUBLEE AU PLATEAU DE 15 ANS** visible.
- **Mes biens** : la visite client n'est pas présente ; état **Aucune demande de visite à venir**, cohérent avec les données réelles du compte.
- Pull-to-refresh client : visite toujours visible.
- Pull-to-refresh propriétaire : état propriétaire toujours cohérent, sans visite client.
- Refocus Profil → Visites, contexte client : visite toujours visible.
- Refocus Profil → Visites, contexte propriétaire : état propriétaire toujours isolé.
- Cold start sans effacement de données : arrivée dans l'application, ouverture Visites, contexte **Mes demandes** par défaut et visite cible visible.
- L'ouverture de détails n'est pas applicable : les cartes de cet écran n'exposent actuellement aucune action de navigation vers un détail.

## Fichiers du hotfix

1. `altimmo-app/src/screens/Visites/VisitesScreen.jsx`
2. `altimmo-app/src/screens/Visites/__tests__/VisitesScreenDualRole.test.jsx`
3. `server/docs/HOTFIX_MOBILE_DUAL_ROLE_VISITS_VIEWS1_REPORT.md`

Backend fonctionnel modifié : **NON**. Web : **NON**. Mongo/migration/mutation : **NON**. Commit : **NON**. Push : **NON**. Deploy : **NON**.

