# Sécurité et environnements mobiles

Les variables `EXPO_PUBLIC_*` sont intégrées en clair au bundle. Elles ne doivent contenir
que des identifiants publics: URL API/Socket, DSN Sentry public, identifiants OAuth publics
et numéro de contact. Les secrets JWT, MongoDB, Cloudinary, OAuth serveur, SMTP, paiement
et administration restent exclusivement sur le backend.

## Environnements EAS

Créer les variables sur le tableau de bord Expo ou avec `eas env:create`, puis associer
chaque profil à `development`, `preview` ou `production` via le champ `environment`.
Ne pas placer de secret dans `eas.json`. Pour le développement local, copier
`.env.example` vers `.env.local`.

Variables mobiles attendues:

- `EXPO_PUBLIC_APP_ENV`
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SOCKET_URL`
- `EXPO_PUBLIC_SENTRY_DSN`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_WHATSAPP_NUMBER`
- `GOOGLE_MAPS_API_KEY` (configuration native publique, restreinte au package/bundle)

Les valeurs précédemment suivies doivent être révoquées ou renouvelées côté MongoDB,
JWT, Cloudinary, Zoho, Facebook, Google Maps et tout autre fournisseur concerné.
L’historique Git n’est pas réécrit dans cette mission.

## Sentry

Le token d’upload de source maps doit être fourni uniquement au job CI/EAS autorisé.
La configuration mobile supprime les corps de requête, cookies, en-têtes
`Authorization` et données utilisateur autres que l’identifiant technique.
