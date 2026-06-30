import { buildMetadata, SITE_URL } from '@/lib/seo';
import EventDetailPage from "@/lib/pages/EventDetailPage";
import JsonLd from "@/lib/components/JsonLd";

async function getEvent(id) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/events/${id}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.event || json;
  } catch { return null; }
}

export async function generateMetadata({ params }) {
  const { eventId } = await params;
  const event = await getEvent(eventId);
  if (!event) return buildMetadata({ title: 'Événement — Mila Events', url: `/evenementiel/event/${eventId}` });
  return buildMetadata({
    title:       `${event.name || event.title} — Mila Events`,
    description: event.description?.slice(0, 155),
    image:       event.images?.[0],
    url:         `/evenementiel/event/${eventId}`,
  });
}

export default async function Page({ params }) {
  const { eventId } = await params;
  const event = await getEvent(eventId);

  const schemas = [];

  if (event) {
    const name = event.name || event.title;
    const images = (event.images || [])
      .filter(Boolean)
      .map(img => img.startsWith('http') ? img : `${SITE_URL}${img}`);

    schemas.push({
      "@context":   "https://schema.org",
      "@type":      "Event",
      name,
      description:  event.description,
      url:          `${SITE_URL}/evenementiel/event/${eventId}`,
      image:        images,
      eventStatus:  "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      ...(event.date && { startDate: new Date(event.date).toISOString() }),
      location: {
        "@type": "Place",
        name:    event.location || "Brazzaville",
        address: {
          "@type":         "PostalAddress",
          addressLocality: "Brazzaville",
          addressCountry:  "CG",
        },
      },
      organizer: {
        "@type": "Organization",
        name:    "Mila Events — Altitude-Vision",
        url:     `${SITE_URL}/evenementiel`,
      },
      ...(event.category && { keywords: event.category }),
    });

    schemas.push({
      "@context":     "https://schema.org",
      "@type":        "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil",        item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Événementiel",   item: `${SITE_URL}/evenementiel` },
        { "@type": "ListItem", position: 3, name: "Événements",     item: `${SITE_URL}/evenementiel/annonces` },
        { "@type": "ListItem", position: 4, name, item: `${SITE_URL}/evenementiel/event/${eventId}` },
      ],
    });
  }

  return (
    <>
      {schemas.length > 0 && <JsonLd schemas={schemas} />}
      <EventDetailPage />
    </>
  );
}
