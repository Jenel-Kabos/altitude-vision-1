# UX-OWNER-2 — Matrice finale de parité Owner ↔ Admin

Reflète le code final de ce sprint (vérifié par lecture directe + tests unitaires + tests d'intégration Mongo réels, voir `UX_OWNER2_REPORT.md` §38-39).

| Capability/Field | Admin Vente | Admin Location | Owner Vente | Owner Location | Backend persisté |
|---|---|---|---|---|---|
| Composant formulaire | `SalePropertyForm.jsx` | `RentalPropertyForm.jsx` | `SalePropertyForm.jsx` (`mode="owner"`) | `RentalPropertyForm.jsx` (`mode="owner"`) | — |
| Endpoint création | `POST /api/sale-properties` | `POST /api/rental-properties` | **même endpoint** | **même endpoint** | ✅ |
| Endpoint édition | `PUT /api/sale-properties/:id` | `PUT /api/rental-properties/:id` | **même endpoint** | **même endpoint** | ✅ |
| Rôles autorisés | `ROLES_ALTIMMO` | `ROLES_ALTIMMO` | `ROLES_ALTIMMO` **+ `Proprietaire`** | `ROLES_ALTIMMO` **+ `Proprietaire`** | — |
| Titre/Description | ✅ | ✅ | ✅ | ✅ | `Property.title/description` |
| Prix / Loyer | ✅ | ✅ | ✅ | ✅ | `Property.price` |
| Type/Ville/Arrondissement/Quartier | ✅ | ✅ | ✅ | ✅ | `Property.type/address` |
| Surface/Chambres/Salles de bain/Séjours | ✅ | ✅ | ✅ | ✅ | `Property.*` |
| Images | ✅ (upload réel, `multer`+Cloudinary) | ✅ | ✅ **(bug multer pré-existant corrigé ce sprint, affectait aussi Admin)** | ✅ (même correctif) | `Property.images` |
| Disponibilité (`availability`) | ✅ libre | ✅ libre | ✅ restreint (`Disponible/Loué/Retiré/Vendu`, jamais si géré activement) | ✅ restreint (même règle) | `Property.availability` |
| Situation juridique (légal, doc propriété, financement, conditions vendeur) | ✅ | — | ✅ **(gagné ce sprint)** | — | `SaleManagement.*` |
| **Commission d'agence** | ✅ | — | **❌ masqué + ignoré serveur** | — | `SaleManagement.agencyCommission` (Admin-only) |
| Loyer/Charges/Caution/Meublé/Conditions bail | — | ✅ | — | ✅ **(déjà existant, confirmé persistant)** | `RentalManagement.*` |
| **Frais de gestion (`managementFee`)** | — | ✅ (backend seul, aucun champ UI) | — | **❌ ignoré serveur (aucun champ UI ni côté Admin)** | `RentalManagement.managementFee` (Admin-only) |
| Caution/Profils locataires/Documents requis | — | ✅ | — | ✅ (déjà existant avant ce sprint, via route legacy) | `Property.cautionMultiplicateur/profilsLocataireRecherches/documentsRequis` |
| `owner` (propriétaire du bien) | body respecté (staff peut créer « pour le compte de ») | body respecté | **forcé `req.user.id`, body ignoré** | **forcé `req.user.id`, body ignoré** | `Property.owner` |
| `statusAdmin` (modération) | jamais exposé au formulaire | jamais exposé | jamais exposé ; **repasse automatiquement à `En attente` après édition** | idem | `Property.statusAdmin` |
| `pole`/`agent`/`recommande`/`isPublished` | Admin only (contrôlés serveur) | idem | jamais exposés, jamais modifiables | idem | `Property.*` |
| Validation champ par champ | ✅ (`validate()` JS, pas de `required` natif) | ✅ | ✅ **(même `validate()`, même composant)** | ✅ | — |
| Ownership vérifiée en édition | non nécessaire (staff) | idem | **✅ 403 si bien d'un tiers** | **✅ 403 si bien d'un tiers** | contrôleur |
| Mass assignment (`isApproved`/`owner`/`agencyCommission`/`managementFee` injectés) | N/A (staff légitime) | N/A | **✅ tous ignorés, prouvé par test Mongo réel** | **✅ ignoré, prouvé** | contrôleur |
| Cross-tenant | N/A (`tenant` jamais renseigné sur `Property` par aucun flux) | N/A | N/A (inchangé) | N/A (inchangé) | — |

## Constat final

Tous les champs affichés au propriétaire dans `SalePropertyForm.jsx`/`RentalPropertyForm.jsx` (`mode="owner"`) sont désormais **réellement persistés**, vérifié par lecture directe en base MongoDB (jamais uniquement depuis la réponse HTTP) dans `server/__tests__/ownerSaleRentalPersistence.mongo.integration.test.js`. Les deux seuls champs Admin-only du périmètre Vente/Location (`agencyCommission`, `managementFee`) sont soit masqués côté UI (Vente), soit déjà absents de toute UI existante (Location — dette pré-existante, non introduite), et dans les deux cas explicitement ignorés côté serveur même si injectés directement en API, prouvé par test.
