'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, Home, Palmtree } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { resolveOwnerContexts, resolveOwnerDestination } from '../../navigation/ownerContext';
import { getPostAuthDestination } from '../../navigation/postAuthDestination';
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardState } from '../../components/dashboard/DashboardUI';

export default function OwnerContextLanding() {
  const router = useRouter();
  const { user, loading, businessProfiles } = useAuth();
  const destination = businessProfiles === null ? null : resolveOwnerDestination(businessProfiles);
  const contexts = resolveOwnerContexts(businessProfiles || []);

  useEffect(() => {
    if (loading || businessProfiles === null) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'Proprietaire') { router.replace(getPostAuthDestination(user)); return; }
    if (destination) router.replace(destination);
  }, [loading, businessProfiles, user, destination, router]);

  if (loading || businessProfiles === null || destination) {
    return <DashboardState type="loading" title="Résolution de vos espaces métier…" />;
  }
  if (!user || user.role !== 'Proprietaire') return null;

  if (!contexts.hasRealEstate && !contexts.hasAccommodation) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
        <DashboardPage><DashboardState icon={Home} title="Aucun espace propriétaire actif" description="Ajoutez un premier bien ou complétez votre profil pour ouvrir un espace métier." /></DashboardPage>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <DashboardPage>
        <DashboardPageHeader icon={Building2} eyebrow="Compte multi-activité" title="Choisissez votre espace de travail" description="Votre compte regroupe plusieurs activités. Chaque espace conserve ses propres ressources et permissions." />
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/mes-biens" className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            <DashboardCard className="h-full transition hover:border-blue-200 hover:shadow-md"><Home className="mb-3 text-blue-700" aria-hidden="true" /><h2 className="text-lg font-bold">Patrimoine immobilier</h2><p className="mt-2 text-sm text-slate-600">Biens, annonces, visites, gestion locative et suivi patrimonial.</p></DashboardCard>
          </Link>
          <Link href="/mes-hotels" className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600">
            <DashboardCard className="h-full transition hover:border-amber-200 hover:shadow-md"><Palmtree className="mb-3 text-amber-700" aria-hidden="true" /><h2 className="text-lg font-bold">Exploitation d’établissements</h2><p className="mt-2 text-sm text-slate-600">Maisons meublées, hôtels, réservations et opérations.</p></DashboardCard>
          </Link>
        </div>
      </DashboardPage>
    </main>
  );
}
