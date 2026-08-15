'use client';
import HotelFinanceDashboardPage from '@/lib/pages/dashboard/HotelFinanceDashboardPage';
import { useParams } from 'next/navigation';
export default function Page() { const { hotelId } = useParams(); return <HotelFinanceDashboardPage initialHotelId={hotelId} />; }
