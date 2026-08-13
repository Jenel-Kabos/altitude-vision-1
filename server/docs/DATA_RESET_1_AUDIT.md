# DATA-RESET-1 — Audit Phase 1

Date : 2026-08-13  
Base résolue : `altitudevision` · hôte `***.atigmso.mongodb.net` · environnement déclaré `development`.

## Conclusion

La base contient désormais 104 collections et 718 documents. La stratégie proposée reste un `dropDatabase` contrôlé, suivi de la recréation des indexes depuis les 104 modèles Mongoose actuellement chargeables et d'un bootstrap minimal canonique.

Incident Phase 1 : le premier outil désactivait `autoIndex` mais pas `autoCreate`. Le chargement des modèles a créé cinq collections vides réelles : `chatmessages`, `privateassetmigrations`, `projects`, `quotes`, `realisations`. Aucun document n'y a été créé. L'outil impose désormais `autoCreate:false`; ces collections ne sont pas supprimées sans autorisation et sont incluses dans le nouveau manifeste.

Aucune collection n'est proposée à la conservation. `ActionLog` (169 entrées) est réinitialisé : ses logs sont liés aux essais ; le bootstrap produira ses propres nouveaux logs. `ApiKey`, webhooks et logs API sont tous à zéro et seront également réinitialisés. `facebookposts` (14) n'a plus de modèle Mongoose chargé : il s'agit d'une collection runtime/legacy de synchronisation Facebook, identifiée comme donnée d'essai et incluse dans le reset. `counters` est une collection d'infrastructure de séquence, également recréable.

## Collections et classification

Le tableau exhaustif des 104 collections, modèle correspondant, compte, catégorie, action et compte final attendu est figé dans le manifeste de revalidation. Toutes ont l'action `DROP_WITH_DATABASE` :

`accommodationavailabilityblocks`, `accommodationcalendarmutexes`, `accommodationnightlocks`, `accommodationreservations`, `accommodations`, `actionlogs`, `altcomprojects`, `apicalllogs`, `apikeys`, `comments`, `companyemails`, `constructioncostreferences`, `contactmessages`, `contrats`, `conversations`, `counters`, `crmactivities`, `crmautomationrules`, `crmautomationruns`, `crmconsolidations`, `crmcustomers`, `crmopportunities`, `devis`, `documents`, `emails`, `estimations`, `events`, `facebookposts`, `financialdocumentartifacts`, `financialdocumentdeliveries`, `financialdocumentlines`, `financialdocuments`, `financialledgerentries`, `financialpayments`, `financialproviderevents`, `financialrefunds`, `financialsequences`, `hotelreservationnotifications`, `hotelreservations`, `hotels`, `hotelstaffassignments`, `housekeepingtasks`, `internalmails`, `internalmessages`, `inventoryoperationlocks`, `likes`, `litiges`, `locataires`, `maintenancetickets`, `marketingcampaigns`, `marketingsends`, `marketingtemplates`, `marketingunsubscribes`, `marketpricereferences`, `messages`, `notifications`, `orgmemberships`, `orgunits`, `paiements`, `paiementtransactions`, `paymentallocations`, `pendingregistrations`, `platformoperators`, `platformtenantdomains`, `platformtenantfeatures`, `platformtenants`, `platformtenantsettings`, `platformtenantsubscriptions`, `platformtenantthemes`, `portfolioitems`, `properties`, `proprietaires`, `publicites`, `quoterequests`, `rateplans`, `realestateapplications`, `realestatereservations`, `rentalcontractreconciliations`, `rentalmaintenancetickets`, `rentalmanagements`, `rentalpaymentreceipts`, `reviews`, `roomassignments`, `roomcategories`, `roominspections`, `roominventories`, `rooms`, `salemanagements`, `services`, `signalements`, `tenantlinkrequests`, `transactions`, `userbusinessprofiles`, `users`, `valuationcalculations`, `valuationcoefficients`, `visites`, `webhooksubscriptions`, `writewindows`.

## Bootstrap et sécurité

Tous les 11 Users seront supprimés. Recommandation : nouveau User Admin, email fourni explicitement et mot de passe transmis via entrée sûre au moment de la Phase 2, jamais dans le dépôt ou le rapport. Ensuite, `platformTenantService.createTenant` créera Altitude Vision, sa racine, Settings, Theme et Subscription ; `organizationService.grantMembership` créera un membership `owner`; le mécanisme certifié PlatformOperator créera l'opérateur actif. `User.role=Admin` ne devient pas un bypass plateforme.

La Phase 2 doit être manifest-bound, exiger la base, le resetId, le hash, l'email Admin explicite et un secret hors arguments persistants. Après drop, l'état est `RESET_DONE / BOOTSTRAP_PENDING`; la recovery consiste à garder l'application en maintenance, recréer les indexes, puis reprendre uniquement le bootstrap minimal. Aucun trafic ne doit être rouvert entre les deux.

## Cloudinary et externes

Cloudinary reste inchangé ; des assets orphelins peuvent subsister. Aucun email, paiement, publication Facebook, credential, Netlify ou Render n'est touché.
