# HZ-09 — Décision

## AUDIT CERTIFIÉ — RECLASSIFY

HZ-09 est LIVE comme pattern transversal : 15 appels directs dans 12 fichiers. Il n'est ni mort ni fermé indirectement par HZ-01 à HZ-07. Toutefois, chaque appel utilise le resolver canonique, qui valide le tenant demandé côté serveur et échoue fermé en cas d'ambiguïté ou de tenant inaccessible. Aucun accès, lecture, mutation ou fallback global indu n'est démontré.

La sévérité P2 « sécurité » n'est donc plus étayée. HZ-09 devient une dette **P3 architecture/fiabilité** : duplication de l'extraction des headers, double résolution sur certaines routes et deux omissions de l'alias `X-Tenant-Id` causant un refus fonctionnel possible.

HZ-09 peut être fermé dans le registre de sécurité et réouvert, si souhaité, sous `ARCH-HZ09-CANONICAL-TENANT-BOUNDARY-1`. Ce futur sprint ne nécessite a priori ni schéma, ni migration, ni frontend/mobile, mais devra préserver RBAC, ownership, ordre Express, PlatformOperator et HZ-08. L'audit horizontal final peut commencer sans hotfix de sécurité HZ-09 préalable ; ne pas le lancer ici.
