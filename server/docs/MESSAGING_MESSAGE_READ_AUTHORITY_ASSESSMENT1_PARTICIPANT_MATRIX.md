# MESSAGING-MESSAGE-READ-AUTHORITY-ASSESSMENT-1 — Matrice participant

| Scénario | Participant réel de la conversation ? | Lecture obtenue |
|---|---|---|
| Client A → conversation privée (Client B ↔ Client C) | Non | **Oui — reproduit** |
| Client A → sa propre conversation | Oui | Oui (attendu, correct) |
| Proprietaire A → conversation d'un tiers | Non | Oui (déduit, même chemin de code que Client) |
| Staff A (même tenant) → conversation privée (Staff B ↔ Client tiers), **pas** `isStaffInbox` | Non (ni participant, ni conversation de la boîte partagée) | **Oui — reproduit** |
| Staff A → boîte partagée (`isStaffInbox:true`) de son tenant | Non au sens strict, mais autorité légitime déjà établie ailleurs (`getStaffInbox`) | Oui — cohérent avec le contrat existant pour la LISTE, mais `getMessages` ne fait pas cette distinction : il autorise aussi les conversations **privées non-staff-inbox** d'un autre staff, ce qui dépasse le contrat |
| Staff A → sa propre conversation 1-à-1 | Oui | Oui (attendu, correct) |

## Le simple `conversationId` suffit-il ? (mandat §17/§34)

**Oui, entièrement confirmé.** Aucune autre information n'est nécessaire : un ObjectId valide (24 caractères hexadécimaux, format vérifié mais pas l'appartenance) suffit à obtenir l'intégralité des messages de n'importe quelle conversation du système, pour n'importe quel acteur authentifié dont le `req.platformTenant` est soit non résolu (Client/Proprietaire — toujours le cas), soit résolu et correspondant/non-attribué (staff/PlatformOperator).

## ObjectId predictability (mandat §35)

Les ObjectId Mongo ne sont pas séquentiels de façon triviale mais sont **prévisibles dans le temps** (encodage d'un timestamp sur les 4 premiers octets) et peuvent être obtenus par un attaquant de multiples façons légitimes : présents dans les réponses d'autres endpoints déjà accessibles à l'attaquant (ex. tout endpoint qui liste ou référence une conversation), dans les WebSocket events (`new-message`/`new-staff-message` portent `conversationId` en clair), ou par énumération à faible coût vu l'absence de rate-limiting spécifique observée sur cette route. Aucune preuve de connaissance privilégiée n'est requise.
