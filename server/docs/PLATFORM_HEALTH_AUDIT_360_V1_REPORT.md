# PLATFORM-HEALTH-AUDIT-360-V1 — Rapport final

## Verdict exécutif

**Score global pondéré : 82,42 / 100.**

**Verdict : C — PLATEFORME SAINE, DETTE TECHNIQUE CONTRÔLÉE.**

Altitude Vision est un monolithe modulaire fonctionnellement riche, testable et exploitable en production. Les frontières architecturales sont désormais surveillées, les contrôles d'accès et d'isolation tenant sont substantiels, et les trois surfaces — web, API et mobile — disposent de suites de non-régression significatives. Aucun P0 ni secret de production versionné n'a été démontré pendant cet audit.

La plateforme n'est toutefois pas encore prête à être multipliée horizontalement sans précaution. Les tâches planifiées s'exécutent dans le processus HTTP sans verrou distribué visible, tandis que la présence Socket.IO est conservée en mémoire et qu'aucun adaptateur distribué n'a été trouvé. La maintenabilité est aussi pénalisée par plusieurs fichiers de 1 000 à 2 700 lignes, des avertissements React récurrents et une documentation de sprint devenue volumineuse.

Ce verdict certifie le **worktree local au commit `f56774e317680aca1bb3992d8d03c0623215f451`**, pas l'état du déploiement de production. `main` et `origin/main` pointaient vers le même commit au début de l'audit. La production, ses variables, ses index effectifs, ses métriques et ses parcours réels n'ont pas été interrogés.

## Périmètre, méthode et limites

- Racine : `/Users/apple/Documents/GitHub/altitude-vision-1`.
- Surfaces : `client`, `server`, `altimmo-app` et `shared`.
- Mode : lecture seule ; aucun correctif, paquet, migration, commit, push ou déploiement.
- Mesures : inventaire statique, graphe d'architecture, lint, tests, build Next, preuves Mongo récentes au même HEAD et inspection ciblée des contrats, routes, modèles, services et configurations.
- Volume mesuré : environ 230 139 lignes de sources, hors dépendances, distributions et couvertures.
- Backend : 77 fichiers de routes, 83 contrôleurs, 165 services, 106 modèles et 276 fichiers de tests.
- Web : 171 pages App Router et 122 fichiers de tests.
- Mobile : 47 écrans et 55 fichiers de tests.
- Validation visuelle : le navigateur intégré a répondu `Browser is not available: iab`. Les notes UI/UX reposent donc sur le code, les tests de contrat et les rapports visuels récents, avec confiance **MOYENNE**.
- Expo Doctor : non confirmé pendant ce passage, car `npx` n'a pas pu joindre le registre (`ENOTFOUND`). Aucun paquet n'a été installé, conformément au mandat.
- Aucune mesure Lighthouse, Core Web Vitals, charge, disponibilité, erreur production ou couverture globale n'est inventée.

## Scorecard pondérée

| Catégorie | Poids | Note /100 | Contribution | Confiance | Synthèse |
|---|---:|---:|---:|---|---|
| Architecture | 10 | 84 | 8,40 | Haute | Garde-fous actifs, zéro cycle connu ; dette legacy encore mesurée |
| Sécurité | 15 | 84 | 12,60 | Haute | RBAC/tenant/rate limiting solides ; CSP désactivée et secrets runtime non observables |
| Backend / API | 7 | 86 | 6,02 | Haute | API large, services et readiness ; quelques listes et traitements non bornés |
| Data / MongoDB | 5 | 88 | 4,40 | Haute | Suite Mongo exhaustive verte, index et idempotence ; modèle tenant hétérogène |
| Règles métier | 10 | 88 | 8,80 | Haute | Couverture riche des workflows sensibles et financiers |
| Cohérence fonctionnelle | 8 | 84 | 6,72 | Moyenne-haute | Parcours majeurs alignés ; contrats partagés encore minces |
| UI Web | 5 | 82 | 4,10 | Moyenne | Design dashboard et contrats dark mode ; pas de contrôle visuel direct |
| UX Web | 5 | 80 | 4,00 | Moyenne | Workflows complets ; écrans/formulaires très volumineux |
| UI Mobile | 5 | 83 | 4,15 | Moyenne | Composants et correctifs visuels testés ; pas de device dans cet audit |
| UX Mobile | 5 | 81 | 4,05 | Moyenne | Couverture métier importante ; parité opérationnelle volontairement partielle |
| SEO | 5 | 82 | 4,10 | Moyenne | Métadonnées, JSON-LD, robots et sitemap ; données dynamiques omises si API indisponible au build |
| Performance | 4 | 76 | 3,04 | Moyenne | Build acceptable ; bundles et composants lourds, polling présent |
| Scalabilité | 4 | 67 | 2,68 | Moyenne-haute | Mongo/API structurés ; cron et Socket.IO non distribués |
| Maintenabilité | 3 | 69 | 2,07 | Haute | Tests et services solides ; gros fichiers, warnings et accumulation documentaire |
| Tests / Qualité | 4 | 91 | 3,64 | Haute | 2 805 tests locaux verts plus preuve Mongo 1 310/1 310 |
| Observabilité / Résilience | 2 | 65 | 1,30 | Moyenne | Liveness/readiness et arrêt gracieux ; télémétrie centralisée incomplète |
| Accessibilité | 1 | 75 | 0,75 | Moyenne | Attributs ARIA/accessibility présents ; aucun audit WCAG automatisé prouvé |
| Release readiness | 2 | 80 | 1,60 | Moyenne | Worktree/CI/build verts ; runtime production et Doctor non certifiés |
| **Total** | **100** |  | **82,42** |  |  |

Calcul : somme de `note × poids / 100` = **82,42**.

Échelle utilisée : 90–100 excellent/certifiable ; 80–89 bon et production viable ; 70–79 acceptable sous dette ; 60–69 fragile ; moins de 60 critique.

## Synthèse par surface

| Surface | Score indicatif | Confiance | Verdict |
|---|---:|---|---|
| Web | 81 / 100 | Moyenne | Solide, SEO structuré, dette de taille et validation visuelle manquante |
| Mobile | 83 / 100 | Moyenne-haute | Tests et contrats solides, runtime device non rejoué |
| Backend | 85 / 100 | Haute | Robuste et très testé, prêt pour une instance ; horizontalisation à sécuriser |
| Règles métier | 88 / 100 | Haute | Couverture convaincante des invariants critiques |
| Sécurité | 84 / 100 | Haute | Bonne défense applicative ; durcissement navigateur et opérationnel à achever |
| Cohérence inter-plateformes | 84 / 100 | Moyenne-haute | Domaines majeurs alignés, partage de contrats insuffisant |
| Scalabilité | 67 / 100 | Moyenne-haute | Principal frein stratégique actuel |
| Risque de dette technique | 58 / 100 | Haute | Risque modéré : dette connue, testée, mais concentrée dans de gros modules |

## Radar textuel

```text
Architecture          84  █████████████████░░░
Sécurité              84  █████████████████░░░
Backend/API           86  █████████████████░░░
Data/Mongo            88  ██████████████████░░
Règles métier         88  ██████████████████░░
Cohérence             84  █████████████████░░░
UI/UX Web             81  ████████████████░░░░
UI/UX Mobile          82  ████████████████░░░░
SEO                   82  ████████████████░░░░
Performance           76  ███████████████░░░░░
Scalabilité           67  █████████████░░░░░░░
Maintenabilité        69  ██████████████░░░░░░
Tests/Qualité         91  ██████████████████░░
Observabilité         65  █████████████░░░░░░░
Accessibilité         75  ███████████████░░░░░
Release readiness     80  ████████████████░░░░
```

## Preuves exécutées

| Gate | Résultat | Détail |
|---|---|---|
| Graphe d'architecture | Vert | 475 fichiers, 1 580 dépendances internes, 0 nouveau manquement, 0 cycle connu |
| Lint backend | Vert | 0 erreur, 103 avertissements |
| Tests backend locaux | Vert | 141 suites, 1 582 tests, 0 échec |
| Suite Mongo exhaustive récente au même HEAD | Vert | 131 suites, 1 310 tests, 0 échec, replica set ; preuve déjà certifiée |
| Lint web | Vert | 0 erreur, 267 avertissements |
| Tests web | Vert | 106 fichiers, 763 tests, 0 échec |
| Build Next | Vert | Compilation et 144 pages statiques générées ; quatre fetchs SSG ont échoué sans faire échouer le build |
| Validation mobile | Vert | syntaxe, lint, types, 55 suites et 460 tests verts |
| Expo Doctor | Non confirmé | Registre npm inaccessible ; aucune installation autorisée |
| `git diff --check` initial | Vert | Aucun défaut d'espacement |

Les tests applicatifs locaux totalisent **2 805 tests verts** (1 582 backend + 763 web + 460 mobile). La preuve Mongo exhaustive de 1 310 tests est une campagne distincte et recoupe une partie du backend ; elle n'est donc pas additionnée artificiellement au total.

## Architecture et frontières

Le dépôt suit un monolithe modulaire pragmatique : routes Express, contrôleurs, services, modèles Mongoose et modules transversaux. Les garde-fous automatiques sont un acquis important : aucune nouvelle violation, aucun cycle connu et aucun import statique non résolu ont été détectés.

Dette résiduelle mesurée par le garde-fou : 2 dépendances service→contrôleur, 1 contrôleur→contrôleur, 12 route→modèle réparties sur 11 routes, et 199 contrôleur→modèle. Ces arêtes sont connues plutôt que cachées, mais montrent que la couche applicative n'est pas encore uniformément séparée.

Le dossier `shared` centralise réellement le registre de navigation consommé par le web, le mobile et le backend. Il ne porte cependant pas encore les DTO, statuts métier, erreurs et contrats d'événements majeurs. La cohérence repose donc encore largement sur des tests parallèles et des conventions.

Les plus gros fichiers observés incluent `GestionLocativePage.jsx` (2 772 lignes), `DetailAnnonceScreen.jsx` (2 422), `PublierBienScreen.jsx` (1 732), `PropertyDetailPage.jsx` (1 713), `PropertyForm.jsx` (1 219), `propertyController.js` (1 210) et `accommodationController.js` (1 105). Ce sont les foyers prioritaires de risque de changement, pas une invitation à un refactor massif.

## Sécurité, IAM et multi-tenant

### Points solides

- JWT vérifié avec `tokenVersion`, état actif et contrôles de suspension/bannissement.
- Distinction opérateur plateforme / utilisateur tenant, résolution de contexte et couverture de scénarios cross-tenant.
- CORS par allowlist, limites JSON, Helmet, compression et sanitation Mongo.
- Rate limiting sur l'authentification et les surfaces publiques sensibles.
- Autorisation de conversation et d'hôtel également contrôlée au niveau Socket.IO.
- Tests nombreux sur les réponses 401, 403, 409 et 422.
- Aucun fichier `.env` opérationnel suivi ; seuls les exemples sont versionnés. Aucun secret de production ou clé privée n'a été démontré.
- Workflow mobile avec contrôle empêchant l'ajout accidentel de credentials.

### Dettes et pénalités

- Helmet désactive explicitement `contentSecurityPolicy` et `crossOriginEmbedderPolicy`. La CSP absente réduit la défense en profondeur contre l'injection côté navigateur.
- Le handler global `OPTIONS` utilise `cors()` séparément de l'allowlist principale, ce qui mérite un contrat unique et testé.
- Les secrets, rotations, IAM cloud, règles réseau et sauvegardes de production ne sont pas observables depuis ce dépôt : confiance opérationnelle limitée.
- Le modèle d'attribution tenant est hétérogène — tenant direct, propriétaire ou ressource parente — ce qui augmente le coût de preuve malgré les correctifs horizontaux récents.

**Conclusion sécurité :** aucune brèche P0 prouvée ; posture applicative bonne, avec durcissement navigateur et vérification opérationnelle encore nécessaires.

## Backend, API et données

Le backend couvre les domaines immobilier, gestion locative, hébergement, hôtellerie, finance, CRM, communications et administration. Les services extraits, les serializers et les helpers de scope réduisent les contrôleurs transversaux. `/api/health` fournit une liveness et `/api/ready` vérifie explicitement l'état Mongo, avec 503 si la dépendance n'est pas prête. Un arrêt gracieux ferme Mongo avec délai de sécurité.

La couche Mongo est mature : 106 modèles, de nombreux index déclarés, contraintes uniques ciblées, tests d'idempotence, de concurrence et de finance. La campagne Mongo exhaustive au HEAD courant a produit 1 310/1 310 tests verts. L'adéquation des index aux requêtes de production reste néanmoins non certifiée sans `explain`, métriques lentes et cardinalités réelles.

Quelques requêtes restent non bornées ou volontairement exhaustives : listes propriétaire/locataire, certaines catégories/chambres/hôtels, exports et listes propriétaire. La détection de doublons CRM charge les clients actifs puis construit des paires, ce qui présente un coût quadratique. La pagination existe dans de nombreux modules mais n'est pas systématique.

## Matrice des domaines métier

| Domaine | API | Web | Mobile | Tenant/RBAC | Tests | État |
|---|---|---|---|---|---|---|
| Altimmo / immobilier | Complet | Complet | Complet | Fort | Fort | Sain |
| Gestion locative | Complet | Complet | Portail ciblé | Fort | Fort | Sain, parité mobile partielle assumée |
| Hébergements | Complet | Gestion/modération | Recherche/réservation | Fort | Fort | Sain |
| Hôtellerie | Complet | Création/opérations/modération | Recherche/opérations ciblées | Fort | Fort | Sain |
| Finance/paiements | Complet | Administration | Parcours ciblés | Fort | Fort | Sensible mais bien couvert |
| Messagerie | Complet + Socket | Complet | Complet | Fort | Fort | Cohérent |
| Notifications | Complet | Complet | Complet | Fort | Fort | Cohérent |
| CRM / marketing | Complet | Administration | Limité | Contrôlé | Bon | Dette de volume |
| Altcom | Complet | Public/admin | Limité | Contrôlé | Bon | Sain |
| Mila Events | Complet | Public/admin | Limité | Contrôlé | Bon | Sain |
| Utilisateurs / IAM | Complet | Complet | Complet | Central | Fort | Sain |
| Dashboard / modération | Agrégats/services | Complet | Ciblé | Fort | Fort | Sain |

La non-parité de certaines fonctions d'administration sur mobile n'est pas une incohérence : les intentions de canal diffèrent. Le risque réel est plutôt la duplication des statuts, payloads et règles d'affichage hors du registre partagé.

## Web : UI, UX, SEO et accessibilité

Le web utilise Next App Router avec 171 pages, métadonnées structurées, composants dashboard et contrats de thème sombre. Le build produit 144 pages statiques et les tests couvrent notamment les formulaires, la modération, l'inbox et les contrastes récents. Le socle est cohérent, mais les écrans métier très volumineux ralentissent l'évolution et rendent les régressions visuelles plus difficiles à isoler.

Le SEO dispose de `metadataBase`, métadonnées par domaine, URL canoniques, Open Graph, robots, sitemap et JSON-LD (`LocalBusiness`, `RealEstateListing`, `Offer`, breadcrumbs et locations). Environ 151 fichiers de page sur 171 contiennent une déclaration de métadonnées ou une génération dynamique. `robots.txt` bloque les zones privées et référence le sitemap.

Risque SEO principal : le sitemap dynamique et certaines générations statiques dépendent de l'API. Pendant le build, quatre appels ont échoué avec `ECONNREFUSED`, tout en laissant le build vert. Le sitemap peut alors omettre silencieusement les propriétés, événements ou portfolios dynamiques. Cette dégradation doit devenir visible et contrôlée dans la chaîne de release.

L'accessibilité est présente dans le code — usages ARIA côté web et propriétés d'accessibilité côté mobile — mais des éléments cliquables non natifs et des images sans preuve systématique d'alternative subsistent. Aucun audit Axe/Lighthouse/WCAG complet n'a été démontré. La note ne constitue donc pas une certification de conformité.

## Mobile : UI, UX et cohérence

Le mobile Expo/React Native couvre les parcours majeurs : authentification, annonces, détails, favoris, partage, visites, messagerie, notifications, profil, réservations et opérations métier ciblées. La validation complète a passé syntaxe, lint, types et 460 tests. Les correctifs récents d'images, de visites double rôle et de workflows disposent de contrats dédiés.

Les principaux risques sont la taille de plusieurs écrans, les avertissements de dépendances de hooks, les logs de debug présents dans le code et des tests React qui signalent encore des mises à jour non enveloppées dans `act`. Aucun appareil réel ni parcours tactile n'a été exécuté dans cet audit ; l'évaluation visuelle reste donc prudente.

## Performance et scalabilité

### État actuel

- Shared JS Next autour de 103 kB ; plusieurs routes métier se situent approximativement entre 193 et 255 kB au premier chargement.
- Home autour de 210 kB, dashboard autour de 255 kB et détail immobilier autour de 224 kB.
- Polling présent sur plusieurs dashboards, notifications et fallbacks de messagerie.
- Certaines listes et exports peuvent croître sans limite applicative uniforme.
- Les gros composants augmentent le coût de rendu, de test et de découpage de bundle.

### Limites horizontales

1. Les tâches cron (IMAP, visites, expirations, paiements et synchronisations) sont enregistrées dans le processus serveur. Sans élection de leader ni verrou distribué démontré, chaque réplique peut exécuter les mêmes effets.
2. La présence Socket.IO repose sur une `Map` en mémoire et aucun adaptateur Redis/distribué n'a été trouvé. Plusieurs instances n'auront pas une vue commune des connexions et rooms.
3. Le CRM de rapprochement de doublons a une trajectoire quadratique.
4. Le sitemap et le SSG dépendent d'une API disponible au moment du build.
5. La configuration DNS forcée dans le processus serveur réduit la portabilité de l'environnement.

**Premier point de rupture probable à 10× :** duplication des jobs et incohérence temps réel dès le passage à plusieurs instances, avant même la saturation CPU générale.

## Maintenabilité et dette

- 17 marqueurs TODO/FIXME apparentés seulement : la dette n'est pas massivement cachée sous ces marqueurs.
- En revanche, 575 usages de `console` dans les sources augmentent le bruit et exposent l'absence d'une politique de logs homogène.
- Les lints sont sans erreur mais totalisent au moins 370 avertissements web/backend, auxquels s'ajoutent les avertissements mobile.
- Les dépendances React/Next cohabitent avec des vestiges React Router, Vite et Helmet, signe d'une transition historique qui mérite une trajectoire claire.
- `server/docs` contient environ 992 fichiers, dont environ 595 rapports/audits/hotfix/certifications. Cette traçabilité est utile mais dégrade la découvrabilité et doit être indexée/archivée.
- Les garde-fous d'architecture et la densité de tests limitent fortement le risque de cette dette : elle est contrôlée, pas inexistante.

## Observabilité et résilience

Points positifs : liveness, readiness Mongo, logs structurés dans plusieurs services, arrêt gracieux et tests des erreurs. Le mobile initialise Sentry.

Lacunes : aucune instrumentation Sentry/APM équivalente n'a été démontrée pour le web et le serveur, ni métriques RED, tracing distribué, SLO, tableaux d'alerte ou preuve de restauration. Le handler `unhandledRejection` journalise sans arrêter le processus, ce qui peut laisser vivre un état potentiellement corrompu. Les cron internes ne fournissent pas de preuve centrale d'unicité et de retard.

## Top 10 des forces

1. Suites de tests étendues et réellement vertes sur les trois surfaces.
2. Campagne Mongo exhaustive au HEAD courant, incluant les scénarios sensibles.
3. Garde-fous d'architecture automatiques et dette mesurée explicitement.
4. Isolation tenant et RBAC couverts horizontalement.
5. Domaines métier riches sans fragmentation prématurée en microservices.
6. Services d'application, serializers et helpers de scope en progression.
7. Readiness Mongo distincte de la liveness.
8. SEO multi-domaines et données structurées substantielles.
9. Registre de navigation partagé entre web, mobile et serveur.
10. CI dédiée au lint, tests, E2E, Mongo et validation mobile.

## Top 10 des faiblesses

1. Cron embarqués sans verrou distribué visible.
2. État Socket.IO en mémoire sans adaptateur multi-instance.
3. Très gros fichiers UI et contrôleurs.
4. Observabilité serveur/web incomplète.
5. CSP explicitement désactivée.
6. Pagination et bornage non uniformes ; algorithme CRM quadratique.
7. Contrats partagés limités principalement à la navigation.
8. Nombre élevé d'avertissements lint/hook et de logs console.
9. Build SEO capable de réussir avec données dynamiques manquantes.
10. Documentation de sprint volumineuse et peu hiérarchisée.

## Matrice des risques

| ID | Risque | Probabilité | Impact | Priorité | Preuve / condition |
|---|---|---|---|---|---|
| R1 | Jobs exécutés plusieurs fois en multi-instance | Haute | Critique | P1 | Cron dans le processus, aucun verrou distribué trouvé |
| R2 | Présence/messages incohérents entre instances | Haute | Élevé | P1 | Map mémoire, aucun adaptateur Socket distribué trouvé |
| R3 | Pages dynamiques absentes du sitemap/build | Moyenne | Élevé | P1 | Build vert malgré 4 `ECONNREFUSED` |
| R4 | Faible détection des incidents serveur/web | Moyenne | Élevé | P1 | APM/tracing/SLO non démontrés |
| R5 | Coût CRM quadratique à forte cardinalité | Moyenne | Élevé | P2 | Comparaison des paires de clients actifs |
| R6 | XSS avec défense en profondeur réduite | Faible-moyenne | Élevé | P2 | CSP désactivée ; sanitation applicative présente |
| R7 | Régression dans gros composants | Moyenne | Moyen | P2 | Plusieurs fichiers > 1 000 lignes |
| R8 | Requêtes/listes coûteuses | Moyenne | Moyen | P2 | Pagination hétérogène et exports exhaustifs |
| R9 | Régression de hooks/stale closures | Moyenne | Moyen | P2 | Nombreux avertissements exhaustive-deps |
| R10 | Écart production/local inconnu | Moyenne | Élevé | P1 | Aucun accès runtime/observabilité production |

## Feuille de route recommandée

### Horizon 0–30 jours — sécuriser l'exploitation

1. Sortir les jobs planifiés du processus HTTP ou introduire un verrou/leader distribué, avec idempotence et métriques.
2. Déployer un adaptateur Socket.IO distribué et externaliser présence/rooms.
3. Rendre bloquante ou explicitement dégradée l'indisponibilité des données dynamiques au build/sitemap.
4. Instrumenter serveur et web : erreurs, latence, débit, saturation, traces et alertes.
5. Définir et tester une CSP progressive en mode report-only, puis enforcement.

### Horizon 1–3 mois — réduire les foyers de dette

1. Caractériser puis découper les dix plus gros fichiers par cas d'usage, sans refactor global.
2. Uniformiser pagination, limites, exports asynchrones et budgets de requête.
3. Remplacer la comparaison CRM quadratique par des clés/index de rapprochement.
4. Étendre `shared` aux statuts, DTO, schémas de validation et erreurs inter-plateformes.
5. Réduire les avertissements de hooks et centraliser les logs structurés.
6. Indexer et archiver les rapports de sprint dans une documentation navigable.

### Horizon 3–12 mois — préparer 100×

1. Isoler les workers de notifications, synchronisation, paiements, IMAP et tâches lourdes via une file durable.
2. Définir SLO, tests de charge, budgets de performance et exercices de restauration.
3. Vérifier les index avec `explain` sur jeux de données représentatifs et métriques production.
4. Mettre en cache les lectures publiques et SEO avec invalidation explicite.
5. Envisager l'extraction de services uniquement pour les domaines présentant une contrainte de charge ou d'autonomie démontrée ; conserver le reste en monolithe modulaire.

## Réponses aux 20 questions stratégiques

1. **La plateforme est-elle production viable ?** Oui, sur une topologie maîtrisée et après validation de l'environnement effectif ; cet audit ne certifie pas la production.
2. **Existe-t-il un P0 ?** Aucun P0 démontré.
3. **Quel est le plus grand risque sécurité ?** Le manque de preuve opérationnelle, puis la CSP désactivée ; l'isolation tenant applicative est plutôt une force.
4. **Quel est le plus grand risque métier ?** Les effets dupliqués des jobs/paiements/synchronisations lors d'une horizontalisation non préparée.
5. **Quel est le plus grand risque data ?** Une requête ou détection non bornée face à une cardinalité réelle inconnue.
6. **Le multi-tenant est-il crédible ?** Oui, grâce aux scopes et tests horizontaux ; son modèle d'attribution reste hétérogène.
7. **Le RBAC est-il crédible ?** Oui, avec contrôles API et temps réel largement testés.
8. **Les règles financières sont-elles assez protégées ?** Le code et les tests d'idempotence/concurrence donnent une confiance élevée ; la supervision runtime reste à prouver.
9. **Le backend est-il trop couplé ?** Pas dangereusement, mais les arêtes legacy et contrôleurs→modèles doivent continuer à décroître.
10. **Faut-il passer aux microservices ?** Non. Les besoins immédiats sont workers, file, cache et temps réel distribué, pas une décomposition générale.
11. **Le web est-il cohérent ?** Oui, malgré des vestiges de frameworks et de gros composants.
12. **Le mobile est-il cohérent avec le web ?** Oui sur les parcours clients majeurs ; les fonctions administratives ne recherchent pas toutes la parité.
13. **Le SEO est-il mature ?** Bon techniquement, mais fragile lorsque l'API est indisponible pendant le build.
14. **Les performances sont-elles satisfaisantes ?** Acceptables sans preuve de charge ; plusieurs bundles et traitements doivent être budgétés.
15. **L'accessibilité est-elle certifiée ?** Non. Des pratiques existent, aucun audit WCAG complet n'est prouvé.
16. **Les tests donnent-ils confiance ?** Oui, fortement, tout en notant l'absence de taux de couverture consolidé et de runtime production.
17. **Que cassera en premier à 10× ?** L'unicité des cron et la cohérence Socket.IO sur plusieurs instances.
18. **Que cassera en premier à 100× ?** Les tâches synchrones/non bornées, le CRM quadratique, les exports et les lectures publiques sans stratégie de cache/file.
19. **Quelle dette faut-il traiter d'abord ?** La dette opérationnelle distribuée avant la dette esthétique ou le découpage des fichiers.
20. **Peut-on livrer le HEAD audité ?** Conditionnellement : gates locaux verts, mais Expo Doctor, secrets/env, index, migrations éventuelles et smoke tests production doivent être vérifiés par la release réelle.

## Readiness actuelle, 10× et 100×

| Niveau | État | Conditions |
|---|---|---|
| Charge actuelle | **PRÊT SOUS CONTRÔLE** | Une instance ou jobs garantis uniques, env/index/smoke tests validés |
| 10× | **CONDITIONNEL** | Jobs distribués, Socket adapter, observabilité, pagination et tests de charge |
| 100× | **NON PRÊT** | Workers/file durable, cache, partitionnement des charges, SLO et optimisation data |

## Top 5 des actions à plus fort rendement

1. Garantir l'unicité et l'observabilité de tous les jobs planifiés.
2. Distribuer Socket.IO et l'état de présence.
3. Installer une observabilité web/backend avec SLO et alertes actionnables.
4. Fermer la réussite silencieuse du build SEO lorsque l'API dynamique est indisponible.
5. Borner les requêtes et réduire le CRM quadratique avant croissance des données.

## Décision finale

**GO ARCHITECTURAL CONDITIONNEL.**

Le socle actuel est bon, les mécanismes de sécurité métier sont crédibles et la qualité automatisée est supérieure à la moyenne d'un monolithe de cette taille. La prochaine étape ne doit pas être une réécriture : elle doit sécuriser l'exploitation distribuée, rendre les dégradations visibles et réduire quelques hotspots mesurés.

**Score final : 82,42 / 100 — C, plateforme saine avec dette technique contrôlée.**

Aucun correctif, migration, installation, commit, push ou déploiement n'a été effectué dans le cadre de cet audit.
