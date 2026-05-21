import "./globals.css";
import AppProviders from "./AppProviders";
import ClientLayout from "./ClientLayout";
import JsonLd from "@/lib/components/JsonLd";
import { buildMetadata, SITE_URL } from "@/lib/seo";

export const metadata = {
  ...buildMetadata({
    title: "Immobilier, Événements & Communication à Brazzaville",
    description: "Altitude-Vision — Trouvez votre bien immobilier, organisez vos événements et boostez votre communication à Brazzaville, Congo.",
    url: "/",
  }),
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
  description: "Agence Altitude-Vision — Immobilier, Événements et Communication à Brazzaville.",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  image: `${SITE_URL}/og-default.jpg`,
  telephone: "+242 05 330 16 75",
  email: "contact@altitudevision.agency",
  address: {
    "@type": "PostalAddress",
    streetAddress: "24 Rue de Mfoa, Poto-Poto",
    addressLocality: "Brazzaville",
    addressCountry: "CG",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: -4.2634,
    longitude: 15.2429,
  },
  areaServed: { "@type": "City", name: "Brazzaville" },
  openingHoursSpecification: [
    { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday"], opens: "08:30", closes: "17:30" },
    { "@type": "OpeningHoursSpecification", dayOfWeek: ["Saturday"], opens: "09:00", closes: "12:00" },
  ],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Services Altitude-Vision",
    itemListElement: [
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Altimmo — Immobilier" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Altcom — Communication & Business" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Mila Events — Organisation d'événements" } },
    ],
  },
  sameAs: [
    "https://www.facebook.com/profile.php?id=61558493665509",
    "https://www.instagram.com/immoaltitudevision/",
    "https://wa.me/242068002151",
  ],
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
