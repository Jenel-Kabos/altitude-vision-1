# PREP-2 — Baseline d'audit pré-production

Date : 12 août 2026  
Dépôt : `/Users/apple/Documents/GitHub/altitude-vision-1`

## Worktree avant toute correction PREP-2

- Worktree multi-sprints non commité préservé.
- 117 fichiers suivis modifiés au relevé PREP-2, 1 734 insertions et 637 suppressions dans le diff suivi.
- Nombreux fichiers non suivis attendus des sprints Storage/Tenant précédents, dont leurs tests et rapports.
- `git diff --check` : exit 0 ; sept avertissements CRLF→LF, aucune erreur whitespace.
- Aucun APK/AAB, dump, clé PEM ou fichier log suivi trouvé par l'inventaire ciblé.
- Les `.env` locaux sont ignorés par Git ; aucune de leurs valeurs n'a été affichée.

## Environnements et configuration

- Backend local : variables Mongo/JWT/Cloudinary/Zoho/paiement présentes, valeurs non inspectées dans le rapport.
- Web local : API, NextAuth, Google OAuth et paramètres Cloudinary présents.
- Mobile local : API/socket, paiement, Sentry, Maps présents.
- Netlify impose Node 20 et construit le client Next.js.
- GitHub Actions utilise Node 20.
- Backend déclare `engines.node >=20.0.0` ; client/mobile ne déclarent pas d'engine.
- Node local : v24.15.0 ; npm 11.12.1. Cette version locale satisfait le minimum mais diffère du runtime CI/Netlify Node 20.
- Java local : Temurin 26.0.1 ; wrapper Android : Gradle 9.3.1. La compatibilité EAS distante reste à vérifier par build EAS, non exécuté localement.
- EAS production pointe vers l'API/Socket HTTPS configurée et produit un app bundle Android.

## Secret scanning — constat bloquant

Le fichier suivi `getZohoOrgId.js` contient trois credentials OAuth Zoho codés en dur : client ID, client secret et refresh token. Les valeurs n'ont été ni affichées ni utilisées. Le fichier existe dans l'historique Git (`3b4c3ea`).

Classification : secret réel potentiellement exposé dans Git ; sévérité critique opérationnelle ; **NO-GO automatique jusqu'à révocation/rotation externe confirmée**, nettoyage du fichier courant et traitement de l'historique selon politique sécurité.

Les autres détections du scan ciblé sont des secrets de test explicitement situés dans `server/__tests__` ou le serveur E2E et doivent être classifiées séparément ; aucune valeur n'est reproduite ici.

## Sécurité/configuration observée

- `helmet` actif, CSP désactivée côté backend API.
- `trust proxy = 1`.
- JSON/urlencoded limités à 2 Mo.
- `express-mongo-sanitize` actif.
- CORS allow-list + `FRONTEND_URL`, credentials autorisés ; localhost reste dans la liste mais n'est pas requis par les URLs de production configurées.
- Rate limits présents pour signup, vérification, login, Google, reset password, estimation et API publique.
- Uploads Multer bornés en taille et nombre ; certaines routes utilisent `memoryStorage`, avec un maximum pouvant atteindre 15 × 100 Mo, risque mémoire à réévaluer.

## Baseline sécurité antérieure

Verdict entrant : `MULTI-TENANT APPLICATION LAYER CERTIFIED — LEGACY CLOUDINARY STORAGE EXCEPTION`.

Exceptions/limitations entrantes : URLs Cloudinary legacy publiques, patch drift Expo SDK 57, précédent Playwright 33/34 corrigé par RCA, PlatformOperator global fail-closed.

## Stratégie PREP-2

1. Audits npm et Expo.
2. Remédiation minimale du fichier credential courant, sans prétendre révoquer les secrets.
3. Gates complètes fraîches Backend/Web/Mobile/E2E.
4. Audit opérationnel backups/restore/monitoring/jobs/migrations.
5. Runbook, registre des risques et verdict fondé sur les preuves.
