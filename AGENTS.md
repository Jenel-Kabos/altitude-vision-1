# Guide de Développement Altitude-Vision pour Agents IA

Ce document aide les agents IA de codage à être immédiatement productifs dans l'application stack MERN Altitude-Vision.

## 📋 Démarrage Rapide

### Installation
```bash
# Répertoire racine
npm install                 # Installer les dépendances partagées
cd server && npm install    # Installer les dépendances backend
cd ../client && npm install # Installer les dépendances frontend
```

### Lancer l'Application (Développement)
```bash
# Terminal 1 - Backend (port 5000)
cd server && npm run dev

# Terminal 2 - Frontend (port 3000)
cd client && npm run dev:next
```

### Build & Déploiement
- **Frontend**: `npm run build:next` → Déploiement sur Netlify (via netlify.toml)
- **Backend**: `npm start` → Déploiement sur Render
- **Base de données**: MongoDB Atlas (via variable MONGO_URI)

---

## 🏗️ Vue d'Ensemble de l'Architecture

### Stack
- **Backend**: Node.js + Express + MongoDB (Mongoose)
- **Frontend**: Next.js 15 (App Router) + React 18 + Tailwind CSS 3
- **État**: React Context (pas de Redux)
- **Auth**: Tokens JWT dans localStorage
- **Téléchargements**: Cloudinary (images)
- **Email**: Zoho IMAP + Nodemailer + Webhooks

### Structure Monorepo
```
altitude-vision-1/
├── server/          # Backend Node.js/Express
├── client/          # Frontend Next.js
├── package.json     # Dépendances partagées
└── netlify.toml     # Config de déploiement
```

### Diagramme du Flux de Données
```
[Client Browser]
    ↓ (Next.js)
[React Components] → [AuthContext] → [Services Layer]
    ↓ (Axios + JWT)
[API Server (Express)]
    ↓ (Middleware → Routes → Controllers)
[MongoDB Database]
    ↓ (Mongoose Models)
[Collections: Users, Properties, Messages, Events, etc.]
```

---

## 🗂️ Backend Structure (`/server`)

### Directory Layout
```
server/
├── routes/          # 33 route files (feature-based modules)
├── controllers/     # 23 controller files (business logic)
├── models/          # 30+ Mongoose schemas (User, Property, Message, etc.)
├── middleware/      # Auth, upload, error handling
├── services/        # Email service, Zoho integration, IMAP polling
├── utils/           # Helpers (tokens, emails, sitemap generation)
├── config/          # MongoDB, Cloudinary, email config
└── server.js        # Entry point
```

### Routing Pattern (MVC-like)
Each feature gets a modular route file that maps to a controller:
- Route: `/routes/propertyRoutes.js` → `GET /api/properties`
- Controller: `/controllers/propertyController.js` → `getProperties()`
- Model: `/models/Property.js` → Mongoose schema

**Example**: Add a new endpoint
```javascript
// routes/propertyRoutes.js
router.post('/properties', auth, validate, propertyController.createProperty);

// controllers/propertyController.js
exports.createProperty = async (req, res) => {
  const property = await Property.create(req.body);
  res.json({ status: 'success', data: property });
};
```

### Three Business Poles
The app supports three main business verticals, each with its own models and routes:
1. **Altimmo** (Real Estate): Properties, Transactions
2. **Altcom** (Business Services): Services, Projects, Portfolio
3. **Mila Events** (Event Planning): Events, Quotes, Reviews

Each pole has dedicated routes, controllers, and models. When adding features, check if it belongs to an existing pole or a new pole.

### Modèles Clés & Leurs Relations

#### User (Noyau)
```javascript
{
  _id: ObjectId,
  email: String,                 // Unique
  password: String,              // Hashée avec bcryptjs
  firstName: String,
  lastName: String,
  role: String,                  // 'Client', 'Collaborateur', 'Admin', 'Prestataire', 'Proprietaire'
  status: String,                // 'Active', 'Suspended', 'Banned'
  phone: String,
  avatar: String,                // URL Cloudinary
  tokenVersion: Number,          // Pour invalider les tokens (incrémenter = déconnexion globale)
  createdAt: Date,
  updatedAt: Date
}
```

#### Property (Altimmo)
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  type: String,                  // 'house', 'apartment', 'land', etc.
  status: String,                // 'available', 'sold', 'rented'
  price: Number,
  location: { latitude, longitude },
  images: [String],              // URLs Cloudinary
  owner: ObjectId,               // Référence User
  transaction: ObjectId,         // Référence Transaction (optionnel)
  createdAt: Date
}
```

#### Message & Conversation (Messagerie)
```javascript
// Conversation
{
  _id: ObjectId,
  participants: [ObjectId],      // Références User
  lastMessage: String,
  lastMessageDate: Date,
  unreadCount: Map                // { userId: count }
}

// Message
{
  _id: ObjectId,
  conversationId: ObjectId,
  senderId: ObjectId,            // Référence User
  content: String,
  attachments: [String],         // URLs
  createdAt: Date
}
```

#### Event (Mila Events)
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  date: Date,
  location: String,
  images: [String],              // URLs Cloudinary
  createdBy: ObjectId,           // Référence User
  quotes: [ObjectId],            // Références Quote
  status: String,                // 'open', 'closed', 'completed'
  createdAt: Date
}
```

#### AltcomProject (Altcom - Services)
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  client: ObjectId,              // Référence User
  budget: Number,
  deadline: Date,
  status: String,                // 'pending', 'in-progress', 'completed'
  portfolio: [ObjectId],         // Références PortfolioItem
  createdAt: Date
}
```

### Relations Entre Modèles
- **User** → Property (1 propriétaire : N propriétés)
- **User** → Message (1 utilisateur : N messages)
- **User** → Conversation (N utilisateurs : 1 conversation)
- **Event** → Quote (1 événement : N devis)
- **User** → AltcomProject (1 client : N projets)
- **AltcomProject** → PortfolioItem (1 projet : N réalisations)

### Middleware Stack (In Order)
1. Security: Helmet, CORS
2. Parsing: JSON, URL-encoded
3. Compression: gzip
4. Logging: Morgan with emoji prefixes (🔍, ✅, ❌, ⚠️)
5. Rate Limiting: express-rate-limit
6. Auth: `authMiddleware.js` (verifies JWT, extracts user)
7. Route handlers
8. Error: `errorMiddleware.js` (catches Mongoose errors, formats responses)

### Authentication Pattern
- JWT stored in localStorage on client
- Token sent in `Authorization: Bearer <token>` header
- Token versioning: increment `tokenVersion` in DB to invalidate all tokens
- Roles checked via `req.user.role` in middleware
- Status checks: Active users only (not Suspended/Banned)

### Cron Jobs
- **Facebook Sync**: Every hour (scheduled job)
- **Email Polling**: Every 5 minutes (IMAP check for new emails)

---

## 🎨 Frontend Structure (`/client`)

### Directory Layout
```
client/
├── app/              # Next.js App Router (current structure)
│   ├── auth/         # Login, register, password reset
│   ├── dashboard/    # User dashboard + protected routes
│   ├── altimmo/      # Real estate pages
│   ├── altcom/       # Business services pages
│   ├── mila-events/  # Events pages
│   ├── admin/        # Admin panels
│   └── layout.js     # Root layout with providers
├── lib/
│   ├── components/   # 36+ reusable UI components
│   ├── services/     # API integration layer (propertyService.js, etc.)
│   ├── context/      # React Context (AuthContext.js)
│   ├── hooks/        # Custom hooks (useAltcomData, useUnreadCount, etc.)
│   └── utils/        # Helper functions
├── components/       # Admin components (legacy)
└── public/           # Static assets
```

### Component Naming & Organization
- **Components**: PascalCase (`PropertyCard.jsx`, `ContactForm.jsx`)
- **Pages**: kebab-case folder names with page content
- **Services**: `<domain>Service.js` pattern (`propertyService.js`, `eventService.js`)
- **Hooks**: `use<Feature>.js` pattern (`useAltcomData.js`, `useUnreadCount.js`)

### Service Layer Pattern
All API calls go through centralized service files:
```javascript
// lib/services/propertyService.js
export const fetchProperties = (filters) => api.get('/api/properties', { params: filters });
export const createProperty = (data) => api.post('/api/properties', data);

// In a component:
import { fetchProperties } from '@/lib/services/propertyService';
const { data } = await fetchProperties({ status: 'active' });
```

### API Response Format
Backend always responds with:
```javascript
{
  status: 'success' | 'error',
  data: {...},           // Actual data payload
  message: '...',        // Human-readable message
  results: [...]         // For list endpoints
}
```

### Protected Routes
- `ProtectedRoute`: Redirects unauthenticated users to login
- `RoleProtectedRoute`: Restricts access to specific roles
- Usage: Wrap pages/components in these components if auth required

### Styling: Tailwind CSS
- **Config**: `tailwind.config.js` with custom theme colors
- **Custom Colors**: `secondary`, `gold` variants
- **Fonts**: Cormorant Garamond (display), DM Sans (body)
- **Responsive**: Mobile-first (sm, md, lg breakpoints)
- **No CSS Modules**: All Tailwind classes in JSX

### State Management (React Context)
```javascript
// lib/context/AuthContext.js
const { user, isAuthenticated, login, logout } = useAuth();
```
- Token persisted in localStorage
- Single source of truth: `AuthContext`
- No Redux (keep it simple with Context API)

---

## 🔐 Common Workflows

### Adding a New Feature

**1. Database Model** (Backend)
```javascript
// server/models/NewFeature.js
const schema = new Schema({
  name: { type: String, required: true },
  userId: { type: mongoose.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('NewFeature', schema);
```

**2. Routes & Controller** (Backend)
```javascript
// server/routes/newFeatureRoutes.js
router.get('/', auth, newFeatureController.list);
router.post('/', auth, newFeatureController.create);

// server/controllers/newFeatureController.js
exports.list = async (req, res) => {
  const items = await NewFeature.find({ userId: req.user._id });
  res.json({ status: 'success', data: items });
};
```

**3. Service Layer** (Frontend)
```javascript
// client/lib/services/newFeatureService.js
export const fetchItems = () => api.get('/api/new-feature');
export const createItem = (data) => api.post('/api/new-feature', data);
```

**4. Component** (Frontend)
```javascript
// client/app/new-feature/page.jsx
'use client';
import { fetchItems, createItem } from '@/lib/services/newFeatureService';

export default function NewFeaturePage() {
  const [items, setItems] = useState([]);
  
  useEffect(() => {
    fetchItems().then(res => setItems(res.data.data));
  }, []);
  
  return (
    <div>
      {items.map(item => <div key={item._id}>{item.name}</div>)}
    </div>
  );
}
```

### Authentification: Flux Détaillé

```
┌─────────────────────── INSCRIPTION ───────────────────────┐
│                                                            │
│  1. User emplit form (email, password)                   │
│  2. Frontend: POST /api/auth/register                    │
│  3. Backend:                                             │
│     - Valide email (unique?)                             │
│     - Hash password avec bcryptjs                        │
│     - Crée User en DB avec status 'Active'              │
│     - Génère JWT (header.payload.signature)             │
│  4. Envoie réponse:                                      │
│     { status: 'success',                                 │
│       data: { token, user } }                            │
│  5. Frontend: Stocke token dans localStorage             │
│     localStorage.setItem('token', token)                 │
│                                                            │
└────────────────────────────────────────────────────────────┘

┌─────────────────────── CONNEXION ────────────────────────┐
│                                                           │
│  1. User emplit (email, password)                        │
│  2. Frontend: POST /api/auth/login                       │
│  3. Backend:                                             │
│     - Trouve User par email                              │
│     - Compare password avec bcryptjs.compare()          │
│     - Vérifie status === 'Active'                        │
│     - Génère JWT avec user._id, role, tokenVersion       │
│  4. Envoie token + user data                             │
│  5. Frontend: Stocke dans localStorage + AuthContext    │
│                                                           │
└────────────────────────────────────────────────────────────┘

┌────────────── REQUÊTES AUTHENTIFIÉES ─────────────────────┐
│                                                            │
│  1. Frontend: api.get('/api/protected-resource')         │
│     + Header: Authorization: Bearer <token>              │
│                                                            │
│  2. Backend Middleware (authMiddleware.js):              │
│     - Extrait token du header                            │
│     - Vérifie signature JWT avec JWT_SECRET              │
│     - Décode payload: { userId, role, tokenVersion }    │
│     - Cherche User dans DB                               │
│     - Vérifie tokenVersion correspond                    │
│     - Attache user à req.user                            │
│                                                            │
│  3. Controller a accès à req.user._id, req.user.role    │
│                                                            │
│  4. Si pas de token → 401 Unauthorized                  │
│     Si token expiré → 403 Forbidden                      │
│     Si tokenVersion != → Token invalidated               │
│                                                            │
└────────────────────────────────────────────────────────────┘

┌────────────── DÉCONNEXION ───────────────────────────────┐
│                                                            │
│  Option 1 (Simple - Frontend Only):                      │
│  - Frontend: localStorage.removeItem('token')           │
│  - Redirige vers /login                                  │
│                                                            │
│  Option 2 (Secure - Globale):                            │
│  - Frontend: POST /api/auth/logout                       │
│  - Backend: Incrémente user.tokenVersion++ dans DB      │
│  - Tous les tokens anciens deviennent invalides         │
│  - Retour: { status: 'success' }                         │
│  - Frontend: Nettoie localStorage                        │
│                                                            │
│  ✅ Avantage: Pas de blacklist nécessaire               │
│  ✅ Works: Force logout global, même depuis autres tabs  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Ajouter Authentification à une Nouvelle Route

**Backend (Protéger la route)**
```javascript
// routes/myFeatureRoutes.js
const auth = require('../middleware/authMiddleware');

router.get('/my-feature', auth, myFeatureController.getFeature);
router.post('/my-feature', auth, myFeatureController.createFeature);

// Pour restriction de rôle:
router.delete('/my-feature/:id', auth, (req, res, next) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ status: 'error' });
  next();
}, myFeatureController.deleteFeature);
```

**Frontend (Utiliser le hook)**
```javascript
// app/my-feature/page.jsx
'use client';
import { useAuth } from '@/lib/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function MyFeaturePage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  
  // Vérifier l'auth
  if (!isAuthenticated) {
    router.push('/login');
    return null;
  }
  
  // Vérifier le rôle
  if (user.role !== 'Admin') {
    return <div>Accès refusé - Admin uniquement</div>;
  }
  
  return <div>Contenu pour Admin: {user.email}</div>;
}
```

### Working with File Uploads
- Frontend: Send FormData via `api.post()`
- Backend: Use `uploadMiddleware` (handles Cloudinary upload)
- Return: `{ url: 'https://cloudinary.com/...' }`

---

## 🧪 Testing & Linting

### Linting
```bash
# Server
cd server && npm run lint    # ESLint 9.x
cd server && npm run format  # Prettier 3.x

# Client
cd client && npm run lint    # ESLint 8.x (React plugins)
```

### No Unit Tests Currently
- No Jest or Vitest configs found
- Manual testing or add Jest if needed
- Consider `supertest` for API testing in server

### Environment Variables

**Server** (.env required)
```
MONGO_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
NODE_ENV=development
CLOUDINARY_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
ZOHO_MAIL_USER=...
ZOHO_MAIL_PASSWORD=...
FRONTEND_URL=http://localhost:3000
```

**Client** (.env.local optional)
```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

## ⚠️ Important Gotchas & Patterns

### Database Quirks
- Models exist in both PascalCase and camelCase variants (check both if something seems missing)
- Always use `ObjectId` from mongoose for ID references
- Mongoose validation happens at schema level; validate early

### API Response Consistency
- Always follow `{ status, data, message }` format
- Use `res.status(400).json(...)` for errors
- Don't mix response formats

### Authentication
- User status must be 'Active' (middleware checks this)
- Token invalidation via `tokenVersion` increment (better than blacklist)
- Never store passwords in logs or error messages

### Frontend Transition (Vite → Next.js)
- Both systems coexist (`dev` vs `dev:next`)
- Use `next dev` for new work
- Path aliases: `@` points to project root (`next.config.mjs` configures it)
- Check both `/app` (Next.js) and `/lib` for components (prefer `/app`)

### CORS & Deployment
- CORS origins are environment-specific (configure in `server.js`)
- Frontend URL must be whitelisted for cookie/credential sharing
- Verify `NEXT_PUBLIC_API_URL` for production

### Naming Conventions
- **Controllers**: Verb+Noun pattern (`createProperty`, `getUserById`)
- **Models**: PascalCase, singular (`User`, `Property`)
- **Routes**: Plural, lowercase (`/api/users`, `/api/properties`)
- **Components**: PascalCase (`PropertyCard.jsx`)
- **Services**: `<domain>Service.js` (`propertyService.js`)

### Middleware Execution Order Matters
- Auth middleware must run AFTER parsing middleware
- Error middleware must be last (after all routes)
- Check `server.js` for correct order

---

## 🔗 Key Files to Understand

### Backend
- `server/server.js`: Entry point, middleware setup, route registration
- `server/middleware/authMiddleware.js`: JWT verification, role checking
- `server/models/User.js`: User schema with roles
- `server/config/mongodb.js`: DB connection setup

### Frontend
- `client/app/layout.js`: Root layout with providers (AuthContext, Helmet)
- `client/lib/context/AuthContext.js`: Auth state management
- `client/lib/services/api.js`: Axios instance with interceptors
- `client/next.config.mjs`: Path aliases, Next.js config
- `client/tailwind.config.js`: Styling config

---

## 📦 Dependencies to Know

### Backend
- **express**: Web framework
- **mongoose**: MongoDB ODM
- **nodemailer**: Email sending
- **multer**: File uploads
- **cloudinary**: Image hosting
- **jsonwebtoken**: JWT auth
- **bcryptjs**: Password hashing
- **node-cron**: Scheduled tasks
- **helmet**: Security headers
- **morgan**: HTTP logging
- **dotenv**: Environment variables

### Frontend
- **next**: React framework (latest App Router)
- **react**: UI library
- **tailwindcss**: Styling
- **axios**: HTTP client
- **framer-motion**: Animations
- **react-icons**: Icon library
- **leaflet**: Maps
- **recharts**: Charts/graphs
- **date-fns**: Date utilities
- **react-hot-toast**: Notifications

---

## 🚀 Deployment

### Frontend (Netlify)
- Trigger: Push to main branch
- Build: `npm run build:next`
- Output: `.next` directory
- Env: Set `NEXT_PUBLIC_API_URL` to production backend URL
- Plugin: `@netlify/plugin-nextjs` (in netlify.toml)

### Backend (Render)
- Trigger: Manual or Git push
- Build: `npm install` in `/server`
- Start: `npm start` (runs `node server.js`)
- Env: Set all `.env` vars in Render dashboard
- Port: Should listen on `process.env.PORT || 5000`

### Database (MongoDB Atlas)
- Always use connection string with IP whitelist
- Backups: Configure daily/weekly via Atlas
- Migrations: Use Mongoose for schema versioning

---

---

## 🛠️ Commandes Utiles & Scripts

### Setup Initial
```bash
# Vérifier les versions
node --version    # Doit être ≥ 20.0.0
npm --version     # Doit être ≥ 10.0.0

# Réinstaller complètement (en cas de problème)
rm -rf node_modules package-lock.json
cd server && rm -rf node_modules package-lock.json && cd ..
cd client && rm -rf node_modules package-lock.json && cd ..
npm install && cd server && npm install && cd ../client && npm install && cd ..
```

### Développement Courant
```bash
# Terminal 1 - Backend
cd server && npm run dev         # Démarrer avec nodemon (watch mode)
npm run lint                     # Vérifier ESLint
npm run format                   # Formater avec Prettier

# Terminal 2 - Frontend
cd client && npm run dev:next    # Démarrer Next.js dev server
npm run lint                     # Vérifier ESLint
npm run preview                  # Prévisualiser build de production
```

### Tests & Build
```bash
# Frontend
cd client && npm run build:next  # Build pour Netlify
npm start:next                   # Lancer production locally

# Backend
npm install                      # Vérifier/installer les dépendances
npm start                        # Lancer en production
```

### Debugging
```bash
# Backend avec logs détaillés
DEBUG=* npm run dev              # Tous les logs (bruyant)
DEBUG=server:* npm run dev       # Logs du serveur uniquement

# Tester une API
curl http://localhost:5000/api/properties
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5000/api/properties

# Vérifier MongoDB
# Connectez-vous via MongoDB Atlas GUI ou CLI mongosh
```

---

---

## ❓ FAQ (Questions Fréquemment Posées)

### Q: "Je dois ajouter un champ au modèle User, comment?"
```javascript
// 1. Modifiez le schéma en server/models/User.js
const userSchema = new Schema({
  // ... champs existants
  newField: { type: String, default: '' }
});

// 2. Migration (optionnel pour dev):
// db.users.updateMany({}, { $set: { newField: '' } })

// 3. Aucun redéploiement frontend nécessaire
```

### Q: "Comment créer un endpoint qui liste les propriétés filtrées?"
```javascript
// 1. Route: server/routes/propertyRoutes.js
router.get('/', propertyController.getProperties);

// 2. Controller: server/controllers/propertyController.js
exports.getProperties = async (req, res) => {
  try {
    const { status, minPrice, maxPrice, type } = req.query;
    
    // Construire filtre
    const filter = {};
    if (status) filter.status = status;
    if (minPrice) filter.price = { $gte: minPrice };
    if (maxPrice) filter.price = { ...filter.price, $lte: maxPrice };
    if (type) filter.type = type;
    
    const properties = await Property.find(filter)
      .limit(20)
      .sort({ createdAt: -1 });
    
    res.json({ 
      status: 'success', 
      data: properties,
      results: properties.length 
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// 3. Service: client/lib/services/propertyService.js
export const fetchProperties = (filters) => 
  api.get('/api/properties', { params: filters });

// 4. Composant: client/app/properties/page.jsx
const { data } = await fetchProperties({ 
  status: 'available', 
  minPrice: 50000 
});
```

### Q: "Le frontend affiche 'API_URL undefined', quoi faire?"
```
Vérifiez:
1. .env.local existe dans /client
2. Variable: NEXT_PUBLIC_API_URL=http://localhost:5000
3. Redémarrez: npm run dev:next (lis les env au démarrage)
4. Vérifiez: console → Network → Headers Authorization
```

### Q: "J'ai une erreur '401 Unauthorized', pourquoi?"
```
Causes:
1. Token expiré → Reconnectez-vous
2. Token invalide → localStorage corrompu → Videz et reconnectez
3. Header manquant → Vérifiez api.js injecte "Authorization: Bearer"
4. Endpoint existe mais ne vérifie pas auth → Oubli authMiddleware

Debug:
- Ouvrez DevTools → Application → localStorage
- Cherchez la clé 'token'
- Copiez le token, décidez-le avec jwt.io (pour debug)
- Vérifiez que req.user est défini dans le controller
```

### Q: "Quel est le format exact pour les uploads d'images?"
```javascript
// Frontend
const formData = new FormData();
formData.append('file', fileInput.files[0]); // File object
formData.append('folder', 'properties');     // Optionnel

const response = await api.post('/api/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
// Retour: { status: 'success', data: { url: '...' } }

// Backend
router.post('/upload', uploadMiddleware.single('file'), (req, res) => {
  // Multer + Cloudinary handle tout
  res.json({ status: 'success', data: { url: req.file.path } });
});
```

### Q: "Comment ajouter une validation côté serveur?"
```javascript
// 1. Niveau Mongoose (meilleur)
const schema = new Schema({
  email: {
    type: String,
    required: [true, 'Email requis'],
    match: [/\S+@\S+/, 'Email invalide'],
    unique: true
  },
  age: {
    type: Number,
    min: [18, 'Minimum 18 ans']
  }
});

// 2. Niveau Controller (middleware)
exports.createUser = async (req, res) => {
  const { email, password } = req.body;
  
  if (!email) return res.status(400).json({ 
    status: 'error', 
    message: 'Email requis' 
  });
  
  if (password.length < 8) return res.status(400).json({
    status: 'error',
    message: 'Password ≥ 8 caractères'
  });
  
  // Continuez...
};
```

### Q: "Qui peut accéder à cet endpoint - quelle sécurité?"
```javascript
// Public (pas de middleware auth)
router.get('/public-info', controller.getPublicInfo);

// Authentifié (n'importe quel utilisateur connecté)
router.get('/my-data', auth, controller.getMyData);

// Admin seulement
router.delete('/users/:id', auth, (req, res, next) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Not allowed' });
  next();
}, controller.deleteUser);

// Propriétaire du contenu ou Admin
router.put('/properties/:id', auth, async (req, res, next) => {
  const property = await Property.findById(req.params.id);
  if (property.owner.toString() !== req.user._id.toString() && req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Not allowed' });
  }
  next();
}, controller.updateProperty);
```

### Q: "Vite vs Next.js, lequel utiliser?"
```
Situation actuelle:
- Les deux coexistent dans /client
- npm run dev = Vite (ancien)
- npm run dev:next = Next.js (nouveau)

Recommandation: Utilisez TOUJOURS Next.js (dev:next)
- Raison: Transition en cours, Next.js est l'avenir
- App Router = meilleure architecture
- SSR/SSG intégré pour SEO
```

---

## 🆘 Guide de Dépannage Avancé

### Problèmes Backend

**Erreur: "Cannot connect to MongoDB"**
```
1. Vérifiez MONGO_URI dans server/.env
2. Testez la connexion:
   mongosh "mongodb+srv://user:password@cluster.mongodb.net/dbname"
3. Vérifiez IP whitelist dans MongoDB Atlas
4. Vérifiez que le cluster n'est pas paused
```

**Erreur: "JWT malformed"**
```
1. Token invalide → localStorage corrompu
2. Vérifiez header format: "Authorization: Bearer <token>"
3. Vérifiez JWT_SECRET existe et ne change pas entre redémarrages
4. Testez: curl -H "Authorization: Bearer TOKEN" http://localhost:5000/api/test
```

**Erreur: "CORS error: Origin not allowed"**
```
1. Vérifiez FRONTEND_URL dans server/.env
2. Doit matcher exactement (http://localhost:3000, pas localhost:3000)
3. Cherchez corsOptions dans server.js
4. Redémarrez le serveur après changement env
```

**Cron jobs qui ne s'exécutent pas**
```
1. Vérifiez que les services (Facebook, IMAP) sont lancés
2. Cherchez les logs cron dans la console
3. Testez manuellement: 
   node -e "require('./services/facebookService').syncPosts()"
4. Vérifiez les credentials (Zoho, Facebook API)
```

### Problèmes Frontend

**Erreur: "Cannot GET /api/properties"**
```
1. Backend n'est pas en cours d'exécution (npm run dev)
2. NEXT_PUBLIC_API_URL pointe vers une mauvaise URL
3. Vérifiez: console → Network → Request URL
4. Testez backend directement: curl http://localhost:5000/api/properties
```

**Authentification qui ne persiste pas après rechargement**
```
1. localStorage non disponible (mode incognito?)
2. AuthContext n'initialise pas correctement:
   - Vérifiez que layout.js wraps le app avec AuthProvider
3. Token expiré:
   - Reconnectez-vous
   - Vérifiez JWT_SECRET_EXPIRY
4. Vérifiez localStorage dans DevTools → Application
```

**Images ne s'affichent pas (Cloudinary URLs)**
```
1. CLOUDINARY_NAME invalide dans server/.env
2. Image n'a pas été uploadée correctement:
   - Vérifiez req.file dans le controller
   - Cherchez erreurs d'upload dans les logs
3. URL Cloudinary expire (rare):
   - Retéléchargez l'image
```

### Problèmes Email

**Emails non envoyés (Zoho)**
```
1. Vérifiez credentials Zoho dans server/.env:
   - ZOHO_MAIL_USER
   - ZOHO_MAIL_PASSWORD
2. Testez la connexion IMAP:
   - node -e "require('./services/emailService').testConnection()"
3. Vérifiez le port IMAP (587 ou 465 selon Zoho)
4. Logs: Cherchez "Email sent successfully" dans console
```

**IMAP polling qui s'arrête**
```
1. Connexion IMAP timeout après 5+ minutes:
   - Services/imapService.js reconnecte auto
   - Vérifiez les logs pour "IMAP reconnecting"
2. Credentials expirés:
   - Régénérez le mot de passe Zoho
3. Limite de connexions Zoho atteinte:
   - Attendez 30 min ou changez de compte
```

### Performance & Optimisation

**App lente - Pourquoi?**
```
Frontend:
- Déboguez DevTools → Lighthouse
- Vérifiez bundle size: npm run build:next
- Optimisez images (Cloudinary transformations)
- Lazy load des composants avec React.lazy()

Backend:
- Indexez les requêtes MongoDB fréquentes
- Mettez en cache avec Redis (futur)
- Paginez les listes (limit + skip)
- Vérifiez n+1 queries avec db.setProfilingLevel()
```

**Mongoose N+1 Query Problem**
```javascript
// ❌ Mauvais (N+1 queries)
const properties = await Property.find();
for (const prop of properties) {
  const owner = await User.findById(prop.ownerId); // N queries!
}

// ✅ Bon (1 query + populate)
const properties = await Property.find().populate('ownerId');
```

---

## 📝 Style de Code

## 📝 Style de Code

### JavaScript
- Utilisez `async/await` (pas de callbacks)
- Utilisez `const` par défaut (pas de `var`)
- Utilisez les template literals pour les strings
- Utilisez `===` pour les comparaisons (pas `==`)

### Composants
- Utilisez les functional components (pas de class)
- Utilisez les hooks (useState, useEffect, useContext)
- Préférez la composition sur l'héritage
- Exportez en bas du fichier

### Nommage
- Fichiers: PascalCase pour composants, camelCase pour utils
- Variables: camelCase
- Constantes: UPPER_CASE ou camelCase (préférence de l'équipe)
- Pas de underscores pour les variables "privées"

---

## 📝 Exemple Complet: Créer une Fonctionnalité Pas à Pas

### Scénario: Ajouter un Système de Favoris

#### Étape 1: Model (Backend)
```javascript
// server/models/Favorite.js
const favoriteSchema = new Schema({
  userId: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  propertyId: { type: mongoose.Types.ObjectId, ref: 'Property', required: true },
  createdAt: { type: Date, default: Date.now }
});

// Index pour éviter les doublons
favoriteSchema.index({ userId: 1, propertyId: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
```

#### Étape 2: Routes & Controller (Backend)
```javascript
// server/routes/favoriteRoutes.js
const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const auth = require('../middleware/authMiddleware');

router.get('/', auth, favoriteController.getFavorites);
router.post('/:propertyId', auth, favoriteController.addFavorite);
router.delete('/:propertyId', auth, favoriteController.removeFavorite);

module.exports = router;

// server/controllers/favoriteController.js
const Favorite = require('../models/Favorite');
const Property = require('../models/Property');

exports.getFavorites = async (req, res) => {
  try {
    const favorites = await Favorite.find({ userId: req.user._id })
      .populate('propertyId')
      .sort({ createdAt: -1 });
    
    res.json({ status: 'success', data: favorites });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.addFavorite = async (req, res) => {
  try {
    // Vérifier que la propriété existe
    const property = await Property.findById(req.params.propertyId);
    if (!property) return res.status(404).json({ status: 'error', message: 'Propriété non trouvée' });
    
    // Créer/vérifier le favori
    const favorite = await Favorite.findOneAndUpdate(
      { userId: req.user._id, propertyId: req.params.propertyId },
      {},
      { upsert: true, new: true }
    ).populate('propertyId');
    
    res.json({ status: 'success', data: favorite });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.removeFavorite = async (req, res) => {
  try {
    await Favorite.deleteOne({ userId: req.user._id, propertyId: req.params.propertyId });
    res.json({ status: 'success', message: 'Favori supprimé' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
```

#### Étape 3: Service Layer (Frontend)
```javascript
// client/lib/services/favoriteService.js
import api from './api';

export const getFavorites = () => api.get('/api/favorites');
export const addFavorite = (propertyId) => api.post(`/api/favorites/${propertyId}`);
export const removeFavorite = (propertyId) => api.delete(`/api/favorites/${propertyId}`);
export const isFavorite = async (propertyId) => {
  const { data } = await getFavorites();
  return data.some(fav => fav.propertyId._id === propertyId);
};
```

#### Étape 4: Custom Hook (Frontend)
```javascript
// client/lib/hooks/useFavorites.js
'use client';
import { useState, useEffect } from 'react';
import { getFavorites, addFavorite, removeFavorite } from '@/lib/services/favoriteService';

export const useFavorites = () => {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      setLoading(true);
      const { data } = await getFavorites();
      setFavorites(data);
    } catch (error) {
      console.error('Erreur chargement favoris:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (propertyId) => {
    const isFav = favorites.some(fav => fav.propertyId._id === propertyId);
    try {
      if (isFav) {
        await removeFavorite(propertyId);
      } else {
        await addFavorite(propertyId);
      }
      await loadFavorites();
    } catch (error) {
      console.error('Erreur toggle favori:', error);
    }
  };

  return { favorites, toggleFavorite, loading };
};
```

#### Étape 5: Composant (Frontend)
```javascript
// client/app/favoris/page.jsx
'use client';
import { useFavorites } from '@/lib/hooks/useFavorites';
import PropertyCard from '@/lib/components/PropertyCard';
import { useAuth } from '@/lib/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function FavoritesPage() {
  const { isAuthenticated } = useAuth();
  const { favorites, loading } = useFavorites();
  const router = useRouter();

  if (!isAuthenticated) {
    router.push('/login');
    return null;
  }

  if (loading) return <div>Chargement...</div>;
  
  if (favorites.length === 0) {
    return <div className="text-center p-8">Aucun favori pour le moment</div>;
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Mes Favoris</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {favorites.map(fav => (
          <PropertyCard 
            key={fav._id} 
            property={fav.propertyId}
            isFavorite={true}
          />
        ))}
      </div>
    </div>
  );
}
```

#### Étape 6: Intégration dans PropertyCard
```javascript
// client/lib/components/PropertyCard.jsx
import { Heart } from 'lucide-react';
import { useFavorites } from '@/lib/hooks/useFavorites';

export default function PropertyCard({ property, isFavorite: initial }) {
  const { toggleFavorite } = useFavorites();
  const [isFav, setIsFav] = useState(initial);

  const handleToggleFavorite = async () => {
    await toggleFavorite(property._id);
    setIsFav(!isFav);
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="relative">
        <img src={property.images?.[0]} alt={property.title} />
        <button 
          onClick={handleToggleFavorite}
          className="absolute top-4 right-4 p-2 bg-white rounded-full"
        >
          <Heart 
            size={24} 
            fill={isFav ? "red" : "none"} 
            color={isFav ? "red" : "gray"}
          />
        </button>
      </div>
      <div className="p-4">
        <h3 className="font-bold text-lg">{property.title}</h3>
        <p className="text-gray-600">${property.price}</p>
      </div>
    </div>
  );
}
```

#### Étape 7: Registrer la Route (Backend)
```javascript
// server/server.js - ajouter la ligne:
app.use('/api/favorites', require('./routes/favoriteRoutes'));
```

#### Résumé: Checklist
- ✅ Créé model Favorite avec index unique
- ✅ Ajouté 3 endpoints (GET, POST, DELETE)
- ✅ Créé service avec 4 fonctions
- ✅ Créé custom hook useFavorites
- ✅ Créé page favoris
- ✅ Intégré bouton dans PropertyCard
- ✅ Registré route dans server.js

---

## 🎯 Améliorations Suggérées (Hors Scope)

- Ajouter des tests unitaires (Jest + supertest)
- Finaliser transition Vite → Next.js
- Considérer GraphQL pour requêtes complexes
- Ajouter TypeScript pour la sécurité des types
- Consolider modèles dupliqués (PascalCase vs camelCase)

---

**Dernière Mise à Jour**: 2026-05-19
**Version Stack**: MERN avec Next.js 15, Express 5.2, MongoDB 7.1, React 18.3

---

**Notes pour les Agents IA**:
- Ce document est votre source de vérité pour la structure et les patterns du projet
- Consultez les fichiers clés listés avant de faire des changements majeurs
- Testez toujours les workflows end-to-end (DB → API → Frontend)
- Les trois pôles (Altimmo, Altcom, Mila Events) ont des structures similaires - suivez les patterns existants
- Pour les problèmes, consultez d'abord la section FAQ et Dépannage
