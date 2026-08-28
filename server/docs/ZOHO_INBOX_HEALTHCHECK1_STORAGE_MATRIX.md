# ZOHO-INBOX-HEALTHCHECK-1 — MATRICE DE STOCKAGE (Mongo, lecture seule)

Requêtes exécutées : `InternalMail.findOne(...).lean()` / `.find(...).sort().limit().lean()` / `User.findOne(...).lean()` / `.countDocuments(...)`. **Aucune écriture** (`create`/`save`/`updateOne`/`deleteOne` jamais appelés).

## Recherche du message de test par `Message-ID`

`zohoMessageId: "<CAKXuA7CqTWmydp7Ktgc9uYrqHgf_xq7wZ9Hm0KrhaGW5qFDL+A@mail.gmail.com>"` (Message-ID exact de l'email UID 113 dans Zoho) → **AUCUN document trouvé dans `InternalMail`.**

## Les deux derniers emails externes réellement stockés

| Sujet (tronqué) | Expéditeur | Destinataire | `createdAt` | `zohoMessageId` |
|---|---|---|---|---|
| "Demande de partenariat – BTL..." | `bohdana_btl_africa@1xpartner.com` | `contact@altitudevision.agency` | 2026-08-19T13:15:02Z | `<CAPU9k4mX3juZNHzaAn9KsZjFbAbPLQksaNK6UEtA2U-AKoQfPw@mail.gmail.com>` |
| "Compliance monitoring detected..." | `61375352@continental.edu.pe` | `contact@altitudevision.agency` | 2026-08-18T22:45:04Z | `<a8925ac2-7072-28e0-7e04-1a2c318e6d3e@continental.edu.pe>` |

**Ces deux `zohoMessageId` correspondent EXACTEMENT aux `Message-ID` des UID 112 et 111 lus en direct dans Zoho** (voir `_IMAP_MATRIX.md`) — preuve directe et datée que le pipeline complet a fonctionné avec succès jusqu'à ces deux messages inclus.

## Résolution du destinataire pour le message de test (mandat §31 — tenant/scope)

`InternalMail` n'a pas de champ tenant (confirmé par `INBOX1_ARCHITECTURE.md`, inchangé). La résolution du destinataire suit `toAddress = contact@altitudevision.agency` :
- `User.findOne({ email: 'contact@altitudevision.agency' })` → **AUCUN utilisateur trouvé** (cette adresse est la boîte partagée de l'agence, pas un compte utilisateur individuel).
- Repli `User.findOne({ role: 'Admin', isActive: true })` → **1 Admin actif trouvé** (`_id: 6a7de24d48d42c4c87f893d5`), utilisé comme destinataire de repli.

**Conclusion déterminante** : si le poller avait traité le message UID 113 pendant qu'il était encore non lu, la résolution du destinataire **aurait réussi** via ce repli Admin — ce n'est donc **pas** la cause de l'absence en base (le chemin "permanent_rejection" ne s'applique pas ici, la résolution destinataire n'échoue pas pour ce message). Voir `_ROOT_CAUSE.md`.

## Erreurs de sauvegarde (mandat §30)

Non applicable — le message n'a jamais atteint l'étape `InternalMail.create(...)` (confirmé par son absence totale en base, y compris comme document partiel ou en erreur). Aucune trace de validation error, duplicate key ou schema drift à investiguer pour ce message : le blocage est **en amont** de la tentative de sauvegarde.
