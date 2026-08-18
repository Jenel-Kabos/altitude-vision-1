# UX-OWNER-1 — Matrice de comparaison des formulaires Property

Source de vérité : `server/models/Property.js` (+ `SaleManagement.js` pour la vente, `RentalManagement.js` pour la location — satellites 1-1, voir `PROPERTY_TRANSACTION_ARCHITECTURE.md`). Aucun champ ci-dessous n'est inventé — chacun est vérifié présent dans le modèle réel ou le formulaire réel audité.

| Élément | Admin Vente (`SalePropertyForm.jsx`) | Admin Location (`RentalPropertyForm.jsx`) | Owner actuel (`PropertyForm.jsx` legacy) | Réutilisable | Action |
|---|---|---|---|---|---|
| Titre | ✅ `title` | ✅ `title` | ✅ `title` | Oui | Owner mode réutilise `SalePropertyForm`/`RentalPropertyForm` tel quel |
| Description | ✅ `description` (textarea) | ✅ `description` (textarea) | ✅ `description` (textarea) | Oui | idem |
| Type (physique) | ✅ `type` (enum 9 valeurs `PROPERTY_TYPES`) | ✅ `type` | ✅ `type` | Oui | idem |
| listingType (transaction) | Implicite (`status='vente'` fixé par le composant) | Implicite (`status='location'`) | Explicite via `<select>` Vente/Louer(/Hébergement) DANS le formulaire | Oui, avec adaptation | Owner choisit Vente/Location **avant** le formulaire (2 cartes), pas un `<select>` interne — aligne Owner sur le pattern Admin déjà en place |
| Prix / Loyer | ✅ `price` (« Prix de vente ») | ✅ `price` (« Loyer mensuel ») + `charges` | ✅ `price` (label dynamique) | Oui | idem |
| Honoraires d'agence | absent (Admin Vente n'expose pas ce champ dans le formulaire audité) | absent | ✅ `honoraires` (auto-calculé) | Champ legacy, conservé côté Owner uniquement s'il existe déjà — **non ajouté** à Admin, **non retiré** à Owner (aucune preuve qu'il soit Admin-only ; c'est un champ `Property` générique déjà rempli par Owner aujourd'hui) | Conserver le comportement Owner actuel pour ce champ, hors du socle Sale/Rental partagé (différence documentée, pas une régression) |
| Commission d'agence (%) | ✅ `agencyCommission` (SaleManagement, Vente uniquement) | absent | absent | **Non** — Admin-only | Masqué explicitement en `mode="owner"` (§10/§16 mandat — jamais de commission interne exposée au propriétaire) |
| Adresse (rue/quartier) | ✅ `address.street` implicite via localisation, `neighborhood` (Vente) | — (pas de champ Quartier dans Location) | ✅ `address.street`, `address.neighborhood` | Oui | idem |
| Ville | ✅ `address.city` (`<select>` `VILLES`) | ✅ | ✅ | Oui | idem |
| Arrondissement | ✅ `address.arrondissement` (`<select>` dépendant de la ville) | ✅ | ✅ (désactivé tant que ville non choisie) | Oui | idem |
| Superficie | ✅ `surface` | ✅ `surface` | ✅ `surface` | Oui | idem |
| Chambres | ✅ `bedrooms` | ✅ (via Caractéristiques) | ✅ `bedrooms` | Oui | idem |
| Salles de bain | ✅ `bathrooms` | ✅ | ✅ `bathrooms` | Oui | idem |
| Séjours / Cuisines | ✅ (Sale : Séjours) | non listé explicitement | ✅ `livingRooms`, `kitchens` | Oui | Sale/Rental à compléter si absent — vérifier lors de l'implémentation, ne pas régresser Owner |
| Type de construction | non listé (Sale/Rental) | non listé | ✅ `constructionType` | Champ legacy Owner, pas de contradiction | Conserver côté Owner si absent du socle partagé (différence documentée) |
| Équipements (`amenities`) | non listé explicitement dans l'audit Sale | non listé | ✅ champ texte libre unique (`amenities`, virgules) | Oui, structure à uniformiser | Hors du périmètre strict header/form-reuse de ce sprint si absent des deux formulaires Admin — documenté comme dette (§40 rapport), pas inventé un nouveau composant équipements non prouvé exister côté Admin |
| Situation juridique | ✅ `legalStatus`, `ownershipDocumentType`, `ownershipDocumentAvailable`, `financingAccepted` (SaleManagement) | — | absent du `PropertyForm.jsx` actuel | Oui (nouveau pour Owner, mais champ `Property`/`SaleManagement` réel, jamais un champ Admin-only par nature) | Owner mode Vente hérite de cette section (amélioration réelle vs formulaire Owner actuel, qui ne l'avait pas) |
| Caution / avance | — | ✅ `cautionMultiplicateur`, durée min. bail | ✅ `cautionMultiplicateur` (`<select>` 0-6 mois) | Oui | idem |
| Conditions du bail | — | ✅ Profils locataires (`profilsLocataireRecherches`, enum 5), Documents requis (`documentsRequis`, enum 6), animaux, conditions additionnelles | ✅ mêmes deux champs enum | Oui | idem — enums identiques des deux côtés, aucun nouvel enum |
| Médias (images) | ✅ upload + preview + suppression, `<input type="file">` brut | ✅ identique | ✅ identique (+ styles `file:` pseudo-classes) | Oui | idem — aucun changement d'implémentation upload, aucun contrat Cloudinary touché |
| Vidéos | absent des 3 formulaires | absent | absent | N/A | Non ajouté — aucune preuve de champ vidéo sur `Property` |
| Géolocalisation | absent (Sale/Rental : pas de carte Leaflet, lat/long simples selon la doc Sprint A) | absent | ✅ `MapLeaflet` interactif (marker draggable) | Owner conserve un avantage réel ici | **Ne pas régresser** : la carte interactive reste disponible pour Owner (différence documentée, pas retirée) |
| Disponibilité | ✅ `availability` (`<select>` Disponible/Réservé/Vendu/Retiré) | ✅ (disponibilité à partir de, `availableFrom`) | ✅ `availability` | Oui | idem |
| Statut (modération, `statusAdmin`) | Non exposé en écriture dans le formulaire (contrôlé serveur) | idem | Non exposé en écriture | N/A — jamais un champ de formulaire, ni Admin ni Owner | Confirmé : aucune capacité de validation administrative à retirer, elle n'a jamais été dans le formulaire |
| Publication (`isPublished`) | Non exposé en écriture dans le formulaire audité | idem | Non exposé | N/A | idem |

## Constat architectural

Les formulaires Admin Vente/Location sont déjà, structurellement, la bonne cible pour Owner : séparés par type de transaction (conforme au modèle `status: vente|location|hebergement`), sections nommées, validation par champ. **Le seul champ réellement Admin-only identifié dans tout le périmètre Vente/Location est `agencyCommission`** (commission interne d'agence, satellite `SaleManagement`, déjà exclue de la sérialisation publique par le sprint précédent). Tous les autres écarts entre Owner-actuel et Admin-Vente/Location sont soit :
- des champs déjà présents côté Owner et absents des formulaires Admin actuels (Honoraires, Type de construction, Carte interactive) — **conservés**, jamais retirés à Owner ;
- des champs présents côté Admin et absents côté Owner actuel (Situation juridique pour la Vente) — **gagnés** par Owner via la réutilisation, amélioration réelle et légitime (ce sont des champs `Property`/`SaleManagement` factuels, pas des capacités administratives).

Aucun nouvel enum, aucun nouveau champ `Property` n'est introduit par cette matrice — conforme au mandat §12/§44.
