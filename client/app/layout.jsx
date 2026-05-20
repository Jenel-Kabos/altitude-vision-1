import "./globals.css";
import AppProviders from "./AppProviders";
import ClientLayout from "./ClientLayout";
import JsonLd from "@/lib/components/JsonLd";

export const metadata = {
  title: "Altitude-Vision",
  description: "Agence Altitude-Vision — Immobilier, Événements et Communication à Brazzaville.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

const LOCAL_BUSINESS_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Altitude-Vision",
  description:
    "Agence Altitude-Vision — Immobilier, Événements et Communication à Brazzaville.",
  url: "https://altitude-vision.com",
  logo: "https://altitude-vision.com/logo.png",
  image: "https://altitude-vision.com/logo.png",
  telephone: "+242 00 000 000",
  email: "contact@altitude-vision.com",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Brazzaville",
    addressLocality: "Brazzaville",
    addressCountry: "CG",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: -4.2634,
    longitude: 15.2429,
  },
  areaServed: {
    "@type": "City",
    name: "Brazzaville",
  },
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Services Altitude-Vision",
    itemListElement: [
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Altimmo — Immobilier" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Altcom — Communication & Business" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Mila Events — Organisation d'événements" } },
    ],
  },
  sameAs: [],
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <JsonLd schemas={[LOCAL_BUSINESS_SCHEMA]} />
        <AppProviders>
          <ClientLayout>
            {children}
          </ClientLayout>
        </AppProviders>
      </body>
    </html>
  );
}
