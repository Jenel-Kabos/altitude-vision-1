import { redirect } from 'next/navigation';

// DOC-ARCH-1 — l'écran documentaire indépendant de la Gestion Locative est
// retiré (un seul Centre documentaire pour toute la plateforme, voir
// /dashboard/documents). Cette route reste montée uniquement pour que les
// anciens liens/favoris (y compris ?contratId=...) redirigent automatiquement
// vers le Centre documentaire déjà filtré, sans jamais devenir invalides.
export default async function Page({ searchParams }) {
  const params = await searchParams;
  const contratId = params?.contratId;
  const query = new URLSearchParams({ pole: 'Altimmo', service: 'gestion_locative' });
  if (contratId) query.set('contratId', String(contratId));
  redirect(`/dashboard/documents?${query.toString()}`);
}
