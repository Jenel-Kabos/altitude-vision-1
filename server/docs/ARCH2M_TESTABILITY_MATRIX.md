# ARCH-2M — Matrice de testabilité

| Edge | Tests directs | Tests indirects | Mongo/intégration | Tenant | Ownership | PlatformOperator | Finance | Difficulté |
|---|---|---|---|---|---|---|---|---|
| Accommodation | Unit handler : vide, formule, 422, owner 403 | Reporting base vide/HTTP | Pas de suite Mongo dédiée au symbole | Partiel indirect | Oui, unit mock | Reporting générique seulement | Valeurs réelles non caractérisées directement | MEDIUM |
| Hotel | Unit handler : vide | Reporting, OrgUnit hotelId, scopes hôtel et finance spécialisés | Nombreuses suites des owners voisins, aucune dédiée au symbole complet | Partiel/owners voisins | Indirect manager/assignments | Reporting adversarial générique | Dashboard financier très couvert, combinaison DomainReport partielle | LOW-MEDIUM |

## Plan de caractérisation Accommodation avant toute extraction

1. Mongo dédié : vide, hébergement publié/brouillon, Property disponible/maintenance, hôtel lié exclu.
2. Réservations : statuts, fenêtres jour/semaine/mois/année, nuits réservées/bloquées, occupation et limites temporelles.
3. Finance : documents annulés/non annulés, allocations actives, refunds completed/pending/failed, brut/net/solde et zéro mutation.
4. Scope : tenant A/B, sélection owner A/B, createdBy fallback, staff same/cross-tenant, PlatformOperator global.
5. Contrat : payload exact, fallbacks, erreurs Mongo, formule et `averageStayLength` du DomainReport.
6. HTTP parity : 200/403/404/422/500 et consumers Web.

## Plan de caractérisation Hotel avant toute extraction

1. Mongo dédié : publication, Property validée/disponible, actif/fermé, chambres et réservations par statut/date.
2. Opérations : housekeeping/maintenance ouverts, fallbacks et erreurs.
3. Scope : tenant A/B, manager legacy, HotelStaffAssignment actif/suspendu/expiré, zéro/un/plusieurs hôtels, requestedHotelId accessible/inaccessible.
4. PlatformOperator : global explicite et tenant sélectionné ; Admin ordinaire jamais global.
5. Finance : allocations/refunds/balances, dashboard financier période-aware, hotelId, RevPAR/ADR et absence de mutation.
6. HTTP/mobile parity : payload, 403/409/422/500 et cockpit Web/mobile.

Ces tests ne sont pas écrits dans ARCH-2M. Un Mongo ciblé serait requis pour les deux candidats ; Hotel demanderait la campagne la plus large.
