import { redirect } from 'next/navigation';

// Sprint B2 — les catégories de chambres sont désormais gérées par
// établissement (/dashboard/hotels/[hotelId]/room-categories). Cette route
// à plat (Sprint 0, préparation de navigation) n'a plus de sens sans
// hotelId — redirige vers la liste des établissements.
export default function Page() {
  redirect('/dashboard/hotels');
}
