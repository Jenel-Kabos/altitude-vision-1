import { redirect } from 'next/navigation';

// Sprint 0 (architecture Altimmo) — route "vanity", voir /immobilier/acheter.
export default function Page() {
  redirect('/immobilier/annonces?status=location');
}
