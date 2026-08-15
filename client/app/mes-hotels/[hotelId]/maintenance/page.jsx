'use client';
import MaintenanceDashboardPage from '@/lib/pages/dashboard/MaintenanceDashboardPage';
import { useParams } from 'next/navigation';
export default function Page() { const { hotelId } = useParams(); return <MaintenanceDashboardPage initialHotelId={hotelId} />; }
