# RELEASE-CONSOLIDATION-SECURITY-1 — Matrice des variables d'environnement

Aucune valeur réelle n'est reproduite ci-dessous. « Local known » signifie que la variable existe dans un `.env`/`.env.local` non tracké sur cette machine — sans lecture de sa valeur.

## Backend (`server/`)

| Variable | Requis | Public/Secret | Local known | Vérification production |
|---|---|---|---|---|
| MONGO_URI | Oui | Secret | Oui (`.env`) | MANUAL CHECK REQUIRED (Render) |
| JWT_SECRET | Oui | Secret | Oui | MANUAL CHECK REQUIRED (Render) |
| JWT_EXPIRES_IN | Oui | Public | Oui | MANUAL CHECK REQUIRED (Render) |
| ZOHO_FROM_EMAIL | Oui | Public | Oui | MANUAL CHECK REQUIRED (Render) |
| ZOHO_IMAP_PASSWORD | Oui | Secret | Oui | MANUAL CHECK REQUIRED (Render) |
| ZOHO_REFRESH_TOKEN | Oui | Secret | Oui | MANUAL CHECK REQUIRED (Render) |
| ZOHO_CLIENT_ID | Oui | Secret | Oui | MANUAL CHECK REQUIRED (Render) |
| ZOHO_CLIENT_SECRET | Oui | Secret | Oui | MANUAL CHECK REQUIRED (Render) |
| ZOHO_ACCOUNT_ID | Oui | Secret | Oui | MANUAL CHECK REQUIRED (Render) |
| ZOHO_API_DOMAIN | Oui | Public | Oui | MANUAL CHECK REQUIRED (Render) |
| CLOUDINARY_CLOUD_NAME | Oui | Public | Oui | MANUAL CHECK REQUIRED (Render) |
| CLOUDINARY_API_KEY | Oui | Secret | Oui | MANUAL CHECK REQUIRED (Render) |
| CLOUDINARY_API_SECRET | Oui | **Secret (jamais confondre avec le cloud name)** | Oui | MANUAL CHECK REQUIRED (Render) |
| FACEBOOK_ACCESS_TOKEN | Oui | Secret | Oui | MANUAL CHECK REQUIRED (Render) |
| CINETPAY_API_KEY | Oui | Secret | Oui | MANUAL CHECK REQUIRED (Render) |
| CINETPAY_SITE_ID | Oui | Public | Oui | MANUAL CHECK REQUIRED (Render) |
| FRONTEND_URL | Oui | Public | Oui | MANUAL CHECK REQUIRED (Render, CORS) |

Note : `server/.env.example` n'existe pas dans le dépôt (lacune préexistante, non introduite par cette session).

## Frontend (`client/`)

| Variable | Requis | Public/Secret | Local known | Vérification production |
|---|---|---|---|---|
| NEXT_PUBLIC_API_URL | Oui | Public | Oui | MANUAL CHECK REQUIRED (Netlify) |
| NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME | Oui | Public (jamais un secret) | Oui | **MANUAL CHECK REQUIRED (Netlify)** — cause racine du hotfix Cloudinary déjà documenté ; désormais un garde-fou fail-fast existe côté code si absent, mais la variable production reste à confirmer manuellement |
| NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET | Oui | Public (unsigned preset, jamais un secret) | Oui | MANUAL CHECK REQUIRED (Netlify) |
| GOOGLE_CLIENT_ID | Oui | Public | Oui | MANUAL CHECK REQUIRED (Netlify) |
| GOOGLE_CLIENT_SECRET | Oui | Secret | Oui | MANUAL CHECK REQUIRED (Netlify) |
| NEXTAUTH_SECRET | Oui | Secret | Oui | MANUAL CHECK REQUIRED (Netlify) |
| NEXTAUTH_URL | Oui | Public | Oui | MANUAL CHECK REQUIRED (Netlify) |

`client/.env.example` confirmé présent et cohérent (gabarit vide, pas de valeur réelle trackée).

## Mobile (`altimmo-app/`)

| Variable | Requis | Public/Secret | Local known | Vérification production |
|---|---|---|---|---|
| EXPO_PUBLIC_API_URL | Oui | Public | Oui | MANUAL CHECK REQUIRED (profils EAS) |
| EXPO_PUBLIC_SOCKET_URL | Oui | Public | Oui | MANUAL CHECK REQUIRED (profils EAS) |
| GOOGLE_MAPS_API_KEY | Oui (build EAS uniquement, jamais runtime JS) | Public (restreint par bundle/package Google Cloud) | Oui | MANUAL CHECK REQUIRED (secret EAS) |

`altimmo-app/.env.example` confirmé présent et cohérent.

## Conclusion

Toutes les variables nécessaires au code sont identifiées et cohérentes avec le code actuel. **Aucune vérification de leur valeur réelle en production (Netlify/Render/EAS) n'est possible depuis cet environnement local** — chaque ligne ci-dessus reste `MANUAL CHECK REQUIRED`, conformément au mandat (§80 : ceci ne bloque pas la « code readiness », seulement la « production-config readiness »).
