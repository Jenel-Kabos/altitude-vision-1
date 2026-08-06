import { Suspense } from 'react';
import CrmCustomersPage from '../../../lib/pages/dashboard/CrmCustomersPage';
export default function Page() { return <Suspense fallback={<main className="p-6">Chargement du CRM…</main>}><CrmCustomersPage /></Suspense>; }
