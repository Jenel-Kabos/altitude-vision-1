# ARCH-2I — Scorecard

| Candidate | Gain | Cohesion | Security Risk | Business Risk | Blast Radius | Testability | Verdict |
|---|---|---|---|---|---|---|---|
| Estimation request/inbox | LOW | MEDIUM | MEDIUM | HIGH | HIGH | MEDIUM | DEFER |
| Realisation route non montée | LOW | HIGH | LOW runtime / HIGH lifecycle | MEDIUM | LOW runtime | LOW | REMOVE-AS-DEAD-CODE-LATER |
| Projet route cassée non montée | LOW | LOW | LOW runtime / HIGH unknown intent | MEDIUM | LOW runtime | LOW | REMOVE-AS-DEAD-CODE-LATER |

Estimation est la seule dette applicative vivante. Son edge mélange soumission publique, upload privé Cloudinary, normalisation, calcul de complétude, persistance, notifications, deux emails et une inbox staff dont la lecture écrit `staffViewedAt`. Une extraction serait étroite seulement en séparant au moins `estimationSubmissionApplicationService` et `estimationInboxService`, donc pas un quick win mono-responsabilité.

Les deux routes mortes pourraient faire l'objet d'un audit/sprint de retrait commun, mais réduire deux lignes de baseline ne justifie pas de devancer une dette active. Aucune cible route→model n'obtient `RECOMMEND`.
