# TENANT-SCOPE-HORIZONTAL-FINAL-AUDIT-1 — Audit ObjectId / IDOR

## Méthode

`grep` de `findById`, `findOne({_id...})`, `findByIdAndUpdate`, `findByIdAndDelete`, `findOneAndUpdate` à travers `controllers/` (80 occurrences de `findByIdAndUpdate`/`findByIdAndDelete` dans 30 fichiers), croisé avec la présence ou l'absence d'un champ `tenant` sur le modèle Mongoose concerné (`grep -rln "tenant:" models/*.js`, 38 modèles porteurs d'un tenant identifiés).

## Domaines SANS champ tenant (hors périmètre tenant-scope par construction)

`Contrat`, `Paiement`, `Litige`, `Proprietaire`, `Locataire` (le domaine locatif "classique") n'ont **aucun champ `tenant`** dans leur schéma Mongoose. Les `findByIdAndUpdate`/`findByIdAndDelete` de `contratController.js`, `paiementController.js`, `litigeController.js`, `proprietaireController.js`, `locataireController.js` **ne peuvent pas** constituer un franchissement de frontière tenant au sens de ce mandat — il n'existe structurellement aucune frontière tenant à violer sur ces modèles (domaine antérieur ou distinct de la couche SaaS multi-tenant `PlatformTenant`). Toute anomalie d'accès sur ce périmètre serait un finding RBAC/ownership classique, pas un finding tenant-scope — hors du périmètre strict de ce mandat, non auditée plus en détail ici.

## Domaines AVEC champ tenant — vérifiés

| Modèle | Contrôleur | Garde avant mutation par ID | Verdict |
|---|---|---|---|
| `Hotel` | `financialAuthorizationService.js::assertFinancialScope` | `Hotel.findById(hotelId)` **puis** `assertResourceTenant` avant tout retour positif ; `!user.platformTenant` → fail-closed (403) sauf legacy `hotel.manager===user` | **CLEAN** — fail-closed confirmé pour le cas ambigu, contrairement à la messagerie |
| `Conversation` | `conversationController.js::assertConversationAccess` (utilisé par `getConversationById`, `getConversationMessages`, `markConversationAsRead`, `deleteConversation`) | `if (activeTenantId(req)) {...}` — **ignoré si tenant absent**, puis `isStaff \|\| isParticipant` (staff seul suffit) | **🔴 HF-FINAL-01 — VULNÉRABLE** |
| `ApiKey` | `apiKeyService.js::revokeApiKey/rotateApiKey` | `findOne({_id, status:'active', tenant})` — le tenant fait partie du filtre de recherche lui-même (jamais une vérification a posteriori contournable) | **CLEAN** |
| `Accommodation`, `AccommodationReservation`, `Property`, `HotelReservation` | Contrôleurs respectifs | Gardes spécifiques déjà certifiées HZ-01→HZ-07, revérifiées vertes (137/137 cluster) | **CLEAN (certifié)** |

## Pattern dangereux généralisable recherché : mutation avant vérification

Recherche explicite du pattern "charger par ID → muter → vérifier" (au lieu de "charger → vérifier → muter") : non trouvé dans les surfaces auditées ci-dessus. `conversationController.js::deleteConversation` charge puis appelle `assertConversationAccess` **avant** toute suppression (`Message.deleteMany`/`Conversation.findOneAndDelete`) — l'ordre est correct, la faille n'est PAS un problème de séquencement mais un problème du **contenu** de la vérification elle-même (elle autorise à tort quand le tenant est absent).

## Conclusion

Le seul IDOR cross-tenant confirmé est HF-FINAL-01 (Conversation). Aucun autre `findById*`/`findOneAndUpdate`/`findByIdAndDelete` examiné sur un modèle porteur de `tenant` ne présente le même défaut. Les domaines sans champ `tenant` (rental classique) sont explicitement hors périmètre tenant-scope, non un blanc-seing de sécurité — une anomalie RBAC/ownership y resterait possible mais n'est pas d'objet ce mandat.
