# ARCH-2B — Contrat comportemental

| Propriété | Avant | Après |
|---|---|---|
| Déclencheur | Une notification vient d'être persistée par `notify()` | Identique |
| Observation CRM | `crmAutomationEngine.handleEvent` via `require()` différé | Même fonction via callback enregistré explicitement |
| Payload | `type`, recipient stringifié, sender, entity type/id normalisés, metadata, audience, dedupe key, notification id, tenant | Identique, testé par égalité structurale |
| Destinataire | `recipient` de la notification | Identique |
| Tenant | `platformTenantId` transmis sans transformation | Identique ; aucun fallback cross-tenant |
| Synchronisme | Microtask fire-and-forget après persistance | Microtask fire-and-forget après persistance |
| Valeur retournée à `notify()` | Aucune valeur CRM utilisée | Identique |
| Erreur CRM | Avalée, la notification continue | Identique ; le port résout `[]` |
| Transaction | Déclenchement après `Notification.create`; aucune transaction partagée | Identique |
| Nombre | Une publication par notification créée ; zéro sur collision de `dedupeKey` retournée avant le hook | Identique |
| Socket.IO | Émis par `notificationService`, indépendamment du callback | Identique |
| Expo push | Envoyé par `notificationService`, indépendamment du callback | Identique |
| Webhook public | Dispatch distinct, inchangé | Identique |

Les tests couvrent le payload producteur, deux publications successives donnant deux traitements, l'échec best-effort, l'absence d'observateur et le refus d'une double registration différente. Le test Mongo CRM existant caractérise le parcours réel notification → règle → activité.
