# ARCH-2C2 — Contrat comportemental

- Fonction pure et synchrone : `serializeMessage(message)`.
- Document-like : appelle une fois `toObject()`; n'utilise pas `toJSON()` afin de conserver exactement le comportement historique.
- Plain/lean object : shallow-copy top-level.
- Ne mute pas l'entrée.
- Préserve ObjectId, objets populated, timestamps, contenu vide autorisé avec attachment, flags read/starred et champs optionnels.
- Transforme chaque attachment exactement une fois.
- Retire les références privées de stockage et URL legacy.
- Ne fait aucune query, permission, tenant, ownership, unread, notification ou émission Socket.IO.
- Les trois callsites HTTP utilisent désormais le même serializer spécialisé.

La caractérisation directe a été exécutée avant extraction et a passé 7/7. Elle couvre message minimal, sender ObjectId/populated, conversation populated, document-like, attachments privés/legacy, contenu vide, timestamps, read/unread et absence de données de stockage privées.
