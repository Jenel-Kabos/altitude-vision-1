"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useAuth } from '@/lib/context/AuthContext';
import AdminDashboard from "@/lib/pages/dashboard/AdminDashboard";
import { Loader2 } from 'lucide-react';
import './dashboard.css';

const ALLOWED_ROLES = [
  'Admin',
  'Collaborateur',          // legacy
  'Secretaire',
  'GestionnaireImmobilier',
  'CommunityManager',
  'Communicant',
];

const REDIRECT_BY_ROLE = {
  Proprietaire: '/mes-biens',
  Prestataire:  '/',
  Client:       '/',
};

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { data: session, status: sessionStatus } = useSession();

  // Resolve role from either auth system (email/password or Google OAuth)
  const role = user?.role ?? session?.user?.role;
  const isLoading = authLoading || sessionStatus === 'loading';
  // Utiliser uniquement user (JWT local) pour décider de l'accès
  // sessionStatus 'authenticated' (Google OAuth) sans user local → redirection login
  const isAuthenticated = !!user;

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (role && !ALLOWED_ROLES.includes(role)) {
      router.replace(REDIRECT_BY_ROLE[role] ?? '/');
    }
  }, [isLoading, isAuthenticated, role, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin w-10 h-10 text-blue-500" />
      </div>
    );
  }

  if (!isAuthenticated || (role && !ALLOWED_ROLES.includes(role))) {
    return null;
  }

  return <AdminDashboard>{children}</AdminDashboard>;
}
