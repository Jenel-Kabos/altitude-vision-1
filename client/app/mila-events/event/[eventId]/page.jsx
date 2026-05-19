import { buildMetadata } from '@/lib/seo';
import EventDetailPage from "@/lib/pages/EventDetailPage";

export async function generateMetadata({ params }) {
  const { eventId } = await params;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/${eventId}`, { next: { revalidate: 60 } });
    if (!res.ok) return buildMetadata({ title: 'Événement', url: `/mila-events/event/${eventId}` });
    const event = await res.json();
    return buildMetadata({
      title: event.title,
      description: event.description?.slice(0, 155),
      image: event.images?.[0],
      url: `/mila-events/event/${eventId}`,
    });
  } catch {
    return buildMetadata({ title: 'Événement', url: `/mila-events/event/${eventId}` });
  }
}

export default function Page() {
  return <EventDetailPage />;
}
