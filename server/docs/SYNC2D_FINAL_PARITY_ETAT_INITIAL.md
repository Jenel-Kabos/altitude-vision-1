# SYNC-2D — État initial : parité fonctionnelle finale Web ↔ Mobile

Date : 2026-08-15. Branche `main`, HEAD `0fc4157262d3a8b69e86b02cda66cb95d2e26ed5` (identique à SYNC-2C, non commité, `git diff --check` propre). Ce document précède les corrections de ce sprint.

## 1. Rapports lus

`SYNC1_WEB_MOBILE_REPORT.md`, `SYNC1_PARITY_MATRIX.md`, `SYNC2A_MOBILE_FOUNDATIONS_REPORT.md`, `SYNC2B_MOBILE_PMS_REPORT.md`, `SYNC2B_PMS_PARITY_MATRIX.md`, `SYNC2C_MOBILE_NOTIFICATIONS_REPORT.md`, `SYNC2C_NOTIFICATION_PARITY_MATRIX.md`, `E2E1_PMS_REPORT.md`, `GL_MOBILE_1_REPORT.md`/`GL_MOBILE_1_AUDIT.md`. Aucun fichier `GL-B2`/`GL-B3`/`GL-B3.1` n'existe littéralement dans `server/docs/` — le travail correspondant (portail locataire natif) est documenté sous `GL_MOBILE_1_*`, revérifié directement en §3.

## 2. Réaudit des 33 lignes SYNC-1 après SYNC-2A/B/C

| Ligne SYNC-1 | Verdict SYNC-1 (5 août) | État réel au 15 août | Preuve |
|---|---|---|---|
| Auth mobile (tokenVersion/compte désactivé) | Absent | **Fermé** SYNC-2A | `api.js` `isAccountDisabledError`, testé |
| Tenant runtime mobile | Absent | **Fermé** (scaffold) SYNC-2A | `PlatformTenantRuntimeContext.jsx`, testé |
| IAM-3 mobile | Absent | **Fermé** (projection) SYNC-2A | `staffCapabilities.js`, testé |
| PMS — housekeeping/inspection/maintenance/cockpit/financial readiness | Absent | **Fermé** SYNC-2B | 4 écrans + services, testés |
| Realtime hôtel mobile | Absent | **Fermé** (scaffold) SYNC-2A, **consommé** SYNC-2B | `useHotelRealtime`, testé |
| Notifications hospitality sans destination | Absent | **Fermé** SYNC-2C | 4 destinations registry + mappings serveur |
| Notification router dupliqué | Non détecté en SYNC-1 | **Trouvé et fermé** SYNC-2C | `NotificationsScreen.jsx` unifié |
| Portail locataire (GL-MOBILE-1) | Fermé avant SYNC-1 (5 août) | **Toujours vrai**, revérifié §3 | `TenantPortalScreen.jsx` inchangé |
| Hébergement indépendant (ACC-MOBILE-1) | Fermé avant SYNC-1 | **Toujours vrai** | Inchangé depuis |
| Documents personnels (DOC-MOBILE-1) | Fermé avant SYNC-1 | **Toujours vrai** | Inchangé depuis |
| Cockpit patrimoine propriétaire immobilier | Absent | **Toujours absent** | `MesAnnoncesScreen.jsx` reste un résumé, aucun sprint OWNER-MOBILE-1 |
| Portefeuille hébergement (Hôtel/Maison) mobile | Absent | **Toujours absent** | Aucune destination `MY_ESTABLISHMENTS.mobileRoute` |
| Client (recherche/favoris/visites/messages) | Quasi complet | **Inchangé**, aucune régression détectée | Non retouché par SYNC-2A/B/C |
| Altcom/Mila Events | Web-only | **Toujours Web-only**, jamais construit | Aucune trace mobile |
| `contrat_*`/`loyer_*`/`quote_*` notifications | Reportés SYNC-2C | **Analysés ce sprint**, voir §4 | Producteurs backend audités |

## 3. Locataire mobile — revérification directe (mandat §23, ne pas supposer SYNC-1 à jour)

`TenantPortalScreen.jsx` inchangé depuis GL-MOBILE-1 : sections `dashboard, lease, payments, documents, notice, maintenance` confirmées présentes (`SECTIONS`/`renderContent`), limite de 5 photos maintenance toujours appliquée (`photos.slice(0, 5)`, ligne 107). Aucune régression, aucun nouveau gap.

## 4. Producteurs réels de `contrat_*`/`loyer_*`/`quote_*` (recherche exhaustive, jamais supposée)

- `loyer_paye`, `loyer_en_retard` : déclarés dans `Notification.js` (enum) mais **aucun producteur** trouvé dans tout `server/` (`grep` exhaustif). Types morts, jamais émis. Classification : **LEGACY / à ne pas reproduire**.
- `contrat_new` : produit par `controllers/contratController.js:158`, envoyé **simultanément** au propriétaire ET au locataire (`notify()` en boucle sur les deux `userId`), `data: { screen: 'Profil' }` générique. Un seul `type` pour deux audiences aux besoins différents (propriétaire → GL, locataire → `TENANT_LEASE`) — impossible à mapper correctement à une destination unique sans modifier le producteur pour distinguer le destinataire. Documenté comme dette réelle, pas contournée par une fausse destination.
- `contrat_updated` (cycle de vie) : produit par `rentalLeaseLifecycleService.js`/`propertyAssetLifecycleService.js` via `notifyStaff` (audience staff uniquement, jamais locataire/propriétaire). Déjà mappé `LEASES`/`PROFILE`, `LEASES.mobileRoute: null` — cohérent, aucun dashboard GL staff mobile n'existe.
- `quote_received/status/response` : domaine Altcom/devis (`controllers/altcomController.js`, `controllers/quoteController.js`). Aucune surface Altcom mobile n'existe (confirmé §6). Classification : **WEB-ONLY JUSTIFIÉ**.

## 5. Réserves SYNC-2C à fermer ce sprint

Tests cross-owner et cross-tenant sur le chemin notification→navigation→backend (mandat §46-48, §74), jusque-là non écrits spécifiquement pour ce chemin mobile.

## 6. Ce qui reste hors périmètre (documenté, pas construit par réflexe)

Cockpit patrimoine propriétaire immobilier, portefeuille hébergement mobile, Altcom/Mila mobile, dashboard GL staff mobile — tous confirmés absents et volontairement non construits ce sprint faute de besoin métier démontré au-delà de ce qui existe déjà (mandat §90).
