# RBAC-5 — ARCHITECTURE FINALE

```
                    User
                      │
                      ▼
                 User.role
                      │
                      ▼
          server/utils/iamArchitecture.js
           (DEFAULT_CAPABILITIES — source
            canonique unique, backend-only)
                      │
             getEffectiveCapabilities(role)
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
  Auth payload Web            Auth payload Mobile
  (login, /auth/google,       (login, /auth/google,
   /auth/google-token, /me)    /me — mêmes endpoints)
        │                           │
        ▼                           ▼
  client/lib/context/         altimmo-app/src/context/
  AuthContext.jsx                AuthContext.jsx
      can(capability)             can(capability)
   (helper canonique unique,   (helper canonique unique,
    fail closed)                fail closed, aucun
                                 consommateur UI de
                                 production actuellement)
```

**Backend enforcement (l'autorité réelle, jamais contournée par ce qui précède)** :
- `requireCapability(...)` / `requireCapabilityForStaff(...)` — ~46 points d'application, dont la route pilote `properties.update` (RBAC-2).
- `restrictTo(...)` — mécanisme legacy actif, ~118 points d'application, coexistant délibérément (pas une source de vérité concurrente, juste un second point d'application lisant la même `req.user.role`).
- Tenant guards (`tenantContext.js`, `requireTenantScope`, `tenantResourceAttributionService.js`).
- Ownership guards (`resource.owner === req.user.id` et équivalents, par domaine).
- `HotelStaffAssignment` — autorisation scopée par établissement, jamais globalisée.
- `financialAuthorizationService` — invariants financiers spécialisés.
- `PlatformOperator` — contexte plateforme, sélection de tenant, fail-closed.

**Identité métier (orthogonale à l'autorisation staff, jamais fusionnée)** :
- `UserBusinessProfile` (`proprietaire_immobilier`, `exploitant_etablissement`, `locataire`, `client`).
- `Client` / `Proprietaire` (rôles externes, identité d'usage plutôt que permission staff).
- Relations à la ressource (ownership) — qui possède/loue/gère quoi, indépendamment de ce qu'un rôle staff peut faire.

## Ce qui a disparu

- `client/lib/utils/staffCapabilities.js` et son test (mapping rôle→capacités dupliqué, Web).
- `altimmo-app/src/utils/staffCapabilities.js` et son test (même duplication, Mobile).
- 3 déclarations littérales séparées de la même valeur d'ensemble (`STAFF_DOC`/`ROLES_PAIEMENTS`/`ROLES_DOCS`), remplacées par des alias d'une unique constante (`CANONICAL_DOC_STAFF_ROLES`) — les noms restent, la duplication de donnée non.

## Ce qui reste, délibérément

- `restrictTo(...)` sur ~118 sites backend — mécanisme legacy fonctionnel, non converti mécaniquement (mandat §26-28).
- ~9 patterns `AUTHORIZATION_STAFF` Web non migrés (`isStaffImmo`, `isStaffDocs`, listes de rôles locales dans des pages non pilotes) — candidats documentés pour un futur sprint, pas des failles de sécurité (le backend reste l'autorité réelle indépendamment de ce que montre l'UI).
- `canAdd` mobile — mélange rôle staff/identité métier, non démêlé faute de preuve produit.
- `GestionLocativePage.jsx`/`TransactionsPage.jsx` — divergences caractérisées (RBAC-3), non corrigées faute de contrat produit validé.
- Résolveurs de redirection post-login Proprietaire — drift UX indépendant du modèle d'autorisation, hors RBAC.
- 8 capacités déclarées mais non consommées par aucun point d'application — contrat du rôle, pas du code mort.
- `CANCEL_ROLES` (`paiementController.js`) — défense en profondeur consciente, une entrée structurellement inatteignable mais volontairement conservée.

## Principe validé par ce sprint

Chaque décision d'autorisation a désormais une seule source de vérité appropriée à sa nature : les capacités staff nommées viennent exclusivement de `iamArchitecture.js` (jamais recalculées ni redupliquées côté client) ; l'ownership, le tenant, l'hôtel et le financier restent des systèmes spécialisés distincts, jamais réduits à une capacité générique ; l'identité métier externe (Client/Proprietaire/businessProfiles) reste explicite et distincte de la permission staff. Aucune de ces distinctions n'a été confondue ou fusionnée artificiellement.
