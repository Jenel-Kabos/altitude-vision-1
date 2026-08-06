import CrmCustomer360Page from '../../../../lib/pages/dashboard/CrmCustomer360Page';
export default async function Page({ params }) { const { id } = await params; return <CrmCustomer360Page customerId={id} />; }
