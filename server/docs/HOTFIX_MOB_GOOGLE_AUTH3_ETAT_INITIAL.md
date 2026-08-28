# HOTFIX-MOB-GOOGLE-AUTH-3 — ÉTAT INITIAL

Branche : `main`. HEAD au démarrage : `a04055f62952c782b92aeef2f100824a17a5f645` ("Update Altimmo 40") — inchangé depuis `HOTFIX-MOB-GOOGLE-AUTH-2`.

`git status --short` (32 lignes) montre le même travail en cours non lié à cette session que documenté dans `HOTFIX_MOB_GOOGLE_AUTH2_ETAT_INITIAL.md` (chantier `ARCH2A`/`ARCH2B`, APK de test), plus les 6 documents produits par `HOTFIX-MOB-GOOGLE-AUTH-2`. **Rien de tout cela n'est touché par cet audit.**

`git diff --check` : exit 0.

## Nature de ce mandat

Audit **pur, en lecture seule**. Aucun fichier ne sera créé ou modifié hors des 6 documents listés dans les livrables. Aucun client OAuth, aucune variable d'environnement, aucune configuration Google Cloud/EAS ne sera modifiée. Aucun commit/push/déploiement.

## Contexte apporté par l'utilisateur (à vérifier, pas à supposer vrai)

Deux projets Google Cloud contiendraient des clients OAuth Android pour le même package `com.altitudevision.altimmo` :
- **Projet 1 "Altitude Vision"** — préfixe `872164120879-`, SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` (= SHA-1 du build gradle local, qui fonctionne).
- **Projet 2 "My First Project"** — préfixe `3869205293-`, SHA-1 `62:49:CC:78:71:E9:43:E4:2E:1E:C9:4C:69:40:CA:F2:2B:E9:26:D6` (= SHA-1 du build EAS, qui échoue avec `DEVELOPER_ERROR`).

Ces deux SHA-1 avaient déjà été extraits et documentés de façon indépendante par `HOTFIX-MOB-GOOGLE-AUTH-2` (lecture directe des certificats via `apksigner`/`keytool`, aucune supposition). Ce qui est **nouveau et non encore vérifié par le code** dans ce tour : l'existence du second projet Google Cloud "My First Project" et l'affirmation que le SHA-1 EAS y est déjà enregistré sous un préfixe `3869205293-`. Cet audit vérifie tout ce qui est vérifiable depuis le dépôt de code, et marque explicitement `NON CONFIRMÉ` tout ce qui nécessiterait un accès direct à Google Cloud Console (non disponible dans cette session).
