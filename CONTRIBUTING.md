# Guide de Contribution - Altitude-Vision

Merci de vouloir contribuer à Altitude-Vision! Ce guide vous aidera à comprendre comment contribuer au projet.

## 🚀 Démarrage Rapide

1. **Clonez le repo**
   ```bash
   git clone https://github.com/your-org/altitude-vision-1.git
   cd altitude-vision-1
   ```

2. **Setup (voir AGENTS.md pour détails)**
   ```bash
   npm install
   cd server && npm install && cd ..
   cd client && npm install && cd ..
   ```

3. **Lancez en développement**
   ```bash
   # Terminal 1: Backend
   cd server && npm run dev
   
   # Terminal 2: Frontend
   cd client && npm run dev:next
   ```

4. **Vérifiez le linting**
   ```bash
   cd server && npm run lint && npm run format
   cd client && npm run lint && npm run format
   ```

## 📋 Processus de Contribution

### 1. Créer une Branche
```bash
git checkout -b feature/your-feature-name
# ou
git checkout -b fix/bug-name
```

**Convention de nommage**:
- `feature/` pour nouvelles fonctionnalités
- `fix/` pour bug fixes
- `refactor/` pour refactorisation
- `docs/` pour documentation

### 2. Faire les Changements

Consultez [AGENTS.md](./AGENTS.md) pour:
- Architecture et patterns
- Structure des données
- Comment ajouter une feature end-to-end
- Commandes utiles

**Types de changements**:
- ✨ **Nouvelle fonctionnalité**: Ajouter une feature complète
- 🐛 **Bug fix**: Corriger un problème existant
- ♻️ **Refactorisation**: Améliorer le code sans changer la logique
- 📚 **Documentation**: Améliorer les docs
- 🎨 **Style**: Changements visuels/UI

### 3. Tester Vos Changements

```bash
# Frontend
cd client
npm run lint          # Vérifier ESLint
npm run format        # Formater avec Prettier
npm run build:next    # Build production (vérifier erreurs)

# Backend
cd server
npm run lint
npm run format
```

**À tester manuellement**:
- [ ] Golden path fonctionne
- [ ] Gestion des erreurs correcte
- [ ] Pas de console.log debug
- [ ] Responsive (si UI)
- [ ] Authentication si protégé

### 4. Créer une Pull Request

GitHub utilisera le template automatiquement (`.github/pull_request_template.md`).

**Titre du PR** (court, descriptif):
```
Add favorites system for properties
Fix login token undefined error
Update property filtering UI
```

**Description** (remplissez le template):
- Décrivez ce qui change et pourquoi
- Liez les issues connexes
- Complétez le checklist
- Ajoutez des screenshots si UI

### 5. Code Review

- 👀 Minimum 1 review avant merge
- ✅ ESLint/Prettier doivent passer (GitHub Actions)
- ✅ Tous les checkpoints du PR template cochés
- 💬 Répondez aux commentaires

## 📖 Standards de Code

### JavaScript/TypeScript
```javascript
// ✅ BON
const fetchProperties = async (filters) => {
  try {
    const { data } = await api.get('/api/properties', { params: filters });
    return data;
  } catch (error) {
    console.error('❌ Failed to fetch properties:', error);
    throw error;
  }
};

// ❌ MAUVAIS
var fetchProps = (filters) => {
  const props = api.get('/api/props', {params: filters});
  return props;
};
```

**Règles**:
- Utilisez `const` (pas `var`)
- Utilisez `async/await` (pas `.then()`)
- Noms clairs: `fetchProperties` pas `fp`
- Gérez les erreurs avec try/catch
- Loguez avec format: `🔍 message` (info), `✅ success`, `❌ error`, `⚠️ warning`

### Composants React
```javascript
// ✅ BON
'use client';
import { useState } from 'react';

export default function PropertyCard({ property }) {
  const [isFavorite, setIsFavorite] = useState(false);
  
  return <div className="p-4 border rounded">...</div>;
}

// ❌ MAUVAIS
class PropertyCard extends React.Component {
  render() {
    return <div style={{padding: '4px'}}>...</div>
  }
}
```

**Règles**:
- Utilisez functional components
- Utilisez hooks (useState, useEffect)
- Utilisez Tailwind CSS (pas CSS inline)
- Noms explicites pour les composants

### Nommage

| Type | Pattern | Exemple |
|------|---------|---------|
| Fichier composant | PascalCase | `PropertyCard.jsx` |
| Fichier service | camelCase | `propertyService.js` |
| Fichier hook | camelCase | `useFavorites.js` |
| Variable | camelCase | `const propertyId = ...` |
| Constante | UPPER_CASE | `const MAX_ITEMS = 10` |
| Route API | kebab-case | `/api/my-endpoint` |

### Commits

**Format**:
```
[type](scope): message

[optional body]
[optional footer]
```

**Types**:
- `feat`: Nouvelle fonctionnalité
- `fix`: Bug fix
- `refactor`: Refactorisation
- `docs`: Documentation
- `style`: Formatting, no logic change
- `test`: Tests
- `chore`: Dépendances, setup

**Exemples**:
```bash
git commit -m "feat(auth): add two-factor authentication"
git commit -m "fix(property): fix image upload to Cloudinary"
git commit -m "docs(readme): update installation steps"
```

## 🗂️ Structure du Projet

```
altitude-vision-1/
├── server/                    # Node.js/Express backend
│   ├── routes/               # Route definitions
│   ├── controllers/          # Business logic
│   ├── models/               # Mongoose schemas
│   ├── middleware/           # Auth, upload, error handling
│   ├── services/             # Email, integrations
│   └── server.js             # Entry point
│
├── client/                    # Next.js frontend
│   ├── app/                  # Next.js App Router pages
│   ├── lib/
│   │   ├── components/       # Reusable components
│   │   ├── services/         # API integration
│   │   ├── hooks/            # Custom hooks
│   │   └── context/          # React Context
│   └── public/               # Static assets
│
├── .claude/                   # Claude Code customization
│   ├── settings.json         # Configuration
│   ├── AGENTS.md            # AI agent guide
│   └── skill-*.md           # Custom skills
│
├── .github/                   # GitHub workflows & templates
│   ├── workflows/lint.yml    # CI/CD linting
│   └── pull_request_template.md
│
└── CONTRIBUTING.md           # This file
```

## 🧪 Testing (Future)

Actuellement: Tests manuels seulement.

**À implémenter**:
```bash
# Backend (supertest + Jest)
cd server && npm test

# Frontend (Vitest + React Testing Library)
cd client && npm test
```

## 🔐 Sécurité

- Ne commitez jamais les `.env` files (utilisez `.env.example`)
- Ne stockez pas les secrets en dur dans le code
- Validez toujours l'input utilisateur
- Utilisez middleware d'authentification pour routes protégées
- Vérifiez CORS pour la production

**Secrets à gérer**:
- Clés API (Cloudinary, Zoho)
- Connexion MongoDB
- JWT secret
- Email credentials

## 📚 Documentation

- **Architecture globale**: [AGENTS.md](./AGENTS.md) → Architecture Overview
- **Ajouter une feature**: [AGENTS.md](./AGENTS.md) → Common Workflows
- **Déboguer**: [AGENTS.md](./AGENTS.md) → Dépannage Avancé
- **Personnalisations Claude Code**: [.claude/README.md](./.claude/README.md)

## ❓ Questions?

1. **Consultez d'abord** [AGENTS.md](./AGENTS.md) (FAQ, Dépannage)
2. **Cherchez dans les issues** GitHub
3. **Demandez** dans la discussion GitHub

## 🎯 Checklist Avant de Faire une PR

- [ ] Code écrit et testé localement
- [ ] ESLint passe: `npm run lint`
- [ ] Code formaté: `npm run format`
- [ ] Pas de console.log debug
- [ ] Authentification vérifiée (si pertinent)
- [ ] Pas de breaking changes
- [ ] Documentation mise à jour (README, AGENTS.md)
- [ ] Screenshots (si UI change)
- [ ] Commit messages clairs
- [ ] Branche à jour avec main

## 📦 Conventions de Versions

Nous utilisons [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

**Format**: `vX.Y.Z` (ex: `v1.2.3`)

## 🚀 Déploiement

Voir [AGENTS.md](./AGENTS.md) → Déploiement:
- **Frontend**: `npm run build:next` → Netlify
- **Backend**: `npm start` → Render
- **Database**: MongoDB Atlas

---

**Merci de contribuer!** 🙏 Vos contributions rendent Altitude-Vision meilleur pour tout le monde.

Toute question? Ouvrez une issue ou une discussion GitHub!
