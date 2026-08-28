# ARCH-2H — Analyse de l'edge

Avant extraction, `routes/devisRoutes.js` importait `../models/Devis` et l'utilisait dans trois endpoints :

- `POST /api/devis` : `Devis.create(payload)` ; création publique après validation de présence effectuée par la route.
- `GET /api/devis` : `Devis.find().populate('traitePar', 'name').sort('-createdAt')` ; lecture staff.
- `PATCH /api/devis/:id` : `findById`, affectations conditionnelles de `statut` et `noteInterne`, affectation systématique de `traitePar`, `save`, puis `populate`.

Classification : query applicative + mutation applicative. Ce n'est ni une validation métier, ni une décision d'autorisation, ni un scope tenant/ownership, ni une génération de document. `protect` et `restrictTo(...ROLES_ESTIMATION)` restent dans la route. L'hypothèse ARCH-2G est donc confirmée.

Side effects : DB sur les trois usages ; notification staff et email best-effort après création. Aucun Socket.IO, Cloudinary, PDF, journal financier ou transaction Mongo. Les deux providers restent appelés depuis la route dans le même ordre.
