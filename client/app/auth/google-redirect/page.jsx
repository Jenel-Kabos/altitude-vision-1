"use client";

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { getPostAuthDestination } from '../../../lib/navigation/postAuthDestination';

export default function GoogleRedirectPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }

    if (!session) return;

    // Nouveau compte → compléter le profil (téléphone, rôle, certifications)
    if (session.user?.isNewUser) {
      router.replace('/completer-profil');
      return;
    }

    // HOTFIX-AUTH-POSTLOGIN-ROUTING-1 — réutilise l'unique résolveur canonique
    // (déjà consommé par LoginPage/RegisterPage/VerifyEmailPage) au lieu d'une
    // logique locale dupliquée qui envoyait Proprietaire directement vers
    // /mes-biens (court-circuitant resolveOwnerDestination/le chooser
    // multi-profil) et Client/legacy vers /altimmo/annonces au lieu de
    // /mon-espace ou /. Voir server/docs/HOTFIX_AUTH_POSTLOGIN_ROUTING1_ROUTE_MATRIX.md.
    const target = getPostAuthDestination(session?.user);
    router.replace(target);
  }, [status, session, router]);

  if (status === 'unauthenticated') return null;

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
