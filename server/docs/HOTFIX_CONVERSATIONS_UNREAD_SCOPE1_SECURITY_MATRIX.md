# HOTFIX-CONVERSATIONS-UNREAD-SCOPE-1 — Matrice sécurité

| Acteur | Contexte | Résultat `/count/unread` | Scope du count |
|---|---|---|---|
| Client ordinaire | Aucun tenant structurel | 200 | `receiver = user.id` uniquement |
| Proprietaire | Aucun tenant | 200 | Identité uniquement ; aucune conversation gagnée par ownership |
| Staff mono-tenant A | Tenant A auto-résolu | 200 | Messages A + inbox A/unattributed légitime |
| Staff multi-tenant | Tenant explicitement sélectionné | 200 | Tenant sélectionné uniquement |
| Staff sans tenant résolu/ambigu | Aucun | 403 | Aucune query compteur |
| Platform Operator | Aucun tenant sélectionné | 403 `PLATFORM_OPERATOR_TENANT_SELECTION_REQUIRED` | Aucune query compteur |
| Platform Operator | Tenant A sélectionné | 200 | Tenant A uniquement, jamais B |
| Sans token / token malformé | Sans objet | 401 | Aucune query compteur |

La route statique reste avant `/:conversationId`. Le middleware ciblé exécute la même résolution, le même enrichissement et la même construction d'erreur que `requireTenantScope`. Les conversations `tenant:null` restent accessibles au staff légitime disposant d'un tenant résolu, conformément à HOTFIX-MSG-STAFF-INBOX-1.
