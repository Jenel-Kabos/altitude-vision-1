'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Home, Palmtree } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { resolveOwnerContexts, resolveOwnerDestination } from '../../navigation/ownerContext';
import { getPostAuthDestination } from '../../navigation/postAuthDestination';

const LoadingShell = ({ children }) => (
  <main className="min-h-screen bg-[#FAF8F5] flex items-center justify-center px-4 py-16">
    <p className="text-sm text-[#8C7B6E]">{children}</p>
  </main>
);

const WorkspaceCard = ({ href, icon: Icon, title, description, accentText, hoverBorderClass, accentBg, ariaLabel }) => (
  <Link
    href={href}
    aria-label={ariaLabel}
    className={`group relative flex h-full flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 sm:p-7 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${hoverBorderClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2E7BB5]`}
  >
    <div>
      <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${accentBg} ${accentText}`}>
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <h2 className="mt-4 text-xl font-semibold text-[#2A241D]">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">{description}</p>
    </div>
    <span className={`mt-6 inline-flex items-center gap-1.5 text-sm font-semibold ${accentText}`}>
      Accéder à cet espace
      <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </span>
  </Link>
);

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
    return <LoadingShell>Résolution de vos espaces métier…</LoadingShell>;
  }
  if (!user || user.role !== 'Proprietaire') return null;

  if (!contexts.hasRealEstate && !contexts.hasAccommodation) {
    return (
      <main className="min-h-screen bg-[#FAF8F5] px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
            <Home aria-hidden="true" className="h-5 w-5" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold text-[#2A241D]">Aucun espace propriétaire actif</h1>
          <p className="mt-3 text-sm text-gray-600">Ajoutez un premier bien ou complétez votre profil pour ouvrir un espace métier.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAF8F5] px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 sm:mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2E7BB5]">Compte multi-activité</p>
          <h1 className="mt-2 font-serif text-3xl sm:text-4xl font-semibold leading-tight text-[#2A241D]">
            Choisissez votre espace de travail
          </h1>
          <p className="mt-3 max-w-2xl text-sm sm:text-base text-gray-600">
            Votre compte regroupe plusieurs activités. Chaque espace conserve ses propres ressources, données et permissions.
          </p>
        </header>

        <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
          <WorkspaceCard
            href="/mes-biens"
            icon={Home}
            title="Patrimoine immobilier"
            description="Biens, annonces, visites, gestion locative et suivi patrimonial."
            accentText="text-[#2E7BB5]"
            hoverBorderClass="hover:border-[#2E7BB5]/40"
            accentBg="bg-[#2E7BB5]/10"
          />
          <WorkspaceCard
            href="/mes-hotels"
            icon={Palmtree}
            title="Exploitation d’établissements"
            description="Maisons meublées, hôtels, réservations et opérations."
            accentText="text-[#C8960C]"
            hoverBorderClass="hover:border-[#C8960C]/40"
            accentBg="bg-[#C8960C]/10"
          />
        </div>
      </div>
    </main>
  );
}
