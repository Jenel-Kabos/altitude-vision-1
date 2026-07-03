"use client";

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const COLLAB_ROLES = ['Collaborateur','Secretaire','GestionnaireImmobilier','CommunityManager','Communicant'];

const getTargetPath = (role) => {
  if (role === 'Admin' || COLLAB_ROLES.includes(role)) return '/dashboard';
  if (role === 'Proprietaire') return '/mes-biens';
  return '/';
};

export default function GoogleRedirectPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }

    const role = session?.user?.role;
    const target = getTargetPath(role);
    router.replace(target);
  }, [status, session, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="animate-spin w-10 h-10 text-blue-500 mx-auto mb-3" />
        <p className="text-sm text-gray-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Connexion en cours…
        </p>
      </div>
    </div>
  );
}
