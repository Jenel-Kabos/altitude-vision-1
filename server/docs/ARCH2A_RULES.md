# ARCH-2A — Règles de dépendances

## Périmètre

Le checker inspecte récursivement le code de production dans `routes`, `controllers`, `services`, `models`, `middleware`, `constants`, `utils` et `config`. Il accepte `.js`, `.cjs`, `.mjs`, les `require()` littéraux, imports/re-exports ESM et imports dynamiques littéraux. Tests, scripts, docs, fixtures, dépendances npm, artefacts générés, couverture et `node_modules` sont hors périmètre.

Les chemins relatifs sont normalisés au format POSIX. Une cible relative appartenant à une couche de production est conservée même si son fichier manque, afin qu'un import pendant ne contourne pas une règle. Les expressions comme `require(variable)` sont classées `STATICALLY UNRESOLVED`, sans destination inventée. Il n'existe pas d'alias backend constaté nécessitant une résolution personnalisée. Le checker n'est pas un parseur JavaScript sémantique : il ne résout ni calcul de chaîne, ni injection runtime, ni dépendance chargée par framework.

## Règles strictes

| Identifiant | Interdiction nouvelle | Motivation |
|---|---|---|
| `ARCH-LAYER-001` | service → controller | Un service métier ne dépend pas du transport HTTP. |
| `ARCH-LAYER-002` | controller → controller | L'orchestration partagée doit vivre dans un service/helper. |
| `ARCH-LAYER-003` | route → model | Le chemin cible est route → controller → service → model. |
| `ARCH-CYCLE-001` | nouveau cycle fort ou croissance du cycle connu | Une SCC nouvelle ou dont la signature change est une nouvelle dette. |

Chaque dette préexistante est autorisée par un couple source/cible exact dans `architecture/baseline.json`. Le calcul est `courant - baseline = nouvelles violations`. Une nouvelle violation échoue avec règle, source, cible et remédiation. Aucun mécanisme d'auto-baseline n'existe.

Le calcul inverse est également strict : une entrée devenue stale fait échouer le gate. Ainsi une dépendance corrigée ne peut pas revenir grâce à une allowlist oubliée.

## Règles progressives

Controller → model reste mesuré (202 arêtes), mais n'est pas encore interdit : ARCH-1 indiquait que 64 contrôleurs sur 78 utilisaient directement au moins un modèle. L'interdire globalement rendrait le repository rouge sans migration préalable. Les imports de `User`, `Property`, `PlatformTenant` et `Notification`, les adapters Finance, IAM, API publique et Dossier ne reçoivent aucune interdiction nouvelle.

## Frontière future, non appliquée

Lorsque `server/domains` existera, le contrat visé sera `domain A → public facade/index de domain B`, jamais vers ses modèles/services internes. ARCH-2A ne l'enforce pas et ne déplace aucun fichier.

## Exceptions futures

Une exception exige justification, revue architecturale, test et décision explicite (ADR seulement si cette pratique est adoptée). Ajouter silencieusement une ligne au baseline est interdit.
