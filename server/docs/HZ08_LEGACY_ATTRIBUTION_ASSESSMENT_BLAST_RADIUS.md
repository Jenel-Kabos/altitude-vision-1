# HZ-08 — Blast radius

| Surface | Constat |
|---|---|
| Models | Au moins Property, Hotel, Accommodation, réservations, RentalManagement, Contrat, Paiement, Proprietaire, Locataire, Conversation, Message, Document, User et extensions storage/finance/CRM |
| Routes | Pattern LIVE transversal sur GL, immobilier, hébergement, messagerie, documents et profils |
| Services | attribution partagée, régularisation, notifications, storage |
| Web | Consumers confirmés : gestion locative, documents, profils, réservations et messagerie |
| Mobile | Consumers confirmés : profils, réservations, RentalManagement owner, conversations/messages |
| Jobs | aucun cron/worker relié confirmé ; scripts CLI offline confirmés |
| Tests | contrats attribution, isolation, compatibilité et régularisation nombreux |
| Historical data | 376 ressources auditées dans la preuve existante ; 309 non exécutables automatiquement |
| Tenant | mismatch resolved bloqué ; unresolved sans frontière déterminée |
| Ownership | doit rester un garde séparé ; couverture variable par domaine |
| RBAC | inchangé ; limite l'accès initial mais ne choisit pas le tenant d'un unresolved |
| Sensitive data | PII, documents, messages, réservations et finance possibles selon le consumer |

Impact potentiel sans exagération : consultation ou mutation d'une ressource historique inattribuable par un staff d'un autre tenant logique, notifications/emails/workflows/documents selon le handler atteint. Aucun transfert de tenant, mass assignment, mutation production ou perte financière n'a été démontré durant cet audit.

