# HOTFIX-MODERATION-PROPERTY-SUBMITTER-CONTACT-1 — État initial

Date : 2026-08-21. Branche `main`. `HEAD` = `f4f6b40b06d72803cdcaf8598ac9479144a6578b`, worktree propre (`git status --short` vide) avant toute modification.

## 1. Audit — relation canonique vers le soumissionnaire

`Property.owner` (`server/models/Property.js`, champ `ObjectId ref: 'User'`, `required`) est bien la relation qui représente l'auteur réel du dépôt — **preuve, pas supposition** :

- `server/controllers/propertyController.js:299` et `:366` : `owner: req.user.id` — assigné à la création (web).
- `server/controllers/propertyMobileController.js:89` : `owner: ownerId` (même origine `req.user.id`) — assigné à la création (mobile).

Il n'existe aucun champ `createdBy`/`submittedBy` distinct sur `Property` — `owner` EST le soumissionnaire, pas un "propriétaire métier" séparé.

## 2. L'API de modération renvoie-t-elle déjà l'utilisateur ?

**Oui, intégralement** — découverte majeure qui réduit le scope de ce hotfix au strict frontend.

`propertyController.js:558-573` (`getPendingProperties`, route `GET /api/properties/status/pending`, `authController.restrictTo('Admin')`) :

```js
const properties = await Property.find(classicPropertyModerationFilter({ statusAdmin: 'En attente' }))
  .populate('owner', 'name email photo role phone')
  .sort('-createdAt');
```

`name`, `email`, `photo`, `role`, `phone` sont déjà peuplés et renvoyés au frontend (`PropertyModerationPage.jsx` les reçoit déjà dans `res.data.data.properties[i].owner`, mais seuls `name`/`email`/`photo` étaient affichés avant ce hotfix — `role` et `phone` arrivaient déjà côté client sans être utilisés).

**Aucun enrichissement backend n'a donc été nécessaire.**

## 3. Scope de sécurité déjà en place (vérifié, pas supposé)

- `getProperty` (`GET /api/properties/:id`, accès public) : `populate('owner', 'name photo')` (ligne 606) puis, pour tout visiteur non-admin/non-owner, réduction explicite à `{_id, name, photo}` (lignes 656-668) — email/téléphone déjà strictement absents de la fiche publique. Un test existant (`propertyRoutes.test.js:249-268`) le prouvait déjà.
- `getAllProperties`/`runPropertySearch` (listing public `GET /api/properties`) : **aucun** `.populate('owner', …)` — `owner` reste un ObjectId brut non résolu, jamais de fuite possible par ce chemin.
- `getPendingProperties` est gated par `authController.restrictTo('Admin')` — endpoint strictement backoffice, jamais accessible sans authentification Admin.
- La sélection Mongoose (`'name email photo role phone'`) exclut structurellement `password`/`tokenVersion`/tokens — impossible de les faire fuir par ce populate quel que soit le contenu du document User.

## 4. Ce qui manquait réellement

Uniquement côté **frontend** (`client/lib/pages/dashboard/PropertyModerationPage.jsx`) :
- Le bloc "Propriétaire" existant n'affichait que nom + email (pas de rôle, pas de téléphone, pas de date de soumission).
- Aucun bouton WhatsApp.
- Aucun helper de normalisation téléphonique vers le format `wa.me` n'existe dans le projet — tous les liens `wa.me` existants (`Footer.jsx`, `ChatWidget.jsx`, `PropertyDetailPage.jsx`) pointent vers le numéro fixe de l'agence (`242068002151`), jamais un numéro dynamique d'utilisateur.

## 5. Format réel de `User.phone`

Aucune validation de format en base (`server/models/User.js:69-73` : `String, trim, default: null` — libre). Formats réellement observés dans les fixtures/tests du projet et dans les placeholders UI (`"+242 06 123 4567"`) :
- `+242 06 123 4567` (international avec espaces)
- `+242061234567` / `242061234567` (international sans espaces / sans +)
- `06 111 22 33` / `06-123-45-67` (local avec espaces ou tirets)

Convention confirmée par le numéro agence déjà utilisé avec succès dans `wa.me` (`242068002151`) : le "0" initial du numéro local à 9 chiffres est **conservé** après le préfixe `242`, jamais retiré.

## 6. Plan

Ajouter au frontend uniquement :
1. `client/lib/utils/whatsapp.js` — `normalizePhoneForWhatsApp()` + `buildWhatsAppLink()`.
2. Bloc "Soumis par" enrichi dans `PropertyModerationPage.jsx` (rôle traduit, téléphone, date de soumission via `Property.createdAt` — confirmé réel via `timestamps: true` sur le schéma — et bouton WhatsApp désactivé si numéro absent/invalide).
3. Tests backend (preuve que `getPendingProperties` renvoie bien `owner.phone`/`role`, qu'un `owner` null ne casse rien, régression sécurité) + tests frontend (rendu du bloc, normalisation téléphonique, non-régression exposition publique déjà couverte).
