# ARCH-2D1 — Sélection du cluster pilote

Le cluster **échéancier de bail** est retenu. Le symbole `generatePaiements` avait une responsabilité unique, une signature de données explicite, deux consommateurs au total après extraction et une seule dépendance interne (`Paiement`). Il ne lit aucun contexte HTTP, tenant, ownership, IAM ou PlatformOperator.

Le risque métier est moyen car des échéances financières sont créées, mais il ne s'agit ni de confirmation de paiement, ni de ledger, payout, checkout ou reversal. Le comportement existant a donc été figé par cinq tests avant déplacement.

Restent hors périmètre :

- publication mobile : mutation Property transactionnelle et sensible ;
- reporting : quatre edges mais une surface multi-domaines, tenant, Hotel et financière ;
- `runPropertySearch` : dernière controller→controller conservée conformément à ARCH-2C4.

Aucune abstraction équivalente n'existait. Le propriétaire retenu, `services/rentalPaymentScheduleService.js`, exprime le domaine et évite tout service générique.
