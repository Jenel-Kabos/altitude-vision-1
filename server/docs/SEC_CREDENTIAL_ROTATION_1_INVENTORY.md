# SEC-CREDENTIAL-ROTATION-1 — Inventaire des credentials exposés

Date : 2026-08-12
Référence : `server/docs/PREP_2_RECHECK_REPORT.md` (fingerprints SHA-256 tronqués, aucune valeur affichée)

Méthode : historique Git (`git show`, `git log --all --follow`) sur `.env` (racine, tracké du commit `2b25924` au commit `2400fa1`, 2026-02-03 → 2026-07-17) et `altimmo-app/.env` (tracké jusqu'au même commit `2400fa1`), plus `getZohoOrgId.js` (commit `3b4c3ea`). Recherche élargie effectuée pour d'autres fichiers `.env*` trackés (`client/.env` : jamais tracké — confirmé) et d'autres noms de secrets usuels (NEXTAUTH, Sentry auth token, Expo token) : aucun autre fichier de secrets trouvé dans l'historique au-delà des deux `.env` déjà identifiés.

## Table principale

| Credential | Provider | Historical exposure | Current fingerprint same? | Runtime consumers | Rotation required | Impact |
|---|---|---|---|---|---|---|
| `ZOHO_CLIENT_ID` | Zoho OAuth | CONFIRMED (`.env` 2026-02-03→07-17, `getZohoOrgId.js` commit `3b4c3ea`) | SAME | `getZohoTokenManual.js`, `getZohoOrgId.js`, `server/config/email.js`, `server/services/zohoMailService.js` | À déterminer côté Zoho (souvent inchangé si seul le secret est régénéré) | Ré-authentification OAuth app |
| `ZOHO_CLIENT_SECRET` | Zoho OAuth | CONFIRMED | SAME | mêmes fichiers | **Oui, obligatoire** | Compromission possible du flux OAuth email |
| `ZOHO_REFRESH_TOKEN` | Zoho OAuth | CONFIRMED | SAME | mêmes fichiers | **Oui, obligatoire** | Accès direct à la mailbox `contact@altitudevision.agency` (lecture/envoi) tant que valide |
| `ZOHO_ACCOUNT_ID` | Zoho Mail | CONFIRMED | SAME | `server/services/zohoMailService.js` | Non rotatable en tant que tel (identifiant de compte, pas un secret) — dépend de la recréation ou non de l'app | Faible seul (nécessite les autres valeurs pour être exploité) |
| `ZOHO_IMAP_PASSWORD` | Zoho Mail (IMAP) | CONFIRMED | DIFFERENT (déjà changé) | `services/zohoImapService.js` (via config) | Déjà fait — à confirmer que l'ancien mot de passe d'application est bien révoqué côté Zoho | Faible résiduel |
| `ZOHO_FROM_EMAIL` | Zoho Mail | CONFIRMED | DIFFERENT (déjà changé) | multiples (`emailService.js`, contrôleurs) | Non applicable (déjà changé, non secret en soi) | Aucun |
| `JWT_SECRET` | Interne (auth) | CONFIRMED | SAME | `server/socket.js`, `server/middleware/authMiddleware.js`, `server/utils/generateToken.js`, `server/controllers/authController.js`, `scripts/health.js` (présence seulement), `server/scripts/start-accommodation-e2e.js`, `server/scripts/verifyAltcomSetup.js` | **Oui, obligatoire** | Falsification de session possible tant que valide ; rotation invalide TOUTES les sessions actives (attendu et acceptable, cf. section JWT du runbook) |
| `CLOUDINARY_API_KEY` | Cloudinary | CONFIRMED | SAME | `server/config/cloudinary.js` | **Oui, obligatoire** | Upload/suppression d'assets non autorisés sur le compte `dop8vzm5z` |
| `CLOUDINARY_API_SECRET` | Cloudinary | CONFIRMED | SAME | `server/config/cloudinary.js` | **Oui, obligatoire** | idem |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary | CONFIRMED (non secret) | SAME (attendu — identifiant, pas un secret) | `server/config/cloudinary.js`, `server/config/cloudinaryProductionFingerprint.js`, `client/lib/services/publiciteService.js` (public, `NEXT_PUBLIC_*`), `altimmo-app/src/services/annonceService.js` (public) | Non — c'est un identifiant public, pas un secret ; ne pas changer sans raison métier | Aucun risque de sécurité direct |
| `FACEBOOK_ACCESS_TOKEN` | Meta/Facebook | CONFIRMED | SAME | `server/scripts/sync-facebook.js` | **Oui, obligatoire** | Accès à la page/compte Facebook connecté (lecture posts, potentiellement publication selon le scope du token) |
| `CINETPAY_API_KEY` | CinetPay | CONFIRMED | SAME | `server/controllers/cinetpayController.js`, `server/controllers/paiementTransactionController.js` | **Oui, obligatoire** | Initiation de transactions de paiement frauduleuses potentielles |
| `CINETPAY_SITE_ID` | CinetPay | CONFIRMED | SAME | mêmes fichiers | À déterminer — souvent un identifiant de site, pas toujours rotatable seul ; voir section CinetPay du runbook | Faible seul, mais à traiter avec la clé API |
| `GOOGLE_MAPS_API_KEY` | Google Cloud | CONFIRMED (`altimmo-app/.env`) | SAME | `altimmo-app/app.config.js` (injection native au build EAS, pas `EXPO_PUBLIC_*`) | **Oui, obligatoire**, accompagnée de restrictions fournisseur (package Android/SHA, bundle iOS, API restreinte) | Abus de quota/facturation si non restreinte |
| `MONGO_URI` | MongoDB Atlas | CONFIRMED | **DIFFERENT** (déjà changé depuis l'exposition) | `server/config/db.js` et l'ensemble du backend (24 fichiers référencent `MONGO_URI`) | Déjà fait — révocation de l'ancien utilisateur Atlas à confirmer séparément (non vérifiable depuis cet environnement, aucune connexion Atlas effectuée) | Résiduel si l'ancien utilisateur Atlas n'a pas été supprimé/désactivé — à confirmer humainement |
| `ACCESS_TOKEN` (générique) | Inconnu/legacy | CONFIRMED | SAME | **Aucun consommateur trouvé dans le code actuel** (`grep` sur `process.env.ACCESS_TOKEN` : 0 résultat) | Recommandé par prudence si le fournisseur associé est identifiable, sinon documenter comme variable morte | Faible — non utilisée en runtime actuel, mais présence dans l'historique reste un secret potentiellement valide côté fournisseur inconnu |
| `DB_NAME`, `UPLOAD_PATH`, `MAX_FILE_SIZE`, `COMPANY_*`, `EMAIL_*` (ancien SMTP legacy), `FRONTEND_URL`, `PORT`, `NODE_ENV`, `REACT_APP_API_URL` | — | CONFIRMED exposition mais non-secrets ou déjà remplacés par l'architecture actuelle (`EMAIL_*` legacy remplacé par Zoho) | N/A | Aucun consommateur actuel pour `EMAIL_HOST`/`EMAIL_PASSWORD`/`EMAIL_USERNAME`/`EMAIL_PORT`/`EMAIL_FROM` (architecture SMTP legacy remplacée par Zoho) | Non | Aucun |

## Classification (section 6 de la mission)

| Credential | Classe |
|---|---|
| `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` / `ZOHO_REFRESH_TOKEN` / `ZOHO_ACCOUNT_ID` / `ZOHO_IMAP_PASSWORD` | D — OAuth/email |
| `JWT_SECRET` | A — authentification interne critique |
| `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | B — infrastructure/storage |
| `CLOUDINARY_CLOUD_NAME` | G — identifiant public, non secret |
| `FACEBOOK_ACCESS_TOKEN` | E — réseau social |
| `CINETPAY_API_KEY` / `CINETPAY_SITE_ID` | C — paiement |
| `GOOGLE_MAPS_API_KEY` | F — frontend/mobile natif, restreignable par fournisseur |
| `MONGO_URI` | A — authentification interne critique (accès base) |
| `ACCESS_TOKEN` (générique, inutilisé) | G — autre / dette d'hygiène |

## Secrets non exposés historiquement (vérifiés, à titre de complétude)

- `GOOGLE_CLIENT_SECRET` / `GOOGLE_CLIENT_ID` (NextAuth) : jamais présents dans `.env` racine historique ni dans `client/.env` (jamais tracké par Git — confirmé via `git ls-tree`). Aucune rotation requise par ce sprint.
- `NEXTAUTH_SECRET`, `SENTRY_AUTH_TOKEN`, `EXPO_TOKEN` : aucune trace dans l'historique Git (recherche `git log --all --diff-filter=A --name-only -- "*.env"` limitée aux deux fichiers déjà identifiés). Non concernés.
- `ZOHO_WEBHOOK_SECRET` : présent dans le code actuel (`process.env.ZOHO_WEBHOOK_SECRET`, 3 fichiers) mais absent de l'historique `.env` inventorié — probablement introduit après le nettoyage du 2026-07-17. Non concerné par une exposition historique confirmée, mais à vérifier par l'opérateur humain par prudence.

## Fichiers `.env` — statut de suivi Git actuel

| Fichier | Tracké par Git à HEAD ? | Historiquement tracké ? |
|---|---|---|
| `.env` (racine) | NON (`git ls-files` ne le liste pas) | OUI, commits `2b25924` → `2400fa1` |
| `server/.env` | NON | Non trouvé dans l'historique |
| `client/.env` | NON | Non trouvé dans l'historique |
| `altimmo-app/.env` | NON | OUI, jusqu'au commit `2400fa1` |

`.gitignore` couvre correctement `.env`, `.env.*` (racine et sous-dossiers), avec exceptions pour `*.env.example`. Rappel : cette couverture protège les commits futurs, pas les 8 (+6) commits historiques où ces fichiers étaient trackés — leur contenu reste lisible tant que l'historique n'est pas purgé (hors périmètre de ce sprint).

## `.env.example` — vérification placeholders

`  .env.example`, `client/.env.example`, `altimmo-app/.env.example` : tous les champs vérifiés sont vides (`CLE=`) ou contiennent uniquement de la documentation en commentaire. Aucun credential réel trouvé.
