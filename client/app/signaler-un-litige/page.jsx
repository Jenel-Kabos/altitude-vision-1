import { Suspense } from 'react';
import { buildMetadata } from '@/lib/seo';
import SignalerLitigePage from '@/lib/pages/SignalerLitigePage';

export const metadata = buildMetadata({
  title:       'Signaler un problème — Altitude Vision',
  description: 'Signalez un problème avec un bien ou une transaction. Notre équipe intervient sous 48h.',
  noIndex:     true,
});

export default function Page() {
  return (
    <Suspense>
      <SignalerLitigePage />
    </Suspense>
  );
}
