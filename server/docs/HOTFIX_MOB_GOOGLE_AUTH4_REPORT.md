# HOTFIX-MOB-GOOGLE-AUTH-4 — RAPPORT

**Verdict actuel : READY FOR MANUAL MIGRATION.**

La Phase A (revalidation) confirme qu'aucun élément de l'audit `HOTFIX-MOB-GOOGLE-AUTH-3` n'a changé. La Phase B détermine, à partir du message d'erreur Google Cloud rapporté par l'utilisateur ("le nom du package Android et son empreinte sont déjà utilisés"), qu'il n'existe qu'une seule procédure viable : supprimer le client Android orphelin dans "My First Project" puis en recréer un équivalent dans "Altitude Vision". Cette procédure est documentée pas à pas dans `HOTFIX_MOB_GOOGLE_AUTH4_MIGRATION_PROCEDURE.md`. **Aucune action Google Cloud n'a été exécutée par cette session — action humaine requise avant de poursuivre.**

## Réponses aux questions du mandat (état actuel, avant migration exécutée)

- **Quel projet OAuth est canonique ?** Altitude Vision (`872164120879-…`) — confirmé, inchangé depuis AUTH-3.
- **Quel projet contenait le SHA-1 EAS avant migration ?** My First Project (`3869205293-…`), client nommé "altitudevision altimmo" — rapporté par l'utilisateur, cohérent avec toutes les preuves de code.
- **Quel projet le contient après migration ?** **NON APPLICABLE POUR L'INSTANT** — la migration n'a pas encore été exécutée dans cette session.
- **Quel package a été utilisé ?** `com.altitudevision.altimmo` — confirmé, inchangé.
- **Quel SHA-1 a été utilisé ?** `62:49:CC:78:71:E9:43:E4:2E:1E:C9:4C:69:40:CA:F2:2B:E9:26:D6` — confirmé, inchangé.
- **Quel `webClientId` le mobile utilise-t-il ?** `872164120879-fnllca3lavaintq499hr7rbjjvcrgj3k.apps.googleusercontent.com` — confirmé, inchangé, revérifié en Phase A.
- **Quel client le backend attend-il ?** `GOOGLE_CLIENT_ID` local, préfixe `872164120879-…`, cohérent — la valeur runtime Render (production) reste **NON CONFIRMÉE**, question distincte héritée de `HOTFIX-BACK-GOOGLE-AUTH-401-1`, non résolue par ce hotfix.
- **Un fichier de code a-t-il été modifié ?** **Non** — 4 documents créés uniquement, aucun fichier de production touché.
- **Un nouveau build a-t-il été nécessaire ?** **Non, et aucun n'est prévu** — le build EAS déjà installé (`build-1787511872437.apk` ou équivalent) sera retesté sans reconstruction (voir `HOTFIX_MOB_GOOGLE_AUTH4_POST_MIGRATION_TEST.md`, justification technique incluse : seule la table de correspondance Google Cloud change, jamais le package/certificat embarqué).
- **`DEVELOPER_ERROR` a-t-il disparu ?** **NON CONFIRMÉ** — dépend de l'exécution de la migration par l'utilisateur, pas encore réalisée.
- **Google Sign-In natif fonctionne-t-il ?** **NON CONFIRMÉ** — idem.
- **Le backend accepte-t-il le token ?** **NON CONFIRMÉ** — idem, et dépend en plus de la question ouverte Render.
- **Une session Altimmo est-elle créée ?** **NON CONFIRMÉ**.
- **La navigation post-login fonctionne-t-elle ?** **NON CONFIRMÉ**.
- **La session survit-elle au redémarrage de l'application ?** **NON CONFIRMÉ**.

## Ce qui a été livré dans ce tour

1. **Phase A — Revalidation** (`HOTFIX_MOB_GOOGLE_AUTH4_ETAT_INITIAL.md`) : confirmation qu'aucun changement n'est survenu depuis `HOTFIX-MOB-GOOGLE-AUTH-3`, tests de régression Google rejoués (21/21 verts).
2. **Phase B — Procédure de migration** (`HOTFIX_MOB_GOOGLE_AUTH4_MIGRATION_PROCEDURE.md`) : détermination that la suppression-puis-recréation est la seule voie possible (Google ne permet pas de "déplacer" un client OAuth entre projets, confirmé par la contrainte d'unicité package+SHA-1 rapportée par l'utilisateur), procédure numérotée précise (22 étapes) avec valeurs exactes à utiliser, clients à ne jamais toucher, gestion des échecs.
3. **Grille de test post-migration** (`HOTFIX_MOB_GOOGLE_AUTH4_POST_MIGRATION_TEST.md`) : 14 étapes de vérification device sans rebuild, grille de verdict (`CERTIFIÉ VERT` / `NON RÉSOLU` / `PROGRESSION CONFIRMÉE` / `GO SOUS RÉSERVES`).
4. **Rollback** (`HOTFIX_MOB_GOOGLE_AUTH4_ROLLBACK.md`) : chemins de secours pour chaque point d'échec possible de la procédure Google Cloud, aucun impact code dans tous les cas.

## Tests de non-régression

Aucun fichier de production modifié → aucun nouveau test créé artificiellement (conformément au mandat §12 : "si aucun fichier n'est modifié, ne pas créer artificiellement de nouveaux tests"). Rejoués par prudence : `googleSignIn.test.js` (17/17) et `googleProjectAlignment.test.js` (3/3) — 21/21 verts. `git diff --check` : exit 0. Lint/typecheck non exécutés (aucun changement de code à valider).

## STOP — en attente d'action humaine

Conformément au mandat : aucun client OAuth supprimé, aucun projet Google Cloud modifié, aucune variable de production modifiée, aucun build EAS lancé, aucun commit/push/déploiement. **La procédure numérotée de `HOTFIX_MOB_GOOGLE_AUTH4_MIGRATION_PROCEDURE.md` doit être exécutée manuellement par l'utilisateur dans Google Cloud Console.** Une fois confirmée, le test post-migration (`HOTFIX_MOB_GOOGLE_AUTH4_POST_MIGRATION_TEST.md`) pourra être mené sur le device réel, et ce rapport sera mis à jour avec le verdict final (`CERTIFIÉ VERT`, `NON RÉSOLU`, ou `PROGRESSION CONFIRMÉE — NOUVELLE CAUSE À AUDITER`) selon le résultat observé.
