'use client';
import HousekeepingDashboardPage from '@/lib/pages/dashboard/HousekeepingDashboardPage';
import { useParams } from 'next/navigation';
export default function Page() { const { hotelId } = useParams(); return <HousekeepingDashboardPage initialHotelId={hotelId} />; }
