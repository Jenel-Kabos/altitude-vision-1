# HZ-09 — Finding original

## Sources historiques

- `HOTFIX_TENANT_SCOPE_HORIZONTAL_AUDIT1_FINDING_MATRIX.md` : « résolution inline de headers dans plusieurs contrôleurs/routes » ; risque « drift et omission future » ; surface « transversal » ; remède envisagé « centralisation » ; preuve « multiples appels resolveTenantForUser hors middleware » ; sévérité P2.
- `HOTFIX_TENANT_SCOPE_HORIZONTAL_AUDIT1_PRIORITY_MATRIX.md` : « HZ-09 drift inline », P2, impact indirect/futur, « adoption progressive canonical resolver ».
- `HOTFIX_TENANT_SCOPE_HORIZONTAL_REAUDIT2_FINDING_INVENTORY.md` : « Cross-domain drift », pattern vivant, STILL_OPEN.
- `HOTFIX_TENANT_SCOPE_HORIZONTAL_REAUDIT2_OPEN_FINDINGS.md` : risque de drift/omission future, aucune vulnérabilité unique démontrée.

## Lecture exacte

HZ-09 n'est ni une route ni un contournement A→B identifié. C'est la dispersion de l'extraction d'en-têtes et des appels au resolver dans plusieurs couches, susceptible de diverger du middleware canonique. La classification originale P2 était préventive : surface transversale et risque de future omission, pas impact runtime déjà prouvé.
