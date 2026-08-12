# Provisionnement d'un environnement Cloudinary sandbox — guide opérateur humain

Ce document décrit une action **humaine**, hors du dépôt et hors de portée de tout agent automatisé : ce dernier ne doit jamais créer de compte Cloudinary, inventer des identifiants, ni utiliser le compte de production comme substitut. Sans cette action, `CLOUDINARY-SANDBOX-CERT-1` reste bloqué (`BLOCKED — CLOUDINARY SANDBOX REQUIRED`).

## Pourquoi un sandbox distinct est nécessaire

Le moteur de migration legacy (`legacyAssetMigrationService.js`) n'a jamais été prouvé contre un vrai compte Cloudinary — uniquement contre des mocks. La seule preuve valable doit se faire sur un environnement Cloudinary **réellement séparé** de la production (`cloud_name` différent de `dop8vzm5z`, l'unique compte actuellement configuré dans ce dépôt, utilisé par le site et l'application mobile en production). Aucun dossier, preset ou sous-espace de ce même compte ne constitue une isolation suffisante.

## Étapes

1. **Créer un compte Cloudinary distinct.** Le plan gratuit ("Free") de Cloudinary suffit très largement pour ce besoin (quelques fichiers jetables, quelques dizaines de Ko/Mo au total). Ne jamais réutiliser le compte existant de ce projet.
2. **Récupérer son `cloud_name`.** Visible sur le tableau de bord Cloudinary du nouveau compte.
3. **Récupérer sa `API Key`.**
4. **Récupérer son `API Secret`.**
5. **Vérifier que `cloud_name` ≠ `dop8vzm5z`.** C'est la garde principale de tout le dispositif — si les deux valeurs sont identiques, tous les outils sandbox refuseront systématiquement (`CLOUDINARY_SANDBOX_PRODUCTION_COLLISION`), par construction.
6. **Ajouter localement, dans `server/.env`** (jamais commité — déjà couvert par `.gitignore`) :
   ```
   CLOUDINARY_SANDBOX_CLOUD_NAME=<cloud_name du nouveau compte>
   CLOUDINARY_SANDBOX_API_KEY=<API Key du nouveau compte>
   CLOUDINARY_SANDBOX_API_SECRET=<API Secret du nouveau compte>
   CLOUDINARY_SANDBOX_CONFIRM=YES
   ```
   `CLOUDINARY_SANDBOX_CONFIRM=YES` est une confirmation explicite et volontaire — sa valeur doit être exactement `YES`, rien d'autre ne sera accepté.
7. **Ne jamais envoyer ces secrets dans Git**, dans un ticket, dans un message, dans un log ou dans un rapport. `server/.env` est déjà ignoré par Git (`.gitignore`) ; ne créez aucun autre fichier contenant ces valeurs en clair.
8. **Exécuter le preflight local**, qui ne fait aucun appel réseau :
   ```
   node server/scripts/checkCloudinarySandbox.js
   ```
   Résultat attendu : `"verdict": "SANDBOX CONFIGURATION VALID"` (code de sortie `0`). Toute autre sortie indique précisément ce qui manque (`CLOUDINARY_SANDBOX_NOT_CONFIGURED`, `CLOUDINARY_SANDBOX_INVALID_CONFIG`, `CLOUDINARY_SANDBOX_CONFIRMATION_REQUIRED`, ou `CLOUDINARY_SANDBOX_PRODUCTION_COLLISION`).
9. **Seulement après ce PASS**, reprendre le sprint `CLOUDINARY-SANDBOX-CERT-1` — c'est à ce moment-là que le script de certification réseau (non encore créé, voir `CLOUDINARY_SANDBOX_PROVISION_1_AUDIT.md` §5) sera écrit et exécuté, exclusivement contre ce nouveau compte.

## Important — isolation de process

Le SDK Cloudinary Node conserve sa configuration dans une variable globale au niveau du module, partagée par tout code qui l'importe dans le même process. Concrètement : **le futur script de certification devra être exécuté comme un process Node autonome**, qui n'importe jamais `server/config/cloudinary.js` (production) ni aucun contrôleur/route qui le charge, même transitivement. `server/config/cloudinarySandbox.js` détecte et refuse cette situation automatiquement (`CLOUDINARY_SANDBOX_PROCESS_ISOLATION_REQUIRED`), mais la meilleure protection reste de ne jamais mélanger les deux dans un même script.

## Capacités à vérifier lors de la certification réelle (pas supposées ici)

Le plan Cloudinary Free devrait couvrir upload, `rename` avec changement de `type` (`upload` → `authenticated`), suppression (`destroy`), et livraison `authenticated` avec URL signée courte — mais cela n'a jamais été vérifié empiriquement pour ce compte spécifique. La certification réelle (`CLOUDINARY-SANDBOX-CERT-1`) devra confirmer chacune de ces capacités avant de s'appuyer dessus, jamais les supposer disponibles.
