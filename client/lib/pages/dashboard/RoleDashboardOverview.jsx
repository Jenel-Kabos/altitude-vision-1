'use client';

import Link from 'next/link';
import { ArrowRight, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { hasStaffCapability } from '../../utils/staffCapabilities';
import { getProfileDashboard, getVisibleProfileModules } from '../../navigation/dashboardProfiles';
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardState } from '../../components/dashboard/DashboardUI';

export default function RoleDashboardOverview() {
  const { user } = useAuth();
  const dashboard = getProfileDashboard(user?.role);
  const modules = getVisibleProfileModules(user?.role, capability => hasStaffCapability(user, capability));

  if (!dashboard) {
    return <DashboardState title="Dashboard indisponible" description="Aucune vue métier n’est configurée pour ce profil." />;
  }

  return (
    <DashboardPage>
      <DashboardPageHeader icon={LayoutDashboard} eyebrow={dashboard.eyebrow} title={dashboard.title} description={dashboard.description} />
      <section aria-labelledby="dashboard-modules-title">
        <h2 id="dashboard-modules-title" className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Mes modules</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map(module => (
            <DashboardCard key={module.href} className="flex min-h-44 flex-col">
              <h3 className="text-lg font-bold text-slate-900">{module.label}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{module.description}</p>
              <Link href={module.href} className="mt-4 inline-flex min-h-11 items-center gap-2 self-start rounded-lg px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                Ouvrir <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </DashboardCard>
          ))}
        </div>
      </section>
      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        Les actions disponibles dans chaque module restent contrôlées par les permissions serveur IAM-3.
      </div>
    </DashboardPage>
  );
}
