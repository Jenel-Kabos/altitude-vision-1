# PAY-6.1 — Matrice justificatif privé

| Cas | Résultat |
|---|---|
| JPEG/PNG/PDF réel, ≤ 8 Mio, paiement manuel pending | Accepté |
| MIME autorisé mais signature binaire mensongère | Refus 400 |
| Type différent / plusieurs fichiers / taille excessive | Refus par middleware |
| Remplacement tant que pending | Autorisé ; ancien objet privé supprimé après bascule DB |
| Remplacement après succeeded/failed | Refus 409 |
| Upload | Ne confirme, n'alloue, ne crée ni ledger de paiement ni reçu |
| Stockage | Cloudinary `authenticated`, purpose `financial`, jamais d'URL publique persistée |
| Lecture | Buffer servi par endpoint authentifié, `private, no-store`, `nosniff` |
| Exposition API | Métadonnées minimales et endpoint ; aucune clé Cloudinary |

Champ multipart : `proof`. Un seul justificatif actif par paiement.
