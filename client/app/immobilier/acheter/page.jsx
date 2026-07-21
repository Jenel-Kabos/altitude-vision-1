import { redirect } from 'next/navigation';

// Sprint 0 (architecture Altimmo) — route "vanity" pour la navigation
// publique restructurée (Acheter/Louer/Séjourner). Réutilise entièrement le
// listing existant (AltimmoAnnonces, filtre ?status= déjà supporté) — voir
// server/docs/ARCHITECTURE_ALTIMMO_V2.md.
export default function Page() {
  redirect('/immobilier/annonces?status=vente');
}
