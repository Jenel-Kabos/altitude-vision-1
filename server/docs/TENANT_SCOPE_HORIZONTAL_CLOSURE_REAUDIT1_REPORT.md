# TENANT-SCOPE-HORIZONTAL-CLOSURE-REAUDIT-1 — Rapport final

**Verdict : B. CAMPAIGN REMAINS OPEN — NEW BLOCKERS**
**HEAD git (inchangé avant/après) :** `a04055f62952c782b92aeef2f100824a17a5f645`
**Aucune modification de code de production. Aucun commit/push/deploy.**

## A. Baseline (Q1-12)

1. HEAD : `a04055f62952c782b92aeef2f100824a17a5f645`. 2. Branche : `main`. 3. Worktree initial : 616 lignes (`git status --short`), incluant l'héritage du hotfix précédent. 4. Diff initial : 67 fichiers, 997+/522- (préexistant, hors périmètre). 5. Architecture initiale : PASS. 6. Files : 473. 7. Edges : 1535. 8. Cycles : 0. 9. Unresolved : 0 (imports statiques). 10. controller→controller : 1. 11. service→controller : 2. 12. route→model : 12 edges / 11 routes.

## B. Historique des hotfixs (Q13-23)

13-19. HZ-01 à HZ-07 : tous RECONFIRMÉS VERTS sur leur périmètre exact (voir `_HOTFIX_VALIDATION_MATRIX.md`) — HZ-07 avec la réserve explicite que le chemin legacy parallèle `adminController.js` (RA-09) n'a jamais été couvert par ce hotfix. 20. HF-FINAL-01 : RECONFIRMÉ VERT (24/24), réserve RA-01 (`sendMessage` jamais couvert). 21. RBAC-FINAL-01 : RECONFIRMÉ VERT (12/12). 22. Message Read Authority : RECONFIRMÉ VERT (14/14), même réserve RA-01. 23. Régression détectée sur l'un d'eux ? **NON** — tous les findings de ce re-audit portent sur des surfaces distinctes, jamais sur le périmètre littéral déjà corrigé.

## C. Staff/Tenant (Q24-32)

24. Staff sans tenant fail-closed partout ? **NON** — fail-closed sur les domaines déjà couverts (Messaging lecture, Accommodation, Hotel, Property canonique, RentalManagement) ; **pas** fail-closed sur les 14 domaines en CONFIRMED GAP (aucun garde du tout, résolu ou non). 25. Exception trouvée ? Oui, RA-01 à RA-19 (voir `_FINDING_MATRIX.md`). 26. Multi-tenant staff sans header ? Refusé où le garde existe (HF-FINAL-01 réutilisé), sans effet différentiel où le garde n'existe pas (accès total dans tous les cas). 27. Invalid tenant header ? Idem. 28-29. Admin A→B / B→A ? Refusé sur les surfaces SAFE, **autorisé** sur les 14 surfaces vulnérables (Admin a la capacité joker `*`). 30-31. PO global/scopé ? Aucune notion de PO « scopé à des tenants précis » n'existe dans le modèle de données (RA-22, écart hypothèse/produit, pas un bug). 32. Fallback global restant ? Oui, RA-02, 04, 06, 07, 08, 14, 15, 16, 17, 19 (pattern `filter = {}` sans branche restrictive).

## D. Resource Authority (Q33-42)

33. Route auth-only sensible restante ? Oui — la plupart des 14 gaps sont en réalité RBAC-only (capacité de rôle) sans dimension tenant ni ownership. 34-36. findById/findByIdAndUpdate/findByIdAndDelete sans authority ? Oui — RA-01, RA-03, RA-05, RA-09, RA-10, RA-11, RA-12, RA-13 (détail `_OBJECTID_AUTHORITY_AUDIT.md`). 37. Client A→ressource B possible ? Non démontré pour Client (les gaps trouvés concernent principalement le staff) — RA-01 (`sendMessage`) est l'exception : exploitable par n'importe quel utilisateur authentifié, y compris Client. 38. Proprietaire A→ressource B ? Non démontré au-delà de RA-01. 39. Staff same-tenant sans resource authority ? Sans objet pour la plupart des gaps (le problème est cross-tenant, pas intra-tenant). 40. ObjectId IDOR confirmé ? Oui, 8 cas (voir Q34-36). 41. Participant bypass ? Oui, RA-01 (sendMessage). 42. Ownership bypass ? Oui, RA-11 (staff sans check alors que l'owner l'est).

## E. Messaging (Q43-53)

43. getMessages sécurisé ? **Oui**, inchangé depuis le hotfix précédent. 44. Client non-participant refusé (lecture) ? Oui. 45. Staff authority conforme au contrat ? Oui pour la lecture ; **non pertinent/absent** pour l'écriture (RA-01). 46. Tenant boundary Messaging ? Intacte pour la lecture, sans effet pour l'écriture côté Client/Proprietaire. 47. sendMessage ? **CONFIRMED GAP (RA-01), P0.** 48. deleteMessage ? SAFE (ownership direct). 49. deleteConversation ? SAFE (`assertConversationAccess`). 50. markAsRead ? SAFE (ownership direct). 51. attachment download ? SAFE mais incohérent (logique dupliquée au lieu du service partagé). 52. unread ? SAFE. 53. side effect unauthorized (sendMessage) ? Oui — un message réel est persisté, poussé en temps réel et notifié à la victime.

## F. Accommodation/Hotel (Q54-63)

54-63. Détail complet dans `_FINDING_MATRIX.md`/`_SECURITY_BOUNDARY_MATRIX.md`. Synthèse : Accommodation/Hotel/HotelReservation SAFE sur leur cœur fonctionnel (mutations, calendrier, listes admin/pending, réservations, lifecycle cross-tenant refusé) à l'exception de 3 findings ponctuels : RA-10 (`accommodationController.updateFull`), RA-13 (`hotelStaffAssignmentController`, assignment non recroisé avec hotelId), et RA-18 (rattachement à un Hotel arbitraire, composant de RA-10).

## G. Property/Rental (Q64-73)

64. Property moderation (canonique) ? SAFE. 65. approve/reject (canonique) ? SAFE. **Mais** un chemin legacy parallèle (RA-09, `adminController.js`) reproduit exactement l'ancienne vulnérabilité sur le même modèle, hard-delete inclus. 66. Property owner authority ? SAFE. 67. RentalManagement ? SAFE (`router.param` + `resolveScope`). 68. Contrat ? SAFE en détail (`:id`), **vulnérable en liste** (RA-04) et sur le routeur lifecycle séparé (RA-05). 69. Locataire ? SAFE en détail, vulnérable en liste (RA-15). 70. Paiement locatif ? Vulnérable en liste/stats/alertes/encaissement-multiple (RA-02, RA-03). 71. maintenance ? SAFE sauf la branche liste-sans-propertyId du staff (RA-19). 72. préavis ? Couvert par `gestionDocumentController`, SAFE (`router.param`). 73. reporting ? SAFE (masquage explicite plutôt que fuite globale).

## H. Finance (Q74-81)

74. FinancialDocument tenant-safe ? **Oui.** 75. FinancialPayment ? Oui. 76. Allocation ? Oui (cross-check `establishmentId`/`domain`). 77. JournalEntry ? Oui (même chaîne d'autorité). 78. invoices ? Oui. 79. checkout ? Oui. 80. finance cross-tenant reproduction ? **Oui, mais sur le sous-système distinct « Gestion Locative » (Paiement/Contrat), pas sur FinancialDocument/Payment** — reproduit par test réel (3/3 PASS, voir `_RUNTIME_REPRODUCTIONS.md`). 81. fallback global financier ? Oui, sur Paiement/Contrat/RentalLeaseLifecycle (RA-02, RA-03, RA-04, RA-05) ; non sur le sous-système Sprint Finance.

## I. Autres surfaces (Q82-89)

82. Notifications ? SAFE. 83. Documents (génériques) ? SAFE. 84. Visits ? **CONFIRMED GAP (RA-06)**, P1. 85. Transactions ? **CONFIRMED GAP (RA-14)**, P0 pour les mutations (finalize/cancel/valider virement), P1 pour la lecture. 86. Dashboard Analytics ? SAFE (garde de route explicite pour le seul cas de fallback identifié, RA-13-like documenté comme voulu). Dashboard KPI globaux : CONFIRMED GAP mineur (RA-17), P2. 87. Developer Portal/API keys ? SAFE, scopé au tenant de l'acteur. 88. Moderation générique ? Litiges/Signalements en CONFIRMED GAP (RA-07). 89. Nouvelle surface non auditée découverte ? Oui — Quote/Devis (RA-16, absence totale de concept tenant, à trancher au niveau produit).

## J. Dettes (Q90-97)

90-92. HZ-08 : toujours LIVE, toujours P2/DEFERRED, aucune nouvelle exploitation démontrée. 93-94. HZ-09 : toujours LIVE, toujours P3/RECLASSIFIED. 95. errorMiddleware toujours incorrect (500 au lieu de 404/403) ? Oui, inchangé. 96. Autorisation reste-t-elle fail-closed malgré cela ? Oui, là où un garde existe ; sans objet là où aucun garde n'existe (RA-01 à RA-19). 97. controller→controller dette inchangée ? Oui, toujours 1.

## K. Findings (Q98-105)

98. Nouveau P0 trouvé ? **Oui, 5** (RA-01, RA-02, RA-03, RA-05, RA-09). 99. Nouveau P1 ? Oui, 9 (RA-04, RA-06, RA-07, RA-08, RA-10, RA-11, RA-12, RA-13, RA-14 [partiel], RA-15). 100. Nouveau P2 ? Oui, 4-5 (RA-16 à clarifier, RA-17, RA-18, RA-19). 101. Nouveau P3 ? Oui, 2 (RA-20, RA-21, dettes de cohérence). 102. Runtime reproduction ? Oui pour RA-02/RA-03 (test réel 3/3 PASS) ; confirmation par lecture directe et convergente pour RA-01 et RA-09 ; confirmation par lecture de code par agent spécialisé pour le reste. 103. Nombre de findings bloquants ? 14 (RA-01 à RA-15, hors RA-16). 104. Blast radius ? Très large pour RA-02/03/05 (Admin, Secretaire, Collaborateur — 3 rôles staff courants, capacité joker ou explicite) ; large pour RA-01 (tout utilisateur authentifié) ; large pour RA-09 (tout Admin, hard-delete). 105. Hotfix nécessaire ? Oui, au moins 5 hotfixs ciblés distincts pour les P0 (voir `_DECISION.md`).

## L. Gates (Q106-121)

106. HZ cluster : inclus dans les 50/50 du cluster ciblé. 107. HF-FINAL-01 : 24/24 (dans le cluster). 108. Message Read Authority : 14/14 (dans le cluster). 109. RBAC-FINAL-01 : 12/12 (dans le cluster). 110. Security cluster (3 suites) : 50/50. 111-112. Backend : 141 suites / 1579 tests, 100 %. 113-114. Mongo : 112 suites / 1177 tests, 100 %. 115. Architecture finale : PASS, identique à l'initiale. 116. Cycles : 0. 117. Unresolved : 0. 118. New violations : 0. 119. Lint : 0 erreur / 108 avertissements (inchangé). 120. diff-check : 4 avertissements CRLF pré-existants inchangés. 121. Tests temporaires supprimés ? **Oui** — `_tmp_reaudit_paiement_tenant_leak.mongo.integration.test.js` créé, exécuté (3/3 PASS), supprimé, `git status` confirmé propre de toute trace.

## M. Drift (Q122-131)

122. Code production modifié ? **NON.** 123. Tests permanents modifiés ? **NON.** 124. Frontend modifié ? **NON.** 125. Mobile modifié ? **NON.** 126. Schema modifié ? **NON.** 127. Migration ? **NON.** 128. Production utilisée ? **NON** (MongoMemoryReplSet local uniquement). 129. Commit ? **NON.** 130. Push ? **NON.** 131. Deploy ? **NON.**

## N. Décision (Q132-141)

132. Tous les P0 connus sont fermés ? **NON** — 5 nouveaux P0 ouverts. 133. Tous les P1 connus sont fermés ? **NON** — 9 nouveaux P1 ouverts. 134. Un nouveau P0/P1 existe ? **OUI**, 14 au total. 135. HZ-08 peut rester deferred ? Oui, statut inchangé, non aggravé. 136. HZ-09 peut rester reclassifié ? Oui, statut inchangé. 137. errorMiddleware bloque-t-il la sécurité ? Non (défaut de code HTTP seulement, pas d'accès accordé à tort). 138. Campagne Tenant Scope peut-elle être fermée ? **NON.** 139. Release consolidation peut-elle commencer ? **NON** (réservé au verdict A). 140. Prochaine étape exacte ? Ouvrir une série de hotfixs ciblés pour les 5 P0 (au minimum), suivant la méthodologie déjà validée par cette campagne (rouge permanent → correction minimale → certification). 141. Verdict final ? **B. CAMPAIGN REMAINS OPEN — NEW BLOCKERS.**

---

**Fin du rapport TENANT-SCOPE-HORIZONTAL-CLOSURE-REAUDIT-1.**
