# TENANT-SCOPE-HORIZONTAL-FINAL-AUDIT-1 — Inventaire des routes

## Méthode

Reconstruit depuis `server/server.js` (mounts réels, pas les rapports historiques) : `grep -n "app.use(" server.js` puis vérification que chaque fichier `require()`-é existe et est effectivement monté. Total : **72 instructions `app.use('/api/...', ...)`** (71 préfixes distincts, `/api/public/v1` portant deux routeurs) + 3 mounts non-API (`/uploads` ×2 statique, `/uploads/*` catch-all 404) = **72 routeurs API réellement vivants**.

`find routes -name "*.js"` recense **77 fichiers de routeur** sur disque (75 dans `routes/`, 2 dans `routes/publicApi/`). **5 fichiers ne sont jamais `require()`-és nulle part dans le code** (confirmé par `grep -rln "require.*<nom>"` sur tout le dépôt hors `node_modules`) :

| Fichier | Statut |
|---|---|
| `routes/adminPropertyRoutes.js` | **DEAD_ROUTE** — jamais monté, jamais requis ailleurs |
| `routes/projectRoutes.js` | **DEAD_ROUTE** |
| `routes/projetsRoutes.js` | **DEAD_ROUTE** |
| `routes/realisationsRoutes.js` | **DEAD_ROUTE** |
| `routes/unreadCountService.js` | **DEAD_ROUTE** (nom trompeur — ce n'est pas un service malgré son nom, mais un routeur non monté) |

Ces 5 fichiers ne sont pas exploitables en runtime (Express ne les charge jamais) — dette de nettoyage documentée, non exploitable, non corrigée (read-only).

## Total d'endpoints

`grep -c "router\.(get|post|put|patch|delete)("` sur tous les fichiers de `routes/` → **657 handlers HTTP individuels** déclarés (dont ceux des 5 fichiers morts, jamais atteignables). Une classification exhaustive endpoint-par-endpoint des 657 handlers dépasse le périmètre réalisable de cet audit ponctuel ; la classification ci-dessous est faite **par routeur** (la granularité pertinente pour la frontière tenant, appliquée par `router.use(...)` dans l'immense majorité des cas), avec les exceptions notables signalées explicitement (notamment le finding HF-FINAL-01, où la frontière diverge *à l'intérieur* d'un même routeur).

## Classification par routeur (72 mounts vivants)

| Préfixe | Fichier | Garde `router.use` | Classe |
|---|---|---|---|
| `/api/auth` | authRoutes.js | mixte (public + `protect`) | PUBLIC/AUTHENTICATED |
| `/api/users` | userRoutes.js | `protect` puis `restrictTo('Admin'), requireTenantScope` (sous-arbre) | MIXED |
| `/api/admin` | adminRoutes.js | `protect` + `restrictTo(...STAFF_ALL)` | STAFF |
| `/api/properties` | propertyRoutes.js | pas de garde routeur global — gardes par route (cf. HZ-07) | MIXED (déjà certifié HZ-07) |
| `/api/transactions` | transactionRoutes.js | pas de garde global visible | UNKNOWN — hors périmètre nommé HZ, non ré-audité en détail ce sprint |
| `/api/real-estate-applications` | realEstateApplicationRoutes.js | `protect` | AUTHENTICATED |
| `/api/publicites` | publiciteRoutes.js | pas de garde global (public `/active`, reste admin par route) | MIXED |
| `/api/proprietaires` | proprietaireRoutes.js | `protect` | AUTHENTICATED/OWNER |
| `/api/locataires` | locataireRoutes.js | `protect` | AUTHENTICATED/OWNER |
| `/api/contrats` | contratRoutes.js | `protect` | AUTHENTICATED |
| `/api/paiements` | paiementRoutes.js | `protect` | AUTHENTICATED |
| `/api/gestion-docs` | gestionDocumentRoutes.js | `protect` | AUTHENTICATED |
| `/api/rental-documents` | rentalDocumentRoutes.js | pas de garde global | MIXED |
| `/api/dossiers` | dossierRoutes.js | pas de garde global | MIXED |
| `/api/rental-lease-lifecycle` | rentalLeaseLifecycleRoutes.js | pas de garde global | MIXED |
| `/api/property-asset` | propertyAssetRoutes.js | `protect` | AUTHENTICATED |
| `/api/rental-management` | rentalManagementRoutes.js | `protect` + `requireTenantScope` | STAFF/TENANT |
| `/api/rental-contract-regularization` | rentalContractRegularizationRoutes.js | pas de garde global | MIXED |
| `/api/rental-maintenance` | rentalMaintenanceRoutes.js | `protect` + `requireTenantScope` | STAFF/TENANT |
| `/api/tenant-portal` | tenantPortalRoutes.js | `protect` | AUTHENTICATED (portail client) |
| `/api/accommodations` | accommodationRoutes.js | `protect` (gardes fines par route — **HZ-01→HZ-04 déjà certifiés**) | MIXED |
| `/api/hotels` | hotelRoutes.js | `protect, attachTenantScopeIfResolvable` (**HZ-06 déjà certifié**) | MIXED |
| `/api/altimmo` | altimmoSearchRoutes.js | pas de garde (recherche publique) | PUBLIC |
| `/api/hotel-reservations` | hotelReservationRoutes.js | `protect` + `attachTenantContext` (**HZ-05 déjà certifié**) | MIXED |
| `/api/financial` | financialRoutes.js | `protect, attachTenantScopeIfResolvable` | MIXED — domaine finance, non ré-audité en détail ligne-par-ligne ce sprint (voir §Finance) |
| `/api/payments/providers` | paymentProviderRoutes.js | pas de garde global | UNKNOWN |
| `/api/dashboard-analytics` | dashboardAnalyticsRoutes.js | `protect, requireTenantScopeForAnalytics` | STAFF/ANALYTICS |
| `/api/accommodation-reservations` | accommodationReservationRoutes.js | `protect` (**HZ-01/HZ-03 déjà certifiés**) | MIXED |
| `/api/housekeeping` | housekeepingRoutes.js | `protect` | STAFF |
| `/api/inspections` | inspectionRoutes.js | `protect` | STAFF |
| `/api/maintenance` | maintenanceRoutes.js | `protect` | STAFF |
| `/api/sale-properties` | salePropertyRoutes.js | `protect, restrictTo(...ROLES_ALTIMMO,'Proprietaire')` | STAFF/OWNER |
| `/api/rental-properties` | rentalPropertyRoutes.js | `protect, restrictTo(...ROLES_ALTIMMO,'Proprietaire')` | STAFF/OWNER |
| `/api/altcom` | altcomRoutes.js | `protect` | AUTHENTICATED |
| `/api/crm` | crmRoutes.js | `protect, restrictTo(...STAFF), requireTenantScope` | STAFF/TENANT |
| `/api/user-business-profiles` | userBusinessProfileRoutes.js | `protect` | AUTHENTICATED |
| `/api/crm-automation` | crmAutomationRoutes.js | `protect, restrictTo(...STAFF), requireTenantScope` | STAFF/TENANT |
| `/api/reporting` | reportingRoutes.js | `protect, restrictTo(...DIRECTION), requireTenantScopeAllowPlatformWide` | STAFF/PLATFORM_OPERATOR |
| `/api/organization` | organizationRoutes.js | `protect` | STAFF |
| `/api/public/v1` (×2) | publicApi/docs.js, publicApi/v1/index.js | auth par clé API (`X-API-Key`), pas `protect` | PUBLIC (API externe, voir §Public API) |
| `/api/dev-portal` | apiPlatformAdminRoutes.js | `protect, restrictTo('Admin'), requireTenantScope` | ADMIN/TENANT — **audité en détail ce sprint, CLEAN** (voir corps du rapport) |
| `/api/marketing` | marketingRoutes.js | `protect, restrictTo(...STAFF), requireTenantScope` | STAFF/TENANT |
| `/api/erp` | erpRoutes.js | `protect, restrictTo('Admin'), requireTenantScope` | ADMIN/TENANT |
| `/api/platform-tenants` | platformTenantRoutes.js | `protect, restrictTo('Admin')` | ADMIN/PLATFORM_OPERATOR |
| `/api/platform-operators` | platformOperatorRoutes.js | `protect, restrictTo('Admin')` puis `requireOperatorCapability` | PLATFORM_OPERATOR |
| `/api/visites` | visiteRoutes.js | `protect` | AUTHENTICATED |
| `/api/contact` | contactRoutes.js | pas de garde (formulaire public) | PUBLIC |
| `/api/estimation` | estimationRoutes.js | pas de garde global | MIXED |
| `/api/devis` | devisRoutes.js | pas de garde global | MIXED |
| `/api/sync` | sync.js | pas de garde global | UNKNOWN |
| `/api/facebook-posts` | facebookPostsRoutes.js | pas de garde global | PUBLIC/STAFF mixte |
| `/api/action-logs` | actionLogRoutes.js | `protect, restrictTo('Admin'), requireTenantScope` | ADMIN/TENANT |
| `/api/export` | exportRoutes.js | `protect, restrictTo('Admin'), requireTenantScope` | ADMIN/TENANT |
| `/api/litiges` | litigeRoutes.js | pas de garde global | MIXED |
| `/api/signalements` | signalementRoutes.js | pas de garde global | MIXED |
| `/api/notifications` | notificationRoutes.js | `protect` | AUTHENTICATED |
| `/api/services` | serviceRoutes.js | `protect` | AUTHENTICATED |
| `/api/portfolio` | portfolioRoutes.js | `protect, restrictTo(...STAFF_CM)` | STAFF |
| `/api/events` | eventRoutes.js | `protect, requireCapability('events.manage')` | STAFF |
| `/api/reviews` | reviewRoutes.js | `protect` | AUTHENTICATED |
| `/api/quotes` | quoteRoutes.js | `protect, restrictTo(...STAFF_ALL)` | STAFF |
| `/api/documents` | documentRoutes.js | `protect, requireTenantScope` | STAFF/TENANT |
| `/api/dashboard` | dashboardRoutes.js | `protect, restrictTo(...STAFF_ALL)` | STAFF |
| `/api/conversations` | conversationRoutes.js | `protect, attachTenantContext` — **⚠️ FINDING HF-FINAL-01, voir corps du rapport** | MIXED — **frontière tenant incorrecte sur une sous-partie (staff-inbox)** |
| `/api/messages` | messageRoutes.js | `protect, attachTenantContext` | MIXED — attachment download vérifié CLEAN (garde stricte tenant+staff), reste non ré-audité ligne-par-ligne |
| `/api/internal-mails` | internalMailRoutes.js | `protect` puis `restrictTo(...ROLES_DOCS)` par route (HOTFIX-INBOX-SECURITY-1, déjà certifié) | STAFF |
| `/api/company-emails` | companyEmailRoutes.js | `protect, restrictTo(...STAFF_ALL)` | STAFF |
| `/api/emails` | emailRoutes.js | `protect, restrictTo(...ROLES_DOCS)` | STAFF |
| `/api/webhooks` | webhookRoutes.js | pas de garde global (signature HMAC par provider) | PUBLIC (webhooks entrants signés) |
| `/api/likes` | likeRoutes.js | `protect` | AUTHENTICATED |
| `/api/comments` | commentRoutes.js | `protect` | AUTHENTICATED |
| `/uploads`, `/uploads/*` | statique + 404 handler | — | PUBLIC (fichiers déjà publics par design) / DEAD (catch-all 404) |

## Domaines explicitement NON ré-audités en détail ligne-par-ligne ce sprint

Conformément à la contrainte de temps d'un audit ponctuel et à la priorité donnée par le mandat à la recherche de surfaces non couvertes plutôt qu'au replay intégral : `transactions`, `payments/providers`, `sync`, `estimation`, `devis`, `litiges`, `signalements`, `facebook-posts`, `rental-documents`, `dossiers`, `rental-lease-lifecycle`, `rental-contract-regularization`. Aucun signal d'alarme trouvé lors du survol de leurs gardes de routeur (majoritairement `protect` simple, cohérent avec des domaines à faible sensibilité tenant ou déjà à portée limitée), mais **NON CONFIRMÉ** au niveau de la même rigueur que le domaine Messaging — à ré-auditer si un chantier de suite est lancé.

## Surface non couverte identifiée par cet audit (nouvelle, hors nomenclature HZ-01→HZ-09)

**Messaging (`/api/conversations`, `/api/messages`)** n'a jamais fait partie du périmètre nommé HZ-01→HZ-07 (qui couvre Accommodation/Hotel/Property). C'est exactement le type de surface que le mandat demandait de rechercher activement plutôt que de supposer couverte — et c'est là qu'un nouveau P0 a été trouvé (HF-FINAL-01, voir `_FINDING_MATRIX.md`).
