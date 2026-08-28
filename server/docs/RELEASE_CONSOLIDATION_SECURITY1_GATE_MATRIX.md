# RELEASE-CONSOLIDATION-SECURITY-1 — Matrice des gates

| Gate | Résultat |
|---|---|
| Security cluster (27 suites HZ/HF/RBAC/Message-Read-Authority/P0/P1/FCA1-01/FCA1-02) | **27/27 suites, 278/278 tests** (réutilisé depuis `SECURITY_CLOSURE_TARGETED_VALIDATION1`, HEAD/diff inchangés depuis) |
| Backend complet (`npm run test:unit`) | **141/141 suites, 1579/1579 tests** — identique à la baseline |
| Mongo exhaustif (`npm run test:mongo`) | **128/128 suites, 1280/1280 tests** (rejeu final propre — voir investigation ci-dessous) |
| Architecture (`npm run architecture:check`) | **PASS** — 473 files, 1571 edges, 0 cycle, 0 unresolved, **0 nouvelle violation** |
| Lint backend (`npm run lint`) | **0 erreur, 108 warnings** — identique à la baseline |
| Lint frontend (`npm run lint` dans `client/`) | **0 erreur, 267 warnings** — nouvelle mesure, aucune baseline antérieure communiquée pour ce gate |
| Build frontend (`npm run build:next`) | **PASS**, exit code 0, toutes les routes compilées |
| Tests frontend (`npm test` / Vitest) | **101 fichiers passés / 2 échoués, 745/749 tests** — voir « Tests frontend en échec » ci-dessous |
| Lint mobile (`npm run lint` dans `altimmo-app/`) | **0 erreur, 118 warnings** (pattern `console.log` pré-existant) |
| Tests mobile (`npm run test:coverage`) | **50/50 suites, 430/430 tests** |
| diff-check | 4 avertissements CRLF pré-existants uniquement, aucun nouveau |
| Code modifié par ce mandat | **`.gitignore` uniquement** (2 lignes, fix APK — voir `_BASELINE.md`) |

## Investigation du gate Mongo exhaustif (transparence complète, §20/§28 du mandat)

**1er passage** : durée anormale de **3h34** (baseline habituelle ~33 min). Résultat : 126/128 suites passées, **2 suites en échec** :
- `realEstateReservationTenantAuthority.mongo.integration.test.js` (durée rapportée : 4420s, soit 73 min pour une suite qui prend normalement 15-20s) — **fait partie du diff de ce mandat** (test permanent FCA1-02).
- `rentalDocumentDownload.mongo.integration.test.js` (durée rapportée : 6397s, soit 106 min) — **ne fait PAS partie du diff** de cette session (fichier jamais touché).

**Cause du 1er échec examinée** : les deux échecs sont des `Exceeded timeout of 180000 ms for a test` (timeout générique Jest), pas des échecs d'assertion logique. Aucun processus zombie trouvé cette fois (contrairement à l'incident de `SECURITY-CLOSURE-TARGETED-VALIDATION-1`), mais `uptime` a montré une charge système élevée (load average 3.6-4.6) pendant toute la durée du run, avec une activité disque/CPU macOS anormale (Preview, QuickLook, AirDrop actifs). Le fait qu'une suite totalement étrangère au diff (`rentalDocumentDownload`) échoue exactement de la même façon, au même moment, est la preuve déterminante qu'il s'agit d'une contention de ressources système, pas d'une régression de code.

**Rejeu isolé** (les 2 suites en échec, seules, replica set dédié) : **2/2 suites passées, 24/24 tests**, en quelques secondes chacune — confirme que le code est correct et que l'échec initial était un artefact de charge.

**Rejeu complet final** (les 128 suites, système redescendu à une charge normale ~2.6-3.1) : **128/128 suites, 1280/1280 tests, 100 % vert**. Ce résultat, propre et reproductible deux fois de suite (rejeu isolé + rejeu complet), est retenu comme résultat final du gate.

**Conclusion** : aucune régression. Incident purement environnemental, documenté et résolu par nouvelle exécution (aucune modification de code ni de test).

## Tests frontend en échec (4/749) — investigation complète, pré-existants et non liés au diff

| Test | Fichier | Cause | Pré-existant à HEAD ? |
|---|---|---|---|
| « affiche un skeleton structuré pendant le chargement » | `ManageAccommodationsPage.test.jsx` | Le composant a deux états de chargement distincts (`isFirstLoad` → spinner sans `role="status"` ; chargement ultérieur → grille squelette avec `role="status"`) ; le test cible le 1er état, qui ne porte jamais ce rôle. | **Oui** — logique `isFirstLoad` et markup identiques à `git show HEAD`, non touchés par le diff de cette session. |
| « affiche une erreur accessible et permet de réessayer » | `ManageAccommodationsPage.test.jsx` | Le composant n'a jamais eu de `role="alert"` sur son message d'erreur. | **Oui** — confirmé absent à `git show HEAD` également. |
| « déplace les vues opérationnelles vers la route détail préfiltrée » | `ManageAccommodationsPage.test.jsx` | Le mock `next/link` du fichier de test (`vi.mock('next/link', ...)`) ne transmet pas la prop `title`, qui est le seul moyen d'exposer un nom accessible "Voir" sur le lien (icône seule, sans texte). | **Oui** — mock identique à `git show HEAD`. |
| « archive via le cycle de vie hôtelier et retire ensuite la carte » | `ManageHotelsPage.test.jsx` | `vi.fn()` jamais appelée avec l'ID attendu — `ManageHotelsPage.jsx`/`.test.jsx` n'ont subi **aucune modification** de toute cette session (`git log -1` pointe sur HEAD lui-même). | **Oui**, par construction (fichier jamais touché). |

**Conclusion** : les 4 échecs sont une dette préexistante du dépôt, complètement indépendante de tout travail de cette session (campagne sécurité incluse). Ce n'est **pas** une régression introduite par ce diff, donc ce n'est **pas** un motif de blocage au sens du mandat (§60 : ne pas bloquer sur une dette connue non liée au diff). **Signalé transparentement comme dette à traiter dans un futur sprint**, pas balayé sous le tapis.

## Anomalie corrigée pendant ce mandat

`altimmo-app/build-1787511872437.apk` (149 Mo, non tracké, sans protection `.gitignore`) — voir `_BASELINE.md` pour le détail exact du fix (2 lignes ajoutées à `.gitignore`). Confirmé disparu de `git status` après correction.
