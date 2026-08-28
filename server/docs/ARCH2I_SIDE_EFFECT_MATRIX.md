# ARCH-2I — Matrice des effets

| Candidate | DB write | Email | Notification | Socket.IO | Cloudinary | Finance | Other |
|---|---|---|---|---|---|---|---|
| Estimation | create + mark viewed | 2 emails best-effort | staff best-effort | non | uploads privés | non | parsing multipart, normalisation, complétude, logs |
| Realisation | create/update/delete dans code non monté | non | non | non | non | non | logs |
| Projet | create/update/delete dans code non montable | non | non | non | non | non | modèle absent |

Pas de transaction Mongo explicite. Aucun des trois flux n'implique hôtel, gestion locative, messaging, Socket.IO, CRM ou journal financier. Estimation touche le domaine Property/valuation et des documents uploadés, mais l'edge inline ne produit ni PDF ni FinancialDocument.
