# HOTFIX-DASHBOARD-DARK-MODE-UI-1 — Accessibilité

## Cibles

- Texte principal clair sur surfaces sombres, texte secondaire au minimum `slate-300/400` conceptuellement.
- Focus visible bleu sur champs, boutons et régions scrollables.
- Placeholders lisibles mais distincts des valeurs.
- États disabled reconnaissables par opacité et curseur, jamais uniquement par couleur.
- Badges success/warning/error/info avec texte et fond différenciés.
- Bordures discrètes mais visibles sur cards, tableaux et champs.
- Respect de `prefers-reduced-motion` déjà présent.

## Contrôles

La vérification automatisée couvre la présence des titres/actions critiques et la stabilité structurelle sous conteneur sombre. Une validation navigateur Light/Dark reste nécessaire pour revendiquer une certification visuelle complète.
