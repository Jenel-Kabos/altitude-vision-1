# ARCH-2C1 — Matrice sécurité

| Surface | Résultat |
|---|---|
| Tenant | Inchangé; contrôles avant streaming conservés dans chaque contrôleur |
| Ownership/participation | Inchangé; aucune vérification déplacée |
| IAM/RBAC | Inchangé; routes et middleware intacts |
| PlatformOperator | Inchangé |
| Finance | Logique intacte; seul le téléchargement legacy d'une preuve utilise le service extrait |
| Property | Inchangé |
| Notification/CRM | Intacts; correction ARCH-2B non touchée |
| SSRF | Surface non élargie : validation HTTP(S) strictement identique, pas de fetch générique |
| Headers privés | Identiques |
| Logs | Événements, contexte et messages identiques |
| Provider | Aucun appel réel ajouté; aucune configuration provider modifiée |
| Base de production | Aucune mutation |
| API publique/HTTP | Routes, payloads, statuts et messages inchangés |
| Frontend/mobile | Intacts |
