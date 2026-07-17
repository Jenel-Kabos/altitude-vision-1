# Checklist de rotation des secrets

| Service | Secret | Risque | Action humaine | Variables à mettre à jour |
| --- | --- | --- | --- | --- |
| MongoDB | URI et mot de passe | Accès/altération des données | Révoquer l’utilisateur exposé, en créer un à privilèges minimaux | `MONGO_URI` |
| JWT | clé de signature | Usurpation de session | Générer une clé forte, invalider les sessions existantes | `JWT_SECRET`, éventuellement version de token |
| Cloudinary | secret API | Upload/suppression non autorisés | Renouveler le secret et auditer les transformations | `CLOUDINARY_API_SECRET`, clés backend |
| Zoho | secret OAuth, refresh token, IMAP/SMTP | Lecture/envoi de courriels | Révoquer sessions/app password et recréer les credentials | `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_IMAP_PASSWORD` |
| Facebook | access token | Accès aux pages/publications | Révoquer et générer un token limité | `FACEBOOK_ACCESS_TOKEN` |
| Google Maps | clé native | Quota/facturation abusive | Renouveler ou restreindre package, SHA et bundle | `GOOGLE_MAPS_API_KEY` |
| Google OAuth | clients/config historique | Détournement OAuth si secret présent ailleurs | Auditer les clients, supprimer credentials obsolètes, restreindre redirections | IDs publics mobile; secret uniquement backend |
| Sentry | DSN public / auth token | Pollution des événements / upload non autorisé | Conserver le DSN public si acceptable; révoquer tout auth token exposé | `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` CI seulement |
| Expo | access token | Builds/publications non autorisés | Révoquer tout token trouvé dans l’historique ou logs | `EXPO_TOKEN`/`EXPO_ACCESS_TOKEN` CI seulement |
| Paiement | clés CinetPay/autres | Transactions frauduleuses | Renouveler et maintenir exclusivement côté backend | Variables backend du fournisseur |
| SMTP/autres fournisseurs | mots de passe/tokens | Compromission de service | Inventorier l’historique et révoquer individuellement | Variables backend concernées |

Aucun secret serveur ne doit être ajouté au mobile. `EXPO_PUBLIC_*` contient uniquement
des URL, DSN public, identifiants OAuth publics et autres valeurs volontairement publiques.
