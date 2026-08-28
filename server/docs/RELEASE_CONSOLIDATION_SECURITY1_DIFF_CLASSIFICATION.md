# RELEASE-CONSOLIDATION-SECURITY-1 — Classification et hygiène du diff

## Résumé des catégories (§8 du mandat)

| Catégorie | Nombre approx. |
|---|---|
| A. PRODUCTION-BACKEND | ~62 (48 modifiés + 14 nouveaux) |
| B. PRODUCTION-FRONTEND | ~10 |
| C. PRODUCTION-MOBILE | 1 |
| D. SECURITY-TEST | ~55 |
| E. FUNCTIONAL-TEST | ~35 |
| F. DOCUMENTATION | 556 |
| G. CONFIGURATION | 3 (`.gitignore`, `server/package.json`, `scripts/local-ci.js`) |
| H. SCRIPT/TOOLING | ~7 |
| I. GENERATED | ~11 (captures d'écran Playwright dans `client/e2e/*/`) |
| J. TEMPORARY | 1 (APK, désormais exclu par `.gitignore`, non commitable) |
| K. UNKNOWN | **0** |

Tous les fichiers ont une provenance identifiée. Aucun fichier n'est resté en catégorie K.

## Artefacts temporaires / générés (§13-14 du mandat)

- **`altimmo-app/build-1787511872437.apk` (149 Mo)** — seul artefact anormal trouvé. Résolu par ajout de `.gitignore` (voir `_BASELINE.md`). Fichier laissé sur disque (non supprimé — aucune suppression physique n'a été faite, conformément à l'interdiction de supprimer sans preuve/validation), simplement exclu du suivi Git.
- Captures d'écran Playwright dans `client/e2e/accommodationSearchBar1/` et `client/e2e/inbox2/` : fichiers `I.GENERATED` légitimes (référence visuelle de tests E2E), taille normale, non anormaux.
- Aucun `*.tmp`/`*.bak`/`*.orig`/`*.rej`/`*.log`/`*.dump`, aucun dossier `coverage/`/`dist/`/`build/`/`node_modules/` dans le diff.

## Secrets (§15-16 du mandat)

- Recherche de motifs `(api_key|secret|password|token)[:=]"…"` dans le diff : un seul résultat, une chaîne de test `'test-password'` assignée à `process.env.ZOHO_IMAP_PASSWORD` dans `server/__tests__/zohoImapService.test.js` — placeholder de test, pas un secret réel.
- Recherche d'URI Mongo avec identifiants embarqués : aucun résultat.
- Fichiers `.env*` : aucun nouveau fichier `.env*` non tracké détecté dans le diff (seuls des `.env.example` — gabarits vides — sont trackés pour `client/` et `altimmo-app/`). `server/.env.example` n'existe pas du tout (lacune préexistante, non introduite par cette session, sans rapport avec la campagne sécurité — à traiter séparément si souhaité).
- **Conclusion : 0 secret exposé dans le diff.**

## Debug code (§38 du mandat, fichiers modifiés uniquement)

Recherche de `console.log`/`console.error`/`debugger`/`TODO`/`FIXME`/`HACK` ajoutés dans les 90 fichiers modifiés : **0 résultat**. Aucun code de debug accidentel.

## Dépendance à NODE_ENV==='test' (§39 du mandat)

Recherche dans les fichiers modifiés : **0 résultat**. Aucun correctif de sécurité ne dépend d'un mode test pour sa correction réelle.

## Duplication / fichiers morts (§37 du mandat)

Aucune duplication de service/contrôleur/route détectée dans le périmètre de ce diff. Le refactor ARCH2 a précisément pour objet d'extraire (pas de dupliquer) la logique métier des contrôleurs vers des services dédiés — vérifié cohérent avec l'architecture checker (0 nouvelle violation `controller→controller`/`service→controller`).

## Schema / migration (§22-23 du mandat)

- **Un seul nouveau modèle** : `server/models/ImapSyncCheckpoint.js` — nouvelle collection additive, index composé unique auto-créé par Mongoose au premier usage, aucun backfill nécessaire (collection vide au démarrage, remplie progressivement par le poller IMAP). Sans rapport avec la campagne sécurité.
- **Aucune modification** de schéma existant (`required`, `enum`, `default`, `unique`, `partialFilterExpression`) détectée dans le diff.
- **Aucune migration** n'est nécessaire avant ou après déploiement.

## Contrats API (§20-21 du mandat)

Vérifié pour les deux blockers sécurité fermés (FCA1-01, FCA1-02), seuls changements de comportement HTTP introduits par cette session :
- `POST /api/contrats` : payload/réponse de succès inchangés ; nouveau chemin de refus utilise le même format `{status:'fail', message}` déjà utilisé par les erreurs existantes du même endpoint (`PROPERTY_NOT_FOUND`, `CONTRACT_TYPE_MISMATCH`). Vérifié cohérent avec `client/lib/services/gestionLocativeService.js`.
- `GET/POST /api/real-estate-applications/reservations/:id[/cancel]` : réponse de succès inchangée ; nouveau chemin de refus utilise le même format déjà utilisé sur ces mêmes endpoints. Vérifié cohérent avec `client/lib/services/realEstateApplicationService.js` ET `altimmo-app/src/services/realEstateApplicationService.js`.

**Aucun breaking change** identifié pour le frontend ou le mobile sur ces deux endpoints. Le reste du diff (ARCH2, hotfixs métier) ne modifie aucune forme de payload/réponse observable côté client (extractions internes uniquement).
