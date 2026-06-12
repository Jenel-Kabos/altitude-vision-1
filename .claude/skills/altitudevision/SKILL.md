# Altitude Vision — Skill Guide
## Contexte du projet
Agence multidisciplinaire congolaise avec 3 pôles : Altimmo (immobilier), Mila Events (événementiel), Altcom (communication).

## Stack technique
- Frontend : Next.js 15 App Router + React 18 + Tailwind CSS
- Backend : Express.js + MongoDB (Mongoose)
- Hébergement : Vercel (frontend) + Render (backend)
- Stockage : Cloudinary (images/vidéos)
- Email : Zoho Mail (IMAP + SMTP)
- Mobile : React Native + Expo SDK 52

## Chemins importants
- Projet local : /Users/apple/Documents/Projet-gemini/altitude-vision-1/
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
- MONGO_URI : MongoDB Atlas
- JWT_SECRET, JWT_EXPIRES_IN
- ZOHO_FROM_EMAIL=contact@altitudevision.agency
- ZOHO_IMAP_PASSWORD, ZOHO_REFRESH_TOKEN
- ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET
- ZOHO_ACCOUNT_ID, ZOHO_API_DOMAIN
- CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET
- FACEBOOK_ACCESS_TOKEN
- CINETPAY_API_KEY, CINETPAY_SITE_ID
- FRONTEND_URL=https://altitudevision.agency

### Vercel (frontend)
- NEXT_PUBLIC_API_URL=https://altitude-vision.onrender.com/api
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
- NEXTAUTH_SECRET, NEXTAUTH_URL

## Modèles MongoDB (server/models/)
- User.js — rôles: admin/collaborateur/user/client/proprietaire
- Property.js — biens immobiliers
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
- POST /api/auth/login
- POST /api/auth/signup
- POST /api/auth/google
- GET  /api/users/me
- PATCH /api/users/:id/role
- GET/POST /api/properties
- GET/POST /api/events
- GET/POST /api/contrats
- GET/POST /api/proprietaires
- GET/POST /api/locataires
- GET/POST /api/paiements
- GET/POST /api/litiges
- GET /api/action-logs
- GET /api/export/contacts/csv
- POST /api/documents/bail/:id
- POST /api/documents/quittance/:id
- POST /api/paiements/initier (CinetPay)

## Rôles et permissions
- admin : accès complet
- collaborateur : peut ajouter, ne peut pas modifier/supprimer/valider/imprimer/payer
- user/client : accès site public
- proprietaire : publie des biens, a signé le contrat d'hébergement

## Composants dashboard importants
- client/lib/pages/dashboard/DashboardHome.jsx
- client/lib/pages/dashboard/GestionLocativePage.jsx
- client/lib/components/dashboard/DashboardSidebar.jsx
- client/lib/context/AuthContext.jsx

## App mobile Altimmo
- Dossier : altimmo-app/
- SDK : Expo 52 + React Native 0.76.9
- Build : EAS Build (APK Android)
- API : même backend que le site web
- Compte EAS : jenelkabos25

## Bugs connus et solutions
- Expo Go incompatible → utiliser EAS Build
- enableScreens(false) dans index.js pour éviter NativeStack errors
- ZOHO_FROM_EMAIL doit exister dans collection emails MongoDB avec isActive: true
- git stash avant git pull si conflits
- npm install --legacy-peer-deps pour altimmo-app/

## Conventions de code
- Tous les montants en FCFA
- Dates formatées en français
- Toast notifications pour les actions
- "use client" sur tous les composants React
- Tailwind CSS pour le styling frontend
- StyleSheet.create pour React Native

## Checklist avant chaque prompt
1. Vérifier si le fichier existe déjà
2. Ne pas recréer ce qui existe
3. Utiliser les mêmes composants UI
4. Respecter la palette de couleurs :
   - Or/doré : #C8960C
   - Noir : #0A0A0A
   - Blanc : #FFFFFF
5. Push après chaque modification
6. Toujours lancer npm run build:next avant de pusher le frontend
