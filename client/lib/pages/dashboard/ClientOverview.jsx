'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Building2, Calendar, Heart, Home, Hotel, MessageCircle, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardState } from '../../components/dashboard/DashboardUI';

const CLIENT_MODULES = [
  { label: 'Favoris', description: 'Retrouvez les biens enregistrés.', href: '/favoris', Icon: Heart },
  { label: 'Mes visites', description: 'Consultez vos demandes et rendez-vous immobiliers.', href: '/mes-visites', Icon: Calendar },
  { label: 'Mes séjours', description: 'Suivez vos réservations d’hébergement.', href: '/mes-reservations-hotel', Icon: Hotel },
  { label: 'Messages', description: 'Échangez avec les équipes et propriétaires.', href: '/messages', Icon: MessageCircle },
  { label: 'Notifications', description: 'Consultez les informations liées à votre activité.', href: '/mon-compte', Icon: Bell },
  { label: 'Profil', description: 'Gérez vos informations personnelles et votre sécurité.', href: '/profile', Icon: UserRound },
];

export default function ClientOverview() {
  const router = useRouter();
  const { user, loading, businessProfiles, isLocataireProfile } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || businessProfiles === null) return <DashboardState type="loading" title="Préparation de votre espace…" />;
  if (!user) return null;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <DashboardPage>
        <DashboardPageHeader icon={Home} eyebrow="Espace personnel" title={`Bonjour ${user.name?.split(' ')[0] || ''}`.trim()} description="Vos recherches immobilières, séjours et échanges au même endroit." />
        {isLocataireProfile && (
          <DashboardCard className="mb-5 border-blue-200 bg-blue-50">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div><h2 className="font-bold text-blue-950">Votre espace locataire est actif</h2><p className="mt-1 text-sm text-blue-800">Bail, documents et suivi de votre location sont disponibles sans second compte.</p></div>
              <Link href="/espace-locataire" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2">Ouvrir l’espace locataire</Link>
            </div>
          </DashboardCard>
        )}
        <section aria-labelledby="client-modules-title">
          <h2 id="client-modules-title" className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Mon activité</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CLIENT_MODULES.map(({ label, description, href, Icon }) => (
              <Link key={href} href={href} className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                <DashboardCard className="h-full transition hover:border-blue-200 hover:shadow-md">
                  <Icon className="mb-3 text-blue-700" aria-hidden="true" />
                  <h3 className="font-bold text-slate-900">{label}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                </DashboardCard>
              </Link>
            ))}
          </div>
        </section>
        <div className="mt-5 flex items-center gap-2 text-sm text-slate-500"><Building2 size={16} aria-hidden="true" /> Les accès affichés concernent uniquement vos propres activités.</div>
      </DashboardPage>
    </main>
  );
}
