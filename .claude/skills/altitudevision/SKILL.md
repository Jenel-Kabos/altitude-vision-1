---
name: altitudevision
description: Altitude Vision — Skill Guide
---

# Altitude Vision — Skill Guide

## Contexte du projet
Agence multidisciplinaire congolaise avec 3 pôles : Altimmo (immobilier), Mila Events (événementiel), Altcom (communication).

## Stack technique
- Frontend : Next.js 15 App Router + React 18 + Tailwind CSS
- Backend : Express.js + MongoDB (Mongoose)
- Hébergement : Netlify (frontend) + Render (backend)
- Stockage : Cloudinary (images/vidéos) — `multer.memoryStorage()` + stream
- Email : Zoho Mail (IMAP + SMTP)
- Mobile : React Native + Expo SDK 52

## Chemins importants
- Projet local : /Users/apple/Documents/GitHub/altitude-vision-1/
- Frontend : client/
- Backend : server/
- App mobile : altimmo-app/
- Logo : client/public/images/Logo_Altitude1.png

## URLs de production
- Frontend : https://altitudevision.agency
- Backend : https://altitude-vision.onrender.com
- API : https://altitude-vision.onrender.com/api
- GitHub : https://github.com/Jenel-Kabos/altitude-vision-1

## Variables d'environnement importantes
### Render (backend)
- MONGO_URI : MongoDB Atlas (le path doit contenir le nom de DB ; sinon Mongoose se connecte à `test`)
- JWT_SECRET, JWT_EXPIRES_IN
- ZOHO_FROM_EMAIL=contact@altitudevision.agency
- ZOHO_IMAP_PASSWORD, ZOHO_REFRESH_TOKEN
- ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET
- ZOHO_ACCOUNT_ID, ZOHO_API_DOMAIN
- CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
- FACEBOOK_ACCESS_TOKEN
- CINETPAY_API_KEY, CINETPAY_SITE_ID
- FRONTEND_URL=https://altitudevision.agency

### Netlify (frontend)
- NEXT_PUBLIC_API_URL=https://altitude-vision.onrender.com/api
- NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dop8vzm5z
- NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=lqwel6X6 (unsigned, mêmes valeurs que mobile hardcodé)
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
- NEXTAUTH_SECRET, NEXTAUTH_URL

## Modèles MongoDB (server/models/)
- User.js — enum roles: `['User', 'Client', 'Proprietaire', 'Collaborateur', 'Admin', 'Prestataire']`, default `'Client'`
- PendingRegistration.js — TTL index 24h (`expireAfterSeconds: 0`), email unique. Auth signup crée ici ; verifyEmail promeut → User
- Property.js — biens immobiliers. Champs : bedrooms, bathrooms, livingRooms, kitchens, surface, amenities[], constructionType, recommande, statusAdmin, address.arrondissement (anciennement `district`). Enum strict `type` : 9 valeurs (Appartement, Appartement meublé, Maison, Villa, Terrain, Bureau, Commerce, Studio, Entrepôt)
- Publicite.js — carrousel mobile. Champs : titre, media (URL Cloudinary), type (image/gif), lien, actif, ordre, pole
- Event.js — événements Mila Events
- Quote.js — devis
- Contrat.js — contrats location/vente
- Proprietaire.js — avec biensPropres[] et commodites{}
- Locataire.js
- Paiement.js — avec pénalités 3% dès le 6e jour
- ActionLog.js — historique des actions
- Litige.js — gestion des litiges
- InternalMail.js — messagerie interne

## Routes API importantes
- POST /api/auth/signup (rate-limited: 5/h) — crée une PendingRegistration, envoie email
- GET  /api/auth/verify-email/:token — promeut Pending → User, retourne JWT
- POST /api/auth/resend-verification (rate-limited: 3/10min)
- POST /api/auth/login | POST /api/auth/google
- GET  /api/users/me | PATCH /api/users/:id/role
- GET/POST /api/properties (POST web) | POST /api/properties/mobile (JSON pur, photos pré-uploadées Cloudinary)
- GET  /api/properties/recommended (public — biens marqués `recommande: true && statusAdmin: 'Validée'`, fallback top-10 par prix)
- PATCH /api/properties/:id/recommande (admin)
- GET/POST/PATCH/DELETE /api/publicites (admin sauf GET /active qui est public)
- GET  /api/publicites/active (public — filtré `pole: 'Altimmo'` en dur)
- GET/POST /api/events | GET/POST /api/contrats | GET/POST /api/proprietaires
- GET/POST /api/locataires | GET/POST /api/paiements | GET/POST /api/litiges
- GET  /api/action-logs | GET /api/export/contacts/csv
- POST /api/documents/bail/:id | POST /api/documents/quittance/:id
- POST /api/paiements/initier (CinetPay)

## Auth flow (à connaître)
1. Signup → bcrypt(12) → `PendingRegistration.findOneAndUpdate({email}, ..., {upsert})` → email envoyé (token hashé sha256)
2. VerifyEmail → `findOneAndDelete` atomique → `new User(...)` + `unmarkModified('password')` + `save({validateBeforeSave: false})` pour éviter double-hash → JWT retourné
3. Tokens invalidables globalement par incrément de `user.tokenVersion`
4. Reverse-proxy : `app.set('trust proxy', 1)` requis pour express-rate-limit (Render/Cloudflare)

## Rôles et permissions
- **Admin** : accès complet
- **Collaborateur** : peut ajouter, ne peut pas modifier/supprimer/valider/imprimer/payer
- **Client** / **User** : accès site public (default = Client depuis cette session)
- **Proprietaire** : publie des biens, a signé contrat d'hébergement (PDF généré)
- **Prestataire** : prestataire externe

Helpers dans AuthContext : `isAdmin`, `canAdd`, `canEdit`, `canDelete`, `canValidate` — tous basés sur `user?.role === 'Admin'`

## Sidebar dashboard — réalité
⚠️ La sidebar active **n'est PAS** `DashboardSidebar.jsx` (qui est du code mort orphelin). Le layout `client/app/dashboard/layout.jsx` délègue à `AdminDashboard.jsx` qui **inline sa propre sidebar** via une const `NAV_SECTIONS`.

- Fichier réel : `client/lib/pages/dashboard/AdminDashboard.jsx`
- Config : `NAV_SECTIONS` (array de `{ label, links: [{to, end, Icon, label, accent, badge, adminOnly}] }`)
- Filtrage rôle : `.filter(link => !link.adminOnly || user?.role === 'Admin')` au render
- Pour ajouter un lien admin : ajouter `adminOnly: true` sur l'entrée

## Composants dashboard importants
- client/lib/pages/dashboard/DashboardHome.jsx
- client/lib/pages/dashboard/AdminDashboard.jsx (sidebar inline)
- client/lib/pages/dashboard/ManagePropertiesPage.jsx (référence CRUD)
- client/lib/pages/dashboard/PublicitesPage.jsx
- client/lib/pages/dashboard/GestionLocativePage.jsx
- client/lib/context/AuthContext.jsx

## Constants partagés (mobile + web, jamais inventer)
- locations.js : `VILLES` (13 villes RC) + `ARRONDISSEMENTS` + `getArrondissementsFor(ville)`
- propertyTypes.js : `PROPERTY_TYPES` (9 valeurs, doivent matcher enum Property.type)
- amenities.js : `AMENITIES` (11 valeurs ; mobile = `{value, icon Ionicons}` ; web = `string[]`)

Chemins : `altimmo-app/src/constants/*.js` (mobile) | `client/lib/constants/*.js` (web)

## App mobile Altimmo
- Dossier : altimmo-app/
- SDK : Expo 52 + React Native 0.76.9
- Build : EAS Build (APK Android)
- API : même backend que le site web (baseURL hardcodée dans `services/api.js`)
- Compte EAS : jenelkabos25
- Cloudinary upload : preset unsigned `lqwel6X6`, cloud `dop8vzm5z` (`uploadToCloudinary` dans `annonceService.js`)
- Splash : `assets/Logo_Altitude_transparent.png` (config `app.json` ligne 11)
- `GOOGLE_MAPS_API_KEY` : lu directement (sans préfixe `EXPO_PUBLIC_`) par `app.config.js` → `android.config.googleMaps.apiKey`, injecté au moment du build EAS (pas à runtime JS), donc secret via `eas secret:create`, pas dans `eas.json` en clair
- Variables `EXPO_PUBLIC_*` réellement utilisées dans le code : `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SOCKET_URL` (déjà présentes dans `eas.json` profils preview/production — vérifier avec `grep -rhoE "EXPO_PUBLIC_[A-Z_]+"` avant d'en ajouter d'autres)
- `eas submit` (Play Store) nécessite un JSON de **compte de service** Google (`type: service_account`, `client_email` en `*.iam.gserviceaccount.com`) — **pas** un fichier `client_secret_*.apps.googleusercontent.com.json` (ça c'est un OAuth Client ID, différent, ne marche pas)
- Si l'org Google Cloud a la contrainte `iam.disableServiceAccountKeyCreation` active (policy de sécurité 2024+), la création de clé JSON est bloquée sans admin org policy → solution de repli : `eas build -p android --profile production` (ne nécessite pas de clé) puis upload manuel du `.aab` sur la Play Console (pas besoin de `eas submit`)

## Bugs connus et solutions
- Expo Go incompatible → utiliser EAS Build
- `src/utils/disableScreens.js` doit appeler `enableScreens(true)` (pas `false` — un `false` casse les safe areas/navigation au build natif)
- `metro.config.js` ne doit pas avoir de bloc `extraNodeModules` (source de bugs de résolution de modules)
- ZOHO_FROM_EMAIL doit exister dans collection `emails` MongoDB avec `isActive: true`
- git stash avant git pull si conflits
- `npm install --legacy-peer-deps` pour altimmo-app/
- Property.js a un encodage NBSP+CRLF qui rejette les Edit tool naïfs ; utiliser Python byte-replace si besoin
- DB de dev locale = base par défaut `test` si `MONGO_URI` n'a pas de DB path ; prod Render a sa propre DB → un `node` local peut renvoyer `[]` alors que prod retourne des résultats
- **Texte français en dur dans JSX (apostrophes)** : ne jamais mettre du texte contenant des apostrophes (l'Agence, d'accord, s'engage…) dans une string délimitée par des `'` simples — ça casse le parsing Babel/Metro (`Unexpected token`). Utiliser des template literals (backticks) pour tout bloc de texte français long. Idem pour `{'\n'}` : ne jamais laisser un retour à la ligne brut à l'intérieur des quotes (`Unterminated string constant`), toujours écrire `{'\n'}` sur une seule ligne.
- Vu en prod (RegisterScreen.jsx, juil. 2026) : le texte du contrat de mandat (articles 1-8) avait ces deux bugs combinés, qui faisaient planter tout le build EAS Android (`Android Bundling failed`, `SyntaxError: Unterminated string constant`) sans jamais avoir été catché en local.

## Conventions de code
- Tous les montants en FCFA
- Dates formatées en français
- Toast notifications pour les actions (`react-hot-toast` web ; `Alert` mobile)
- `"use client"` sur tous les composants React qui utilisent des hooks
- Tailwind CSS pour le styling frontend
- StyleSheet.create pour React Native
- Pas de mocks DB dans les tests (incident passé — toujours intégration sur vraie DB)
- French UI text partout

## Pattern auto-scroll carrousel mobile
Référence : `AdCarousel.jsx` (pleine largeur) ou `RecommendedCarousel.jsx` (cards 150px) :
- `useRef` pour `listRef` + `intervalRef` + `indexRef` (préférer ref à state pour éviter re-render)
- `setInterval` qui appelle `listRef.current?.scrollToOffset({offset, animated})`
- `onScrollBeginDrag={stopAutoScroll}` + `onScrollEndDrag={startAutoScroll}`
- Condition de démarrage `items.length > N` selon le contexte
- `useEffect(..., [items.length])` retourne `stopAutoScroll` au cleanup

## Checklist avant chaque prompt
1. Vérifier si le fichier existe déjà
2. Ne pas recréer ce qui existe (constants/, models/, services/ — souvent déjà là)
3. Utiliser les mêmes composants UI (PropertyForm, ConfirmDialog, etc.)
4. Respecter la palette de couleurs :
   - Or/doré : #C8960C (mobile : `colors.gold`)
   - Bleu : #185FA5 (mobile : `colors.blue`)
   - Noir : #0A0A0A
   - Blanc : #FFFFFF
5. Push après chaque modification
6. Toujours lancer npm run build:next avant de pusher le frontend
