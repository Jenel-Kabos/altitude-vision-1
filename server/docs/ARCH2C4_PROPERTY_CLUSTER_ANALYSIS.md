# ARCH-2C4 — Analyse du cluster Property

- Helpers sélectionnés : `uploadFilesToCloudinary`, `parseAmenities`, `parseStringArray`, `parseNonNegativeAmount`, `parseAddress`, `parseGeoLocation`, `parseNumericField`, `buildBasePropertyData`.
- Classement : parsing pur + adaptation upload + construction déterministe de payload; pas de query Mongo, HTTP response, auth ou mutation DB.
- Effet secondaire unique : upload Cloudinary, options et ordre inchangés.
- Champs sensibles : `status` est fourni explicitement par le caller; `statusAdmin` reste exactement `En attente`; `type`, `owner`, `pole`, `availability` sont copiés/défautés à l'identique. Aucun `isPublished`, `isApproved`, `listingType` ou tenant.
- Extraction : OUI, quatre consumers réels et responsabilité claire.
- `runPropertySearch` : NON dans ce sprint; mélange query, visibilité, filtres, pagination et Accommodation post-fetch, risque élevé.
- Aucune abstraction existante équivalente trouvée; `propertyFilterService` concerne la recherche, pas l'entrée publication.
