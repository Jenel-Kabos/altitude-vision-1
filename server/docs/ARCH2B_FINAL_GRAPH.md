# ARCH-2B — Graphe final CRM / Marketing / Notification

Le graphe final ne contient aucune composante fortement connexe.

```text
server.js
   └─ initialise crmAutomationEngine
                    │
                    ├─→ crmAutomationActions ─→ crmService ─→ notificationService
                    │          │                      │                │
                    │          └─→ marketingCampaign ─┼─→ notificationObservationPort
                    │                    │             │
                    │                    └─→ marketingSegment
                    │                              ├─→ crmCockpit ─→ crmService
                    │                              └─→ crmScore   ─→ crmService
                    │
                    └─→ notificationObservationPort ←─ notificationService
```

Le port est un point de rencontre sans dépendance sortante : Notification y publie et CRM y enregistre son callback. Il n'importe aucun des deux domaines. L'ancienne arête `notificationService → crmAutomationEngine` n'existe plus.

Mesure finale : 462 fichiers, 1 509 arêtes internes, 0 cycle fort, 0 nouvelle violation ARCH-2A. Le baseline machine-readable contient désormais `"cycles": []`.
