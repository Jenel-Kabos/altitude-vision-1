# TENANT-SCOPE-HORIZONTAL-FINAL-AUDIT-1 — Risques résiduels

Ce document ne prétend pas "la sécurité est parfaite". Il énumère précisément ce qui est fermé, ce qui reste accepté/différé, et ce qui reste nouvellement ouvert.

## Fermé (certifié, revérifié vert ce sprint)

- HZ-01 (AccommodationReservation mutations), HZ-02 (Calendar/Blocks), HZ-03 (Reservation list), HZ-04 (Accommodation admin/pending), HZ-05 (HotelReservation admin/pending), HZ-06 (Hotel admin), HZ-07 (Property moderation) — cluster revérifié **137/137** tests verts.
- Dev Portal / API keys (nouvelle surface auditée ce sprint) — CLEAN.
- Dashboard Analytics — CLEAN (garde routeur fail-closed confirmée).

## Nouveau — OUVERT (bloque la certification finale)

- **HF-FINAL-01** (P0, CONFIRMED_RUNTIME) — Messaging (`conversationController.js`) : frontière tenant contournée pour un staff à contexte tenant ambigu (multi-tenant sans sélection). Lecture, suppression et envoi cross-tenant démontrés en conditions réelles. **La campagne ne peut pas être clôturée tant que ce point n'est pas traité.**

## Nouveau — RBAC (classé séparément du tenant, non bloquant pour CE mandat mais à traiter)

- **RBAC-FINAL-01** (P1/P2, STATICALLY_EXPLOITABLE) — `GET /accommodations/:id/availability-blocks` accessible à tout utilisateur authentifié sans vérification d'ownership. Confirme l'état "toujours actuel" du finding déjà connu cité par le mandat §30/§68. Recommandation : sprint RBAC dédié.

## Déjà connu, différé (inchangé par cet audit)

- **HZ-08** (P2/DEFERRED) — `assertResourceTenantOrUnattributed` : 376 ressources historiques `unresolved` (67 déterministes, 309 nécessitant validation). Aucune surface nouvellement auditée ce sprint n'amplifie cet impact — au contraire, HF-FINAL-01 est un mécanisme **différent** (contexte tenant ambigu pour un acteur vivant, pas une ressource historique orpheline), documenté séparément pour ne pas brouiller la classification de HZ-08. Reste `KNOWN_ACCEPTED_LEGACY_RISK`, non corrigé (hors périmètre).
- **HZ-09** (P3/RECLASSIFIED) — 15 appels directs à `resolveTenantForUser`, resolver canonique, aucune fuite cross-tenant démontrée, deux divergences d'en-tête fail-closed 403 (déjà connues). Aucune nouvelle preuve trouvée ce sprint qui justifierait de le re-classifier en P2/P1 — reste P3 architecture/fiabilité, non corrigé.

## Domaines non ré-audités à profondeur suffisante (NI confirmés propres NI confirmés vulnérables)

`transactions`, `payments/providers`, `sync`, `estimation`, `devis`, `litiges`, `signalements`, `facebook-posts`, `rental-documents`, `dossiers`, `rental-lease-lifecycle`, `rental-contract-regularization`, Finance au-delà de `assertFinancialScope` (agrégations/rapports détaillés). Domaine rental classique (`Contrat`/`Paiement`/`Locataire`/`Litige`/`Proprietaire`) confirmé **hors périmètre tenant-scope par construction** (aucun champ `tenant` dans ces modèles) — pas un risque tenant, potentiellement un périmètre RBAC/ownership distinct non évalué ici.

## Ce que cet audit NE dit PAS

Il ne dit pas que ces domaines non ré-audités sont sûrs. Il dit qu'ils n'ont pas été examinés à la même profondeur que Messaging/Dev-Portal/Dashboard-Analytics dans le temps imparti à ce sprint, et que rien dans leur garde de routeur de premier niveau n'a déclenché d'alerte lors du survol effectué.
