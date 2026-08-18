# UX-OWNER-2 — État initial

Date : 2026-08-18. Branche `main`.

## 1. Baseline Git

```
git status --short (au lancement)
 M client/app/ClientLayout.jsx                        (UX-OWNER-1)
 M client/lib/components/dashboard/PropertyForm.jsx    (UX-OWNER-1)
 M client/lib/pages/dashboard/ManagePropertiesPage.jsx (UX-OWNER-1)
 M client/lib/pages/dashboard/OwnerPropertyManagement.jsx (UX-OWNER-1)
 M server/docs/HOTFIX_MSG_STAFF_INBOX1_REPORT.md       (session HOTFIX, non lié)
?? client/lib/__tests__/ClientLayout.test.jsx          (UX-OWNER-1)
?? client/lib/__tests__/OwnerPropertyManagement.test.jsx (UX-OWNER-1)
?? server/docs/UX_OWNER1_*.md                          (UX-OWNER-1)

git branch --show-current → main
git rev-parse HEAD        → 1462ea748cd032523c575a4387ae7048a99e9c21
git diff --check          → exit 0
```
`HEAD` identique à la clôture d'UX-OWNER-1 — aucun commit externe entre les deux sprints. Toutes les modifications UX-OWNER-1 sont présentes, non commitées, non écrasées.

## 2. UX-OWNER-1 relu intégralement

`UX_OWNER1_ETAT_INITIAL.md`, `UX_OWNER1_PROPERTY_FORM_MATRIX.md`, `UX_OWNER1_REPORT.md`. Verdict : GO SOUS RÉSERVES. Réserves reprises telles quelles (§4 ci-dessous).

## 3. Réserves UX-OWNER-1 reprises

1. Convergence complète des composants (Sale/RentalPropertyForm réutilisés en mode `owner`) non entreprise — bloquée à l'époque par une contrainte backend réelle (endpoints Admin-only). **Objet direct de ce sprint.**
2. Re-certification tablette/mobile du formulaire après le correctif de validation non effectuée.
3. Contraste `text-xs text-gray-500` et absence de Dark Mode documentés, non corrigés.

## 4. Vrais formulaires identifiés (vérifiés, pas supposés)

- **A. Admin → Vente → Ajouter** : `client/lib/components/dashboard/SalePropertyForm.jsx`, monté par `ManagePropertiesPage.jsx` (choix `addChoice==='vente'`).
- **B. Admin → Location → Ajouter** : `client/lib/components/dashboard/RentalPropertyForm.jsx`, monté par `ManagePropertiesPage.jsx` (choix `addChoice==='location'`).
- **C. Owner → Ajouter un bien** : `client/lib/components/dashboard/PropertyForm.jsx` (legacy), monté inline par `OwnerPropertyManagement.jsx` via `PropertyManagementForm`.
- **D. Owner → Modifier un bien** : même chemin (C), `view==='edit'`.

Aucun changement de ces faits depuis UX-OWNER-1 (re-vérifié par lecture directe des fichiers avant modification).

## 5. Endpoints réels (vérifiés)

| Endpoint | Rôles avant ce sprint | Contrôleur |
|---|---|---|
| `POST/PUT /api/sale-properties` | `ROLES_ALTIMMO` uniquement | `salePropertyController.js` |
| `POST/PUT /api/rental-properties` | `ROLES_ALTIMMO` uniquement | `rentalPropertyController.js` |
| `POST/PUT /api/properties` | `Admin`+`Proprietaire` (POST : `STAFF_CM`+`Proprietaire`) | `propertyController.js` |

## 6. Audit de sécurité AVANT modification — découverte critique

`salePropertyController.createFull` : `const ownerId = mongoose.isValidObjectId(owner) ? owner : req.user.id;` — accepte un `owner` arbitraire depuis `req.body`, jamais un problème tant que la route restait `ROLES_ALTIMMO`-only (le staff a légitimement besoin de créer « pour le compte de »), mais **serait devenu une faille de mass assignment majeure** si `Proprietaire` avait été ajouté à la route sans corriger le contrôleur en parallèle (un propriétaire aurait pu créer un bien attribué à un tiers).

`salePropertyController.updateFull`/`rentalPropertyController.updateFull` : **aucune vérification d'ownership** — cohérent tant que la route reste staff-only (le staff peut légitimement éditer n'importe quelle annonce), mais aurait permis à **n'importe quel Proprietaire de modifier le bien de n'importe quel autre propriétaire** si la route avait été ouverte sans ce garde.

Ces deux routes ne répliquaient pas non plus les protections déjà existantes sur la route legacy `propertyController.updateProperty` : restriction `availability` (`ALLOWED_OWNER_AVAILABILITY`, respect de la gestion locative active), et remise en modération (`statusAdmin = 'En attente'`) après une édition propriétaire.

**Conclusion de l'audit, avant toute ligne de code écrite** : ouvrir `Proprietaire` sur ces deux routes est sûr **uniquement** si le contrôleur applique explicitement, pour cet acteur : (1) `owner` forcé sur `req.user.id`, jamais lu du body ; (2) vérification d'ownership stricte en édition (403 sinon) ; (3) mêmes restrictions `availability`/re-modération que la route legacy ; (4) retrait des champs strictement Admin-only du satellite (voir §7).

## 7. Classification des champs Admin supplémentaires — décision documentée

Méthode appliquée (mandat §9) : la donnée décrit-elle le BIEN/l'OFFRE (Owner-legitimate) ou une opération ADMINISTRATIVE interne agence↔propriétaire (Admin-only) ?

**SaleManagement** (Vente) :
| Champ | Nature | Décision |
|---|---|---|
| `negotiable` | Condition de l'offre de vente | Owner-authorized |
| `ownershipDocumentType` | Caractéristique du bien (type de titre) | Owner-authorized |
| `ownershipDocumentAvailable` | Caractéristique du bien | Owner-authorized |
| `legalStatus` | Caractéristique du bien | Owner-authorized |
| `financingAccepted` | Condition du vendeur | Owner-authorized |
| `sellerConditions` | Condition du vendeur (texte libre, littéralement « conditions DU VENDEUR ») | Owner-authorized |
| `agencyCommission` | Taux négocié agence↔vendeur, déjà exclu de la sérialisation publique (voir `PROPERTY_TRANSACTION_ARCHITECTURE.md`) | **Admin-only** |

**RentalManagement** (Location, champs Sprint A ajoutés) :
| Champ | Nature | Décision |
|---|---|---|
| `chargesIncluded`, `furnished`, `minimumLeaseMonths`, `availableFrom`, `petsAllowed`, `rentalConditions` | Caractéristiques/conditions de l'offre locative | Owner-authorized |
| `monthlyRent`, `charges`, `depositAmount` | Déjà des équivalents natifs `Property.price`/frais — champs de l'offre | Owner-authorized |
| `managementFee` | Frais de GESTION qu'Altitude Vision facture au propriétaire — terme commercial agence↔propriétaire, même nature que `agencyCommission` | **Admin-only** |
| `cautionMultiplicateur`, `profilsLocataireRecherches`, `documentsRequis` | Déjà natifs sur `Property`, déjà Owner-authorized via la route legacy | Owner-authorized (inchangé) |

Aucun autre champ Admin-only trouvé dans ces deux satellites. `statusAdmin`, `isPublished`, `pole` (forcé Altimmo), `agent`, `recommande` restent Admin-only comme déjà établi par la route legacy — non touchés, répliqués à l'identique dans les nouveaux chemins.

## 8. Décision : architecture de convergence retenue

Les routes `/api/sale-properties` et `/api/rental-properties` sont étendues (additif, pas de nouvelle route, pas de nouvel endpoint dupliqué) : `restrictTo(...ROLES_ALTIMMO, 'Proprietaire')`. Les contrôleurs appliquent un branchement explicite par rôle (`isOwnerActor = req.user.role === 'Proprietaire'`) — jamais `Proprietaire` fondu dans `ROLES_ALTIMMO` (qui reste un ensemble staff pur, réutilisé par d'autres routes non concernées par ce sprint). `ROLES_ALTIMMO` n'a **pas** été modifié.

Ceci permet à `SalePropertyForm.jsx`/`RentalPropertyForm.jsx` (composants déjà bien architecturés, sections nommées, validation par champ) d'être réellement réutilisés côté Owner via un prop `mode` — sans duplication de JSX, sans perte de données (tous les champs affichés sont désormais réellement persistés), sans élévation de privilège (`agencyCommission`/`managementFee` restent strictement Admin-only, ownership strictement vérifiée).

Détails d'implémentation, tests, vérification navigateur : voir `UX_OWNER2_REPORT.md`.
