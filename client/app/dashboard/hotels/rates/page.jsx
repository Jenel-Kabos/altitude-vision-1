import { redirect } from 'next/navigation';

// Sprint B2 — les tarifs sont désormais gérés par établissement
// (/dashboard/hotels/[hotelId]/rates). Cette route à plat (Sprint 0,
// préparation de navigation) n'a plus de sens sans hotelId — redirige vers
// la liste des établissements.
export default function Page() {
  redirect('/dashboard/hotels');
}
