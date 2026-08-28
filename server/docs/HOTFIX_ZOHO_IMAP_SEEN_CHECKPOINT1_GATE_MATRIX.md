# HOTFIX-ZOHO-IMAP-SEEN-CHECKPOINT-1 — Matrice des portes de qualité (gates)

| Gate | Commande | Résultat |
|---|---|---|
| Tests unitaires ciblés | `npx jest __tests__/zohoImapService.test.js --silent` (depuis `server/`) | **23/23 PASS** (10 pré-existants inchangés + 13 nouveaux) |
| Suite unitaire complète | `npm run test:unit` (depuis `server/`) | **141 suites / 1579 tests — PASS** |
| Frontières d'architecture | `npm run architecture:check` (depuis `server/`) | **PASS** — 0 nouvelle violation ; dette légale pré-existante inchangée (aucun nouvel edge introduit par ce hotfix : `ImapSyncCheckpoint` n'est référencé que par `zohoImapService.js`, un service, vers un modèle — un edge service→model, catégorie déjà tolérée) |
| Lint backend | `npm run lint` (depuis `server/`) | **0 erreur**, 108 warnings — tous pré-existants, aucun sur `zohoImapService.js`, `ImapSyncCheckpoint.js` ni le fichier de test modifié (vérifié par grep ciblé) |
| Whitespace du diff | `git diff --check` | 3 avertissements CRLF pré-existants sur des fichiers non touchés par ce mandat (`conversationController.js`, `internalMailController.js`, `emailRoutes.js` — issus de mandats antérieurs) ; **aucun avertissement sur les fichiers de ce mandat** |
| Git status | `git status --short` | Aucun commit/push/add effectué ; modifications présentes uniquement dans l'arbre de travail, conformément à la contrainte permanente |
| Mutation Zoho pendant les tests | Revue du code de test | **Aucune** — tous les tests utilisent `jest.mock('imapflow')` ; aucune connexion réseau réelle n'a lieu pendant `npm run test:unit` |
| Mutation Mongo de production | Revue du code de test | **Aucune** — `InternalMail`, `User`, `ImapSyncCheckpoint` sont tous mockés (`jest.mock`) dans la suite de tests |
| Secrets dans les logs | Revue de `logger.*` dans `zohoImapService.js` | Seul `account` (= `ZOHO_FROM_EMAIL`, une adresse email, pas un secret) apparaît dans les logs de checkpoint ; aucun mot de passe, token, ni contenu de message n'est jamais loggé |

## Verdict des gates

**Toutes les portes obligatoires sont vertes.** Aucune porte n'a nécessité de contournement (`--no-verify`, désactivation de test, etc.).
