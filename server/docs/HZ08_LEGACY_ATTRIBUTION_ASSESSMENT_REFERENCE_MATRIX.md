# HZ-08 — Matrice des références

| File | Symbol | Purpose | Called by | Status |
|---|---|---|---|---|
| `services/platformTenant/tenantResourceAttributionService.js` | `resolveResourceTenant` | Déduit le tenant par champ direct ou graphe relationnel | assertions, notifications, audits, migrations | LIVE |
| même fichier | `assertResourceTenantOrUnattributed` | Autorise `unresolved`, refuse mismatch/ambigu | 19 fichiers controller/route | LEGACY-LIVE |
| même fichier | `assertResourceTenant` | Exige une attribution exacte | Hotel/Finance | LIVE, CANONICAL-STRICT |
| `controllers/accommodationController.js` | garde Accommodation | Accès individuel staff | routes Accommodation montées | LEGACY-LIVE |
| `controllers/accommodationReservationController.js` | gardes Reservation | Mutations/finance individuelles | routes Reservation montées | LEGACY-LIVE |
| `controllers/conversationController.js` | `assertConversationAccess`, filtre | Conversation attribuée ou générique | routes Conversation montées | LEGACY-LIVE |
| `controllers/messageController.js` | gardes Message/Conversation | Lecture, envoi, pièces jointes | routes Message montées | LEGACY-LIVE |
| `controllers/documentController.js` | alias `assertResourceTenant` | Documents historiques | routes Document montées | LEGACY-LIVE |
| `controllers/propertyController.js` | `assertPropertyTenantAccess` | Actions staff individuelles | routes Property montées | LEGACY-LIVE |
| `controllers/{locataire,proprietaire,rentalDocument,rentalMaintenance,user}Controller.js` | gardes domaine | GL, documents, identité | routes montées | LEGACY-LIVE |
| `routes/{contrat,paiement,locataire,proprietaire,rentalManagement,gestionDocument,userBusinessProfile}Routes.js` | guards/`router.param` | Contrôle avant handler | `server.js` | LEGACY-LIVE |
| `services/platformTenant/tenantDataRegularizationService.js` | manifest/apply/rollback | Régularisation contrôlée des seuls A déterministes | CLI dédié | LIVE-OFFLINE |
| `scripts/auditTenantLegacyData.js` | audit A–F | Audit read-only des données historiques | opérateur humain/tests | LIVE-OFFLINE |
| `scripts/regularizeTenantLegacyData.js` | dry-run/apply explicite | Exécution contrôlée | opérateur humain uniquement | LIVE-OFFLINE |
| scripts d'audit/storage annexes | `resolveResourceTenant` | Analyse/migration hors ligne | CLI | LEGACY-LIVE |
| tests `tenantAttribution*`, `tenantCert2*`, `tenantDataRegularization*`, `tenantScopeAudit2a*` | contrats | Attribution, cross-tenant, régularisation | Jest/Mongo jetable | TEST-ONLY |

Inventaire : 19 fichiers production importent directement la variante tolérante, auxquels s'ajoutent le service partagé, les consommateurs du resolver brut et les outils offline. Aucun symbole candidat n'est DEAD.

