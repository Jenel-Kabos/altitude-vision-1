# HZ-09 — Options

| Option | Gain | Risque / blast radius | Compatibilité / tests | Décision |
|---|---|---|---|---|
| A KEEP AS-IS | aucun churn | dérive future reste possible | comportement actuel conservé | rejetée comme clôture définitive |
| B Minimal security hotfix | corrigerait une faille ciblée | aucune faille HZ-09 démontrée | hotfix injustifié | rejetée |
| C Replace with canonical boundary | uniformité, enrichissement unique | large surface, ordre Express et self-service sensibles | sprint séparé + tests par domaine | recommandée à terme |
| D Remove dead/legacy path | simplification | références toutes LIVE | incompatible | rejetée |
| E Deprecate gradually | migration sûre des 15 appels | dette temporaire maintenue | compatibilité élevée | viable dans sprint architecture |
| F DEFER | évite churn maintenant | conserve dette fiabilité P3 | acceptable après tests actuels | compatible avec reclassification |
| G Already fixed | fermeture administrative | faux : 15 appels subsistent | HZ-01→07 seulement partiels | rejetée |

Recommandation : reclassifier en dette architecture/fiabilité P3, puis canonicaliser progressivement hors urgence de sécurité.
